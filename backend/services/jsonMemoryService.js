const fs = require('fs').promises;
const path = require('path');

// Tạo thư mục memory nếu chưa có
const MEMORY_DIR = path.join(__dirname, '../memory');
(async () => {
    try {
        await fs.mkdir(MEMORY_DIR, { recursive: true });
    } catch (e) {
        console.error("Cannot create memory directory", e);
    }
})();

// Hàm tạo tên file duy nhất dựa trên user và bài học
const getFileName = (userId, courseId, lessonKey) => {
    // Sanitize để tránh lỗi ký tự đặc biệt
    const safeLessonKey = lessonKey.replace(/[^a-zA-Z0-9-_]/g, '_');
    return path.join(MEMORY_DIR, `${userId}_${courseId}_${safeLessonKey}.json`);
};

exports.getHistory = async (userId, courseId, lessonKey) => {
    const filePath = getFileName(userId, courseId, lessonKey);
    try {
        const data = await fs.readFile(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        // Nếu file chưa tồn tại thì trả về mảng rỗng
        return [];
    }
};

exports.saveHistory = async (userId, courseId, lessonKey, newHistory) => {
    const filePath = getFileName(userId, courseId, lessonKey);
    await fs.writeFile(filePath, JSON.stringify(newHistory, null, 2), 'utf8');
};

// Hàm dọn dẹp file cũ > 10 ngày
exports.cleanupOldMemories = async () => {
    try {
        const files = await fs.readdir(MEMORY_DIR);
        const now = Date.now();
        const MAX_AGE = 10 * 24 * 60 * 60 * 1000; // 10 ngày

        for (const file of files) {
            if (!file.endsWith('.json')) continue;
            const filePath = path.join(MEMORY_DIR, file);
            const stats = await fs.stat(filePath);
            
            if (now - stats.mtimeMs > MAX_AGE) {
                await fs.unlink(filePath);
                console.log(`[Memory] Deleted old file: ${file}`);
            }
        }
    } catch (err) {
        console.error("[Memory] Cleanup failed:", err);
    }
};