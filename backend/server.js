require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cookiesParser = require('cookie-parser');
const path = require('path');

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const contactRoutes = require('./routes/contactRoutes');
const adminRoutes = require('./routes/adminRoutes');
const instructorRoutes = require('./routes/instructorRoutes');
const adminInstructorRouters = require('./routes/adminInstructorRoutes');
const testRoutes = require("./routes/testRoutes");
const courseRoutes = require('./routes/courseRoutes');
const ttsRoutes = require("./routes/ttsRoutes");
const aiSlidesRoutes = require("./routes/aiSlidesRoutes");
const lessonChatRoutes = require("./routes/lessonChatRoutes");
const learningRoutes = require('./routes/learningRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const flashcardRoutes = require('./routes/flashcardRoutes');
const badgeRoutes = require('./routes/badgeRoutes');

const { startCronJobs } = require('./services/cronService');

const app = express();

// ==== Global Middleware ====

/**
 * CORS Configuration: 
 * Allows the React frontend to securely communicate with this Express backend.
 * 'credentials: true' is mandatory for exchanging HTTP-only cookies (JWT).
 * 'x-csrf-token' is whitelisted to support the Anti-CSRF security layer.
 */
const corsOptions = {
    origin: process.env.FRONTEND_URL,
    credentials: true,  
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-Requested-With', 'Authorization', 'x-csrf-token'] 
};

app.use(cors(corsOptions));

// Body and Cookie Parsers
app.use(express.json());    // Parses incoming JSON payloads
app.use(cookiesParser());   // Parses cookies attached to the client request object

// Serve static files from the 'uploads' directory (e.g., user avatars, course images)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ==== API Routes Mounting ====

// --- A. Core & Public Routes ---
app.use('/api/auth', authRoutes);                   // Authentication (Login, Register, JWT, CSRF)
app.use('/api/users', userRoutes);                  // User profiles and configurations
app.use('/api/contact', contactRoutes);             // Contact form submissions
app.use('/api/notifications', notificationRoutes);  // System alerts & real-time updates

// --- B. Learning & Content Routes ---
app.use('/api/courses', courseRoutes);              // Course catalog, curriculum, and lessons
app.use('/api/tests', testRoutes);                  // Online exams and test management
app.use('/api/learning', learningRoutes);           // User progress, bookmarks, and mistakes
app.use('/api/learning/flashcards', flashcardRoutes); // AI-generated spaced repetition flashcards

// --- C. AI & Specialized Features ---
app.use('/api/tts', ttsRoutes);                     // Text-to-Speech integration
app.use('/api/ai-slides', aiSlidesRoutes);          // AI-generated presentation slides
app.use('/api/lesson-chat', lessonChatRoutes);      // Contextual AI Tutor chat within lessons

// --- D. Admin & Instructor Management ---
app.use('/api/admin', adminRoutes);                 // Global Admin dashboard and metrics
app.use('/api/instructors', instructorRoutes);      // Instructor-specific portals and actions
app.use('/api/admin/instructors', adminInstructorRouters); // Admin control over instructor accounts

app.use('/api/badges', badgeRoutes);

// ==== Database Connection & Server Start ====

const PORT = process.env.DB_PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;

/**
 * Initializes the MongoDB connection and starts the Express server.
 * Ensures the app only accepts requests if the database is successfully connected.
 */
mongoose
    .connect(MONGO_URI) // Modern Mongoose (>v6) automatically handles deprecation warnings internally
    .then(() => {
        console.log('MongoDB connected successfully');
        
        // Start background tasks (e.g., scheduled emails, DB cleanup)
        startCronJobs();

        // Spin up the server
        app.listen(PORT, () => {
            console.log(`Server is up and running on port ${PORT}`);
        });
    })
    .catch((err) => {
        console.error('MongoDB connection error:', err);
        process.exit(1); // Kill the server process if the database connection fails
    });