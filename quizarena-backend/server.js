const express = require('express');
const dotenv  = require('dotenv');
const cors    = require('cors');
const http = require('http');
const path = require('path');
const connectDB = require('./config/db');
const multiplayer = require('./routes/multiplayer');

dotenv.config();
connectDB();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Routes
app.use('/api/auth',     require('./routes/auth'));
app.use('/api/quiz',     require('./routes/quiz'));
app.use('/api/question', require('./routes/question'));
app.use('/api/student',  require('./routes/student'));
app.use('/api/teacher',  require('./routes/teacher'));
app.use('/api/admin',    require('./routes/admin'));
app.use('/api', multiplayer.router);

// Base route serves frontend page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'QuizArena_Frontend.html'));
});

const PORT = process.env.PORT || 3300;
const server = http.createServer(app);
multiplayer.attachWebSocket(server);  
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});