require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
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

// ===== SECURITY VALIDATION =====
if (!process.env.JWT_SECRET) {
  console.error('❌ CRITICAL: JWT_SECRET is not set in environment variables');
  process.exit(1);
}

if (process.env.JWT_SECRET.length < 32) {
  console.warn('⚠️  WARNING: JWT_SECRET should be at least 32 characters for better security');
}

// ===== SECURITY MIDDLEWARE =====

// Helmet for security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", process.env.FRONTEND_URL || 'http://localhost:3000'],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
}));

// CORS configuration - Restrict to your frontend only
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:3000', // For local development
  'http://localhost:5173', // For Vite local development
].filter(Boolean); // Remove undefined values

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`⚠️  Blocked CORS request from: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true, // Allow cookies
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Set-Cookie'],
  maxAge: 86400, // 24 hours
};

app.use(cors(corsOptions));

// Body parsers with size limits to prevent DOS attacks
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Cookie parser for httpOnly cookies
app.use(cookieParser());

// Passport initialization
app.use(passport.initialize());

// Trust proxy (important for rate limiting behind reverse proxy)
app.set('trust proxy', 1);

// ===== SOCKET.IO SETUP =====
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  // Add connection limits
  maxHttpBufferSize: 1e6, // 1MB
  pingTimeout: 60000,
  pingInterval: 25000,
});

// Initialize Socket.io
initializeSocket(io);

// ===== HEALTH CHECK =====
app.get('/', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Codeforces Duel API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// ===== API ROUTES =====
// Note: Rate limiting is only applied to auth routes
// Other routes have no rate limiting to support real-time polling
app.use('/api/auth', authRoutes);
app.use('/api/matchmaking', matchmakingRoutes);
app.use('/api/duel', duelRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/matches', matchRoutes);

// ===== 404 HANDLER =====
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.path,
  });
});

// ===== ERROR HANDLER (must be last) =====
app.use(errorHandler);

// ===== UNHANDLED ERRORS =====
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit in production, just log
  if (process.env.NODE_ENV !== 'production') {
    process.exit(1);
  }
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  // Exit on uncaught exceptions
  process.exit(1);
});

// ===== START SERVER =====
const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log('\n🚀 ===== SERVER STARTED =====');
  console.log(`📍 Port: ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔒 CORS enabled for: ${allowedOrigins.join(', ')}`);
  console.log(`📡 Socket.io ready for connections`);
  console.log(`⚡ Rate limiting: Auth routes only (allows real-time polling)`);
  console.log(`⏰ Server time: ${new Date().toISOString()}`);
  console.log('============================\n');
  
  // Warning if in development mode
  if (process.env.NODE_ENV !== 'production') {
    console.warn('⚠️  Running in DEVELOPMENT mode');
    console.warn('   Set NODE_ENV=production for production deployment\n');
  }
});

// ===== GRACEFUL SHUTDOWN =====
const gracefulShutdown = (signal) => {
  console.log(`\n📥 Received ${signal}, starting graceful shutdown...`);
  
  server.close(() => {
    console.log('✅ HTTP server closed');
    
    // Close database connections
    // prisma.$disconnect() if using Prisma
    
    // Close socket connections
    io.close(() => {
      console.log('✅ Socket.io connections closed');
      console.log('👋 Shutdown complete');
      process.exit(0);
    });
  });
  
  // Force shutdown after 30 seconds
  setTimeout(() => {
    console.error('⚠️  Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Export for testing
module.exports = { app, server, io };