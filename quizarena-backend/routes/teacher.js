const express = require('express');
const router  = express.Router();
const User    = require('../models/User');
const Attempt = require('../models/Attempt');
const Teacher = require('../models/Teacher');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');

// @route  GET /api/teacher/dashboard
// @desc   Teacher dashboard — semester-wise students
// @access Private/Teacher
router.get('/dashboard', protect, authorizeRoles('teacher'), async (req, res) => {
  try {
    const teacher = await Teacher.findOne({ user: req.user._id });

    // Get all students per semester
    const semesterData = [];

    for (const sem of teacher.semesters) {
      const students = await User.find({
        role: 'student',
        semester: sem,
        isActive: true
      }).select('name email xp streak');

      // Get attempt stats for each student
      const studentStats = [];
      for (const student of students) {
        const attempts = await Attempt.find({ student: student._id });
        const avgScore = attempts.length > 0
          ? Math.round(attempts.reduce((s, a) => s + a.percentage, 0) / attempts.length)
          : 0;

        studentStats.push({
          _id:        student._id,
          name:       student.name,
          email:      student.email,
          xp:         student.xp,
          quizzesTaken: attempts.length,
          avgScore,
          status:     avgScore < 60 ? 'At Risk' : avgScore < 70 ? 'Inactive' : 'Active',
          lastActive: attempts.length > 0
            ? attempts.sort((a, b) => b.createdAt - a.createdAt)[0].createdAt
            : null
        });
      }

      semesterData.push({
        semester:  sem,
        students:  studentStats,
        total:     studentStats.length,
        atRisk:    studentStats.filter(s => s.status === 'At Risk').length
      });
    }

    res.json({
      teacher,
      semesterData,
      totalStudents: semesterData.reduce((s, d) => s + d.total, 0)
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;