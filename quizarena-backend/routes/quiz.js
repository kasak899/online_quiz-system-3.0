const express  = require('express');
const router   = express.Router();
const Quiz     = require('../models/Quiz');
const Question = require('../models/Question');
const Attempt  = require('../models/Attempt');
const User     = require('../models/User');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');

// @route  POST /api/quiz/create
// @desc   Create quiz (teacher/admin)
// @access Private/Teacher/Admin
router.post('/create',
  protect,
  authorizeRoles('teacher', 'admin'),
  async (req, res) => {
    const { title, category, subject, duration, semester } = req.body;
    try {
      // Auto-pick 10 approved questions for this subject
      const questions = await Question.find({
        subject, isApproved: true
      }).limit(10).select('_id marks xpReward');

      const totalMarks = questions.reduce((s, q) => s + q.marks, 0);
      const maxXP      = questions.reduce((s, q) => s + q.xpReward, 0);

      const quiz = await Quiz.create({
        title, category, subject, duration, semester,
        questions: questions.map(q => q._id),
        totalMarks, maxXP,
        createdBy: req.user._id
      });

      res.status(201).json({ message: 'Quiz created', quiz });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

// @route  GET /api/quiz/all
// @desc   Get all active quizzes
// @access Private
router.get('/all', protect, async (req, res) => {
  try {
    const quizzes = await Quiz.find({ isActive: true })
      .populate('createdBy', 'name')
      .select('-questions');
    res.json(quizzes);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route  GET /api/quiz/:id
// @desc   Get quiz with questions (for taking quiz)
// @access Private
router.get('/:id', protect, async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id)
      .populate({
        path: 'questions',
        select: '-options.isCorrect -explanation'  // hide answers
      });

    if (!quiz) return res.status(404).json({ message: 'Quiz not found' });
    res.json(quiz);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route  POST /api/quiz/submit/:id
// @desc   Submit quiz attempt
// @access Private/Student
router.post('/submit/:id', protect, async (req, res) => {
  const { answers, timeTaken, tabSwitchCount } = req.body;

  try {
    const quiz = await Quiz.findById(req.params.id)
      .populate('questions');

    if (!quiz) return res.status(404).json({ message: 'Quiz not found' });

    // Grade each answer
    let score = 0;
    let baseXP = 0;
    let speedXP = 0;
    const gradedAnswers = [];

    for (let i = 0; i < answers.length; i++) {
      const question = quiz.questions[i];
      const selected = answers[i].selectedOption;
      const isCorrect = question.options[selected] &&
                        question.options[selected].isCorrect;

      if (isCorrect) {
        score  += question.marks;
        baseXP += question.xpReward;
        // Speed bonus: answered within 10 seconds
        if (answers[i].timeTaken && answers[i].timeTaken < 10) {
          speedXP += 5;
        }
      }

      gradedAnswers.push({
        question: question._id,
        selectedOption: selected,
        isCorrect,
        timeTaken: answers[i].timeTaken
      });
    }

    const percentage = Math.round((score / quiz.totalMarks) * 100);

    // Streak XP bonus
    const user = await User.findById(req.user._id);
    const streakXP = user.streak >= 5 ? 10 : 0;

    // Perfect score bonus
    if (percentage === 100) baseXP += 50;

    const totalXP = baseXP + speedXP + streakXP;

    // Save attempt
    const attempt = await Attempt.create({
      student: req.user._id,
      quiz: quiz._id,
      answers: gradedAnswers,
      score,
      percentage,
      xpEarned: totalXP,
      baseXP, speedXP, streakXP,
      timeTaken,
      tabSwitchCount: tabSwitchCount || 0,
      status: tabSwitchCount > 3 ? 'flagged' : 'completed'
    });

    // Update user XP
    await User.findByIdAndUpdate(req.user._id, {
      $inc: { xp: totalXP }
    });

    // Calculate rank among all attempts for this quiz
    const allAttempts = await Attempt.find({ quiz: quiz._id })
      .sort({ percentage: -1, timeTaken: 1 });

    const rank = allAttempts.findIndex(
      a => a._id.toString() === attempt._id.toString()
    ) + 1;

    // First rank bonus XP
    if (rank === 1) {
      await User.findByIdAndUpdate(req.user._id, { $inc: { xp: 100 } });
    }

    await Attempt.findByIdAndUpdate(attempt._id, { rank });

    res.json({
      message:    'Quiz submitted successfully',
      score,
      percentage,
      xpEarned:   totalXP,
      breakdown:  { baseXP, speedXP, streakXP },
      rank,
      correct:    gradedAnswers.filter(a => a.isCorrect).length,
      wrong:      gradedAnswers.filter(a => !a.isCorrect).length,
      flagged:    tabSwitchCount > 3
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route  GET /api/quiz/leaderboard/:id
// @desc   Get leaderboard for a quiz
// @access Private
router.get('/leaderboard/:id', protect, async (req, res) => {
  try {
    const attempts = await Attempt.find({
      quiz: req.params.id,
      status: { $ne: 'incomplete' }
    })
      .sort({ percentage: -1, timeTaken: 1 })
      .limit(20)
      .populate('student', 'name xp');

    res.json(attempts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
