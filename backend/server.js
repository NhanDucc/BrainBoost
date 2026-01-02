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

const app = express();

const corsOptions = {
    origin: 'http://localhost:3000',
    credentials: true,
    methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-Requested-With', 'Authorization']
};

app.use(cors(corsOptions));

app.use(cookiesParser());

app.use(express.json());

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));   // Serve static files from uploads directory

app.use('/api/auth', authRoutes);   // Auth routes

app.use('/api/users', userRoutes);  // User profile routes

app.use('/api/contact', contactRoutes);

app.use('/api/admin', adminRoutes);

app.use('/api/instructors', instructorRoutes);

app.use('/api/admin/instructors', adminInstructorRouters);

app.use("/api/tests", testRoutes);

app.use('/api/courses', courseRoutes);

app.use("/api/tts", ttsRoutes);

app.use("/api/ai-slides", aiSlidesRoutes);

mongoose.connect('mongodb://localhost:27017/learning_platform', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
}).then(() => {
    console.log('MongoDB connected');
}).catch(err => {
    console.error('MongoDB connection error:', err);
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});