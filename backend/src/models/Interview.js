const mongoose = require('mongoose');

const interviewSchema = new mongoose.Schema({
  topic: {
    type: String,
    required: true,
  },
  mode: {
    type: String,
    enum: ['chat', 'audio', 'video'],
    default: 'chat'
  },
  questions: [{
    questionId: { type: Number },
    questionText: { type: String },
    mediaUrl: { type: String, default: null },
    answerType: { type: String, enum: ['chat', 'audio', 'video'] },
    transcript: { type: String }
  }],
  score: { type: Number, min: 0, max: 10 },
  feedback: { type: String },
  metrics: {
    technical: { type: Number, default: 0 },
    communication: { type: Number, default: 0 },
    problemSolving: { type: Number, default: 0 },
    confidence: { type: Number, default: 0 }
  },
  strengths: [{ type: String }],
  weaknesses: [{ type: String }],
  recommendations: [{ type: String }],
  status: {
    type: String,
    enum: ['pending', 'completed', 'evaluated'],
    default: 'pending'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Interview', interviewSchema);

