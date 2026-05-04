const express = require('express');
const router  = express.Router();
const User    = require('../models/User');
const jwt     = require('jsonwebtoken');

// Generate JWT token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE
  });
};

// @route  POST /api/auth/register
// @desc   Register new user
// @access Public
router.post('/register', async (req, res) => {
  const { name, email, password, role, semester } = req.body;

  try {
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const user = await User.create({ name, email, password, role, semester });

    res.status(201).json({
      _id:      user._id,
      name:     user.name,
      email:    user.email,
      role:     user.role,
      semester: user.semester,
      xp:       user.xp,
      token:    generateToken(user._id)
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route  POST /api/auth/login
// @desc   Login user and return token
// @access Public
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Update streak
    const today    = new Date().toDateString();
    const lastDate = user.lastLogin
      ? new Date(user.lastLogin).toDateString()
      : null;

    if (lastDate !== today) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      if (lastDate === yesterday.toDateString()) {
        user.streak += 1;
        user.xp     += 10;   // streak XP bonus
      } else {
        user.streak = 1;
      }
      user.lastLogin = new Date();
      await user.save();
    }

    res.json({
      _id:      user._id,
      name:     user.name,
      email:    user.email,
      role:     user.role,
      semester: user.semester,
      xp:       user.xp,
      streak:   user.streak,
      level:    user.calculateLevel(),
      token:    generateToken(user._id)
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route  GET /api/auth/me
// @desc   Get logged in user
// @access Private
const { protect } = require('../middleware/authMiddleware');
router.get('/me', protect, async (req, res) => {
  const user = await User.findById(req.user._id);
  res.json({
    _id:      user._id,
    name:     user.name,
    email:    user.email,
    role:     user.role,
    semester: user.semester,
    xp:       user.xp,
    streak:   user.streak,
    level:    user.calculateLevel()
  });
});

module.exports = router;