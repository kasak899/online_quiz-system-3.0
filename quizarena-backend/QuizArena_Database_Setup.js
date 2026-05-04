// ============================================================
//  QuizArena — Complete Database Setup
//  MongoDB + Mongoose
//  Run: node database_setup.js
// ============================================================

const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');
require('dotenv').config();

// ── Connect ──────────────────────────────────────────────────
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/quizarena')
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => { console.error(err); process.exit(1); });

// ============================================================
//  SCHEMA 1 — USERS
// ============================================================
const userSchema = new mongoose.Schema({
  name:      { type: String, required: true, trim: true },
  email:     { type: String, required: true, unique: true, lowercase: true },
  password:  { type: String, required: true, minlength: 6, select: false },
  role:      { type: String, enum: ['student','teacher','admin'], default: 'student' },
  semester:  { type: Number, min: 1, max: 6 },   // for students
  xp:        { type: Number, default: 0 },
  level:     { type: Number, default: 1 },
  tier:      { type: String, enum: ['Bronze','Silver','Gold','Diamond'], default: 'Bronze' },
  streak:    { type: Number, default: 0 },
  lastLogin: { type: Date,   default: Date.now },
  isActive:  { type: Boolean, default: true }
}, { timestamps: true });

// Hash password before save
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Compare password
userSchema.methods.matchPassword = async function(entered) {
  return await bcrypt.compare(entered, this.password);
};

// Calculate tier from XP
userSchema.methods.calculateTier = function() {
  if (this.xp < 300)  return 'Bronze';
  if (this.xp < 700)  return 'Silver';
  if (this.xp < 2000) return 'Gold';
  return 'Diamond';
};

const User = mongoose.model('User', userSchema);

