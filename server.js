// ============================================================
//  EduQuiz Arena — Backend Server
//  Stack: Node.js + Express + MongoDB (Mongoose) + Socket.io
//  Features: Auth, Quiz API, Real-time Multiplayer, Leaderboard
// ============================================================

const express      = require('express');
const http         = require('http');
const { Server }   = require('socket.io');
const mongoose     = require('mongoose');
const bcrypt       = require('bcryptjs');
const jwt          = require('jsonwebtoken');
const cors         = require('cors');
require('dotenv').config();

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors: { origin: '*', methods: ['GET','POST'] }
});

// ── Middleware ──────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ── MongoDB Connection ──────────────────────────────────────
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/eduquiz')
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB error:', err));

const JWT_SECRET = process.env.JWT_SECRET || 'eduquiz_super_secret_key';

// ────────────────────────────────────────────────────────────
//  SCHEMAS & MODELS
// ────────────────────────────────────────────────────────────

// User
const userSchema = new mongoose.Schema({
  name:       { type: String, required: true },
  email:      { type: String, required: true, unique: true, lowercase: true },
  password:   { type: String, required: true },
  xp:         { type: Number, default: 0 },
  level:      { type: Number, default: 1 },
  streak:     { type: Number, default: 0 },
  lastLogin:  { type: Date,   default: Date.now },
  totalQuizzes: { type: Number, default: 0 },
  totalCorrect: { type: Number, default: 0 },
  achievements: [String],
  avatar:     { type: String, default: '#7c5cfc' },
  createdAt:  { type: Date, default: Date.now }
});
const User = mongoose.model('User', userSchema);

// Question
const questionSchema = new mongoose.Schema({
  subject:    { type: String, required: true },
  question:   { type: String, required: true },
  options:    [String],
  answer:     { type: Number, required: true },  // index 0-3
  explanation:{ type: String },
  difficulty: { type: String, enum: ['Easy','Medium','Hard'], default: 'Medium' },
  createdBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approved:   { type: Boolean, default: false },
  createdAt:  { type: Date, default: Date.now }
});
const Question = mongoose.model('Question', questionSchema);

// Quiz Result
const resultSchema = new mongoose.Schema({
  user:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  subject:    { type: String, required: true },
  score:      { type: Number, required: true },      // percentage
  points:     { type: Number, required: true },
  correct:    { type: Number, required: true },
  total:      { type: Number, required: true },
  timeTaken:  { type: Number },                       // seconds
  isMultiplayer: { type: Boolean, default: false },
  roomId:     { type: String },
  rank:       { type: Number },
  xpEarned:   { type: Number, default: 0 },
  createdAt:  { type: Date, default: Date.now }
});
const Result = mongoose.model('Result', resultSchema);

