/**
 * interviewGraph.js
 * ─────────────────────────────────────────────────────────────────
 * LangGraph-powered Interview State Machine.
 *
 * DESIGN: Single-pass per request (stateless per HTTP turn).
 * Each API call processes ONE question-answer cycle:
 *   1. generate_question → picks the current question
 *   2. evaluate_answer   → grades the user's answer
 *   3. decide_next       → decides next action (next_question | conclude)
 *
 * The frontend holds and advances the state between turns.
 * ─────────────────────────────────────────────────────────────────
 */

const { StateGraph, Annotation } = require('@langchain/langgraph');
const { ChatGroq } = require('@langchain/groq');

// ── LLM Setup ────────────────────────────────────────────────────
const llm = new ChatGroq({
  apiKey: process.env.GROQ_API_KEY,
  model: 'llama-3.3-70b-versatile',
  temperature: 0.7,
});

const jsonLlm = new ChatGroq({
  apiKey: process.env.GROQ_API_KEY,
  model: 'llama-3.3-70b-versatile',
  temperature: 0.5,
  modelKwargs: { response_format: { type: 'json_object' } },
});

// ── State Schema ─────────────────────────────────────────────────
const InterviewStateAnnotation = Annotation.Root({
  topic: Annotation({ reducer: (_, v) => v, default: () => 'general' }),
  resumeContext: Annotation({ reducer: (_, v) => v, default: () => '' }),
  allQuestions: Annotation({ reducer: (_, v) => v, default: () => [] }),
  currentQuestion: Annotation({ reducer: (_, v) => v, default: () => '' }),
  questionIndex: Annotation({ reducer: (_, v) => v, default: () => 0 }),
  userAnswer: Annotation({ reducer: (_, v) => v, default: () => '' }),
  answerQuality: Annotation({ reducer: (_, v) => v, default: () => 'none' }),
  answerFeedback: Annotation({ reducer: (_, v) => v, default: () => '' }),
  nextAction: Annotation({ reducer: (_, v) => v, default: () => 'next' }),
  isRetry: Annotation({ reducer: (_, v) => v, default: () => false }),
  conversationHistory: Annotation({ reducer: (prev, next) => prev.concat(next), default: () => [] }),
  conclusion: Annotation({ reducer: (_, v) => v, default: () => '' }),
  maxQuestions: Annotation({ reducer: (_, v) => v, default: () => 5 }),
});

// ── Node 1: evaluate_answer ───────────────────────────────────────
async function evaluateAnswer(state) {
  const qIdx = state.questionIndex;
  console.log(`[Graph] evaluate_answer | QIdx: ${qIdx} | History: ${state.conversationHistory.length}`);

  let currentQ = state.currentQuestion;

  // Safety: Recover question from history if missing
  if (!currentQ || currentQ.trim() === '') {
    const lastAI = [...state.conversationHistory].reverse().find(m => m.role === 'assistant');
    currentQ = lastAI ? lastAI.content : '';
  }

  // If truly first turn (no question yet)
  if (!currentQ || currentQ.trim() === '') {
    return { answerQuality: 'none' };
  }

  // If no user answer provided or very short gibberish
  const cleanAnswer = (state.userAnswer || '').trim();
  if (!cleanAnswer || cleanAnswer === '__SKIP__' || cleanAnswer.length < 2) {
    return {
      answerQuality: 'missed',
      answerFeedback: 'The response was too short or missing.',
      currentQuestion: currentQ,
      conversationHistory: [{ role: 'user', content: cleanAnswer || '[No answer provided]' }]
    };
  }

  const historyUpdate = [{ role: 'user', content: state.userAnswer }];

  try {
    const res = await jsonLlm.invoke([
      {
        role: 'system',
        content: `You are a technical interview evaluator. 
        Evaluate if the user's answer is relevant to the question.
        
        QUALITY LEVELS:
        - "perfect": Accurate and relevant.
        - "partial": Relevant but missing details or slightly off.
        - "missed": Completely irrelevant, gibberish (e.g. "asdf", "jkjkn"), or clearly dodging the question.
        
        Output ONLY valid JSON: {"quality": "perfect"|"partial"|"missed", "feedback": "one sentence"}`
      },
      {
        role: 'user',
        content: `Question: "${currentQ}"\nCandidate Answer: "${state.userAnswer}"`
      },
    ]);

    const cleaned = res.content.replace(/```json\n?|\n?```/g, '').trim();
    const parsed = JSON.parse(cleaned);

    console.log(`[Graph] evaluation result | Quality: ${parsed.quality}`);

    return {
      answerQuality: parsed.quality || 'missed',
      answerFeedback: parsed.feedback || '',
      currentQuestion: currentQ,
      conversationHistory: historyUpdate
    };
  } catch (err) {
    console.error('[Graph] Evaluation parse failed, defaulting to partial.', err);
    return {
      answerQuality: 'partial',
      answerFeedback: 'Received your answer.',
      currentQuestion: currentQ,
      conversationHistory: historyUpdate
    };
  }
}

