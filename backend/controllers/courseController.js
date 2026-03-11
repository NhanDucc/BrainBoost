const Course = require("../models/Course");
const axios = require("axios");
const mongoose = require("mongoose");
const LessonProgress = require("../models/LessonProgress");

// Retrieve the AI microservice URL from environment variables
const AI_AGENT_URL = process.env.AI_AGENT_URL

/**
 * * POST /api/courses
 * Creates a new course in the database.
 * Validates required metadata and initializes the course with a "published" visibility.
 */
const createCourse = async (req, res) => {
    try {
        const p = req.body || {};

        // Validate required fields before proceeding
        if (!p.title || !p.subject || !p.grade || !p.description) {
            return res.status(400).json({ message: "Missing required fields." });
        }

        const sections = Array.isArray(p.sections) ? p.sections : [];
        if (sections.length < 1) {
            return res.status(400).json({ message: "Add at least 1 section." });
        }

        // Create and save the new course document
        const doc = await Course.create({
            title: p.title.trim(),
            slug: (p.slug || "").trim(),
            subject: p.subject,
            grade: p.grade,
            description: p.description || "",
            tags: Array.isArray(p.tags) ? p.tags : [],
            price: p.price ?? null,
            coverUrl: p.coverUrl || "",
            learn: Array.isArray(p.learn) ? p.learn : [],
            sections,
            createdBy: req.userId,
            visibility: "published"
        });

        res.status(201).json({ id: doc._id, message: "Created" });
    } catch (e) {
        console.error("createCourse error:", e);
        res.status(500).json({ message: "Server error" });
    }
};

/**
 * * GET /api/courses/:id
 * Retrieves a specific course by its ID for editing purposes.
 * Ensures that only the creator (instructor) can access the raw course data.
 */
