require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

// Import routes
const classRoutes = require('./routes/classRoutes');
const groupRoutes = require('./routes/groupRoutes');
const subjectRoutes = require('./routes/subjectRoutes');
const chapterRoutes = require('./routes/chapterRoutes');
const topicRoutes = require('./routes/topicRoutes');
const questionRoutes = require('./routes/questionRoutes');
const examRoutes = require('./routes/examRoutes');
const examTypeRoutes = require('./routes/examTypeRoutes');
const examResultRoutes = require('./routes/examResultRoutes');
const leaderboardRoutes = require('./routes/leaderboardRoutes');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');

const app = express();

// Connect to database
connectDB();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Parse CORS origins from comma-separated list
const corsOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map(origin => origin.trim());

app.use(cors({
  origin: corsOrigins,
  credentials: true,
}));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is running',
  });
});

// API Routes
app.use('/api/classes', classRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/subjects', subjectRoutes);
app.use('/api/chapters', chapterRoutes);
app.use('/api/topics', topicRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/exam-types', examTypeRoutes);

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/exam-results', examResultRoutes);
app.use('/api/leaderboard', leaderboardRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
  });
});

const DEFAULT_PORT = Number(process.env.PORT) || 5000;

const startServer = (port, retriesLeft = 10) => {
  const server = app.listen(port, () => {
    console.log(`✓ Server running on port ${port}`);
    console.log(`✓ Environment: ${process.env.NODE_ENV || 'development'}`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE' && retriesLeft > 0) {
      const nextPort = port + 1;
      console.warn(`⚠ Port ${port} is in use. Retrying on ${nextPort}...`);
      startServer(nextPort, retriesLeft - 1);
      return;
    }

    console.error('✗ Failed to start server:', err.message);
    process.exit(1);
  });
};

startServer(DEFAULT_PORT);
