const Course = require("../models/Course");
const axios = require("axios");
const mongoose = require("mongoose");
const LessonProgress = require("../models/LessonProgress");
const Enrollment = require("../models/Enrollment");
const socketService = require('../services/socketService');

const AI_AGENT_URL = process.env.AI_AGENT_URL

/**
 * * POST /api/courses
 * Handles the creation of a new course.
 * Validates mandatory fields and initial curriculum structure.
 * New courses are set to "pending" by default to await admin moderation.
 */
const createCourse = async (req, res) => {
  try {
    const p = req.body || {};

    // Validate required fields before proceeding
    if (!p.title || !p.subject || !p.grade || !p.description) {
      return res.status(400).json({ message: "Missing required fields." });
    }

    // Ensure at least one section exists to prevent empty courses
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
      visibility: "pending",
      adminFeedback: ""
    });

    // Notify Admin of a new course pending review
    await socketService.notifyAdmins({
      title: "New Course Pending Review",
      message: `An instructor has submitted the course "${doc.title}" for moderation.`,
      type: "system",
      link: `/admin/courses`
    });

    res.status(201).json({ id: doc._id, message: "Course submitted for review." });
  } catch (e) {
    console.error("createCourse error:", e);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * * GET /api/courses/:id
 * Retrieves a specific course by its ID for editing purposes.
 * Ensures that only the creator (instructor) OR an admin can access the raw course data.
 */
const getCourse = async (req, res) => {
  try {
    const c = await Course.findById(req.params.id).lean();
    if (!c) return res.status(404).json({ message: "Not found" });

    // Authorization check: Verify if the requester is the course creator or an Admin
    const isOwner = String(c.createdBy) === String(req.userId);
    const isAdmin = String(req.userRole) === "admin";

    if (!isOwner && !isAdmin) {
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
 * Updates specific fields of an existing course.
 * Resets visibility to "pending" (unless specified as "draft") to ensure 
 * updated content is re-moderated by an admin.
 */
const updateCourse = async (req, res) => {
  try {
    const c = await Course.findById(req.params.id);
    if (!c) return res.status(404).json({ message: "Not found" });

    // Verify that the instructor owns this course// Authorization check
    if (String(c.createdBy) !== String(req.userId)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const p = req.body || {};

    // Map updated fields from payload or preserve existing ones
    c.title = p.title ?? c.title;
    c.slug = p.slug ?? c.slug;
    c.subject = p.subject ?? c.subject;
    c.grade = p.grade ?? c.grade;
    c.description = p.description ?? c.description;
    c.tags = Array.isArray(p.tags) ? p.tags : c.tags;
    c.price = p.price ?? c.price;
    c.coverUrl = p.coverUrl ?? c.coverUrl;
    c.learn = Array.isArray(p.learn) ? p.learn : c.learn;
        
    // Update curriculum sections if provided
    if (Array.isArray(p.sections) && p.sections.length > 0) {
      c.sections = p.sections;
    }

    // Logic for handling save state: can be saved as a local "draft" or submitted as "pending"
    if (p.visibility === "draft" || p.visibility === "pending") {
      c.visibility = p.visibility;
    } else {
      c.visibility = "pending";
    }

    // Wipe old feedback to indicate a fresh review is needed
    c.adminFeedback = "";

    await c.save();

    // Notify Admin of course update
    if (c.visibility === "pending") {
      await socketService.notifyAdmins({
        title: "Course Updated",
        message: `The course "${c.title}" has been updated and re-submitted for review.`,
        type: "system",
        link: `/admin/courses`
      });
    }

    res.json({ message: "Updated" });
  } catch (e) {
    console.error("updateCourse error:", e);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * * GET /api/courses
 * Lists courses for the instructor dashboard with filters and server-side pagination.
 * Supports searching by query string, subject, grade, and current status.
 */
const listCourses = async (req, res) => {
  try {
    const { q = "", subject, grade, status } = req.query;
    const mine = String(req.query.mine || "") === "1";

    const cond = {};
    if (subject && subject !== "all") cond.subject = subject;
    if (grade && grade !== "All") cond.grade = grade;
    if (status && status !== "All") {
        cond.visibility = status.toLowerCase();
    }

    // Ensure the instructor only sees their own content when requested
    if (mine) {
      if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
      cond.createdBy = req.userId;
    }

    // Regex-based search across multiple fields
    if (q) {
      cond.$or = [
        { title: { $regex: q, $options: "i" } },
        { description: { $regex: q, $options: "i" } },
        { tags: { $elemMatch: { $regex: q, $options: "i" } } },
      ];
    }

    // Pagination logic (Defaults to page 1, 12 items per page)
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const skip = (page - 1) * limit;

    const totalItems = await Course.countDocuments(cond);
    const totalPages = Math.ceil(totalItems / limit);

    const rows = await Course.find(cond)
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Map raw DB rows to a clean format for the dashboard UI
    const data = rows.map((c) => {
      const sections = Array.isArray(c.sections) ? c.sections : [];

      // Flatten sections to count total lessons
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
        visibility: c.visibility,
        adminFeedback: c.adminFeedback
      };
    });

    res.json({
      data: data,
      pagination: {
        currentPage: page,
        totalPages: totalPages,
        totalItems: totalItems,
        limit: limit
      }
    });

  } catch (e) {
    console.error("Lỗi listCourses:", e);
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
        grade: c.grade,
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

// ==== Admin Moderation Controllers ====

/**
 * * GET /api/courses/admin/list
 * Admin only route: Retrieves courses based on their approval status (pending, published, rejected).
 * Populates instructor details so admins know who submitted the content.
 */
const getAdminCourses = async (req, res) => {
  try {
    const { status = "pending" } = req.query;
    const courses = await Course.find({ visibility: status })
      .populate('createdBy', 'fullname email') // Pull instructor contact info
      .sort({ updatedAt: -1 })
      .lean();
    res.json(courses);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * * PATCH /api/courses/admin/:id/review
 * Admin only: Approves or rejects an instructor's submission.
 * Upon approval, it automatically archives existing published versions to avoid duplication.
 */
const reviewCourse = async (req, res) => {
  try {
    const { status, note } = req.body;

    // Prevent invalid statuses from polluting the database
    if (!["published", "rejected"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const c = await Course.findById(req.params.id);
    if (!c) return res.status(404).json({ message: "Course not found" });

    c.visibility = status;
    c.adminFeedback = note || "";

    // If approved for publication
    if (status === "published") {
      // Remove "(Draft Edit)" suffix from the title
      c.title = c.title.replace(/\s*\(Draft Edit\)/i, "").trim();

      // Find the old version (same title/creator) and archive it automatically
      await Course.updateMany(
        { 
          _id: { $ne: c._id }, 
          createdBy: c.createdBy, 
          title: c.title, 
          visibility: "published" 
        },
        { $set: { visibility: "archived" } }
      );
    }

    await c.save();

    // Send Real-time notification to the Instructor
    const actionText = status === "published" ? "approved" : "needs revision";
    const messageText = status === "published" 
      ? `Your course "${c.title}" has been approved. Students can now view and enroll in it!`
      : `Your course "${c.title}" was rejected. Reason: ${note || "Please review the content."}`;

    try {
      await socketService.sendNotification({
        userId: c.createdBy, 
        title: `Content Moderation: ${actionText}`,
        message: messageText,
        type: "content", 
        link: `/instructor/courses/${c._id}/edit`
      });
    } catch (err) {
      console.error("Notification emission error:", err);
    }

    res.json({ message: `Course ${status}` });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * * PATCH /api/courses/:id/archive
 * Manually moves a course to the archives to hide it from students without deleting data.
 */
const archiveCourse = async (req, res) => {
  try {
    const c = await Course.findById(req.params.id);
    if (!c) return res.status(404).json({ message: "Not found" });
    if (String(c.createdBy) !== String(req.userId)) return res.status(403).json({ message: "Forbidden" });
        
    c.visibility = "archived";
    await c.save();
    res.json({ message: "Course archived successfully" });
  } catch (e) {
        res.status(500).json({ message: "Server error" });
  }
};

/**
 * * POST /api/courses/:id/clone
 * Creates a duplicate "draft" clone of a course, allowing instructors 
 * to work on updates without disrupting the live published version.
 */
const createDraftClone = async (req, res) => {
  try {
    const c = await Course.findById(req.params.id).lean();
    if (!c) return res.status(404).json({ message: "Not found" });
    if (String(c.createdBy) !== String(req.userId)) return res.status(403).json({ message: "Forbidden" });

    // Strip unique identifiers and timestamps to prepare for a new document
    const { _id, createdAt, updatedAt, ...restData } = c;
        
    const clonedCourse = await Course.create({
      ...restData,
      title: `${c.title} (Draft Edit)`,   // Mark it as an edit version
      visibility: "draft",
      adminFeedback: ""
    });
        
    res.status(201).json({ id: clonedCourse._id, message: "Draft clone created" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * * GET /api/courses/:id/check-enrollment
 * Checks if the current user is already enrolled in this course.
 */
const checkEnrollment = async (req, res) => {
  try {
    const enrollment = await Enrollment.findOne({ user: req.userId, course: req.params.id, status: 'active' });
    res.json({ isEnrolled: !!enrollment });
  } catch (e) {
    console.error("checkEnrollment error:", e);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * * POST /api/courses/:id/enroll
 * Mock Purchase: Simulates a successful course purchase/enrollment.
 */
const enrollCourse = async (req, res) => {
  try {
    const courseId = req.params.id;
    const userId = req.userId;

    // Check if the course exists and is currently published
    const course = await Course.findById(courseId);
      if (!course || course.visibility !== 'published') {
        return res.status(404).json({ message: "Course not found or not available." });
      }

    // Check if the user is already enrolled
    const existing = await Enrollment.findOne({ user: userId, course: courseId });
    if (existing) {
      return res.status(400).json({ message: "You are already enrolled in this course." });
    }

    // Create a successful enrollment record (A real payment gateway charge would go here)
    await Enrollment.create({
      user: userId,
      course: courseId,
      status: 'active'
    });

    // Send Real-time notification to the Instructor
    await socketService.sendNotification({
      userId: course.createdBy,
      title: "New Student!",
      message: `A new student has enrolled in your course "${course.title}".`,
      type: "system", 
      link: `/instructor` 
    });

    res.status(201).json({ message: "Enrollment successful!" });
  } catch (e) {
    console.error("enrollCourse error:", e);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * * GET /api/courses/enrolled
 * Retrieves a list of active courses the current student is enrolled in.
 */
const getMyEnrolledCourses = async (req, res) => {
  try {
    // Find active enrollments and populate necessary course data for the UI
    // Sort by newest enrollment first
    const enrollments = await Enrollment.find({ user: req.userId, status: 'active' })
      .populate({
        path: 'course',
        select: 'title coverUrl subject grade' 
      })
      .sort({ enrolledAt: -1 }); 

    // Filter out invalid records (e.g., if a course was hard-deleted by an admin)
    const validEnrollments = enrollments.filter(e => e.course);
      
    // Return a clean array of data
    res.json(validEnrollments.map(e => ({
      enrolledAt: e.enrolledAt,
      course: e.course
    })));
  } catch (e) {
    console.error("getMyEnrolledCourses error:", e);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  createCourse, getCourse, updateCourse, listCourses, listPublicCourses,
  getPublicCourseById, deleteCourse, generateLessonSlides, createLearningPath, markLessonProgress,
  getAdminCourses, reviewCourse, archiveCourse, createDraftClone, checkEnrollment,
  enrollCourse, getMyEnrolledCourses, 
};