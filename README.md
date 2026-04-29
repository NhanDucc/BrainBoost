# Create .env file

# Environment Variables Setup Guide (BrainBoost)

This guide explains how to obtain and configure all the necessary keys for your `.env` file to ensure the **BrainBoost** system runs correctly.

---

## 1. Authentication Secrets (JWT)
These are used to secure your login sessions and refresh tokens.

* **`JWT_SECRET`** & **`REFRESH_TOKEN_SECRET`**:
    * **How to get:** Generate a secure random string using Node.js.
    * **Command:** Open your terminal and run:
        ```bash
        node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
        ```
    * Run this twice to get two different strings for the two variables.

---

## 2. Email Configuration (SMTP)
This allows the system to send OTP codes and notifications via Gmail.

* **`EMAIL_USER`**: Your Gmail address (e.g., `user@gmail.com`).
* **`EMAIL_PASS`**: An **App Password**, not your regular password.
    * **Steps:**
        1. Go to your **Google Account** settings.
        2. Navigate to **Security**.
        3. Enable **2-Step Verification**.
        4. Search for **App Passwords**.
        5. Create a new app password (e.g., named "BrainBoost").
        6. Copy the 16-character code provided.

---

## 3. Database Connection (MongoDB)
* **`MONGO_URI`**: The connection string for your database.
    * **If using MongoDB Atlas (Cloud):**
        1. Log in to [MongoDB Atlas](https://www.mongodb.com/).
        2. Click **Connect** on your Cluster.
        3. Choose **Drivers** (Node.js).
        4. Copy the connection string and replace `<password>` with your database user password.
    * **If using Local MongoDB:** Use `mongodb://localhost:27017/brainboost`.

---

## 4. Cloud Media Storage (Cloudinary)
Used to store avatars and course/test cover images.

* **`CLOUDINARY_CLOUD_NAME`**, **`CLOUDINARY_API_KEY`**, **`CLOUDINARY_API_SECRET`**:
    * **Steps:**
        1. Log in to your [Cloudinary Dashboard](https://cloudinary.com/console).
        2. Your **Cloud Name**, **API Key**, and **API Secret** are displayed on the main Dashboard page under "Product Environment Credentials".

---

## 5. Artificial Intelligence (Gemini API)
Powers the AI tutoring, grading, and RAG systems.

* **`GEMINI_API_KEY`**:
    * **Steps:**
        1. Visit [Google AI Studio](https://aistudio.google.com/).
        2. Click **Get API key**.
        3. Create a key in a new or existing project.
* **`GEMINI_MODEL`**: Default is `gemini-2.5-flash` (recommended for speed and cost).

---

## 6. Environment & Ports
* **`NODE_ENV`**: Set to `development` for local testing.
* **`DB_PORT`**: Port for the Node.js server (Default: `8080`).
* **`AI_AGENT_URL`**: The address of your Python AI Microservice (Default: `http://localhost:8001`).
* **`FRONTEND_URL`**: The address of your React app (Default: `http://localhost:3001`) for CORS configuration.

---

## 7. Google Cloud Text-to-Speech (TTS) Credentials
The backend uses Google Cloud TTS for reading texts aloud. You need to provide a service account key file named `google-tts-key.json` in the root of your backend folder.

* **How to get `google-tts-key.json`:**
    * **Steps:**
        1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
        2. Create a new Project or select your existing project.
        3. Navigate to **APIs & Services** > **Library**, search for **Cloud Text-to-Speech API**, and click **Enable**.
        4. Go to **IAM & Admin** > **Service Accounts**.
        5. Click **Create Service Account**, give it a name (like `tts-service`), and click **Done**.
        6. Click on your newly created service account, navigate to the **Keys** tab.
        7. Click **Add Key** > **Create new key**. Choose the **JSON** format and click **Create**.
        8. The file will automatically download to your computer.
        9. **Rename** the downloaded file to exactly `google-tts-key.json` and move it into your backend's root folder.

---

# Project structure
```
├── chroma_db/                 # Local vector database storage for RAG (Retrieval-Augmented Generation)
│   ├── bd2a34ed-...           # Vector data collection (embeddings, HNSW indices) for specific knowledge bases    
│   ├── d2f63a93-...           # Another vector collection (e.g., separating course materials from test banks)   
│   └── chroma.sqlite3         # SQLite metadata database tracking document IDs, collections, and RAG metadata
├── .env.example               # Template for environment variables (e.g., OPENAI_API_KEY, HOST, PORT)
├── Dockerfile                 # Instructions to containerize the Python AI microservice for deployment
├── app.py                     # Main API gateway (FastAPI/Flask) routing incoming requests to specific AI agents
├── check_db.py                # Utility script to inspect, query, or debug the contents of the ChromaDB collections
├── flashcards_agent.py        # Multi-agent component: AI agent responsible for extracting concepts and generating flashcards
├── grading_agent.py           # Multi-agent component: AI agent for automated essay grading, scoring, and feedback generation
├── learning_path_agent.py     # Multi-agent component: AI agent for analyzing student data to create personalized learning paths
├── lesson_chat_agent.py       # Multi-agent component: AI conversational tutor for real-time Q&A during lessons
├── requirements.txt           # List of required Python dependencies (e.g., langchain, chromadb, fastapi, openai)
├── slides_agent.py            # Multi-agent component: AI agent designed to synthesize course content into presentation slides
└── vector_store.py            # Core RAG module managing embeddings, text chunking, and similarity search queries in ChromaDB

├── controllers/                 # Business logic layer: Handles incoming HTTP requests and returns responses
│   ├── adminController.js       # Manages global platform settings and system overviews
│   ├── adminInstructorController.js # Handles admin moderation of instructor accounts and content
│   ├── authController.js        # Manages user authentication, JWT token generation, and password resets
│   ├── badgeController.js       # Handles fetching and displaying gamification badges for users
│   ├── contactController.js     # Processes contact form submissions from the frontend
│   ├── courseController.js      # Manages course creation, fetching, and enrollment logic
│   ├── instructorController.js  # Instructor dashboard logic and course/test management
│   ├── learningController.js    # Tracks student learning progress and bookmarking
│   ├── notificationController.js# Manages retrieving and marking in-app notifications as read
│   ├── testController.js        # Core testing logic: submission, auto-grading, and leaderboard aggregation
│   └── userController.js        # Manages user profile updates, avatars, and preference settings
├── middleware/                  # Interceptors: Functions that run before requests hit the controllers
│   ├── auth.js                  # Secures routes using JWT verification and Anti-CSRF token checks
│   ├── mailer.js                # Core email configuration (e.g., Nodemailer setup)
│   ├── otpHelper.js             # Utility for generating and validating One-Time Passwords
│   ├── requireRole.js           # Role-based Access Control (RBAC) to restrict admin/instructor routes
│   ├── sendEmailOtp.js          # Specific middleware for dispatching OTP emails during auth flows
│   ├── uploadDoc.js             # Handles parsing and uploading document files (PDFs, Word)
│   └── uploadImage.js           # Handles parsing and uploading image files (Avatars, Course covers)
├── models/                      # Data Access Layer: MongoDB/Mongoose schemas defining database structures
│   ├── Badge.js                 # Schema defining gamification badges (name, icon, criteria)
│   ├── ContactMessage.js        # Schema for storing user support inquiries
│   ├── Course.js                # Schema for e-learning courses and modules
│   ├── Enrollment.js            # Junction schema mapping students to their enrolled courses
│   ├── InstructorApplication.js # Schema for users applying to become instructors
│   ├── LessonChatSession.js     # Schema storing chat history between students and the AI Tutor
│   ├── LessonProgress.js        # Tracks completion status of individual video/text lessons
│   ├── Notification.js          # Schema for real-time system alerts and user notifications
│   ├── Otp.js                   # Temporary storage schema for active OTP codes
│   ├── Test.js                  # Schema for exams, quizzes, and question banks
│   ├── TestResult.js            # Stores student answers, scores, and AI grading feedback
│   └── User.js                  # Core user schema including streaks, authentication data, and preferences
├── routes/                      # API Router: Maps URL endpoints to their specific controller functions
│   ├── adminInstructorRoutes.js # Routes for /api/admin/instructors
│   ├── adminRoutes.js           # Routes for /api/admin
│   ├── aiSlidesRoutes.js        # Routes proxying requests to the AI slide generation microservice
│   ├── authRoutes.js            # Routes for /api/auth (login, register, refresh tokens)
│   ├── badgeRoutes.js           # Routes for /api/badges
│   ├── contactRoutes.js         # Routes for /api/contact
│   ├── courseRoutes.js          # Routes for /api/courses
│   ├── flashcardRoutes.js       # Routes proxying requests to the AI flashcard microservice
│   ├── instructorRoutes.js      # Routes for /api/instructors
│   ├── learningRoutes.js        # Routes for /api/learning
│   ├── lessonChatRoutes.js      # Routes proxying requests to the AI Lesson Chatbot
│   ├── notificationRoutes.js    # Routes for /api/notifications
│   ├── testRoutes.js            # Routes for /api/tests
│   ├── ttsRoutes.js             # Routes for Google Text-to-Speech integration
│   └── userRoutes.js            # Routes for /api/users
├── services/                    # Shared utilities, background tasks, and external integrations
│   ├── badgeService.js          # Gamification engine: Evaluates streaks and awards badges dynamically
│   ├── cronService.js           # Scheduled background jobs (e.g., clearing expired OTPs, daily summaries)
│   ├── docTextService.js        # Utility for extracting raw text from uploaded PDFs/Word documents
│   ├── jsonMemoryService.js     # In-memory caching service for optimizing repetitive read operations
│   └── socketService.js         # Real-time WebSocket engine (Socket.IO) for instant notifications
├── .env.example                 # Template for required environment variables (DB strings, Secrets, API Keys)
├── Dockerfile                   # Containerization instructions for deploying the Node.js backend
├── cloudinaryConfig.js          # Configuration for integrating with Cloudinary (cloud media storage)
├── google-tts-key.json          # Service account credentials for Google Cloud Text-to-Speech API
├── package-lock.json            # Exact dependency versions tree
├── package.json                 # Project metadata, npm scripts, and list of dependencies
└── server.js                    # Application Entry Point: Initializes Express, connects to MongoDB, starts Socket.IO

├── public/                      # Static assets served directly by the web server
│   ├── image/                   # Landing page illustrations and marketing graphics
│   │   ├── about-bb.png
│   │   ├── ai-sp.png            # AI Support feature illustration
│   │   └── ...                  # (Other promotional images)
│   ├── favicon.ico.png          # Website icon displayed in the browser tab
│   ├── index.html               # The single main HTML template where the React app is injected
│   ├── manifest.json            # Web App Manifest for PWA (Progressive Web App) settings
│   └── robots.txt               # Instructions for search engine web crawlers
├── src/                         # Main source code directory for the React application
│   ├── components/              # UI Components and Main Page Views
│   │   ├── profile/             # Role-specific dashboard widgets and overviews
│   │   │   ├── AdminOverview.js     # Statistics and controls for system administrators
│   │   │   ├── InstructorOverview.js# Course and student metrics for instructors
│   │   │   └── StudentDashboard.js  # Learning progress and quick actions for students
│   │   ├── AboutUs.js               # "About Us" informational page
│   │   ├── AdminDashboard.js        # Global administration panel (users, content moderation)
│   │   ├── AllCourses.js            # Course catalog/library page with filters
│   │   ├── AllTests.js              # Public test bank/library for students
│   │   ├── ApplyInstructor.js       # Form for students to apply for instructor roles
│   │   ├── BadgeCase.js             # Gamification UI displaying earned achievements
│   │   ├── Contact.js               # Contact and support form
│   │   ├── ContentCover.js          # Reusable UI wrapper for course/test thumbnails
│   │   ├── CourseDetail.js          # Detailed view of a specific course's syllabus
│   │   ├── CourseEditor.js          # Instructor tool for creating and updating courses
│   │   ├── CoursePlayer.js          # The learning interface (video player, text lessons)
│   │   ├── Footer.js                # Global website footer component
│   │   ├── ForgotPassword.js        # Password recovery flow (OTP entry)
│   │   ├── FormulaDisplay.js        # Renders mathematical/scientific formulas safely
│   │   ├── FormulaEditor.js         # Input tool for teachers to type complex formulas
│   │   ├── Header.js                # Global navigation bar (sticky, responsive)
│   │   ├── Help.js                  # FAQ and user guide page
│   │   ├── HomePage.js              # Landing page with AI Path generator and featured content
│   │   ├── InstructorDashboard.js   # Main hub for instructors to manage their content
│   │   ├── Leaderboard.js           # UI ranking top students for specific tests
│   │   ├── Learning.js              # Student's personal library of enrolled courses and bookmarks
│   │   ├── Login.js                 # User authentication page
│   │   ├── Profile.js               # User profile page (routes to specific role dashboards)
│   │   ├── Register.js              # New user account creation page
│   │   ├── RequireAuth.js           # High-order component (HOC) protecting private routes
│   │   ├── ScrollToTop.js           # Utility component to reset scroll position on route change
│   │   ├── Settings.js              # User preferences (theme, notification settings)
│   │   ├── TestEditor.js            # Instructor tool for building exams and quizzes
│   │   ├── TestPlayer.js            # The active exam-taking interface with countdown timer
│   │   ├── TestResultView.js        # Detailed post-exam review, score, and AI feedback
│   │   ├── UpdateProfile.js         # Form to edit personal info and avatars
│   │   └── VerifyCode.js            # Registration OTP verification screen
│   ├── context/                 # Global State Management (React Context API)
│   │   ├── SocketContext.js         # Manages WebSocket connection for real-time notifications
│   │   └── UserContext.js           # Manages global user state, auth status, and themes
│   ├── css/                     # Component-specific stylesheets
│   │   └── *.css                    # CSS files matching their respective components
│   ├── images/                  # Dynamic and default application images
│   │   ├── defaultAvatar.png      # Fallback image for users without avatars
│   │   └── skills-placeholder.png # Fallback cover for courses/tests
│   ├── pages/                   # Secondary or static pages
│   │   ├── Privacy.js               # Privacy Policy documentation
│   │   ├── Term.js                  # Terms of Service documentation
│   │   └── legal.css                # Styles for legal documents
│   ├── utils/                   # Reusable helper functions
│   │   └── url.js                   # URL formatting and routing utilities
│   ├── App.css                  # Global CSS resets and application-wide styles
│   ├── App.js                   # Root React component defining all React Router paths
│   ├── App.test.js              # Initial unit tests for the App component
│   ├── api.js                   # Global Axios instance configuration (interceptors, token refresh)
│   ├── index.css                # Base CSS (variables, fonts, CSS resets)
│   ├── index.js                 # React DOM entry point: mounts the App to index.html
│   └── setupTests.js            # Configuration for the Jest testing framework
├── .env.example                 # Template for Frontend environment variables (e.g., Backend URL)
├── .gitignore                   # Specifies intentionally untracked files to ignore in Git
├── Dockerfile                   # Instructions to build and serve the React app via Nginx/Node
├── README.md                    # Project documentation and setup instructions
├── package-lock.json            # Exact frontend dependency versions tree
└── package.json                 # Project metadata, scripts (start, build), and dependencies
```
