const express = require('express');
const router  = express.Router();
const User    = require('../models/User');
const Teacher = require('../models/Teacher');
const Attempt = require('../models/Attempt');
const Quiz    = require('../models/Quiz');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');

const adminOnly = [protect, authorizeRoles('admin')];

// @route  GET /api/admin/teachers
// @desc   Get all teachers with performance data
// @access Private/Admin
router.get('/teachers', ...adminOnly, async (req, res) => {
  try {
    const teachers = await Teacher.find()
      .populate('user', 'name email isActive');

    const performanceData = [];
    for (const teacher of teachers) {
      // Count quizzes created
      const quizzesCreated = await Quiz.countDocuments({
        createdBy: teacher.user._id
      });

      // Get all student attempts for quizzes by this teacher
      const teacherQuizzes = await Quiz.find({ createdBy: teacher.user._id });
      const quizIds = teacherQuizzes.map(q => q._id);
      const attempts = await Attempt.find({ quiz: { $in: quizIds } });

      const avgScore = attempts.length > 0
        ? Math.round(attempts.reduce((s, a) => s + a.percentage, 0) / attempts.length)
        : 0;

      const passRate = attempts.length > 0
        ? Math.round(
            (attempts.filter(a => a.percentage >= 60).length / attempts.length) * 100
          )
        : 0;

      performanceData.push({
        _id:            teacher._id,
        name:           teacher.user.name,
        email:          teacher.user.email,
        subject:        teacher.subject,
        semesters:      teacher.semesters,
        salary:         teacher.salary,
        rating:         teacher.rating,
        grade:          teacher.performanceGrade,
        status:         teacher.status,
        studentPassRate: passRate,
        avgQuizScore:   avgScore,
        quizzesCreated
      });
    }

    res.json(performanceData);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route  PUT /api/admin/teacher/salary/:id
// @desc   Update teacher salary (increment/decrement)
// @access Private/Admin
router.put('/teacher/salary/:id', ...adminOnly, async (req, res) => {
  const { adjustment } = req.body;  // +2000 or -2000

  try {
    const teacher = await Teacher.findById(req.params.id);
    if (!teacher) return res.status(404).json({ message: 'Teacher not found' });

    teacher.salary = Math.max(20000, teacher.salary + adjustment);
    await teacher.save();

    res.json({
      message:   `Salary updated to ₹${teacher.salary.toLocaleString('en-IN')}`,
      newSalary: teacher.salary,
      change:    adjustment
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route  PUT /api/admin/teacher/rate/:id
// @desc   Rate a teacher
// @access Private/Admin
router.put('/teacher/rate/:id', ...adminOnly, async (req, res) => {
  const { rating } = req.body;   // 1 to 5

  if (rating < 1 || rating > 5) {
    return res.status(400).json({ message: 'Rating must be between 1 and 5' });
  }

  try {
    const teacher = await Teacher.findById(req.params.id);
    if (!teacher) return res.status(404).json({ message: 'Teacher not found' });

    teacher.rating = rating;
    // Auto-assign grade based on rating
    if (rating >= 4.5)      teacher.performanceGrade = 'Excellent';
    else if (rating >= 3.5) teacher.performanceGrade = 'Good';
    else if (rating >= 2.5) teacher.performanceGrade = 'Average';
    else                    teacher.performanceGrade = 'Poor';

    // Auto probation if rating <= 2
    if (rating <= 2) teacher.status = 'Probation';

    await teacher.save();
    res.json({ message: 'Rating updated', rating, grade: teacher.performanceGrade });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route  GET /api/admin/dashboard
// @desc   Admin dashboard overview stats
// @access Private/Admin
router.get('/dashboard', ...adminOnly, async (req, res) => {
  try {
    const totalStudents = await User.countDocuments({ role: 'student' });
    const totalTeachers = await User.countDocuments({ role: 'teacher' });
    const totalQuizzes  = await Quiz.countDocuments({ isActive: true });
    const totalAttempts = await Attempt.countDocuments();
    const totalXPGiven  = await Attempt.aggregate([
      { $group: { _id: null, total: { $sum: '$xpEarned' } } }
    ]);

    res.json({
      totalStudents,
      totalTeachers,
      totalQuizzes,
      totalAttempts,
      totalXPGiven: totalXPGiven[0]?.total || 0
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route  PUT /api/admin/question/approve/:id
// @desc   Approve student question submission
// @access Private/Admin
router.put('/question/approve/:id', ...adminOnly, async (req, res) => {
  const Question = require('../models/Question');
  try {
    const q = await Question.findByIdAndUpdate(
      req.params.id,
      { isApproved: true },
      { new: true }
    ).populate('createdBy', '_id name');

    // Give XP to contributor
    await User.findByIdAndUpdate(q.createdBy._id, { $inc: { xp: 30 } });

    res.json({ message: 'Question approved. +30 XP given.', question: q });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;