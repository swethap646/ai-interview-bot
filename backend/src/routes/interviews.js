const express = require('express');
const router = express.Router();
const Interview = require('../models/Interview');
const { evaluateSession } = require('../services/aiService');
const { buildInterviewGraph } = require('../services/interviewGraph');

// Cached compiled graph (so we don't rebuild on every request)
const interviewGraph = buildInterviewGraph();

/**
 * POST /api/interviews/evaluate
 * Saves the interview session and provides AI evaluation.
 * Body: { topic, mode, messages, questions }
 */
router.post('/evaluate', async (req, res) => {
  try {
    const { topic, mode, questions: rawQuestions, messages } = req.body;

    // Normalize data: we want an array of objects { questionText, transcript, ... }
    let normalizedQuestions = [];

    if (Array.isArray(rawQuestions) && rawQuestions.length > 0) {
      // If they are objects, use them. If they are strings, convert them.
      normalizedQuestions = rawQuestions.map((q, idx) => {
        if (typeof q === 'string') {
          return {
            questionId: idx + 1,
            questionText: q,
            answerType: mode || 'chat',
            transcript: 'No transcript provided' // Fallback
          };
        }
        return q;
      });
    } else if (Array.isArray(messages) && messages.length > 0) {
      // Convert chat messages (assistant/user pairs) into question/transcript objects
      for (let i = 0; i < messages.length; i++) {
        if (messages[i].role === 'assistant') {
          const nextMsg = messages[i + 1];
          normalizedQuestions.push({
            questionId: normalizedQuestions.length + 1,
            questionText: messages[i].content,
            answerType: 'chat',
            transcript: (nextMsg && nextMsg.role === 'user') ? nextMsg.content : 'No answer provided'
          });
          if (nextMsg && nextMsg.role === 'user') i++; // Skip the user message as we've paired it
        }
      }
    }

    if (!topic || normalizedQuestions.length === 0) {
      return res.status(400).json({ error: 'Missing required session data (topic and questions/messages)' });
    }

    console.log(`[HTTP] Evaluating ${mode} interview for ${topic} (${normalizedQuestions.length} questions)...`);

    // 1. Perform AI Evaluation
    const evaluation = await evaluateSession(topic, normalizedQuestions);

    // 2. Save to Database
    const newInterview = new Interview({
      topic,
      mode,
      questions: normalizedQuestions,
      score: evaluation.score,
      feedback: evaluation.feedback,
      metrics: evaluation.metrics,
      strengths: evaluation.strengths,
      weaknesses: evaluation.weaknesses,
      recommendations: evaluation.recommendations,
      status: 'evaluated'
    });

    console.log(`[DB] Saving new interview record...`);
    const saved = await newInterview.save();
    console.log(`[DB] Interview saved with ID: ${saved._id}`);

    // 3. Fire Make.com Webhook (non-blocking - doesn't delay the response)
    if (process.env.MAKE_WEBHOOK_URL) {
      const webhookPayload = {
        interview_id: saved._id.toString(),
        topic,
        mode,
        score: evaluation.score,
        feedback: evaluation.feedback,
        metrics: evaluation.metrics,
        strengths: evaluation.strengths,
        recommendations: evaluation.recommendations,
        timestamp: new Date().toISOString(),
      };

      // Fire-and-forget: don't await so the response isn't delayed
      fetch(process.env.MAKE_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(webhookPayload),
      })
        .then(() => console.log(`[Webhook] Make.com notified for interview ${saved._id}`))
        .catch((err) => console.warn(`[Webhook] Make.com dispatch failed (non-critical):`, err.message));
    } else {
      console.log('[Webhook] MAKE_WEBHOOK_URL not set — skipping automation trigger.');
    }

    res.json(saved);
  } catch (error) {
    console.error('Error in save-and-evaluate:', error);
    res.status(500).json({ error: 'Failed to evaluate interview' });
  }
});

/**
 * GET /api/interviews/:id
 * Fetches result of a specific interview.
 */
router.get('/:id', async (req, res) => {
  try {
    const interview = await Interview.findById(req.params.id);
    if (!interview) return res.status(404).json({ error: 'Interview not found' });
    res.json(interview);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch interview' });
  }
});

/**
 * POST /api/interviews/graph
 * LangGraph-powered stateful interview turn.
 * Body: { topic, questionIndex, allQuestions, userAnswer, maxQuestions, resumeContext }
 * Returns: { currentQuestion, answerQuality, nextAction, questionIndex, conclusion }
 */
router.post('/graph', async (req, res) => {
  try {
    const {
      topic = 'general',
      questionIndex = 0,
      allQuestions = [],
      currentQuestion = '',
      userAnswer = '',
      maxQuestions = 5,
      resumeContext = '',
      isRetry = false,
      conversationHistory = [],
    } = req.body;

    console.log(`[Graph Turn] QIdx: ${questionIndex} | HistoryLen: ${conversationHistory.length} | isRetry: ${isRetry}`);

    const result = await interviewGraph.invoke({
      topic,
      questionIndex,
      allQuestions,
      currentQuestion,
      userAnswer,
      maxQuestions,
      resumeContext,
      isRetry,
      conversationHistory,
    });

    res.json({
      currentQuestion: result.currentQuestion,
      answerQuality: result.answerQuality,
      nextAction: result.nextAction,
      questionIndex: result.questionIndex,
      isRetry: result.isRetry,
      conversationHistory: result.conversationHistory,
      conclusion: result.conclusion || null,
    });
  } catch (error) {
    console.error('[Graph Route] Error:', error);
    res.status(500).json({ error: 'LangGraph turn failed', details: error.message });
  }
});

module.exports = router;