// Room (Multiplayer)
const roomSchema = new mongoose.Schema({
  code:       { type: String, unique: true, required: true },
  name:       { type: String, required: true },
  subject:    { type: String, required: true },
  host:       { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  players:    [{ userId: mongoose.Schema.Types.ObjectId, name: String, score: Number, answers: [Number] }],
  maxPlayers: { type: Number, default: 6 },
  difficulty: { type: String, default: 'Medium' },
  status:     { type: String, enum: ['waiting','active','finished'], default: 'waiting' },
  questions:  [{ type: mongoose.Schema.Types.ObjectId, ref: 'Question' }],
  currentQ:   { type: Number, default: 0 },
  createdAt:  { type: Date, default: Date.now }
});
const Room = mongoose.model('Room', roomSchema);

// ────────────────────────────────────────────────────────────
//  HELPERS
// ────────────────────────────────────────────────────────────
const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

const calcLevel = (xp) => Math.floor(xp / 500) + 1;
const calcXP    = (correct, total, timeTaken) => {
  let base = correct * 50;
  if (timeTaken && timeTaken < 60) base += 30; // speed bonus
  base += 80; // completion bonus
  return base;
};

function generateRoomCode() {
  return Math.random().toString(36).substr(2, 6).toUpperCase();
}

// ────────────────────────────────────────────────────────────
//  AUTH ROUTES
// ────────────────────────────────────────────────────────────
// POST /api/auth/register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ error: 'All fields required' });
    if (await User.findOne({ email }))
      return res.status(409).json({ error: 'Email already registered' });

    const hashed = await bcrypt.hash(password, 12);
    const user   = await User.create({ name, email, password: hashed });
    const token  = jwt.sign({ id: user._id, email }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      token,
      user: { id: user._id, name, email, xp: 0, level: 1, streak: 0 }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password)))
      return res.status(401).json({ error: 'Invalid credentials' });

    // Update streak
    const now      = new Date();
    const lastLogin= new Date(user.lastLogin);
    const diffDays = Math.floor((now - lastLogin) / 86400000);
    if (diffDays === 1) user.streak += 1;
    else if (diffDays > 1) user.streak = 1;
    user.lastLogin = now;
    await user.save();

    const token = jwt.sign({ id: user._id, email }, JWT_SECRET, { expiresIn: '7d' });
    res.json({
      token,
      user: { id: user._id, name: user.name, email, xp: user.xp, level: user.level, streak: user.streak }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/me
app.get('/api/auth/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ────────────────────────────────────────────────────────────
//  QUESTION ROUTES
// ────────────────────────────────────────────────────────────
// GET /api/questions?subject=Math&difficulty=Medium&limit=10
app.get('/api/questions', authMiddleware, async (req, res) => {
  try {
    const { subject, difficulty, limit = 10 } = req.query;
    const filter = { approved: true };
    if (subject)    filter.subject    = subject;
    if (difficulty) filter.difficulty = difficulty;

    const questions = await Question.aggregate([
      { $match: filter },
      { $sample: { size: parseInt(limit) } },
      { $project: { answer: 0 } }  // don't send answer to client
    ]);
    res.json(questions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/questions — submit a new question (user-contributed)
app.post('/api/questions', authMiddleware, async (req, res) => {
  try {
    const { subject, question, options, answer, explanation, difficulty } = req.body;
    if (!subject || !question || !options || answer === undefined)
      return res.status(400).json({ error: 'Missing required fields' });

    const q = await Question.create({
      subject, question, options, answer, explanation, difficulty,
      createdBy: req.user.id,
      approved: false  // requires admin approval
    });

    // Award XP for submission (will fully unlock on approval)
    await User.findByIdAndUpdate(req.user.id, { $inc: { xp: 15 } });
    res.status(201).json({ question: q, message: 'Submitted! +15 XP. Awaiting approval.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/questions/:id/answer — reveal answer after quiz
app.get('/api/questions/:id/answer', authMiddleware, async (req, res) => {
  try {
    const q = await Question.findById(req.params.id).select('answer explanation');
    if (!q) return res.status(404).json({ error: 'Question not found' });
    res.json(q);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ────────────────────────────────────────────────────────────
//  QUIZ / RESULT ROUTES
// ────────────────────────────────────────────────────────────
// POST /api/quiz/submit
app.post('/api/quiz/submit', authMiddleware, async (req, res) => {
  try {
    const { subject, answers, questionIds, timeTaken, roomId, rank } = req.body;
    // answers: array of selected option indices
    // questionIds: array of question ObjectIds

    // Fetch correct answers
    const questions = await Question.find({ _id: { $in: questionIds } }).select('answer');
    const answerMap = {};
    questions.forEach(q => { answerMap[q._id.toString()] = q.answer; });

    let correct = 0;
    questionIds.forEach((id, i) => {
      if (answerMap[id] !== undefined && answers[i] === answerMap[id]) correct++;
    });

    const total  = questionIds.length;
    const score  = Math.round((correct / total) * 100);
    const points = correct * 100;
    const xpEarned = calcXP(correct, total, timeTaken);
    const isMultiplayer = !!roomId;

    // Save result
    const result = await Result.create({
      user: req.user.id, subject, score, points,
      correct, total, timeTaken, isMultiplayer, roomId, rank, xpEarned
    });

    // Update user stats
    const user = await User.findById(req.user.id);
    user.xp            += xpEarned;
    user.level          = calcLevel(user.xp);
    user.totalQuizzes  += 1;
    user.totalCorrect  += correct;
    await user.save();

    res.json({
      result,
      xpEarned,
      newXP: user.xp,
      newLevel: user.level,
      score,
      correct,
      total
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/quiz/history — user quiz history
app.get('/api/quiz/history', authMiddleware, async (req, res) => {
  try {
    const results = await Result.find({ user: req.user.id })
      .sort({ createdAt: -1 })
      .limit(20);
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/quiz/stats — user stats summary
app.get('/api/quiz/stats', authMiddleware, async (req, res) => {
  try {
    const user    = await User.findById(req.user.id).select('-password');
    const results = await Result.find({ user: req.user.id });

    const accuracy = results.length
      ? Math.round(results.reduce((a, r) => a + r.score, 0) / results.length)
      : 0;

    const subjectStats = {};
    results.forEach(r => {
      if (!subjectStats[r.subject]) subjectStats[r.subject] = { count: 0, totalScore: 0 };
      subjectStats[r.subject].count++;
      subjectStats[r.subject].totalScore += r.score;
    });
    Object.keys(subjectStats).forEach(s => {
      subjectStats[s].avgScore = Math.round(subjectStats[s].totalScore / subjectStats[s].count);
    });

    res.json({
      user: { name: user.name, xp: user.xp, level: user.level, streak: user.streak },
      accuracy,
      totalQuizzes: user.totalQuizzes,
      totalCorrect: user.totalCorrect,
      subjectStats
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ────────────────────────────────────────────────────────────
//  LEADERBOARD
// ────────────────────────────────────────────────────────────
// GET /api/leaderboard?period=weekly&limit=20
app.get('/api/leaderboard', async (req, res) => {
  try {
    const { period = 'all', limit = 20 } = req.query;

    let dateFilter = {};
    if (period === 'weekly')  dateFilter = { createdAt: { $gte: new Date(Date.now() - 7*86400000) } };
    if (period === 'monthly') dateFilter = { createdAt: { $gte: new Date(Date.now() - 30*86400000) } };

    const scores = await Result.aggregate([
      { $match: dateFilter },
      { $group: { _id: '$user', totalPoints: { $sum: '$points' }, quizzesTaken: { $sum: 1 } } },
      { $sort: { totalPoints: -1 } },
      { $limit: parseInt(limit) },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'userInfo' } },
      { $unwind: '$userInfo' },
      { $project: {
        name:       '$userInfo.name',
        xp:         '$userInfo.xp',
        streak:     '$userInfo.streak',
        avatar:     '$userInfo.avatar',
        totalPoints: 1,
        quizzesTaken: 1
      }}
    ]);

    res.json(scores);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ────────────────────────────────────────────────────────────
//  ROOM ROUTES (HTTP — create / list)
// ────────────────────────────────────────────────────────────
// GET /api/rooms — list open rooms
app.get('/api/rooms', async (req, res) => {
  try {
    const rooms = await Room.find({ status: { $in: ['waiting','active'] } })
      .populate('host', 'name')
      .limit(20);
    res.json(rooms);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/rooms — create a room
app.post('/api/rooms', authMiddleware, async (req, res) => {
  try {
    const { name, subject, maxPlayers = 6, difficulty = 'Medium' } = req.body;

    // Fetch 10 random approved questions for the room
    const questions = await Question.aggregate([
      { $match: { subject, approved: true } },
      { $sample: { size: 10 } },
      { $project: { _id: 1 } }
    ]);

    const code = generateRoomCode();
    const room = await Room.create({
      code, name, subject, maxPlayers, difficulty,
      host: req.user.id,
      questions: questions.map(q => q._id),
      players: [{ userId: req.user.id, name: req.user.name || 'Host', score: 0, answers: [] }]
    });

    res.status(201).json(room);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ────────────────────────────────────────────────────────────
//  PROFILE ROUTES
// ────────────────────────────────────────────────────────────
// PUT /api/profile — update profile
app.put('/api/profile', authMiddleware, async (req, res) => {
  try {
    const { name, avatar } = req.body;
    const updates = {};
    if (name)   updates.name   = name;
    if (avatar) updates.avatar = avatar;

    const user = await User.findByIdAndUpdate(req.user.id, updates, { new: true }).select('-password');
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ────────────────────────────────────────────────────────────
//  ADMIN ROUTES
// ────────────────────────────────────────────────────────────
const adminAuth = (req, res, next) => {
  authMiddleware(req, res, async () => {
    const user = await User.findById(req.user.id);
    if (!user?.isAdmin) return res.status(403).json({ error: 'Admin only' });
    next();
  });
};

// GET /api/admin/questions/pending
app.get('/api/admin/questions/pending', adminAuth, async (req, res) => {
  const qs = await Question.find({ approved: false }).populate('createdBy', 'name');
  res.json(qs);
});

// PUT /api/admin/questions/:id/approve
app.put('/api/admin/questions/:id/approve', adminAuth, async (req, res) => {
  const q = await Question.findByIdAndUpdate(req.params.id, { approved: true }, { new: true });
  if (q) {
    // Award full XP to question creator
    await User.findByIdAndUpdate(q.createdBy, { $inc: { xp: 30 } });
  }
  res.json(q);
});

// DELETE /api/admin/questions/:id
app.delete('/api/admin/questions/:id', adminAuth, async (req, res) => {
  await Question.findByIdAndDelete(req.params.id);
  res.json({ message: 'Deleted' });
});

// GET /api/admin/users
app.get('/api/admin/users', adminAuth, async (req, res) => {
  const users = await User.find().select('-password').sort({ createdAt: -1 });
  res.json(users);
});

// ────────────────────────────────────────────────────────────
//  SOCKET.IO — REAL-TIME MULTIPLAYER
// ────────────────────────────────────────────────────────────
// In-memory game state for active rooms
const activeRooms = {};
/*
  activeRooms[roomCode] = {
    players:    Map<socketId, { userId, name, score, answers, ready }>
    questions:  [...],         // full question objects with answers
    currentQ:   0,
    timer:      null,
    phase:      'lobby' | 'question' | 'results' | 'finished'
    questionTimer: 20          // seconds per question
  }
*/

io.use((socket, next) => {
  // Optional: verify JWT on socket connect
  const token = socket.handshake.auth?.token;
  if (token) {
    try {
      socket.user = jwt.verify(token, JWT_SECRET);
    } catch { /* guest */ }
  }
  next();
});

io.on('connection', (socket) => {
  console.log(`🔌 Socket connected: ${socket.id}`);

  // ── JOIN ROOM ──────────────────────────────────────────
  socket.on('join_room', async ({ roomCode, playerName }) => {
    try {
      const room = await Room.findOne({ code: roomCode })
        .populate({ path: 'questions', select: '+answer' });

      if (!room) return socket.emit('error', { msg: 'Room not found' });
      if (room.status === 'finished') return socket.emit('error', { msg: 'Room already finished' });

      const socketCount = io.sockets.adapter.rooms.get(roomCode)?.size || 0;
      if (socketCount >= room.maxPlayers) return socket.emit('error', { msg: 'Room is full' });

      socket.join(roomCode);
      socket.roomCode = roomCode;

      // Init in-memory room state if needed
      if (!activeRooms[roomCode]) {
        activeRooms[roomCode] = {
          players:   new Map(),
          questions: room.questions,
          currentQ:  0,
          timer:     null,
          phase:     'lobby'
        };
      }

      const pName = playerName || socket.user?.name || `Player${Math.floor(Math.random()*100)}`;
      activeRooms[roomCode].players.set(socket.id, {
        userId: socket.user?.id || null,
        name: pName,
        score: 0,
        answers: [],
        ready: false,
        avatar: avatarList[activeRooms[roomCode].players.size % 8]
      });

      // Tell everyone the updated player list
      io.to(roomCode).emit('room_update', {
        roomCode,
        players: getPlayerList(roomCode),
        phase: activeRooms[roomCode].phase
      });

      socket.emit('joined', {
        roomCode,
        roomName: room.name,
        subject: room.subject,
        maxPlayers: room.maxPlayers,
        players: getPlayerList(roomCode)
      });

      console.log(`👤 ${pName} joined room ${roomCode}`);
    } catch (err) {
      socket.emit('error', { msg: err.message });
    }
  });

  // ── PLAYER READY ──────────────────────────────────────
  socket.on('player_ready', () => {
    const rc = socket.roomCode;
    if (!rc || !activeRooms[rc]) return;
    const p = activeRooms[rc].players.get(socket.id);
    if (p) p.ready = true;

    io.to(rc).emit('room_update', {
      players: getPlayerList(rc),
      phase: activeRooms[rc].phase
    });

    // Auto-start when all players are ready (min 2)
    const all = [...activeRooms[rc].players.values()];
    if (all.length >= 2 && all.every(p => p.ready)) {
      startMultiplayerRound(rc);
    }
  });

  // ── HOST STARTS GAME ──────────────────────────────────
  socket.on('start_game', () => {
    const rc = socket.roomCode;
    if (!rc || !activeRooms[rc]) return;
    startMultiplayerRound(rc);
  });

  // ── SUBMIT ANSWER ─────────────────────────────────────
  socket.on('submit_answer', ({ questionIndex, answer, timeTaken }) => {
    const rc = socket.roomCode;
    if (!rc || !activeRooms[rc]) return;
    const state = activeRooms[rc];
    if (state.phase !== 'question') return;
    if (questionIndex !== state.currentQ) return;

    const player = state.players.get(socket.id);
    if (!player || player.answers[questionIndex] !== undefined) return;

    const q = state.questions[questionIndex];
    const correct = (answer === q.answer);
    const pts = correct ? (100 + Math.max(0, 20 - timeTaken) * 2) : 0; // speed bonus

    player.answers[questionIndex] = answer;
    player.score += pts;

    // Notify everyone of score update
    io.to(rc).emit('score_update', {
      playerId: socket.id,
      name:     player.name,
      score:    player.score,
      correct,
      scores:   getScores(rc)
    });

    // If all players answered → advance
    const answered = [...state.players.values()].filter(p => p.answers[questionIndex] !== undefined);
    if (answered.length === state.players.size) {
      clearTimeout(state.timer);
      setTimeout(() => advanceQuestion(rc), 1500);
    }
  });

  // ── CHAT ──────────────────────────────────────────────
  socket.on('chat_message', ({ message }) => {
    const rc = socket.roomCode;
    if (!rc) return;
    const player = activeRooms[rc]?.players.get(socket.id);
    if (!player) return;
    io.to(rc).emit('chat_message', {
      name:    player.name,
      message: message.slice(0, 200),
      time:    new Date().toISOString()
    });
  });

  // ── DISCONNECT ────────────────────────────────────────
  socket.on('disconnect', () => {
    const rc = socket.roomCode;
    if (rc && activeRooms[rc]) {
      activeRooms[rc].players.delete(socket.id);
      if (activeRooms[rc].players.size === 0) {
        clearTimeout(activeRooms[rc].timer);
        delete activeRooms[rc];
        console.log(`🗑️  Room ${rc} cleaned up`);
      } else {
        io.to(rc).emit('room_update', {
          players: getPlayerList(rc),
          phase: activeRooms[rc].phase
        });
      }
    }
    console.log(`🔌 Socket disconnected: ${socket.id}`);
  });
});

// ── Multiplayer Game Logic ─────────────────────────────────
function startMultiplayerRound(roomCode) {
  const state = activeRooms[roomCode];
  if (!state) return;
  state.phase     = 'question';
  state.currentQ  = 0;
  sendQuestion(roomCode);
}

function sendQuestion(roomCode) {
  const state = activeRooms[roomCode];
  if (!state || state.currentQ >= state.questions.length) {
    return endGame(roomCode);
  }

  const q = state.questions[state.currentQ];
  // Send question WITHOUT answer
  io.to(roomCode).emit('question', {
    index:      state.currentQ,
    total:      state.questions.length,
    question:   q.question,
    options:    q.options,
    subject:    q.subject,
    difficulty: q.difficulty,
    timeLimit:  20
  });

  // Per-question countdown
  let timeLeft = 20;
  const iv = setInterval(() => {
    timeLeft--;
    io.to(roomCode).emit('timer_tick', { timeLeft, questionIndex: state.currentQ });
    if (timeLeft <= 0) {
      clearInterval(iv);
      advanceQuestion(roomCode);
    }
  }, 1000);

  state.timer = iv;
}

function advanceQuestion(roomCode) {
  const state = activeRooms[roomCode];
  if (!state) return;
  clearInterval(state.timer);

  const q = state.questions[state.currentQ];
  // Reveal answer
  io.to(roomCode).emit('question_end', {
    questionIndex: state.currentQ,
    correctAnswer: q.answer,
    explanation:   q.explanation,
    scores:        getScores(roomCode)
  });

  state.currentQ++;
  setTimeout(() => sendQuestion(roomCode), 3000); // 3s break between questions
}

async function endGame(roomCode) {
  const state = activeRooms[roomCode];
  if (!state) return;
  state.phase = 'finished';

  const scores = getScores(roomCode);
  io.to(roomCode).emit('game_end', { scores, winner: scores[0] });

  // Persist results to DB
  try {
    await Room.findOneAndUpdate({ code: roomCode }, { status: 'finished' });
    for (const [, player] of state.players) {
      if (!player.userId) continue;
      const rank    = scores.findIndex(s => s.name === player.name) + 1;
      const correct = player.answers.filter((a, i) => a === state.questions[i]?.answer).length;
      const xp      = calcXP(correct, state.questions.length, null) + (rank === 1 ? 100 : 0);

      await Result.create({
        user:       player.userId,
        subject:    state.questions[0]?.subject || 'Mixed',
        score:      Math.round((correct / state.questions.length) * 100),
        points:     player.score,
        correct,
        total:      state.questions.length,
        isMultiplayer: true,
        roomId:     roomCode,
        rank,
        xpEarned:   xp
      });
      await User.findByIdAndUpdate(player.userId, {
        $inc: { xp, totalQuizzes: 1, totalCorrect: correct },
        $set: { level: calcLevel((await User.findById(player.userId)).xp + xp) }
      });
    }
  } catch (err) {
    console.error('Error saving multiplayer results:', err.message);
  }

  // Cleanup after 5 min
  setTimeout(() => { delete activeRooms[roomCode]; }, 300000);
}

// ── Helpers ───────────────────────────────────────────────
const avatarList = ['#7c5cfc','#22d3ee','#f472b6','#10b981','#f59e0b','#a78bfa','#fb7185','#34d399'];

function getPlayerList(roomCode) {
  const state = activeRooms[roomCode];
  if (!state) return [];
  return [...state.players.entries()].map(([id, p]) => ({
    id, name: p.name, score: p.score, ready: p.ready, avatar: p.avatar
  }));
}

function getScores(roomCode) {
  return getPlayerList(roomCode).sort((a, b) => b.score - a.score);
}

// ── Default route ──────────────────────────────────────────
app.get('/', (_, res) => res.json({ status: '✅ EduQuiz API running', version: '1.0.0' }));

// ── Start Server ───────────────────────────────────────────
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 EduQuiz Server running on port ${PORT}`);
  console.log(`📡 Socket.io ready for real-time multiplayer`);
});