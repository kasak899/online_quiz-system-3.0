// ============================================================
//  QuizArena — MongoDB + Backend + Frontend Connection Guide
//  Poora setup ek jagah
// ============================================================

/*
STEP 1 — MongoDB Install & Start
STEP 2 — Backend Setup
STEP 3 — Frontend ko Backend se Connect
STEP 4 — Test karo
*/

// ============================================================
//  STEP 1 — MONGODB INSTALL & CONNECT
// ============================================================

/*
MongoDB Install karo:
  Windows: https://www.mongodb.com/try/download/community
  macOS:   brew install mongodb-community
  Ubuntu:  sudo apt install mongodb

MongoDB Start karo:
  Windows: net start MongoDB
  macOS:   brew services start mongodb-community
  Ubuntu:  sudo systemctl start mongodb
*/

// ============================================================
//  STEP 2 — BACKEND — POORI FILE STRUCTURE
// ============================================================

/*
Yeh folder structure banao:

quizarena-backend/
├── server.js
├── package.json
├── .env
├── config/
│   └── db.js
├── models/
│   ├── User.js
│   ├── Teacher.js
│   ├── Question.js
│   ├── Quiz.js
│   └── Attempt.js
├── middleware/
│   └── auth.js
└── routes/
    ├── auth.js
    ├── quiz.js
    ├── question.js
    ├── student.js
    ├── teacher.js
    └── admin.js
*/

// ── .env file ──────────────────────────────────────────────
/*
PORT=5000
MONGO_URI=mongodb://localhost:27017/quizarena
JWT_SECRET=quizarena_super_secret_2024
JWT_EXPIRE=7d
FRONTEND_URL=http://127.0.0.1:5500
*/

// ── package.json ───────────────────────────────────────────
/*
{
  "name": "quizarena-backend",
  "version": "1.0.0",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev":   "nodemon server.js"
  },
  "dependencies": {
    "express":           "^4.18.2",
    "mongoose":          "^7.5.0",
    "bcryptjs":          "^2.4.3",
    "jsonwebtoken":      "^9.0.2",
    "dotenv":            "^16.3.1",
    "cors":              "^2.8.5"
  },
  "devDependencies": {
    "nodemon": "^3.0.1"
  }
}
*/

// ============================================================
//  config/db.js — MongoDB Connection
// ============================================================
const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser:    true,
      useUnifiedTopology: true
    });
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ MongoDB Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;


// ============================================================
//  server.js — Main Entry Point
// ============================================================
/*
const express   = require('express');
const dotenv    = require('dotenv');
const cors      = require('cors');
const connectDB = require('./config/db');

dotenv.config();
connectDB();

const app = express();

// ── CORS — Frontend ko allow karo ──
app.use(cors({
  origin:      process.env.FRONTEND_URL || '*',
  methods:     ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));

app.use(express.json());

// ── Routes ──
app.use('/api/auth',     require('./routes/auth'));
app.use('/api/quiz',     require('./routes/quiz'));
app.use('/api/question', require('./routes/question'));
app.use('/api/student',  require('./routes/student'));
app.use('/api/teacher',  require('./routes/teacher'));
app.use('/api/admin',    require('./routes/admin'));

app.get('/', (req, res) => {
  res.json({ message: '✅ QuizArena API Running on port 5000' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
*/


// ============================================================
//  middleware/auth.js
// ============================================================
/*
const jwt  = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  let token;
  if (req.headers.authorization?.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select('-password');
      next();
    } catch {
      return res.status(401).json({ message: 'Token invalid' });
    }
  } else {
    return res.status(401).json({ message: 'No token provided' });
  }
};

const authorizeRoles = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role))
    return res.status(403).json({ message: 'Access denied' });
  next();
};

module.exports = { protect, authorizeRoles };
*/


