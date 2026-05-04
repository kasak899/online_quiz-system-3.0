const mongoose = require('mongoose');

const attemptSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  quiz: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Quiz',
    required: true
  },
  answers: [{
    question: { type: mongoose.Schema.Types.ObjectId, ref: 'Question' },
    selectedOption: { type: Number },   // index 0-3
    isCorrect: { type: Boolean },
    timeTaken: { type: Number }          // seconds
  }],
  score: {
    type: Number,
    default: 0
  },
  percentage: {
    type: Number,
    default: 0
  },
  xpEarned: {
    type: Number,
    default: 0
  },
  baseXP: { type: Number, default: 0 },
  speedXP: { type: Number, default: 0 },
  streakXP: { type: Number, default: 0 },
  timeTaken: {
    type: Number   // total seconds
  },
  rank: {
    type: Number
  },
  tabSwitchCount: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['completed', 'incomplete', 'flagged'],
    default: 'completed'
  }
}, { timestamps: true });

module.exports = mongoose.model('Attempt', attemptSchema);