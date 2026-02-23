const Course = require("../models/Course");
const axios = require("axios");
const mongoose = require("mongoose");
const LessonProgress = require("../models/LessonProgress");

const AI_AGENT_URL = process.env.AI_AGENT_URL

// POST /api/courses
const createCourse = async (req, res) => {
    try {
        const p = req.body || {};
        if (!p.title || !p.subject || !p.grade || !p.description) {
            return res.status(400).json({ message: "Missing required fields." });
        }
        const sections = Array.isArray(p.sections) ? p.sections : [];
        if (sections.length < 1) {
            return res.status(400).json({ message: "Add at least 1 section." });
        }

        const doc = await Course.create({
            title: p.title.trim(),
            slug: (p.slug || "").trim(),
            subject: p.subject,
            grade: p.grade,
            description: p.description || "",
            tags: Array.isArray(p.tags) ? p.tags : [],
            price: p.price ?? null,
            coverUrl: p.coverUrl || "",
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

// GET /api/courses/:id
const getCourse = async (req, res) => {
  try {
    const c = await Course.findById(req.params.id).lean();
    if (!c) return res.status(404).json({ message: "Not found" });
    if (String(c.createdBy) !== String(req.userId)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    res.json(c);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
};

// PATCH /api/courses/:id
const updateCourse = async (req, res) => {
    try {
        const c = await Course.findById(req.params.id);
        if (!c) return res.status(404).json({ message: "Not found" });
        if (String(c.createdBy) !== String(req.userId)) {
        return res.status(403).json({ message: "Forbidden" });
        }

        const p = req.body || {};
        c.title = p.title ?? c.title;
        c.slug = p.slug ?? c.slug;
        c.subject = p.subject ?? c.subject;
        c.grade = p.grade ?? c.grade;
        c.description = p.description ?? c.description;
        c.tags = Array.isArray(p.tags) ? p.tags : c.tags;
        c.price = p.price ?? c.price;
        c.coverUrl = p.coverUrl ?? c.coverUrl;
        if (Array.isArray(p.sections) && p.sections.length > 0) c.sections = p.sections;

        await c.save();
        res.json({ message: "Updated" });
    } catch (e) {
        console.error("updateCourse error:", e);
        res.status(500).json({ message: "Server error" });
    }
};

// GET /api/courses
const listCourses = async (req, res) => {
  try {
    const { q = "", subject } = req.query;
    const mine = String(req.query.mine || "") === "1";

    const cond = {};
    if (subject) cond.subject = subject;

    if (mine) {
      if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
      cond.createdBy = req.userId;
    }

    if (q) {
      cond.$or = [
        { title: { $regex: q, $options: "i" } },
        { description: { $regex: q, $options: "i" } },
        { tags: { $elemMatch: { $regex: q, $options: "i" } } },
      ];
    }

    const rows = await Course.find(cond).sort({ updatedAt: -1 }).lean();

    // Chuẩn hoá dữ liệu trả về cho AllCourses/Instructor
    const data = rows.map((c) => {
      const sections = Array.isArray(c.sections) ? c.sections : [];
      const lessons = sections.reduce((acc, s) => acc + ((s.lessons || []).length), 0);
      return {
        id: String(c._id),
        _id: c._id,                // để tab instructor dùng trực tiếp
        title: c.title,
        subject: c.subject,
        grade: c.grade,
        coverUrl: c.coverUrl || "",
        description: c.description || "",
        tags: c.tags || [],
        priceUSD: c.price ?? 0,    // client đang hiển thị priceUSD
        lessons,
        hours: null,               // chưa tính giờ => để null
        updatedAt: c.updatedAt,
        createdAt: c.createdAt,
        sections: c.sections || [], // tab instructor cần tính lessons
      };
    });

    res.json(data);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
};

// GET /api/courses/public
const listPublicCourses = async (req, res) => {
  try {
    const { q = "", subject } = req.query;

    // chỉ lấy course đã publish
    const cond = { visibility: "published" };

    if (subject) {
      cond.subject = subject;  // math / english / physics / chemistry
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

      sections.forEach((s) => {
        (s.lessons || []).forEach((l) => {
          lessonCount += 1;
          if (typeof l.durationMin === "number") {
            totalMinutes += l.durationMin;
          }
        });
      });

      const hours =
        totalMinutes > 0
          ? Math.round((totalMinutes / 60) * 10) / 10 // làm tròn 1 chữ số thập phân
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

// GET /api/courses/public/:id
const getPublicCourseById = async (req, res) => {
  try {
    const c = await Course.findById(req.params.id).lean();
    if (!c) {
      return res.status(404).json({ message: "Course not found" });
    }

    const sections = Array.isArray(c.sections) ? c.sections : [];
    const lessons = sections.reduce(
      (acc, s) => acc + ((s.lessons || []).length),
      0
    );

    // Chuẩn hóa dữ liệu giống format listCourses trả về
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
      hours: null,          // hiện chưa có tổng giờ, để null
      updatedAt: c.updatedAt,
      createdAt: c.createdAt,
      sections,             // để trang CourseDetail dùng làm syllabus
    };

    res.json(course);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
};

// DELETE /api/courses/:id
const deleteCourse = async (req, res) => {
  try {
    const c = await Course.findById(req.params.id);
    if (!c) return res.status(404).json({ message: "Not found" });

    const isOwner = String(c.createdBy) === String(req.userId);
    const isAdmin = String(req.userRole) === "admin";
    if (!isOwner && !isAdmin) return res.status(403).json({ message: "Forbidden" });

    await c.deleteOne();
    res.json({ message: "Deleted" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
};

// POST /api/courses/:courseId/sections/:secIndex/lessons/:lessonIndex/gen-slides
async function generateLessonSlides(req, res) {
  try {
    const { courseId, secIndex, lessonIndex } = req.params;
    const { numSlides } = req.body;

    if (!mongoose.Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({ message: "Invalid courseId format" });
    }

    const sectionIdx = parseInt(secIndex, 10);
    const lessonIdx = parseInt(lessonIndex, 10);

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

    if (!lesson.lessonText) {
      return res.status(400).json({
        message:
          "Lesson content is empty. Please upload or input lesson text first.",
      });
    }

    // Payload gửi sang ai-agent
    const payload = {
      lesson_id: `${courseId}:s${sectionIdx}:l${lessonIdx}`,
      lesson_title: lesson.title || course.title || "Untitled lesson",
      lesson_text: lesson.lessonText,
      num_slides: numSlides || 8,
    };

    // Gọi sang AI agent: /generate-slides
    const resp = await axios.post(
      `${AI_AGENT_URL}/generate-slides`,
      payload,
      { timeout: 60000 }
    );

    const slidesFromAgent = resp.data?.slides || [];

    // Map lại theo schema AiSlide trong Course.js
    lesson.aiSlides = slidesFromAgent.map((s, idx) => ({
      index: typeof s.index === "number" ? s.index : idx,
      title: s.title || `Slide ${idx + 1}`,
      bullets: Array.isArray(s.bullets) ? s.bullets : [],
      ttsText:
        s.ttsText ||
        (Array.isArray(s.bullets) ? s.bullets.join(". ") : ""),
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

// POST /api/courses/learning-path
async function createLearningPath (req, res) {
    try {
        const { goal } = req.body;
        if (!goal) return res.status(400).json({ message: "Please tell us your goal." });

        // 1. Lấy danh sách khóa học (chỉ lấy field cần thiết để nhẹ payload)
        const courses = await Course.find({ visibility: 'published' })
            .select('_id title subject grade description')
            .lean();

        // Map _id thành id string cho gọn
        const availableCourses = courses.map(c => ({
            id: c._id.toString(),
            title: c.title,
            subject: c.subject,
            grade: c.grade,
            description: c.description || ""
        }));

        // 2. Gọi AI Agent
        const aiResponse = await axios.post(`${AI_AGENT_URL}/generate-learning-path`, {
            user_goal: goal,
            available_courses: availableCourses
        });

        const { advice, recommended_courses } = aiResponse.data;

        // 3. (Optional) Map lại thông tin chi tiết khóa học từ DB để trả về Frontend hiển thị đẹp hơn
        const resultCourses = recommended_courses.map(rc => {
            const fullInfo = availableCourses.find(c => c.id === rc.course_id);
            return {
                ...fullInfo,
                reason: rc.reason
            };
        }).filter(item => item.id); // Lọc bỏ nếu AI bịa ra ID không tồn tại

        res.json({ advice, path: resultCourses });

    } catch (err) {
        console.error("Learning Path Error:", err.message);
        res.status(500).json({ message: "Failed to generate path" });
    }
};

// POST /api/courses/:id/progress
const markLessonProgress = async (req, res) => {
    try {
        const courseId = req.params.id;
        const { lessonKey, timeSpent } = req.body;

        const course = await Course.findById(courseId).select('subject');
        if (!course) return res.status(404).json({ message: "Course not found" });

        // Lấy thời điểm 00:00:00 của ngày hôm nay
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // TÌM TIẾN ĐỘ CỦA BÀI NÀY - NHƯNG CHỈ TRONG NGÀY HÔM NAY (tránh cộng dồn nhầm ngày cũ)
        let progress = await LessonProgress.findOne({
            user: req.userId,
            course: courseId,
            lessonKey: lessonKey,
            lastAccessed: { $gte: today } 
        });

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
  createCourse,
  getCourse,
  updateCourse,
  listCourses,
  listPublicCourses,
  getPublicCourseById,
  deleteCourse,
  generateLessonSlides,
  createLearningPath,
  markLessonProgress,
};