// ============================================================
//  routes/auth.js
// ============================================================
/*
const express = require('express');
const router  = express.Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const User    = require('../models/User');

const genToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE });

// REGISTER
router.post('/register', async (req, res) => {
  const { name, email, password, role, semester } = req.body;
  try {
    if (await User.findOne({ email }))
      return res.status(400).json({ message: 'Email already registered' });

    const user = await User.create({ name, email, password, role, semester });
    res.status(201).json({
      _id: user._id, name: user.name, email: user.email,
      role: user.role, xp: user.xp, token: genToken(user._id)
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// LOGIN
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await bcrypt.compare(password, user.password)))
      return res.status(401).json({ message: 'Invalid email or password' });

    // Streak update
    const today = new Date().toDateString();
    if (new Date(user.lastLogin).toDateString() !== today) {
      const yest = new Date(); yest.setDate(yest.getDate() - 1);
      user.streak = new Date(user.lastLogin).toDateString() === yest.toDateString()
        ? user.streak + 1 : 1;
      user.xp += 10;
      user.lastLogin = new Date();
      await user.save();
    }

    res.json({
      _id: user._id, name: user.name, email: user.email,
      role: user.role, xp: user.xp, streak: user.streak,
      semester: user.semester, token: genToken(user._id)
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
*/


// ============================================================
//  routes/admin.js — Teacher Performance + Salary
// ============================================================
/*
const express = require('express');
const router  = express.Router();
const User    = require('../models/User');
const Teacher = require('../models/Teacher');
const Quiz    = require('../models/Quiz');
const Attempt = require('../models/Attempt');
const { protect, authorizeRoles } = require('../middleware/auth');
const admin = [protect, authorizeRoles('admin')];

// GET all teachers with performance
router.get('/teachers', ...admin, async (req, res) => {
  try {
    const teachers = await Teacher.find().populate('user','name email');
    const result = [];

    for (const t of teachers) {
      const quizzes  = await Quiz.find({ createdBy: t.user._id });
      const qIds     = quizzes.map(q => q._id);
      const attempts = await Attempt.find({ quiz: { $in: qIds } });
      const passRate = attempts.length
        ? Math.round(attempts.filter(a => a.percentage >= 60).length / attempts.length * 100) : 0;
      const avgScore = attempts.length
        ? Math.round(attempts.reduce((s,a) => s + a.percentage, 0) / attempts.length) : 0;

      result.push({
        _id: t._id, name: t.user.name, email: t.user.email,
        subject: t.subject, semesters: t.semesters,
        salary: t.salary, rating: t.rating,
        grade: t.performanceGrade, status: t.status,
        studentPassRate: passRate, avgQuizScore: avgScore,
        quizzesCreated: quizzes.length
      });
    }
    res.json(result);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// UPDATE salary (increment / decrement)
router.put('/teacher/salary/:id', ...admin, async (req, res) => {
  const { adjustment } = req.body;  // +2000 ya -2000
  try {
    const t = await Teacher.findById(req.params.id);
    if (!t) return res.status(404).json({ message: 'Teacher not found' });
    t.salary = Math.max(20000, t.salary + adjustment);
    await t.save();
    res.json({ message: 'Salary updated', newSalary: t.salary });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// RATE a teacher
router.put('/teacher/rate/:id', ...admin, async (req, res) => {
  const { rating } = req.body;
  try {
    const t = await Teacher.findById(req.params.id);
    t.rating = rating;
    if (rating >= 4.5)      t.performanceGrade = 'Excellent';
    else if (rating >= 3.5) t.performanceGrade = 'Good';
    else if (rating >= 2.5) t.performanceGrade = 'Average';
    else { t.performanceGrade = 'Poor'; t.status = 'Probation'; }
    await t.save();
    res.json({ message: 'Rating updated', grade: t.performanceGrade });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// DASHBOARD stats
router.get('/dashboard', ...admin, async (req, res) => {
  try {
    res.json({
      totalStudents: await User.countDocuments({ role: 'student' }),
      totalTeachers: await User.countDocuments({ role: 'teacher' }),
      totalQuizzes:  await (require('../models/Quiz')).countDocuments(),
      totalXP: (await Attempt.aggregate([
        { $group: { _id: null, total: { $sum: '$xpEarned' } } }
      ]))[0]?.total || 0
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
*/


