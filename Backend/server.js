const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: [
    "http://localhost:3000", // for local dev
    "http://localhost:5000", // if testing backend locally
    "https://quizzed-platform.netlify.app/" // Netlify domain
  ],
  methods: "GET,POST,PUT,DELETE",
  credentials: true
}));
app.use(express.json({ limit: '10mb' })); // Parse JSON data from requests
app.use(express.static('../frontend')); // Serve static files

// Import Routes
const authRoutes = require('./routes/auth');
const quizRoutes = require('./routes/quiz');
const aiRoutes = require('./routes/ai');
const dashboardRoutes = require('./routes/dashboard');

// Database Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/quizzed', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => {
    console.log('✅ Connected to MongoDB');
    console.log(`📁 Database: ${mongoose.connection.db.databaseName}`);
})
.catch((err) => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
});

// MongoDB connection event handlers
mongoose.connection.on('connected', () => {
    console.log('🔗 Mongoose connected to MongoDB');
});

mongoose.connection.on('error', (err) => {
    console.error('🚨 Mongoose connection error:', err);
});

mongoose.connection.on('disconnected', () => {
    console.log('📡 Mongoose disconnected');
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/quiz', quizRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Basic Routes
app.get('/api/test', (req, res) => {
    res.json({ 
        message: 'Quizzed API is working!',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    const healthStatus = {
        status: 'OK',
        timestamp: new Date().toISOString(),
        database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
        memory: process.memoryUsage(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development'
    };

    // Check if OpenAI API key is configured
    healthStatus.ai = process.env.OPENAI_API_KEY ? 'Configured' : 'Not configured';

    // Add database stats
    if (mongoose.connection.readyState === 1) {
        healthStatus.databaseStats = {
            host: mongoose.connection.host,
            port: mongoose.connection.port,
            name: mongoose.connection.name
        };
    }

    res.json(healthStatus);
});

// Topics endpoint (simplified for demo)
app.get('/api/topics', (req, res) => {
    const sampleTopics = [
        {
            id: 'mathematics',
            name: 'Mathematics',
            description: 'Algebra, Calculus, Geometry, Statistics',
            icon: 'fas fa-calculator',
            questionCount: 150,
            difficulty: 'medium',
            subjects: ['Algebra', 'Geometry', 'Calculus']
        },
        {
            id: 'science',
            name: 'Science',
            description: 'Physics, Chemistry, Biology, Earth Science',
            icon: 'fas fa-atom',
            questionCount: 200,
            difficulty: 'hard',
            subjects: ['Physics', 'Chemistry', 'Biology']
        },
        {
            id: 'history',
            name: 'History',
            description: 'World History, Ancient Civilizations, Modern Events',
            icon: 'fas fa-landmark',
            questionCount: 120,
            difficulty: 'easy',
            subjects: ['World History', 'Ancient History']
        },
        {
            id: 'literature',
            name: 'Literature',
            description: 'Classic Literature, Poetry, Literary Analysis',
            icon: 'fas fa-book',
            questionCount: 100,
            difficulty: 'medium',
            subjects: ['Classic Literature', 'Poetry']
        },
        {
            id: 'geography',
            name: 'Geography',
            description: 'World Geography, Countries, Capitals, Physical Features',
            icon: 'fas fa-globe',
            questionCount: 80,
            difficulty: 'easy',
            subjects: ['World Geography', 'Physical Geography']
        },
        {
            id: 'programming',
            name: 'Programming',
            description: 'JavaScript, Python, Algorithms, Data Structures',
            icon: 'fas fa-code',
            questionCount: 180,
            difficulty: 'hard',
            subjects: ['JavaScript', 'Python', 'Algorithms']
        }
    ];

    res.json({
        success: true,
        topics: sampleTopics,
        totalTopics: sampleTopics.length
    });
});

// Global error handling middleware
app.use((err, req, res, next) => {
    console.error('💥 Unhandled error:', err);
    
    // Don't leak error details in production
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Internal server error',
        ...(isDevelopment && { stack: err.stack, details: err })
    });
});

// Handle 404 routes
app.use((req, res) => {
    if (req.originalUrl.startsWith('/api')) {
        res.status(404).json({
            success: false,
            message: 'API endpoint not found',
            path: req.originalUrl
        });
    } else {
        // Serve the main app for non-API routes (SPA support)
        res.sendFile('index.html', { root: '../frontend' });
    }
});

// Graceful shutdown handling
process.on('SIGINT', async () => {
    console.log('\n🛑 Received SIGINT, shutting down gracefully...');
    
    try {
        await mongoose.connection.close();
        console.log('📤 Database connection closed');
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Error during shutdown:', error);
        process.exit(1);
    }
});

process.on('SIGTERM', async () => {
    console.log('🛑 Received SIGTERM, shutting down gracefully...');
    
    try {
        await mongoose.connection.close();
        console.log('📤 Database connection closed');
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Error during shutdown:', error);
        process.exit(1);
    }
});

// Start Server
app.listen(PORT, () => {
    console.log('\n🚀 Quizzed API Server Started');
    console.log('='.repeat(50));
    console.log(`📍 Server: http://localhost:${PORT}`);
    console.log(`🌐 Frontend: http://localhost:${PORT}`);
    console.log(`⚡ API: http://localhost:${PORT}/api`);
    console.log(`🔍 Health Check: http://localhost:${PORT}/api/health`);
    console.log('='.repeat(50));
    
    if (!process.env.OPENAI_API_KEY) {
        console.log('⚠️  Warning: OPENAI_API_KEY not set - AI features will use fallbacks');
    }
    
    if (!process.env.JWT_SECRET) {
        console.log('⚠️  Warning: JWT_SECRET not set - using default (insecure for production)');
    }
    
    console.log(`🏃 Running in ${process.env.NODE_ENV || 'development'} mode`);
});

module.exports = app;
