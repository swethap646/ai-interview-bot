const express = require('express');
const multer = require('multer');
const pdf = require('pdf-parse');
const router = express.Router();
const { generateQuestions, generateQuestionsFromResume } = require('../services/aiService');

// Multer setup for memory storage (resume files)
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are supported'), false);
    }
  }
});

/**
 * GET /api/questions?topic=general
 * Returns a dynamically generated list of interview questions for a given topic from Groq (Qwen).
 */
router.get('/', async (req, res) => {
  try {
    const { topic = 'general', time = '10' } = req.query;
    
    // Map time (minutes) to number of questions
    // 5 -> 5, 10 -> 8, 15 -> 12, 20 -> 15, 25 -> 20
    let count = 8;
    const minutes = parseInt(time.toString());
    
    if (minutes <= 5) count = 3;
    else if (minutes <= 10) count = 5;
    else if (minutes <= 15) count = 8;
    else if (minutes <= 20) count = 10;
    else count = 12;

    // Generate questions dynamically
    const questions = await generateQuestions(topic, count);
    
    res.json({ topic, questions });
  } catch (error) {
    console.error('Error generating questions:', error);
    res.status(500).json({ error: 'Failed to generate questions' });
  }
});

/**
 * POST /api/questions/resume
 * Extracts text from an uploaded PDF resume and generates tailored interview questions.
 */
router.post('/resume', upload.single('resume'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No resume file uploaded' });
    }

    const { time = '15' } = req.body;
    
    // Map time to question count
    let count = 8;
    const minutes = parseInt(time.toString());
    if (minutes <= 5) count = 3;
    else if (minutes <= 10) count = 5;
    else if (minutes <= 15) count = 8;
    else if (minutes <= 20) count = 10;
    else count = 12;

    console.log(`[HTTP] Processing resume upload. Size: ${req.file.size} bytes`);

    // 1. Extract text from PDF
    const data = await pdf(req.file.buffer);
    const resumeText = data.text;

    if (!resumeText || resumeText.trim().length < 50) {
      return res.status(400).json({ error: 'Could not extract sufficient text from the resume. Please ensure it is not an image-only PDF.' });
    }

    console.log(`[HTTP] Extraction successful. Length: ${resumeText.length} chars. Generating questions...`);

    // 2. Generate questions from AI
    const questions = await generateQuestionsFromResume(resumeText, count);

    res.json({ 
      topic: 'Resume-based Interview', 
      questions,
      filename: req.file.originalname 
    });
  } catch (error) {
    const fs = require('fs');
    const util = require('util');
    fs.appendFileSync('debug.log', '[' + new Date().toISOString() + '] ' + util.inspect(error) + '\nStack: ' + error.stack + '\n\n');
    console.error('Error in resume question generation:', error);
    res.status(500).json({ error: 'Failed to process resume and generate questions', details: error.message });
  }
});

module.exports = router;
