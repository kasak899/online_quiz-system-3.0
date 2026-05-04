const mongoose = require('mongoose');

const teacherSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  subject: {
    type: String,
    required: true
  },
  semesters: [{
    type: Number,
    min: 1,
    max: 6
  }],
  salary: {
    type: Number,
    default: 40000
  },
  rating: {
    type: Number,
    default: 3.0,
    min: 1,
    max: 5
  },
  performanceGrade: {
    type: String,
    enum: ['Excellent', 'Good', 'Average', 'Poor'],
    default: 'Average'
  },
  studentPassRate: {
    type: Number,
    default: 0
  },
  avgQuizScore: {
    type: Number,
    default: 0
  },
  quizzesCreated: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['Active', 'On Leave', 'Probation'],
    default: 'Active'
  }
}, { timestamps: true });

module.exports = mongoose.model('Teacher', teacherSchema);