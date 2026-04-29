const express = require('express');
const router = express.Router();
const { chatWithAI } = require('../services/aiService');

/**
 * POST /api/chat
 * Handles conversational interview turns.
 * Body: { topic: string, messages: Array<{role: string, content: string}> }
 */
/**
 * POST /api/chat
 * Handles conversational interview turns with real-time streaming.
 * Body: { topic: string, messages: Array<{role: string, content: string}> }
 */
router.post('/', async (req, res) => {
  try {
    const { topic, messages } = req.body;
    
    if (!topic || !messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Missing topic or messages array' });
    }

    // Set headers for streaming (SSE)
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const stream = await chatWithAI(topic, messages);

    
    for await (const chunk of stream) {
      const token = chunk.content || "";
      if (token) {
        // Log to terminal for debugging
        process.stdout.write(token); 
        // Send each token as a data event
        res.write(`data: ${JSON.stringify({ token })}\n\n`);
      }
    }
    process.stdout.write('\n[Stream Done]\n');


    // Signal completion
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    console.error('Error in chat route:', error);
    // If headers haven't been sent, we can still send a 500
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to process chat' });
    } else {
      res.write(`data: ${JSON.stringify({ error: 'Stream interrupted' })}\n\n`);
      res.end();
    }
  }
});


module.exports = router;
