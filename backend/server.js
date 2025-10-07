require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const passport = require('./config/passport.config');
const initializeSocket = require('./socket/socket.handler');
const errorHandler = require('./middlewares/error.middleware');

// Import routes
const authRoutes = require('./routes/auth.routes');
const matchmakingRoutes = require('./routes/matchmaking.routes');
const duelRoutes = require('./routes/duel.routes');
const profileRoutes = require('./routes/profile.routes');
const leaderboardRoutes = require('./routes/leaderboard.routes');
const matchRoutes = require('./routes/match.routes');

const app = express();
const server = http.createServer(app);

// Socket.io setup
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(passport.initialize());

// Health check
app.get('/', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Codeforces Duel API is running',
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/matchmaking', matchmakingRoutes);
app.use('/api/duel', duelRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/matches', matchRoutes);

// Error handler (must be last)
app.use(errorHandler);

// Initialize Socket.io
initializeSocket(io);

// Start server
const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 Socket.io ready for connections`);
  console.log(`🌍 Frontend URL: ${process.env.FRONTEND_URL}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});