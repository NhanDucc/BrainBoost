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
const { startCronJobs } = require('./services/cronService');
const notificationRoutes = require('./routes/notificationRoutes');
const flashcardRoutes = require('./routes/flashcardRoutes');

const app = express();

// ==== CORS Configuration ====

// Configures Cross-Origin Resource Sharing to allow requests from the React frontend
const corsOptions = {
    origin: process.env.FRONTEND_URL,
    credentials: true,  // Crucial for allowing cookies (JWT) to be sent across origins
    methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-Requested-With', 'Authorization']
};
app.use(cors(corsOptions));

// ==== Global Middleware ====

app.use(cookiesParser());   // Parses cookies attached to the client request object
app.use(express.json());    // Parses incoming JSON payloads

// Serve static files from the 'uploads' directory (e.g., user avatars, course images)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ==== API Routes Mounting ====

app.use('/api/auth', authRoutes);                           // Authentication (login, register, logout)
app.use('/api/users', userRoutes);                          // User profiles and basic info
app.use('/api/contact', contactRoutes);                     // Contact form submissions
app.use('/api/admin', adminRoutes);                         // Admin dashboard and management
app.use('/api/instructors', instructorRoutes);              // Instructor-specific actions
app.use('/api/admin/instructors', adminInstructorRouters);  // Admin control over instructors
app.use("/api/tests", testRoutes);                          // Exam and test management
app.use('/api/courses', courseRoutes);                      // Course content and curriculum
app.use("/api/tts", ttsRoutes);                             // Text-to-Speech integrations
app.use("/api/ai-slides", aiSlidesRoutes);                  // AI-generated presentation slides
app.use("/api/lesson-chat", lessonChatRoutes);              // AI Tutor chat within lessons
app.use('/api/learning', learningRoutes);                   // User learning data (Bookmarks, Mistakes, AI Paths)
app.use('/api/notifications', notificationRoutes);          // System alerts, course updates, and user notifications
app.use('/api/learning/flashcards', flashcardRoutes);       // AI-generated flashcards for spaced repetition study

// ==== Database Connection & Server Start ====

const dbUri = process.env.MONGO_URI;

mongoose.connect(dbUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
}).then(() => {
    console.log('MongoDB connected successfully');
}).catch(err => {
    console.error('MongoDB connection error:', err);
});

const PORT = process.env.DB_PORT;

// Start background tasks
startCronJobs();

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});