
//📁 quizarena_backend.js (Node.js + Express + WebSocket)
/**
 * QuizArena — Node.js + Express + WebSocket Backend (Real-time Multiplayer)
 *
 * Setup:
 *   npm init -y
 *   npm install express ws cors
 *   node quizarena_backend.js
 *
 * WebSocket: ws://localhost:5000/ws/multiplayer/{room_code}?name=Arjun
 */

const express = require("express");
const cors = require("cors");
const http = require("http");
const { WebSocketServer } = require("ws");
const { URL } = require("url");

const PORT = 5000;
const QUESTION_TIMER = 15; // seconds
const MAX_PLAYERS = 8;

// ── Quiz Bank ──
const QUIZ_BANK = {
  coding: [
    { q: "Time complexity of binary search?", opts: ["O(n)", "O(log n)", "O(n log n)", "O(1)"], ans: 1 },
    { q: "Which is NOT a Python data type?", opts: ["list", "tuple", "array", "dict"], ans: 2 },
    { q: "Who invented C language?", opts: ["Dennis Ritchie", "James Gosling", "Guido van Rossum", "Linus Torvalds"], ans: 0 },
    { q: "Java keyword to inherit a class?", opts: ["this", "extends", "super", "import"], ans: 1 },
    { q: "SQL stands for?", opts: ["Strong Query Lang", "Structured Query Language", "Simple Query List", "Server Quick Lang"], ans: 1 },
  ],
  gk: [
    { q: "Capital of Australia?", opts: ["Sydney", "Melbourne", "Canberra", "Perth"], ans: 2 },
    { q: "Who wrote 'Discovery of India'?", opts: ["Gandhi", "Nehru", "Tagore", "Ambedkar"], ans: 1 },
    { q: "Largest planet in solar system?", opts: ["Earth", "Saturn", "Jupiter", "Neptune"], ans: 2 },
    { q: "Year of Indian Independence?", opts: ["1945", "1947", "1950", "1942"], ans: 1 },
    { q: "Currency of Japan?", opts: ["Yuan", "Won", "Yen", "Ringgit"], ans: 2 },
  ],
};

// ── Helpers ──
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const randCode = (len = 6) => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
};
const randId = (len = 8) => {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
};
const sample = (arr, k) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, k);
};

// ── Player & Room Models ──
class Player {
  constructor(ws, name, pid) {
    this.ws = ws;
    this.name = name;
    this.id = pid;
    this.score = 0;
    this.isHost = false;
    this.currentAnswer = null;
    this.answerTime = null;
  }
}

class Room {
  constructor(code, category) {
    this.code = code;
    this.category = category;
    this.players = new Map(); // pid -> Player
    this.state = "lobby"; // lobby | playing | finished
    this.questions = [];
    this.currentQIndex = -1;
    this.qStartTime = null;
  }

  playerList() {
    return [...this.players.values()].map((p) => ({
      id: p.id, name: p.name, score: p.score, is_host: p.isHost,
    }));
  }

  leaderboard() {
    return [...this.players.values()]
      .sort((a, b) => b.score - a.score)
      .map((p, i) => ({ name: p.name, score: p.score, rank: i + 1 }));
  }

  broadcast(message) {
    const payload = JSON.stringify(message);
    for (const p of this.players.values()) {
      try {
        if (p.ws.readyState === 1) p.ws.send(payload);
      } catch (e) { /* ignore */ }
    }
  }
}

// ── Room Manager ──
const rooms = new Map();

function createRoom(category) {
  let code = randCode();
  while (rooms.has(code)) code = randCode();
  const r = new Room(code, category);
  rooms.set(code, r);
  return r;
}

const getRoom = (code) => rooms.get(code.toUpperCase());

// ── Express REST API ──
const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (_req, res) => {
  res.json({ status: "ok", service: "QuizArena Multiplayer" });
});

app.post("/api/room/create", (req, res) => {
  const category = (req.body && req.body.category) || "coding";
  if (!QUIZ_BANK[category]) {
    return res.json({ error: "Invalid category. Use 'coding' or 'gk'" });
  }
  const room = createRoom(category);
  res.json({ code: room.code, category: room.category });
});

app.get("/api/room/:code", (req, res) => {
  const room = getRoom(req.params.code);
  if (!room) return res.json({ error: "Room not found" });
  res.json({
    code: room.code, category: room.category, state: room.state,
    players: room.playerList(),
  });
});

app.get("/api/rooms", (_req, res) => {
  res.json([...rooms.values()].map((r) => ({
    code: r.code, category: r.category, players: r.players.size, state: r.state,
  })));
});

