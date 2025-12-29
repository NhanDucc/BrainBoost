const Course = require("../models/Course");
const axios = require("axios");
const { extractTextFromDocUrl } = require("../services/docTextService");

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-1.5-flash";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

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

function buildSlidePrompt({ text, subject, grade, maxSlides }) {
  const trimmed = text.replace(/\s+/g, " ").trim();
  const MAX_CHARS = 12000;
  const clipped = trimmed.length > MAX_CHARS
    ? trimmed.slice(0, MAX_CHARS) + "..."
    : trimmed;

  const subjLabel = subject || "school";
  const gradeLabel = grade || "secondary";

  return `
You are an expert ${subjLabel} teacher. Create clear, concise teaching slides for students at level "${gradeLabel}".

Requirements:
- Output MUST be valid JSON ONLY, no markdown, no explanation.
- Use exactly this JSON shape:

{
  "slides": [
    {
      "title": "Slide title",
      "bullets": ["First bullet", "Second bullet", "..."]
    }
  ]
}

- Maximum ${maxSlides} slides.
- Each slide should have 3–6 short bullet points.
- Focus on key concepts, definitions, simple examples and important formulas.
- Do NOT include any code fences or backticks.
- Language: keep the same language as the original text.

Lesson text:
"""${clipped}"""
`;
}

// POST /api/courses/:courseId/sections/:secIndex/lessons/:lessonIndex/gen-slides
const generateLessonSlides = async (req, res) => {
  try {
    if (!GEMINI_API_KEY) {
      return res.status(500).json({
        message:
          "Gemini API key is not configured on the server. Please set GEMINI_API_KEY in .env.",
      });
    }

    const { courseId, secIndex, lessonIndex } = req.params;
    const sIndex = parseInt(secIndex, 10);
    const lIndex = parseInt(lessonIndex, 10);

    if (
      Number.isNaN(sIndex) ||
      Number.isNaN(lIndex) ||
      sIndex < 0 ||
      lIndex < 0
    ) {
      return res.status(400).json({ message: "Invalid section/lesson index." });
    }

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ message: "Course not found." });
    }

    const isOwner = String(course.createdBy) === String(req.userId);
    const isAdmin = String(req.userRole) === "admin";
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: "Forbidden" });
    }

    if (
      !Array.isArray(course.sections) ||
      sIndex >= course.sections.length ||
      sIndex < 0
    ) {
      return res.status(404).json({ message: "Section not found." });
    }

    const section = course.sections[sIndex];
    if (
      !Array.isArray(section.lessons) ||
      lIndex >= section.lessons.length ||
      lIndex < 0
    ) {
      return res.status(404).json({ message: "Lesson not found." });
    }

    const lesson = section.lessons[lIndex];

    const docUrl = lesson.originalDocUrl || lesson.contentUrl;
    if (!docUrl) {
      return res.status(400).json({
        message:
          "This lesson does not have a document URL. Please upload a document first.",
      });
    }

    // 1) Trích text từ tài liệu (dùng chung service với TTS)
    const rawText = await extractTextFromDocUrl(docUrl);
    const text = rawText.replace(/\s+/g, " ").trim();
    if (!text) {
      return res.status(400).json({
        message: "No readable text extracted from lesson document.",
      });
    }

    // 2) Gọi Gemini để tạo slide
    const maxSlides =
      typeof req.body?.maxSlides === "number" && req.body.maxSlides > 0
        ? Math.min(req.body.maxSlides, 20)
        : 10;

    const prompt = buildSlidePrompt({
      text,
      subject: course.subject,
      grade: course.grade,
      maxSlides,
    });

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

    const resp = await axios.post(url, {
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
    });

    const raw =
      resp.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";

    if (!raw) {
      return res
        .status(500)
        .json({ message: "Gemini returned an empty response." });
    }

    // 3) Parse JSON từ Gemini (strip ```json ... ``` nếu có)
    let clean = raw.replace(/^```json\s*/i, "").replace(/^```/, "");
    clean = clean.replace(/```$/i, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch (e) {
      console.error("JSON parse failed. Raw response:", raw);
      return res.status(500).json({
        message: "Failed to parse slide JSON from Gemini response.",
      });
    }

    const slidesArr = Array.isArray(parsed.slides) ? parsed.slides : [];
    if (!slidesArr.length) {
      return res.status(500).json({
        message: "Gemini returned no slides in the 'slides' array.",
      });
    }

    // 4) Map sang schema aiSlides
    const aiSlides = slidesArr.map((s, idx) => {
      const bullets = Array.isArray(s.bullets)
        ? s.bullets.map((b) => String(b || "").trim()).filter(Boolean)
        : [];

      const ttsText = bullets.length
        ? bullets.join(". ") + "."
        : String(s.title || `Slide ${idx + 1}`);

      return {
        index: idx,
        title: s.title || `Slide ${idx + 1}`,
        bullets,
        ttsText,
      };
    });

    // 5) Lưu lại vào lesson
    lesson.originalDocUrl = lesson.originalDocUrl || docUrl;
    lesson.aiSlides = aiSlides;
    lesson.useAiSlides = true;

    course.markModified("sections");
    await course.save();

    return res.json({
      message: "AI slides generated successfully.",
      slides: aiSlides,
    });
  } catch (e) {
    console.error("generateLessonSlides error:", e);
    return res.status(500).json({ message: "Server error", error: e.message });
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
};