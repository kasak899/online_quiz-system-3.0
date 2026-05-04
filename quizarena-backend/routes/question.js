const express  = require('express');
const router   = express.Router();
const Question = require('../models/Question');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const User = require('../models/User');

// @route  POST /api/question/add
// @desc   Add new question (teacher/student)
// @access Private
router.post('/add', protect, async (req, res) => {
  const {
    questionText, category, subject,
    options, difficulty, marks, explanation, topicTag
  } = req.body;

  try {
    const question = await Question.create({
      questionText, category, subject, options,
      difficulty, marks, explanation, topicTag,
      createdBy: req.user._id,
      isApproved: req.user.role === 'admin' || req.user.role === 'teacher'
    });

    // Give XP if student submitted (pending approval)
    if (req.user.role === 'student') {
      // XP given on approval by admin, not here
    }

    res.status(201).json({ message: 'Question submitted successfully', question });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route  GET /api/question/subject/:subject
// @desc   Get approved questions by subject
// @access Private
router.get('/subject/:subject', protect, async (req, res) => {
  try {
    const questions = await Question.find({
      subject: req.params.subject,
      isApproved: true
    }).limit(20);

    res.json(questions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route  GET /api/question/pending
// @desc   Get pending (unapproved) questions — admin only
// @access Private/Admin
router.get('/pending',
  protect,
  authorizeRoles('admin'),
  async (req, res) => {
    try {
      const questions = await Question.find({ isApproved: false })
        .populate('createdBy', 'name email role');
      res.json(questions);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

// @route  PUT /api/question/approve/:id
// @desc   Approve question and give XP to contributor
// @access Private/Admin
router.put('/approve/:id',
  protect,
  authorizeRoles('admin'),
  async (req, res) => {
    try {
      const question = await Question.findById(req.params.id)
        .populate('createdBy');
      if (!question) return res.status(404).json({ message: 'Question not found' });

      question.isApproved = true;
      await question.save();

      // Give 30 XP to the contributor
      await User.findByIdAndUpdate(question.createdBy._id, { $inc: { xp: 30 } });

      res.json({ message: 'Question approved. +30 XP given to contributor.' });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

module.exports = router;