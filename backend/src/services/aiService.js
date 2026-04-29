/**
 * aiService.js
 * ─────────────────────────────────────────────────────────────────
 * Handles all AI / LLM interactions.
 * Configured using Langchain with Groq.
 * ─────────────────────────────────────────────────────────────────
 */

const { ChatGroq } = require('@langchain/groq');

// Initialize Langchain ChatGroq model
const llm = new ChatGroq({
  apiKey: process.env.GROQ_API_KEY,
  model: 'llama-3.3-70b-versatile',
  temperature: 0.7,
});

// A separate instance for JSON-constrained output (modelKwargs is the correct v2 API)
const jsonLlm = new ChatGroq({
  apiKey: process.env.GROQ_API_KEY,
  model: 'llama-3.3-70b-versatile',
  temperature: 0.5,
  modelKwargs: { response_format: { type: 'json_object' } },
});

/**
 * Helper to strip markdown code blocks from LLM response before parsing.
 */
function cleanJsonResponse(content) {
  if (typeof content !== 'string') return content;
  // Remove markdown code blocks (e.g., ```json ... ``` or ``` ... ```)
  return content.replace(/```(?:json)?\n?([\s\S]*?)\n?```/g, '$1').trim();
}

/**
 * Generate interview questions for a topic.
 * @param {string} topic - e.g. "frontend", "data science"
 * @returns {Promise<string[]>} - array of question strings
 */
async function generateQuestions(topic, count = 5) {
  try {
    console.log(`[AI] Generating ${count} questions for topic: ${topic}...`);
    const startTime = Date.now();

    const prompt = `You are a technical interviewer. Generate exactly ${count} basic to intermediate interview questions for the topic: "${topic}".
    
    CRITICAL CONSTRAINTS:
    1. Keep each question short (max 1-2 sentences). No big paragraphs.
    2. Focus on professional Basic and Intermediate concepts. Avoid trivial questions.
    3. Ensure every question is INDEPENDENT. No follow-ups to previous questions.
    4. Every question must cover a DIFFERENT concept within "${topic}".
    5. NEVER mention "time remaining", "minutes", or session progress.
    
    Return as JSON: {"questions": ["q1", "q2", ...]}`;

    // Using Langchain jsonLlm for structured response
    const res = await jsonLlm.invoke([
      { role: "system", content: "You are an expert technical interviewer. Output ONLY raw JSON. NO markdown, NO code blocks, NO backticks." },
      { role: "user", content: prompt }
    ]);

    const endTime = Date.now();
    console.log(`[AI] Questions generated in ${endTime - startTime}ms`);

    const cleaned = cleanJsonResponse(res.content);
    const parsed = JSON.parse(cleaned);
    const questions = parsed.questions || [];
    console.log(`[AI] Returning ${questions.length} questions to client.`);
    return questions;
  } catch (error) {
    console.error('Error in generateQuestions:', error);
    throw error;
  }
}

/**
 * Evaluate an entire interview session.
 * @param {string} topic - The interview topic
 * @param {Array} history - The chat/interview history
 * @returns {Promise<{ score: number, feedback: string }>}
 */
async function evaluateSession(topic, questions) {
  try {
    console.log(`[AI] Evaluating session for topic: ${topic}...`);
    const sessionLog = questions
      .map(q => `INTERVIEWER: ${q.questionText}\nCANDIDATE: ${q.transcript || q.answer || ''}`)
      .join('\n\n');

    console.log('[DEBUG] Session Log Sample:', sessionLog.substring(0, 100) + '...');

    const evaluationPrompt = `
    INTERVIEW LOG:
    ${ sessionLog }

    Provide a detailed professional evaluation of this ${topic} interview.
    1. Overall score(1 - 10).
    2. One sentence feedback summary.
    3. Metrics(1 - 10): technical, communication, problemSolving, confidence.
    4. Two strengths, two weaknesses, and two recommendations.
    
    Return JSON only:
    {
      "score": number,
      "feedback": "string",
      "metrics": { "technical": number, "communication": number, "problemSolving": number, "confidence": number },
      "strengths": ["string"],
      "weaknesses": ["string"],
      "recommendations": ["string"]
    }`;

    console.log(`[AI] Invoking LLM for evaluation(with 60s timeout)...`);

    // Timeout promise
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Evaluation timed out')), 60000)
    );

    const res = await Promise.race([
      jsonLlm.invoke([
        { role: 'system', content: 'You are a professional technical evaluator. Output ONLY raw JSON. NO markdown, NO code blocks, NO backticks.' },
        { role: 'user', content: evaluationPrompt }
      ]),
      timeoutPromise
    ]);

    console.log(`[AI] LLM responded.Parsing content...`);
    const cleaned = cleanJsonResponse(res.content);
    const result = JSON.parse(cleaned);
    console.log(`[AI] Evaluation complete.Score: ${ result.score } `);
    return result;
  } catch (error) {
    console.error('Error in evaluateSession:', error);
    return {
      score: 0,
      feedback: "Evaluation is taking longer than expected. You can still see your session details below.",
      metrics: { technical: 0, communication: 0, problemSolving: 0, confidence: 0 },
      strengths: ["Session recorded successfully"],
      weaknesses: ["AI evaluation timed out"],
      recommendations: ["Try re-taking the interview later"]
    };
  }
}