// ============================================================
//  routes/quiz.js — Submit Quiz + XP Calculate
// ============================================================
/*
const express  = require('express');
const router   = express.Router();
const Quiz     = require('../models/Quiz');
const Attempt  = require('../models/Attempt');
const User     = require('../models/User');
const { protect } = require('../middleware/auth');

// GET all quizzes
router.get('/all', protect, async (req, res) => {
  const quizzes = await Quiz.find({ isActive: true })
    .populate('createdBy','name').select('-questions');
  res.json(quizzes);
});

// GET single quiz with questions (answers hidden)
router.get('/:id', protect, async (req, res) => {
  const quiz = await Quiz.findById(req.params.id)
    .populate({ path:'questions', select:'-options.isCorrect -explanation' });
  if (!quiz) return res.status(404).json({ message: 'Quiz not found' });
  res.json(quiz);
});

// SUBMIT quiz attempt
router.post('/submit/:id', protect, async (req, res) => {
  const { answers, timeTaken, tabSwitchCount } = req.body;
  try {
    const quiz = await Quiz.findById(req.params.id).populate('questions');
    let score = 0, baseXP = 0, speedXP = 0;

    const graded = answers.map((ans, i) => {
      const q = quiz.questions[i];
      const correct = q.options[ans.selectedOption]?.isCorrect || false;
      if (correct) {
        score  += q.marks;
        baseXP += q.xpReward;
        if (ans.timeTaken < 10) speedXP += 5;
      }
      return { question: q._id, selectedOption: ans.selectedOption, isCorrect: correct, timeTaken: ans.timeTaken };
    });

    const pct      = Math.round(score / quiz.totalMarks * 100);
    const user     = await User.findById(req.user._id);
    const streakXP = user.streak >= 5 ? 10 : 0;
    if (pct === 100) baseXP += 50;
    const totalXP  = baseXP + speedXP + streakXP;

    const attempt = await Attempt.create({
      student: req.user._id, quiz: quiz._id,
      answers: graded, score, percentage: pct,
      xpEarned: totalXP, baseXP, speedXP, streakXP,
      timeTaken, tabSwitchCount: tabSwitchCount || 0,
      status: tabSwitchCount > 3 ? 'flagged' : 'completed'
    });

    await User.findByIdAndUpdate(req.user._id, { $inc: { xp: totalXP } });

    const allAttempts = await Attempt.find({ quiz: quiz._id }).sort({ percentage: -1 });
    const rank = allAttempts.findIndex(a => a._id.toString() === attempt._id.toString()) + 1;
    if (rank === 1) await User.findByIdAndUpdate(req.user._id, { $inc: { xp: 100 } });
    await Attempt.findByIdAndUpdate(attempt._id, { rank });

    res.json({
      score, percentage: pct, xpEarned: totalXP,
      breakdown: { baseXP, speedXP, streakXP }, rank,
      correct: graded.filter(a => a.isCorrect).length,
      wrong:   graded.filter(a => !a.isCorrect).length
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Leaderboard
router.get('/leaderboard/:id', protect, async (req, res) => {
  const attempts = await Attempt.find({ quiz: req.params.id })
    .sort({ percentage: -1, timeTaken: 1 }).limit(20)
    .populate('student','name xp');
  res.json(attempts);
});

module.exports = router;
*/


// ============================================================
//  STEP 3 — FRONTEND ko BACKEND se CONNECT KARO
//  Apne HTML file mein yeh script add karo
// ============================================================

const API = 'http://localhost:5000/api';

// ── Token helpers ───────────────────────────────────────────
function saveToken(token, role, name, xp) {
  localStorage.setItem('qa_token', token);
  localStorage.setItem('qa_role',  role);
  localStorage.setItem('qa_name',  name);
  localStorage.setItem('qa_xp',    xp);
}

function getToken()  { return localStorage.getItem('qa_token'); }
function getRole()   { return localStorage.getItem('qa_role');  }

function authHeaders() {
  return {
    'Content-Type':  'application/json',
    'Authorization': 'Bearer ' + getToken()
  };
}

// ── REGISTER ───────────────────────────────────────────────
async function apiRegister(name, email, password, role, semester) {
  const res = await fetch(API + '/auth/register', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ name, email, password, role, semester })
  });
  return await res.json();
}

