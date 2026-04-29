require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

const questionsRoute = require('./routes/questions');
const uploadRoute = require('./routes/upload');
const evaluateRoute = require('./routes/evaluate');
const chatRoute = require('./routes/chat');
const interviewsRoute = require('./routes/interviews');
const Interview = require('./models/Interview');


const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ────────────────────────────────────────────────────────────────
app.use(cors()); // Allow all for debugging
app.use(express.json());

// Simple request logger
app.use((req, res, next) => {
  console.log(`[HTTP] ${req.method} ${req.url}`);
  next();
});

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/questions', questionsRoute);
app.use('/api/upload', uploadRoute);
app.use('/api/evaluate', evaluateRoute);
app.use('/api/chat', chatRoute);
app.use('/api/interviews', interviewsRoute);



// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'AI Interview Bot backend is running' });
});

// ─── Database ─────────────────────────────────────────────────────────────────
connectDB().then(async () => {
  // Insert a test record to make the DB visible in UI tools
  try {
    const count = await Interview.countDocuments();
    if (count === 0) {
      await Interview.create({
        topic: 'Test Interview',
        questions: [{
          questionId: 1,
          questionText: 'How are you?',
          answerType: 'chat',
          transcript: 'I am doing well, thank you!'
        }],
        status: 'evaluated'
      });
      console.log('✨ Test record created! Database is now visible in your UI.');
    }
  } catch (err) {
    console.error('Error creating test record:', err);
  }
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 Backend running at http://localhost:${PORT}`);
});