// ── Node 2: decide_next ───────────────────────────────────────────
async function decideNext(state) {
  const qIdx = state.questionIndex;
  const maxQ = state.maxQuestions;

  // Strict check: if we've reached the limit, conclude.
  const isLast = qIdx >= maxQ - 1;

  console.log(`[Graph] decide_next | QIdx: ${qIdx} | maxQ: ${maxQ} | Quality: ${state.answerQuality} | isRetry: ${state.isRetry}`);

  // If quality is missed and we haven't retried this specific question yet
  if (state.answerQuality === 'missed' && !state.isRetry && !isLast) {
    console.log(`[Graph] decide_next -> RETRY (Index: ${qIdx})`);
    return { nextAction: 'next', isRetry: true, questionIndex: qIdx };
  }

  if (isLast) {
    console.log(`[Graph] decide_next -> CONCLUDE`);
    return { nextAction: 'conclude' };
  }

  // Progress to next question
  const nextIdx = qIdx + 1;
  console.log(`[Graph] decide_next -> NEXT (Index: ${nextIdx})`);
  return { nextAction: 'next', questionIndex: nextIdx, isRetry: false };
}

// ── Node 3: generate_question ─────────────────────────────────────
async function generateQuestion(state) {
  const asked = state.conversationHistory
    .filter(m => m.role === 'assistant')
    .map(m => m.content.toLowerCase().trim());

  console.log(`[Graph] generate_question | Index: ${state.questionIndex} | isRetry: ${state.isRetry}`);
  console.log(`[Graph] History Length: ${state.conversationHistory.length}`);
  console.log(`[Graph] Asked Questions so far: ${asked.length}`);

  // If it's a retry, ask the SAME question but with a polite nudge
  if (state.isRetry) {
    const lastQ = state.currentQuestion;
    const retryMsg = `I didn't quite catch that. Could you please provide a more detailed answer to the question: "${lastQ}"?`;
    return { currentQuestion: retryMsg, conversationHistory: [{ role: 'assistant', content: retryMsg }] };
  }

  // Fetch pre-defined (Resume flow)
  if (state.allQuestions.length > 0 && state.questionIndex < state.allQuestions.length) {
    let idx = state.questionIndex;
    const q = state.allQuestions[idx];
    // Only return if not already asked in this exact session
    if (q && !asked.includes(q.toLowerCase().trim())) {
      return { currentQuestion: q, conversationHistory: [{ role: 'assistant', content: q }] };
    }
  }

  // Dynamic generation: Force INDEPENDENT and NEW question
  const res = await llm.invoke([
    {
      role: 'system', content: `You are a professional technical interviewer for "${state.topic}". 
      
      YOUR GOAL: Ask ONE new, focused technical question.
      
      CRITICAL RULES:
      1. DO NOT repeat or ask anything similar to these previous questions: [${asked.join(' | ')}].
      2. DO NOT ask follow-ups. Every question must cover a completely DIFFERENT concept than the previous ones.
      3. Briefly acknowledge the candidate's previous response (max 5 words), then transition to the new question.
      4. Keep the question short and professional (1-2 sentences). 
      5. LEVEL: Basic to Intermediate.
      
      CONTEXT: You have already discussed: ${asked.join(', ')}.`
    },
    ...state.conversationHistory,
    { role: 'user', content: `Ask a NEW, DIFFERENT technical question about ${state.topic} that has NOT been asked before.` }
  ]);

  let q = res.content.trim();
  
  // Basic safety: if LLM repeats exactly, try one more time with a sharper prompt
  if (asked.includes(q.toLowerCase().trim())) {
    console.log(`[Graph] LLM repeated a question! Retrying generation...`);
    const resRetry = await llm.invoke([
      {
        role: 'system', content: `CRITICAL: You just repeated a question. You MUST ask a DIFFERENT technical question about "${state.topic}". 
        DO NOT ask about: [${asked.join(' | ')}].`
      },
      ...state.conversationHistory,
      { role: 'user', content: `Ask a NEW technical question.` }
    ]);
    q = resRetry.content.trim();
  }

  return { currentQuestion: q, conversationHistory: [{ role: 'assistant', content: q }] };
}

// ── Node 4: conclude ──────────────────────────────────────────────
async function conclude(state) {
  console.log('[Graph] Node: conclude');

  const res = await llm.invoke([
    {
      role: 'system', content: `You are a professional technical interviewer for the topic: "${state.topic}".
    
    YOUR GOALS:
    CRITICAL CONSTRAINTS:
    1. Keep each question short (max 1-2 sentences). No big paragraphs.
    2. Focus on professional Basic and Intermediate concepts. Avoid trivial or "too low" level questions.
    3. Ensure every question is UNIQUE and covers a DIFFERENT sub-topic or aspect of "${state.topic}". 
    4. NEVER repeat the same question or ask very similar variations.
    5. NEVER mention "time remaining", "minutes", or session progress.
` },
    {
      role: 'user',
      content: `Briefly and warmly conclude the interview on the topic of "${state.topic}". 
Thank the candidate and give one encouraging sentence. Keep it to 2-3 sentences maximum.
CRITICAL: Do NOT mention the duration of the interview or how much time has passed.`,
    },
  ]);

  return { conclusion: res.content.trim(), nextAction: 'conclude' };
}

// ── Build the Graph ───────────────────────────────────────────────
function buildInterviewGraph() {
  const graph = new StateGraph(InterviewStateAnnotation)
    .addNode('evaluate_answer', evaluateAnswer)
    .addNode('decide_next', decideNext)
    .addNode('generate_question', generateQuestion)
    .addNode('conclude', conclude)

    // Flow: Evaluate -> Decide -> (Retry/Next -> Generate | Conclude)
    .addEdge('__start__', 'evaluate_answer')
    .addEdge('evaluate_answer', 'decide_next')

    .addConditionalEdges('decide_next', (state) => state.nextAction, {
      next: 'generate_question',
      conclude: 'conclude',
    })

    .addEdge('generate_question', '__end__')
    .addEdge('conclude', '__end__');

  return graph.compile();
}

module.exports = { buildInterviewGraph };