/**
 * Evaluate a single answer for a specific question.
 * @param {string} question - The interview question
 * @param {string} answer - The candidate's answer
 * @returns {Promise<{ score: number, feedback: string }>}
 */
async function evaluateAnswer(question, answer) {
  try {
    console.log(`[AI] Evaluating single answer(with 15s timeout)...`);

    const prompt = `Evaluate this interview answer.Question: "${question}" Answer: "${answer}" Return JSON only: { "score": number(1 - 10), "feedback": "one sentence" } `;

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Single answer evaluation timed out')), 15000)
    );

    const res = await Promise.race([
      jsonLlm.invoke([
        { role: 'system', content: 'You are a professional technical evaluator that outputs strictly valid JSON.' },
        { role: 'user', content: prompt }
      ]),
      timeoutPromise
    ]);

    const cleaned = cleanJsonResponse(res.content);
    return JSON.parse(cleaned);
  } catch (error) {
    console.error('Error in evaluateAnswer:', error);
    return { score: 0, feedback: "Failed to evaluate answer." };
  }
}

/**
 * Summarize a set of messages to condense context.
 */
async function summarizeHistory(messages) {
  try {
    console.log(`[AI] Summarizing ${messages.length} old messages...`);
    const textToSummarize = messages
      .map(m => `${m.role.toUpperCase()}: ${m.content}`)
      .join('\n');

    const summaryPrompt = `Summarize the following interview conversation history concisely (3-4 sentences). 
    Focus on:
    1. The technical topics discussed.
    2. The candidate's key strengths or weaknesses shown so far.
    3. The last question asked.
    
    HISTORY:
    ${textToSummarize}`;

    const res = await llm.invoke([
      { role: 'system', content: 'You are a professional technical recruiter summarizing an ongoing interview.' },
      { role: 'user', content: summaryPrompt }
    ]);

    return res.content;
  } catch (error) {
    console.error('Error summarizing history:', error);
    return "The interview is ongoing. Multiple technical topics have been discussed.";
  }
}

/**
 * Manage conversation history to prevent context window bloat.
 */
async function getManagedContext(topic, messages) {
  const THRESHOLD = 10; // Start summarizing after 10 messages
  const KEEP_RECENT = 6; // Keep the last 6 messages as direct context

  if (messages.length <= THRESHOLD) {
    return messages;
  }

  const oldMessages = messages.slice(0, messages.length - KEEP_RECENT);
  const recentMessages = messages.slice(messages.length - KEEP_RECENT);

  const summary = await summarizeHistory(oldMessages);

  return [
    { 
      role: 'system', 
      content: `CONTEXT SUMMARY OF PREVIOUS TURNS: ${summary}\n\nContinue the interview based on this summary and the recent messages below.` 
    },
    ...recentMessages
  ];
}

/**
 * Handle a chat-based interview turn with Streaming.
 * @param {string} topic - The interview topic
 * @param {Array} messages - Conversation history [{role: 'user'|'assistant', content: string}]
 * @returns {Promise<AsyncIterable>} - The AI's streaming response
 */
async function chatWithAI(topic, messages) {
  try {
    console.log(`[AI] Chat streaming turn for topic: ${ topic }.`);

    const systemPrompt = `You are a professional technical interviewer for the topic: "${topic}".
    
    YOUR GOALS:
    1. Ask SHORT, focused technical questions(max 1 - 2 sentences).
    2. ZERO repetition of the candidate's previous answer. 
    3. Briefly acknowledge(e.g. "Got it", "Good") then immediately ask the next NEW question.
    4. Review history and NEVER repeat a question.`;

    const managedMessages = await getManagedContext(topic, messages);

    const payload = [
      { role: 'system', content: systemPrompt },
      ...managedMessages
    ];

    // Use Langchain's stream method
    return await llm.stream(payload);
  } catch (error) {
    console.error('Error in chatWithAI:', error);
    throw error;
  }
}

