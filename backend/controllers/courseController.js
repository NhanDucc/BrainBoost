const Course = require("../models/Course");

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

module.exports = {
  createCourse,
  getCourse,
  updateCourse,
  listCourses,
  listPublicCourses,
  getPublicCourseById,
  deleteCourse,
};