// ── LOGIN ──────────────────────────────────────────────────
async function apiLogin(email, password) {
  const res = await fetch(API + '/auth/login', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ email, password })
  });
  const data = await res.json();

  if (res.ok) {
    saveToken(data.token, data.role, data.name, data.xp);
    // Update UI
    document.getElementById('nav-xp-val').textContent = data.xp.toLocaleString();
    document.getElementById('nav-user-name').textContent = data.name;
    document.getElementById('nav-avatar').textContent =
      data.name.split(' ').map(n => n[0]).join('').toUpperCase();
    return { success: true, data };
  }
  return { success: false, message: data.message };
}

// ── GET ALL QUIZZES ─────────────────────────────────────────
async function apiGetQuizzes() {
  const res = await fetch(API + '/quiz/all', { headers: authHeaders() });
  return await res.json();
}

// ── GET QUIZ WITH QUESTIONS ─────────────────────────────────
async function apiGetQuiz(quizId) {
  const res = await fetch(API + '/quiz/' + quizId, { headers: authHeaders() });
  return await res.json();
}

// ── SUBMIT QUIZ ─────────────────────────────────────────────
async function apiSubmitQuiz(quizId, answers, timeTaken, tabSwitchCount) {
  const res = await fetch(API + '/quiz/submit/' + quizId, {
    method:  'POST',
    headers: authHeaders(),
    body:    JSON.stringify({ answers, timeTaken, tabSwitchCount })
  });
  return await res.json();
}

// ── STUDENT DASHBOARD ───────────────────────────────────────
async function apiStudentDashboard() {
  const res = await fetch(API + '/student/dashboard', { headers: authHeaders() });
  const data = await res.json();
  if (res.ok) {
    // Update dashboard cards
    document.getElementById('stat-taken').textContent = data.totalAttempts;
    document.getElementById('stat-avg').textContent   = data.avgScore + '%';
    document.getElementById('stat-rank').textContent  = '#' + data.globalRank;
    document.getElementById('stat-xp').textContent    = data.xp.toLocaleString();
    document.getElementById('nav-xp-val').textContent = data.xp.toLocaleString();
    document.getElementById('sb-xp').textContent      = data.xp.toLocaleString() + ' XP';
  }
  return data;
}

// ── TEACHER DASHBOARD (semester-wise students) ──────────────
async function apiTeacherDashboard() {
  const res = await fetch(API + '/teacher/dashboard', { headers: authHeaders() });
  return await res.json();
}

// ── GLOBAL LEADERBOARD ──────────────────────────────────────
async function apiLeaderboard() {
  const res = await fetch(API + '/student/global-leaderboard', { headers: authHeaders() });
  return await res.json();
}

// ── ADD QUESTION ────────────────────────────────────────────
async function apiAddQuestion(questionData) {
  const res = await fetch(API + '/question/add', {
    method:  'POST',
    headers: authHeaders(),
    body:    JSON.stringify(questionData)
  });
  return await res.json();
}

// ── ADMIN — GET TEACHER PERFORMANCE ────────────────────────
async function apiGetTeacherPerformance() {
  const res = await fetch(API + '/admin/teachers', { headers: authHeaders() });
  return await res.json();
}

// ── ADMIN — UPDATE SALARY ───────────────────────────────────
async function apiUpdateSalary(teacherId, adjustment) {
  const res = await fetch(API + '/admin/teacher/salary/' + teacherId, {
    method:  'PUT',
    headers: authHeaders(),
    body:    JSON.stringify({ adjustment })
  });
  return await res.json();
}

// ── ADMIN — RATE TEACHER ────────────────────────────────────
async function apiRateTeacher(teacherId, rating) {
  const res = await fetch(API + '/admin/teacher/rate/' + teacherId, {
    method:  'PUT',
    headers: authHeaders(),
    body:    JSON.stringify({ rating })
  });
  return await res.json();
}

// ── LOGOUT ──────────────────────────────────────────────────
function apiLogout() {
  localStorage.removeItem('qa_token');
  localStorage.removeItem('qa_role');
  localStorage.removeItem('qa_name');
  localStorage.removeItem('qa_xp');
}