const { pipeline } = require('@xenova/transformers');

function cosineSimilarity(A, B) {
  let dotProduct = 0, normA = 0, normB = 0;
  for (let i = 0; i < A.length; i++) {
    dotProduct += A[i] * B[i];
    normA += A[i] * A[i];
    normB += B[i] * B[i];
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

class ResumeVectorStore {
  constructor() {
    this.modelName = 'Xenova/all-MiniLM-L6-v2';
    this.extractor = null;
    this.store = [];
  }
  async getExtractor() {
    if (!this.extractor) {
      this.extractor = await pipeline('feature-extraction', this.modelName);
    }
    return this.extractor;
  }
  splitText(text, chunkSize = 500, overlap = 100) {
    const chunks = [];
    let i = 0;
    while (i < text.length) {
      chunks.push(text.slice(i, i + chunkSize));
      i += (chunkSize - overlap);
    }
    return chunks;
  }
  async embedDocument(text) {
    const extractor = await this.getExtractor();
    const chunks = this.splitText(text);
    console.log(`[RAG] Split resume into ${ chunks.length } chunks.Embedding...`);

    for (const chunk of chunks) {
      const output = await extractor(chunk, { pooling: 'mean', normalize: true });
      this.store.push({ text: chunk, vector: Array.from(output.data) });
    }
    console.log(`[RAG] Resume successfully vectorized and stored in memory.`);
  }
  async similaritySearch(query, k = 3) {
    const extractor = await this.getExtractor();
    const queryOutput = await extractor(query, { pooling: 'mean', normalize: true });
    const queryVector = Array.from(queryOutput.data);

    const scored = this.store.map(doc => ({
      text: doc.text,
      score: cosineSimilarity(doc.vector, queryVector)
    }));

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, k)
      .map(d => d.text);
  }
}

/**
 * Generate interview questions based on extracted resume text using RAG.
 * @param {string} resumeText - The extracted text from the candidate's resume.
 * @param {number} count - Number of questions to generate.
 * @returns {Promise<string[]>}
 */
async function generateQuestionsFromResume(resumeText, count = 5) {
  try {
    console.log(`[AI] Generating ${ count } questions from resume content using RAG pipeline...`);
    const startTime = Date.now();

    // 1. Initialize Vector Store and Embed the Resume
    const vectorStore = new ResumeVectorStore();
    await vectorStore.embedDocument(resumeText);

    // 2. Query the Vector Store for specific technical experiences
    const topContextChunks = await vectorStore.similaritySearch("Specific technical projects, coding skills, achievements, and work experience.", 3);
    const relevantContext = topContextChunks.join("\n...\n");

    console.log(`[RAG] Retrieved ${ topContextChunks.length } highly relevant chunks for AI context.`);

    // 3. Generate Questions using the retrieved chunks
    const prompt = `You are a technical interviewer.Using the resume context below, generate exactly ${ count } basic to intermediate interview questions.
    
    CRITICAL CONSTRAINTS:
    1. Each question must be short(max 2 sentences).
    2. Focus on fundamental and mid - level concepts related to the candidate's experience. 
    3. Ensure every question is UNIQUE.Do NOT repeat yourself or ask about the same project twice.
    4. NEVER mention "time remaining", "minutes", or session progress.
    
    RETRIEVED RESUME EXPERIENCES(RAG CONTEXT):
    ${ relevantContext }
 
    Return JSON only: { "questions": ["q1", "q2", ...] }
    `;

    const res = await jsonLlm.invoke([
      { role: "system", content: "You are a professional technical interviewer. Output ONLY raw JSON. NO markdown, NO code blocks, NO backticks." },
      { role: "user", content: prompt }
    ]);

    const endTime = Date.now();
    console.log(`[AI] RAG Resume questions generated in ${ endTime - startTime } ms`);

    const cleaned = cleanJsonResponse(res.content);
    const parsed = JSON.parse(cleaned);
    const questions = parsed.questions || [];
    return questions;
  } catch (error) {
    console.error('Error in generateQuestionsFromResume:', error);
    throw error;
  }
}

module.exports = { generateQuestions, evaluateSession, chatWithAI, generateQuestionsFromResume, evaluateAnswer };