// ── HTTP server + WebSocket ──
const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

// Handle upgrade for /ws/multiplayer/{code}
server.on("upgrade", (request, socket, head) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const match = url.pathname.match(/^\/ws\/multiplayer\/([A-Za-z0-9]+)$/);
  if (!match) {
    socket.destroy();
    return;
  }
  const code = match[1].toUpperCase();
  const name = url.searchParams.get("name") || "Player";
  wss.handleUpgrade(request, socket, head, (ws) => {
    handleConnection(ws, code, name);
  });
});

// ── Game Loop ──
async function runGame(room) {
  const questions = sample(QUIZ_BANK[room.category], Math.min(5, QUIZ_BANK[room.category].length));
  room.questions = questions;
  room.state = "playing";

  room.broadcast({ type: "game_start", total: questions.length });
  await sleep(2000);

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    room.currentQIndex = i;
    room.qStartTime = Date.now() / 1000;

    for (const p of room.players.values()) {
      p.currentAnswer = null;
      p.answerTime = null;
    }

    room.broadcast({
      type: "question", index: i, total: questions.length,
      question: q.q, options: q.opts, timer: QUESTION_TIMER,
    });

    const endTime = Date.now() + QUESTION_TIMER * 1000;
    while (Date.now() < endTime) {
      const allAnswered =
        room.players.size > 0 &&
        [...room.players.values()].every((p) => p.currentAnswer !== null);
      if (allAnswered) break;
      await sleep(300);
    }

    const correct = q.ans;
    for (const p of room.players.values()) {
      if (p.currentAnswer === correct) {
        const t = (p.answerTime || endTime / 1000) - room.qStartTime;
        const speedPts = Math.max(0, Math.floor((QUESTION_TIMER - t) * 5));
        p.score += 100 + speedPts;
      }
    }

    room.broadcast({
      type: "question_result",
      correct_index: correct,
      leaderboard: room.leaderboard(),
    });
    await sleep(3000);
  }

  room.state = "finished";
  room.broadcast({ type: "game_over", leaderboard: room.leaderboard() });
}

// ── WebSocket connection handler ──
function handleConnection(ws, code, name) {
  const room = getRoom(code);

  if (!room) {
    ws.send(JSON.stringify({ type: "error", message: "Room not found" }));
    ws.close();
    return;
  }
  if (room.players.size >= MAX_PLAYERS) {
    ws.send(JSON.stringify({ type: "error", message: "Room is full" }));
    ws.close();
    return;
  }
  if (room.state !== "lobby") {
    ws.send(JSON.stringify({ type: "error", message: "Game already started" }));
    ws.close();
    return;
  }

  const pid = randId();
  const player = new Player(ws, name, pid);
  if (room.players.size === 0) player.isHost = true;
  room.players.set(pid, player);

  ws.send(JSON.stringify({
    type: "joined", your_id: pid, is_host: player.isHost,
    room_code: room.code, category: room.category, players: room.playerList(),
  }));
  room.broadcast({ type: "player_joined", players: room.playerList() });

  ws.on("message", (raw) => {
    let data;
    try { data = JSON.parse(raw.toString()); } catch { return; }
    const mtype = data.type;

    if (mtype === "start_game" && player.isHost && room.state === "lobby") {
      if (room.players.size >= 1) runGame(room);
    } else if (mtype === "answer" && room.state === "playing") {
      const idx = data.option_index;
      if (Number.isInteger(idx) && idx >= 0 && idx < 4 && player.currentAnswer === null) {
        player.currentAnswer = idx;
        player.answerTime = Date.now() / 1000;
        ws.send(JSON.stringify({ type: "answer_received" }));
      }
    } else if (mtype === "chat") {
      const msg = String(data.message || "").substring(0, 120);
      room.broadcast({ type: "chat", from: player.name, message: msg });
    } else if (mtype === "leave") {
      ws.close();
    }
  });

  const cleanup = () => {
    room.players.delete(pid);
    if (player.isHost && room.players.size > 0) {
      const next = room.players.values().next().value;
      next.isHost = true;
    }
    if (room.players.size > 0) {
      room.broadcast({
        type: "player_left", name: player.name, players: room.playerList(),
      });
    } else {
      rooms.delete(room.code);
    }
  };

  ws.on("close", cleanup);
  ws.on("error", () => cleanup());
}

// ── Start ──
server.listen(PORT, () => {
  console.log(`🚀 QuizArena Multiplayer running on http://localhost:${PORT}`);
});