// ============================================================
//  STEP 4 — APNE HTML FILE MEIN YEH CHANGES KARO
// ============================================================

/*
1. HTML file ke andar <head> tag mein yeh script link add karo:

   <script src="api.js"></script>

   (ya seedha copy karo poora code ek <script> block mein)

2. doLogin() function ko yeh se replace karo:

   async function doLogin() {
     var email    = document.getElementById('login-email').value;
     var password = document.getElementById('login-pass').value;
     var result   = await apiLogin(email, password);

     if (result.success) {
       currentRole = result.data.role;
       document.getElementById('main-nav').classList.remove('hidden');
       document.getElementById('role-label').textContent =
         currentRole === 'teacher' ? 'Teacher Portal' :
         currentRole === 'admin'   ? 'Admin Console'  : 'Student Portal';

       if (currentRole === 'admin') {
         document.getElementById('nav-admin').classList.remove('hidden');
         document.getElementById('sb-admin-link').classList.remove('hidden');
         goAdmin();
       } else {
         goDash();
         if (currentRole === 'student') apiStudentDashboard();
         if (currentRole === 'teacher') apiTeacherDashboard();
       }
       xpToast('✓ Signed in — +10 XP daily bonus', 'var(--success)');
     } else {
       alert('❌ ' + result.message);
     }
   }

3. doLogout() mein apiLogout() call karo:

   function doLogout() {
     apiLogout();
     stopTimer();
     currentRole = 'student';
     document.getElementById('main-nav').classList.add('hidden');
     goLanding();
   }

4. saveQuestion() function update karo:

   async function saveQuestion() {
     var data = {
       questionText: document.querySelector('textarea').value,
       category:     document.querySelectorAll('select')[0].value,
       subject:      document.querySelectorAll('select')[1].value,
       difficulty:   document.querySelectorAll('select')[2].value,
       marks:        parseInt(document.querySelectorAll('input[type=number]')[0].value),
       options: [
         { text: document.querySelectorAll('.option-row input')[0].value, isCorrect: false },
         { text: document.querySelectorAll('.option-row input')[1].value, isCorrect: false },
         { text: document.querySelectorAll('.option-row input')[2].value, isCorrect: false },
         { text: document.querySelectorAll('.option-row input')[3].value, isCorrect: false }
       ]
     };
     // Mark correct option
     var radios = document.querySelectorAll('.correct-radio');
     radios.forEach((r, i) => { if (r.checked) data.options[i].isCorrect = true; });

     var result = await apiAddQuestion(data);
     if (result.question) {
       xpToast('✓ Question submitted! +30 XP on approval', 'var(--success)');
     } else {
       alert('Error: ' + result.message);
     }
   }

5. Auto-login check — page load par token check karo:

   window.onload = function() {
     var token = getToken();
     var role  = getRole();
     if (token && role) {
       currentRole = role;
       document.getElementById('main-nav').classList.remove('hidden');
       if (role === 'admin')   { goAdmin(); }
       else if (role === 'teacher') { goDash(); }
       else { goDash(); apiStudentDashboard(); }
     }
   };
*/


// ============================================================
//  STEP 5 — RUN KARO
// ============================================================

/*
Terminal 1 — MongoDB start karo:
  mongod

Terminal 2 — Database seed karo (sirf pehli baar):
  cd quizarena-backend
  npm install
  node database_setup.js

Terminal 3 — Backend start karo:
  npm run dev
  (Server: http://localhost:5000)

Browser — Frontend open karo:
  QuizArena_Frontend.html ko browser mein open karo
  Ya VS Code mein Live Server use karo (port 5500)

Test karo:
  Admin login:   admin@college.edu  / admin123
  Teacher login: ravi@college.edu   / pass123
  Student login: arjun@college.edu  / pass123
*/


// ============================================================
//  QUICK TEST — API kaam kar raha hai ya nahi check karo
// ============================================================

async function testConnection() {
  try {
    const res = await fetch('http://localhost:5000/');
    const data = await res.json();
    console.log('✅ Backend connected:', data.message);
  } catch (err) {
    console.error('❌ Backend not running. Start with: npm run dev');
  }
}

// Browser console mein yeh run karo:
// testConnection();