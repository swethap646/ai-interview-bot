const express = require('express');
const router = express.Router();
const { evaluateAnswer } = require('../services/aiService');

/**
 * POST /api/evaluate
 * Body: { question: string, transcript: string }
 * Returns AI feedback/score for a given interview answer.
 */
router.post('/', async (req, res) => {
  const { question, transcript } = req.body;

  if (!question || !transcript) {
    return res.status(400).json({ error: 'question and transcript are required' });
  }

  try {
    const result = await evaluateAnswer(question, transcript);
    res.json({
      score: result.score,
      feedback: result.feedback,
      question,
      transcript
    });
  } catch (err) {
    console.error('Error in evaluation route:', err);
    res.status(500).json({ error: 'Evaluation failed', detail: err.message });
  }
});

module.exports = router;
