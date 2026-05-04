const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: 6,
    select: false      // don't return password in queries
  },
  role: {
    type: String,
    enum: ['student', 'teacher', 'admin'],
    default: 'student'
  },
  semester: {
    type: Number,
    min: 1,
    max: 6
  },
  xp: {
    type: Number,
    default: 0
  },
  level: {
    type: Number,
    default: 1
  },
  streak: {
    type: Number,
    default: 0
  },
  lastLogin: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Compare password method
userSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Calculate level from XP
userSchema.methods.calculateLevel = function() {
  if (this.xp < 300)  return { level: Math.ceil(this.xp / 100) || 1, tier: 'Bronze' };
  if (this.xp < 700)  return { level: Math.ceil(this.xp / 100), tier: 'Silver' };
  if (this.xp < 2000) return { level: Math.ceil(this.xp / 100), tier: 'Gold' };
  return { level: Math.ceil(this.xp / 100), tier: 'Diamond' };
};

module.exports = mongoose.model('User', userSchema);