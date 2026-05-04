const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  questionText: {
    type: String,
    required: [true, 'Question text is required']
  },
  category: {
    type: String,
    enum: ['Coding', 'GK'],
    required: true
  },
  subject: {
    type: String,
    required: true
    // DSA, Python, C, C++, Java, Web Dev, DBMS, OS, CN,
    // Current Affairs, Science, History, Geography, Polity, Sports
  },
  options: [{
    text: { type: String, required: true },
    isCorrect: { type: Boolean, default: false }
  }],
  difficulty: {
    type: String,
    enum: ['Easy', 'Medium', 'Hard'],
    default: 'Medium'
  },
  marks: {
    type: Number,
    default: 4
  },
  xpReward: {
    type: Number,
    default: 25
  },
  explanation: {
    type: String
  },
  topicTag: {
    type: String
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  isApproved: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

module.exports = mongoose.model('Question', questionSchema);