// ============================================================
//  SCHEMA 2 — TEACHER PROFILE
// ============================================================
const teacherSchema = new mongoose.Schema({
  user:             { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  subject:          { type: String, required: true },
  semesters:        [{ type: Number, min: 1, max: 6 }],
  salary:           { type: Number, default: 40000 },
  rating:           { type: Number, default: 3.0, min: 1, max: 5 },
  performanceGrade: { type: String, enum: ['Excellent','Good','Average','Poor'], default: 'Average' },
  studentPassRate:  { type: Number, default: 0 },
  avgQuizScore:     { type: Number, default: 0 },
  quizzesCreated:   { type: Number, default: 0 },
  status:           { type: String, enum: ['Active','On Leave','Probation'], default: 'Active' }
}, { timestamps: true });

const Teacher = mongoose.model('Teacher', teacherSchema);

// ============================================================
//  SCHEMA 3 — QUESTIONS
// ============================================================
const questionSchema = new mongoose.Schema({
  questionText: { type: String, required: true },
  category:     { type: String, enum: ['Coding','GK'], required: true },
  subject:      { type: String, required: true },
  // Subjects: DSA, Python, C Programming, C++, Java, Web Development,
  //           DBMS & SQL, Operating Systems, Computer Networks,
  //           Current Affairs, Science & Technology, History & Culture,
  //           Geography, Indian Polity, Sports & Games
  options: [{
    text:      { type: String, required: true },
    isCorrect: { type: Boolean, default: false }
  }],
  difficulty:  { type: String, enum: ['Easy','Medium','Hard'], default: 'Medium' },
  marks:       { type: Number, default: 4 },
  xpReward:    { type: Number, default: 25 },
  explanation: { type: String },
  topicTag:    { type: String },
  createdBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  isApproved:  { type: Boolean, default: false }
}, { timestamps: true });

const Question = mongoose.model('Question', questionSchema);

// ============================================================
//  SCHEMA 4 — QUIZZES
// ============================================================
const quizSchema = new mongoose.Schema({
  title:      { type: String, required: true },
  category:   { type: String, enum: ['Coding','GK'], required: true },
  subject:    { type: String, required: true },
  questions:  [{ type: mongoose.Schema.Types.ObjectId, ref: 'Question' }],
  duration:   { type: Number, default: 15 },   // minutes
  maxXP:      { type: Number, default: 250 },
  totalMarks: { type: Number, default: 40 },
  createdBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  semester:   { type: Number },
  isActive:   { type: Boolean, default: true }
}, { timestamps: true });

const Quiz = mongoose.model('Quiz', quizSchema);

// ============================================================
//  SCHEMA 5 — QUIZ ATTEMPTS
// ============================================================
const attemptSchema = new mongoose.Schema({
  student:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  quiz:     { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz', required: true },
  answers: [{
    question:       { type: mongoose.Schema.Types.ObjectId, ref: 'Question' },
    selectedOption: { type: Number },
    isCorrect:      { type: Boolean },
    timeTaken:      { type: Number }   // seconds per question
  }],
  score:           { type: Number, default: 0 },
  percentage:      { type: Number, default: 0 },
  xpEarned:        { type: Number, default: 0 },
  baseXP:          { type: Number, default: 0 },
  speedXP:         { type: Number, default: 0 },
  streakXP:        { type: Number, default: 0 },
  timeTaken:       { type: Number },   // total seconds
  rank:            { type: Number },
  tabSwitchCount:  { type: Number, default: 0 },
  status:          { type: String, enum: ['completed','incomplete','flagged'], default: 'completed' }
}, { timestamps: true });

const Attempt = mongoose.model('Attempt', attemptSchema);

// ============================================================
//  SEED DATA — Insert sample data
// ============================================================
async function seedDatabase() {
  try {
    // Clear existing data
    await User.deleteMany({});
    await Teacher.deleteMany({});
    await Question.deleteMany({});
    await Quiz.deleteMany({});
    await Attempt.deleteMany({});
    console.log('🗑️  Old data cleared');

    // ── CREATE USERS ──────────────────────────────────────────

    // Admin
    const admin = await User.create({
      name:     'Admin',
      email:    'admin@college.edu',
      password: 'admin123',
      role:     'admin',
      xp:       0,
      isActive: true
    });

    // Teachers
    const teacherRK = await User.create({
      name:     'Prof. Ravi Kumar',
      email:    'ravi@college.edu',
      password: 'pass123',
      role:     'teacher',
      isActive: true
    });

    const teacherSG = await User.create({
      name:     'Dr. Sunita Ghosh',
      email:    'sunita@college.edu',
      password: 'pass123',
      role:     'teacher',
      isActive: true
    });

    const teacherAM = await User.create({
      name:     'Mr. Amit Mishra',
      email:    'amit@college.edu',
      password: 'pass123',
      role:     'teacher',
      isActive: true
    });

    const teacherNP = await User.create({
      name:     'Ms. Neha Pandey',
      email:    'neha@college.edu',
      password: 'pass123',
      role:     'teacher',
      isActive: true
    });

    const teacherPJ = await User.create({
      name:     'Mr. Pankaj Jain',
      email:    'pankaj@college.edu',
      password: 'pass123',
      role:     'teacher',
      isActive: true
    });

    // Students — Semester I
    const students = await User.insertMany([
      { name:'Arjun Sharma',  email:'arjun@college.edu',  password: await bcrypt.hash('pass123',10), role:'student', semester:1, xp:3940, tier:'Diamond', streak:5, isActive:true },
      { name:'Priya Mehta',   email:'priya@college.edu',  password: await bcrypt.hash('pass123',10), role:'student', semester:1, xp:2875, tier:'Gold',    streak:3, isActive:true },
      { name:'Dev Nair',      email:'dev@college.edu',    password: await bcrypt.hash('pass123',10), role:'student', semester:1, xp:840,  tier:'Gold',    streak:2, isActive:true },
      { name:'Rohan Verma',   email:'rohan@college.edu',  password: await bcrypt.hash('pass123',10), role:'student', semester:1, xp:1540, tier:'Gold',    streak:4, isActive:true },
      { name:'Karan Bose',    email:'karan@college.edu',  password: await bcrypt.hash('pass123',10), role:'student', semester:1, xp:310,  tier:'Bronze',  streak:0, isActive:true },
      { name:'Anika Singh',   email:'anika@college.edu',  password: await bcrypt.hash('pass123',10), role:'student', semester:1, xp:420,  tier:'Bronze',  streak:1, isActive:true },
      // Semester II
      { name:'Ravi Singh',    email:'ravi.s@college.edu', password: await bcrypt.hash('pass123',10), role:'student', semester:2, xp:2210, tier:'Gold',    streak:3, isActive:true },
      { name:'Pooja Reddy',   email:'pooja@college.edu',  password: await bcrypt.hash('pass123',10), role:'student', semester:2, xp:1120, tier:'Gold',    streak:2, isActive:true },
      { name:'Nikhil Das',    email:'nikhil@college.edu', password: await bcrypt.hash('pass123',10), role:'student', semester:2, xp:380,  tier:'Bronze',  streak:0, isActive:true },
      { name:'Shreya Gupta',  email:'shreya@college.edu', password: await bcrypt.hash('pass123',10), role:'student', semester:2, xp:1780, tier:'Gold',    streak:4, isActive:true },
      // Semester III
      { name:'Ananya Roy',    email:'ananya@college.edu', password: await bcrypt.hash('pass123',10), role:'student', semester:3, xp:4200, tier:'Diamond', streak:6, isActive:true },
      { name:'Sahil Khan',    email:'sahil@college.edu',  password: await bcrypt.hash('pass123',10), role:'student', semester:3, xp:1650, tier:'Gold',    streak:3, isActive:true },
      { name:'Tanvi Joshi',   email:'tanvi@college.edu',  password: await bcrypt.hash('pass123',10), role:'student', semester:3, xp:560,  tier:'Silver',  streak:1, isActive:true },
      // Semester VI
      { name:'Suresh Pillai', email:'suresh@college.edu', password: await bcrypt.hash('pass123',10), role:'student', semester:6, xp:6400, tier:'Diamond', streak:10,isActive:true },
      { name:'Riya Batra',    email:'riya@college.edu',   password: await bcrypt.hash('pass123',10), role:'student', semester:6, xp:3850, tier:'Diamond', streak:7, isActive:true },
    ]);

    console.log(`✅ ${students.length + 6} Users created`);

    // ── CREATE TEACHER PROFILES ───────────────────────────────

    await Teacher.insertMany([
      { user: teacherRK._id, subject:'Mathematics',    semesters:[1,2,3], salary:52000, rating:4.0, performanceGrade:'Good',      studentPassRate:78, avgQuizScore:82, quizzesCreated:18, status:'Active'    },
      { user: teacherSG._id, subject:'Science',        semesters:[1,4],   salary:68000, rating:5.0, performanceGrade:'Excellent',  studentPassRate:92, avgQuizScore:90, quizzesCreated:22, status:'Active'    },
      { user: teacherAM._id, subject:'English',        semesters:[2,3],   salary:44000, rating:3.0, performanceGrade:'Average',    studentPassRate:61, avgQuizScore:64, quizzesCreated:7,  status:'On Leave'  },
      { user: teacherNP._id, subject:'History',        semesters:[5,6],   salary:48000, rating:4.0, performanceGrade:'Good',       studentPassRate:84, avgQuizScore:79, quizzesCreated:10, status:'Active'    },
      { user: teacherPJ._id, subject:'Computer Sc.',   semesters:[4,5,6], salary:38000, rating:2.0, performanceGrade:'Poor',       studentPassRate:42, avgQuizScore:46, quizzesCreated:4,  status:'Probation' },
    ]);

    console.log('✅ Teacher profiles created');

    // ── CREATE QUESTIONS ──────────────────────────────────────

    const questions = await Question.insertMany([

      // ── DSA Questions ──
      {
        questionText: 'What is the time complexity of Binary Search?',
        category: 'Coding', subject: 'DSA', difficulty: 'Easy', marks: 4, xpReward: 25,
        options: [
          { text: 'O(n)',      isCorrect: false },
          { text: 'O(log n)', isCorrect: true  },
          { text: 'O(n²)',    isCorrect: false },
          { text: 'O(1)',     isCorrect: false }
        ],
        explanation: 'Binary search divides the array in half each step, giving O(log n).',
        topicTag: 'Searching', createdBy: teacherRK._id, isApproved: true
      },
      {
        questionText: 'Which data structure uses LIFO order?',
        category: 'Coding', subject: 'DSA', difficulty: 'Easy', marks: 4, xpReward: 25,
        options: [
          { text: 'Queue',  isCorrect: false },
          { text: 'Stack',  isCorrect: true  },
          { text: 'Tree',   isCorrect: false },
          { text: 'Graph',  isCorrect: false }
        ],
        explanation: 'Stack follows Last In First Out (LIFO).',
        topicTag: 'Stack', createdBy: teacherRK._id, isApproved: true
      },
      {
        questionText: 'What is the worst-case time complexity of QuickSort?',
        category: 'Coding', subject: 'DSA', difficulty: 'Medium', marks: 4, xpReward: 25,
        options: [
          { text: 'O(n log n)', isCorrect: false },
          { text: 'O(n)',       isCorrect: false },
          { text: 'O(n²)',      isCorrect: true  },
          { text: 'O(log n)',   isCorrect: false }
        ],
        explanation: 'QuickSort worst case is O(n²) when pivot is always smallest/largest.',
        topicTag: 'Sorting', createdBy: teacherRK._id, isApproved: true
      },

      // ── Python Questions ──
      {
        questionText: 'Which keyword is used to define a function in Python?',
        category: 'Coding', subject: 'Python', difficulty: 'Easy', marks: 4, xpReward: 25,
        options: [
          { text: 'function', isCorrect: false },
          { text: 'def',      isCorrect: true  },
          { text: 'fun',      isCorrect: false },
          { text: 'define',   isCorrect: false }
        ],
        explanation: "Python uses 'def' keyword to define functions.",
        topicTag: 'Functions', createdBy: teacherSG._id, isApproved: true
      },
      {
        questionText: 'What is the output of: print(type([]))?',
        category: 'Coding', subject: 'Python', difficulty: 'Easy', marks: 4, xpReward: 25,
        options: [
          { text: "<class 'array'>", isCorrect: false },
          { text: "<class 'list'>",  isCorrect: true  },
          { text: "<class 'tuple'>", isCorrect: false },
          { text: "<class 'dict'>",  isCorrect: false }
        ],
        explanation: '[] creates an empty list in Python.',
        topicTag: 'Data Types', createdBy: teacherSG._id, isApproved: true
      },

      // ── C Programming Questions ──
      {
        questionText: 'Which operator is used to get the address of a variable in C?',
        category: 'Coding', subject: 'C Programming', difficulty: 'Easy', marks: 4, xpReward: 25,
        options: [
          { text: '*', isCorrect: false },
          { text: '&', isCorrect: true  },
          { text: '#', isCorrect: false },
          { text: '@', isCorrect: false }
        ],
        explanation: '& is the address-of operator in C.',
        topicTag: 'Pointers', createdBy: teacherRK._id, isApproved: true
      },
      {
        questionText: 'What is the size of int in C (32-bit system)?',
        category: 'Coding', subject: 'C Programming', difficulty: 'Easy', marks: 4, xpReward: 25,
        options: [
          { text: '1 byte',  isCorrect: false },
          { text: '2 bytes', isCorrect: false },
          { text: '4 bytes', isCorrect: true  },
          { text: '8 bytes', isCorrect: false }
        ],
        explanation: 'int is 4 bytes (32 bits) on a 32-bit system.',
        topicTag: 'Data Types', createdBy: teacherRK._id, isApproved: true
      },

      // ── C++ Questions ──
      {
        questionText: 'Which concept of OOP restricts access to class members?',
        category: 'Coding', subject: 'C++', difficulty: 'Medium', marks: 4, xpReward: 25,
        options: [
          { text: 'Inheritance',   isCorrect: false },
          { text: 'Polymorphism',  isCorrect: false },
          { text: 'Encapsulation', isCorrect: true  },
          { text: 'Abstraction',   isCorrect: false }
        ],
        explanation: 'Encapsulation bundles data and restricts direct access.',
        topicTag: 'OOP', createdBy: teacherPJ._id, isApproved: true
      },
      {
        questionText: 'What is a constructor in C++?',
        category: 'Coding', subject: 'C++', difficulty: 'Easy', marks: 4, xpReward: 25,
        options: [
          { text: 'A function that destroys objects',    isCorrect: false },
          { text: 'A function automatically called when object is created', isCorrect: true },
          { text: 'A static function',                  isCorrect: false },
          { text: 'A global function',                  isCorrect: false }
        ],
        explanation: 'Constructor is called automatically when an object is instantiated.',
        topicTag: 'Constructors', createdBy: teacherPJ._id, isApproved: true
      },

      // ── Web Development Questions ──
      {
        questionText: 'Which HTML tag is used to create a hyperlink?',
        category: 'Coding', subject: 'Web Development', difficulty: 'Easy', marks: 4, xpReward: 25,
        options: [
          { text: '<link>',   isCorrect: false },
          { text: '<a>',      isCorrect: true  },
          { text: '<href>',   isCorrect: false },
          { text: '<url>',    isCorrect: false }
        ],
        explanation: '<a> tag with href attribute creates hyperlinks.',
        topicTag: 'HTML', createdBy: teacherSG._id, isApproved: true
      },
      {
        questionText: 'What does CSS stand for?',
        category: 'Coding', subject: 'Web Development', difficulty: 'Easy', marks: 4, xpReward: 25,
        options: [
          { text: 'Computer Style Sheets',   isCorrect: false },
          { text: 'Cascading Style Sheets',  isCorrect: true  },
          { text: 'Creative Style Sheets',   isCorrect: false },
          { text: 'Colorful Style Sheets',   isCorrect: false }
        ],
        explanation: 'CSS stands for Cascading Style Sheets.',
        topicTag: 'CSS', createdBy: teacherSG._id, isApproved: true
      },

      // ── DBMS Questions ──
      {
        questionText: 'What does SQL stand for?',
        category: 'Coding', subject: 'DBMS & SQL', difficulty: 'Easy', marks: 4, xpReward: 25,
        options: [
          { text: 'Structured Question Language', isCorrect: false },
          { text: 'Structured Query Language',    isCorrect: true  },
          { text: 'Simple Query Language',        isCorrect: false },
          { text: 'Sequential Query Language',    isCorrect: false }
        ],
        explanation: 'SQL = Structured Query Language.',
        topicTag: 'SQL Basics', createdBy: teacherNP._id, isApproved: true
      },

      // ── GK: Current Affairs ──
      {
        questionText: 'Which country hosted the G20 Summit in 2023?',
        category: 'GK', subject: 'Current Affairs', difficulty: 'Medium', marks: 4, xpReward: 25,
        options: [
          { text: 'USA',   isCorrect: false },
          { text: 'India', isCorrect: true  },
          { text: 'Japan', isCorrect: false },
          { text: 'China', isCorrect: false }
        ],
        explanation: 'India hosted the G20 Summit 2023 in New Delhi.',
        topicTag: 'International', createdBy: admin._id, isApproved: true
      },
      {
        questionText: 'What is the capital of India?',
        category: 'GK', subject: 'Geography', difficulty: 'Easy', marks: 4, xpReward: 25,
        options: [
          { text: 'Mumbai',    isCorrect: false },
          { text: 'New Delhi', isCorrect: true  },
          { text: 'Kolkata',   isCorrect: false },
          { text: 'Chennai',   isCorrect: false }
        ],
        explanation: 'New Delhi is the capital city of India.',
        topicTag: 'Indian Geography', createdBy: admin._id, isApproved: true
      },
      {
        questionText: 'Who wrote the Indian National Anthem "Jana Gana Mana"?',
        category: 'GK', subject: 'History & Culture', difficulty: 'Easy', marks: 4, xpReward: 25,
        options: [
          { text: 'Mahatma Gandhi',          isCorrect: false },
          { text: 'Rabindranath Tagore',     isCorrect: true  },
          { text: 'Bankim Chandra Chatterjee',isCorrect: false },
          { text: 'Subhas Chandra Bose',     isCorrect: false }
        ],
        explanation: 'Jana Gana Mana was written by Rabindranath Tagore.',
        topicTag: 'Indian History', createdBy: admin._id, isApproved: true
      },
      {
        questionText: 'Article 370 was related to which Indian state?',
        category: 'GK', subject: 'Indian Polity', difficulty: 'Medium', marks: 4, xpReward: 25,
        options: [
          { text: 'Punjab',         isCorrect: false },
          { text: 'Jammu & Kashmir',isCorrect: true  },
          { text: 'Assam',          isCorrect: false },
          { text: 'Nagaland',       isCorrect: false }
        ],
        explanation: 'Article 370 gave special status to Jammu & Kashmir, revoked in 2019.',
        topicTag: 'Constitution', createdBy: admin._id, isApproved: true
      },
      {
        questionText: 'How many players are there in a cricket team?',
        category: 'GK', subject: 'Sports & Games', difficulty: 'Easy', marks: 4, xpReward: 25,
        options: [
          { text: '9',  isCorrect: false },
          { text: '11', isCorrect: true  },
          { text: '13', isCorrect: false },
          { text: '15', isCorrect: false }
        ],
        explanation: 'A cricket team has 11 players.',
        topicTag: 'Cricket', createdBy: admin._id, isApproved: true
      }
    ]);

    console.log(`✅ ${questions.length} Questions created`);

    // ── CREATE QUIZZES ────────────────────────────────────────

    const dsaQs  = questions.filter(q => q.subject === 'DSA').map(q => q._id);
    const pyQs   = questions.filter(q => q.subject === 'Python').map(q => q._id);
    const cQs    = questions.filter(q => q.subject === 'C Programming').map(q => q._id);
    const cppQs  = questions.filter(q => q.subject === 'C++').map(q => q._id);
    const webQs  = questions.filter(q => q.subject === 'Web Development').map(q => q._id);
    const gkQs   = questions.filter(q => q.category === 'GK').map(q => q._id);

    const quizzes = await Quiz.insertMany([
      { title:'DSA Fundamentals',        category:'Coding', subject:'DSA',              questions: dsaQs,  duration:20, maxXP:300, totalMarks: dsaQs.length  * 4, createdBy: teacherRK._id, semester:2, isActive:true },
      { title:'Python Basics',           category:'Coding', subject:'Python',            questions: pyQs,   duration:15, maxXP:250, totalMarks: pyQs.length   * 4, createdBy: teacherSG._id, semester:2, isActive:true },
      { title:'C Programming',           category:'Coding', subject:'C Programming',     questions: cQs,    duration:15, maxXP:250, totalMarks: cQs.length    * 4, createdBy: teacherRK._id, semester:3, isActive:true },
      { title:'C++ OOP Concepts',        category:'Coding', subject:'C++',               questions: cppQs,  duration:15, maxXP:250, totalMarks: cppQs.length  * 4, createdBy: teacherPJ._id, semester:4, isActive:true },
      { title:'Web Dev Basics',          category:'Coding', subject:'Web Development',   questions: webQs,  duration:18, maxXP:300, totalMarks: webQs.length  * 4, createdBy: teacherSG._id, semester:4, isActive:true },
      { title:'General Knowledge Mix',   category:'GK',     subject:'Current Affairs',   questions: gkQs,   duration:10, maxXP:200, totalMarks: gkQs.length   * 4, createdBy: admin._id,      isActive:true },
    ]);

    console.log(`✅ ${quizzes.length} Quizzes created`);

    // ── CREATE SAMPLE ATTEMPTS ────────────────────────────────

    const arjun  = students[0];
    const priya  = students[1];
    const quiz1  = quizzes[0];   // DSA
    const quiz2  = quizzes[1];   // Python

    await Attempt.insertMany([
      {
        student: arjun._id, quiz: quiz1._id,
        answers: dsaQs.map((qid, i) => ({ question: qid, selectedOption: 1, isCorrect: i < 3 ? true : false, timeTaken: 8 })),
        score: 12, percentage: 80, xpEarned: 180, baseXP: 150, speedXP: 20, streakXP: 10,
        timeTaken: 480, rank: 1, tabSwitchCount: 0, status: 'completed'
      },
      {
        student: priya._id, quiz: quiz1._id,
        answers: dsaQs.map((qid, i) => ({ question: qid, selectedOption: 1, isCorrect: i < 2 ? true : false, timeTaken: 12 })),
        score: 8, percentage: 67, xpEarned: 120, baseXP: 100, speedXP: 10, streakXP: 10,
        timeTaken: 600, rank: 2, tabSwitchCount: 0, status: 'completed'
      },
      {
        student: arjun._id, quiz: quiz2._id,
        answers: pyQs.map((qid, i) => ({ question: qid, selectedOption: 1, isCorrect: true, timeTaken: 7 })),
        score: 8, percentage: 100, xpEarned: 230, baseXP: 170, speedXP: 30, streakXP: 10,
        timeTaken: 350, rank: 1, tabSwitchCount: 0, status: 'completed'
      }
    ]);

    console.log('✅ Sample attempts created');

    // ── FINAL SUMMARY ─────────────────────────────────────────
    console.log('\n═══════════════════════════════════════');
    console.log('  ✅  QuizArena Database Setup Complete!');
    console.log('═══════════════════════════════════════');
    console.log('\n📧 Login Credentials:');
    console.log('  Admin:   admin@college.edu   / admin123');
    console.log('  Teacher: ravi@college.edu    / pass123');
    console.log('  Student: arjun@college.edu   / pass123');
    console.log('\n📊 Database Summary:');
    console.log(`  Users:     ${await User.countDocuments()}`);
    console.log(`  Teachers:  ${await Teacher.countDocuments()}`);
    console.log(`  Questions: ${await Question.countDocuments()}`);
    console.log(`  Quizzes:   ${await Quiz.countDocuments()}`);
    console.log(`  Attempts:  ${await Attempt.countDocuments()}`);
    console.log('\n🌐 API Base URL: http://localhost:5000');
    console.log('═══════════════════════════════════════\n');

    mongoose.connection.close();
  } catch (error) {
    console.error('❌ Seed Error:', error.message);
    mongoose.connection.close();
  }
}

seedDatabase();