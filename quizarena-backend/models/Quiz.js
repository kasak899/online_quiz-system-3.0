const mongoose = require('mongoose');

const quizSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Quiz title is required']
  },
  category: {
    type: String,
    enum: ['Coding', 'GK'],
    required: true
  },
  subject: {
    type: String,
    required: true
  },
  questions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Question'
  }],
  duration: {
    type: Number,   // minutes
    default: 15
  },
  maxXP: {
    type: Number,
    default: 250
  },
  totalMarks: {
    type: Number,
    default: 40
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  semester: {
    type: Number
  }
}, { timestamps: true });

module.exports = mongoose.model('Quiz', quizSchema);