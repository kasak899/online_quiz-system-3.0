const express = require('express');
const router  = express.Router();
const User    = require('../models/User');
const Attempt = require('../models/Attempt');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');

// @route  GET /api/student/dashboard
// @desc   Get student dashboard data
// @access Private/Student
router.get('/dashboard', protect, authorizeRoles('student'), async (req, res) => {
  try {
    const attempts = await Attempt.find({ student: req.user._id })
      .populate('quiz', 'title subject category')
      .sort({ createdAt: -1 })
      .limit(10);

    const totalAttempts = await Attempt.countDocuments({ student: req.user._id });
    const avgScore = attempts.length > 0
      ? Math.round(attempts.reduce((s, a) => s + a.percentage, 0) / attempts.length)
      : 0;

    // Global rank by XP
    const usersAbove = await User.countDocuments({
      xp: { $gt: req.user.xp },
      role: 'student'
    });
    const globalRank = usersAbove + 1;

    const user = await User.findById(req.user._id);

    res.json({
      totalAttempts,
      avgScore,
      globalRank,
      xp:     user.xp,
      streak: user.streak,
      level:  user.calculateLevel(),
      recentAttempts: attempts
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route  GET /api/student/xp-history
// @desc   Get XP earning history
// @access Private/Student
router.get('/xp-history', protect, authorizeRoles('student'), async (req, res) => {
  try {
    const attempts = await Attempt.find({ student: req.user._id })
      .populate('quiz', 'title subject')
      .sort({ createdAt: -1 })
      .limit(20);

    const history = attempts.map(a => ({
      type:    'quiz',
      label:   `${a.quiz.title} — ${a.percentage}% score`,
      xp:      a.xpEarned,
      date:    a.createdAt
    }));

    res.json(history);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route  GET /api/student/global-leaderboard
// @desc   Get global leaderboard
// @access Private
router.get('/global-leaderboard', protect, async (req, res) => {
  try {
    const students = await User.find({ role: 'student', isActive: true })
      .sort({ xp: -1 })
      .limit(20)
      .select('name xp streak');

    const leaderboard = students.map((s, i) => ({
      rank:   i + 1,
      name:   s.name,
      xp:     s.xp,
      streak: s.streak
    }));

    res.json(leaderboard);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;