const getCourse = async (req, res) => {
  try {
    const c = await Course.findById(req.params.id).lean();
    if (!c) return res.status(404).json({ message: "Not found" });

    // Authorization check: Verify if the requester is the course creator
    if (String(c.createdBy) !== String(req.userId)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    res.json(c);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * * PATCH /api/courses/:id
 * Updates an existing course.
 * Verifies ownership before applying the requested partial updates to the database.
 */
const updateCourse = async (req, res) => {
    try {
        const c = await Course.findById(req.params.id);
        if (!c) return res.status(404).json({ message: "Not found" });

        // Authorization check
        if (String(c.createdBy) !== String(req.userId)) {
          return res.status(403).json({ message: "Forbidden" });
        }

        const p = req.body || {};

        // Conditionally update fields if they are provided in the payload
        c.title = p.title ?? c.title;
        c.slug = p.slug ?? c.slug;
        c.subject = p.subject ?? c.subject;
        c.grade = p.grade ?? c.grade;
        c.description = p.description ?? c.description;
        c.tags = Array.isArray(p.tags) ? p.tags : c.tags;
        c.price = p.price ?? c.price;
        c.coverUrl = p.coverUrl ?? c.coverUrl;
        c.learn = Array.isArray(p.learn) ? p.learn : c.learn;
        
        // Completely replace sections if a valid array is provided
        if (Array.isArray(p.sections) && p.sections.length > 0) {
            c.sections = p.sections;
        }

        await c.save();
        res.json({ message: "Updated" });
    } catch (e) {
        console.error("updateCourse error:", e);
        res.status(500).json({ message: "Server error" });
    }
};

/**
 * * GET /api/courses
 * Lists courses based on search queries or filters.
 * Used primarily for the Instructor Dashboard (mine=1) to view their own courses.
 */
const listCourses = async (req, res) => {
  try {
    const { q = "", subject } = req.query;
    const mine = String(req.query.mine || "") === "1";  // Flag to fetch only the user's courses

    const cond = {};
    if (subject) cond.subject = subject;

    // Filter by the logged-in user if 'mine' flag is present
    if (mine) {
      if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
      cond.createdBy = req.userId;
    }

    // Apply regex search on title, description, or tags (case-insensitive)
    if (q) {
      cond.$or = [
        { title: { $regex: q, $options: "i" } },
        { description: { $regex: q, $options: "i" } },
        { tags: { $elemMatch: { $regex: q, $options: "i" } } },
      ];
    }

    const rows = await Course.find(cond).sort({ updatedAt: -1 }).lean();

    // Format the output payload
    const data = rows.map((c) => {
      const sections = Array.isArray(c.sections) ? c.sections : [];
      // Calculate the total number of lessons across all sections
      const lessons = sections.reduce((acc, s) => acc + ((s.lessons || []).length), 0);
      
      return {
        id: String(c._id),
        _id: c._id,                
        title: c.title,
        subject: c.subject,
        grade: c.grade,
        coverUrl: c.coverUrl || "",
        description: c.description || "",
        tags: c.tags || [],
        priceUSD: c.price ?? 0,    
        lessons,
        hours: null,               
        updatedAt: c.updatedAt,
        createdAt: c.createdAt,
        sections: c.sections || [], 
      };
    });

    res.json(data);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * * GET /api/courses/public
 * Retrieves a list of published courses for students.
 * Aggregates total lessons and calculates total estimated hours automatically.
 */
const listPublicCourses = async (req, res) => {
  try {
    const { q = "", subject } = req.query;
    const cond = { visibility: "published" }; // Only fetch published courses

    if (subject) {
      cond.subject = subject;  
    }

    const term = q.trim();
    if (term) {
      const regex = new RegExp(term, "i");
      cond.$or = [
        { title: regex },
        { description: regex },
        { tags: regex },
      ];
    }

    const docs = await Course.find(cond).sort({ updatedAt: -1 }).lean();

    const result = docs.map((c) => {
      const sections = Array.isArray(c.sections) ? c.sections : [];
      let lessonCount = 0;
      let totalMinutes = 0;

      // Map through the documents to calculate dynamic totals (lessons and hours)
      sections.forEach((s) => {
        (s.lessons || []).forEach((l) => {
          lessonCount += 1;
          if (typeof l.durationMin === "number") {
            totalMinutes += l.durationMin;
          }
        });
      });

      // Convert total minutes into hours (rounded to 1 decimal place)
      const hours =
        totalMinutes > 0
          ? Math.round((totalMinutes / 60) * 10) / 10
          : null;

      return {
        id: c._id,
        title: c.title,
        subject: c.subject,
        coverUrl: c.coverUrl,
        priceUSD: c.price ?? null,
        lessons: lessonCount,
        hours,
      };
    });

    res.json(result);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * * GET /api/courses/public/:id
 * Fetches detailed information for a specific published course.
 * Used on the Course Preview page to display the syllabus and metadata.
 */
const getPublicCourseById = async (req, res) => {
  try {
    const c = await Course.findById(req.params.id).lean();
    if (!c) {
      return res.status(404).json({ message: "Course not found" });
    }

    const sections = Array.isArray(c.sections) ? c.sections : [];
    // Count total lessons
    const lessons = sections.reduce(
      (acc, s) => acc + ((s.lessons || []).length),
      0
    );

    const course = {
      id: String(c._id),
      _id: c._id,
      title: c.title,
      subject: c.subject,
      grade: c.grade,
      coverUrl: c.coverUrl || "",
      description: c.description || "",
      tags: c.tags || [],
      priceUSD: c.price ?? 0,
      lessons,
      hours: null,          
      updatedAt: c.updatedAt,
      createdAt: c.createdAt,
      sections,             
      learn: c.learn || [],   // The "What you'll learn" features array
    };

    res.json(course);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * * DELETE /api/courses/:id
 * Deletes a course from the database.
 * Security: Only the course owner or an admin can perform this action.
 */
const deleteCourse = async (req, res) => {
  try {
    const c = await Course.findById(req.params.id);
    if (!c) return res.status(404).json({ message: "Not found" });

    const isOwner = String(c.createdBy) === String(req.userId);
    const isAdmin = String(req.userRole) === "admin";

    // Validate authorization
    if (!isOwner && !isAdmin) return res.status(403).json({ message: "Forbidden" });

    await c.deleteOne();
    res.json({ message: "Deleted" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * * POST /api/courses/:courseId/sections/:secIndex/lessons/:lessonIndex/gen-slides
 * Forwards lesson text to the external Python AI Agent to automatically generate presentation slides.
 */
async function generateLessonSlides(req, res) {
  try {
    const { courseId, secIndex, lessonIndex } = req.params;
    const { numSlides } = req.body;

    if (!mongoose.Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({ message: "Invalid courseId format" });
    }

    const sectionIdx = parseInt(secIndex, 10);
    const lessonIdx = parseInt(lessonIndex, 10);

    // Locate the exact course, section, and lesson
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    if (!course.sections || !course.sections[sectionIdx]) {
      return res.status(404).json({ message: "Section not found" });
    }

    const section = course.sections[sectionIdx];
    if (!section.lessons || !section.lessons[lessonIdx]) {
      return res.status(404).json({ message: "Lesson not found" });
    }

    const lesson = section.lessons[lessonIdx];

    // Ensure there is textual content available for the AI to summarize
    if (!lesson.lessonText) {
      return res.status(400).json({
        message:
          "Lesson content is empty. Please upload or input lesson text first.",
      });
    }

    // Construct the payload for the Python microservice
    const payload = {
      lesson_id: `${courseId}:s${sectionIdx}:l${lessonIdx}`,
      lesson_title: lesson.title || course.title || "Untitled lesson",
      lesson_text: lesson.lessonText,
      num_slides: numSlides || 8,
    };

    // Forward the request to the AI agent
    const resp = await axios.post(
      `${AI_AGENT_URL}/generate-slides`,
      payload,
      { timeout: 60000 }    // Extended timeout for AI processing
    );

    const slidesFromAgent = resp.data?.slides || [];

    // Map the returned slides to the schema format
    lesson.aiSlides = slidesFromAgent.map((s, idx) => ({
      index: typeof s.index === "number" ? s.index : idx,
      title: s.title || `Slide ${idx + 1}`,
      bullets: Array.isArray(s.bullets) ? s.bullets : [],
      ttsText:
        s.ttsText ||
        (Array.isArray(s.bullets) ? s.bullets.join(". ") : ""),   // Fallback Text-to-Speech text
      imagePrompt: s.imagePrompt || "",
    }));

    await course.save();

    return res.json({ slides: lesson.aiSlides });
  } catch (err) {
    console.error("[generateLessonSlides] error:", err.response?.data || err);
    return res
      .status(500)
      .json({ message: "Failed to generate slides with AI" });
  }
};

/**
 * * POST /api/courses/learning-path
 * Analyzes a user's typed goal and recommends a personalized learning path 
 * by calling the external AI Agent.
 */
async function createLearningPath (req, res) {
    try {
        const { goal } = req.body;
        if (!goal) return res.status(400).json({ message: "Please tell us your goal." });

        // Retrieve all available published courses to feed into the AI
        const courses = await Course.find({ visibility: 'published' })
            .select('_id title subject grade description')
            .lean();

        const availableCourses = courses.map(c => ({
            id: c._id.toString(),
            title: c.title,
            subject: c.subject,
            grade: c.grade,
            description: c.description || ""
        }));

        // Send the user goal and course inventory to the AI Agent
        const aiResponse = await axios.post(`${AI_AGENT_URL}/generate-learning-path`, {
            user_goal: goal,
            available_courses: availableCourses
        });

        const { advice, recommended_courses } = aiResponse.data;

        // Map the AI recommendations back to the full course objects
        const resultCourses = recommended_courses.map(rc => {
            const fullInfo = availableCourses.find(c => c.id === rc.course_id);
            return {
                ...fullInfo,
                reason: rc.reason   // Include the AI's reasoning for why this course was picked
            };
        }).filter(item => item.id);

        res.json({ advice, path: resultCourses });

    } catch (err) {
        console.error("Learning Path Error:", err.message);
        res.status(500).json({ message: "Failed to generate path" });
    }
};

/**
 * * POST /api/courses/:id/progress
 * Records or updates the time a student has spent studying a specific lesson.
 * Logs progress daily to prevent overwriting historical study time.
 */
const markLessonProgress = async (req, res) => {
  try {
    const courseId = req.params.id;
    const { lessonKey, timeSpent } = req.body;

    const course = await Course.findById(courseId).select('subject');
    if (!course) return res.status(404).json({ message: "Course not found" });

    // Reset the time to midnight to group progress by day
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Look for an existing progress record created today
    let progress = await LessonProgress.findOne({
      user: req.userId,
      course: courseId,
      lessonKey: lessonKey,
      lastAccessed: { $gte: today } 
    });

    // Update time if record exists, otherwise create a new daily record
    if (progress) {
      progress.lastAccessed = Date.now();
      progress.timeSpent += (timeSpent || 1);
      await progress.save();
    } else {
      progress = await LessonProgress.create({
        user: req.userId,
        course: courseId,
        lessonKey: lessonKey,
        subject: course.subject,
        timeSpent: timeSpent || 1,
        lastAccessed: Date.now()
      });
    }

    res.json({ message: "Progress recorded", progress });
  } catch (error) {
    console.error("Progress error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  createCourse, getCourse, updateCourse, listCourses, listPublicCourses,
  getPublicCourseById, deleteCourse, generateLessonSlides, createLearningPath, markLessonProgress,
};