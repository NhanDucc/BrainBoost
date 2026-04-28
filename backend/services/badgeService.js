const EventEmitter = require('events');
class BadgeEmitter extends EventEmitter {}
const badgeEvents = new BadgeEmitter();
const Badge = require('../models/Badge');
const User = require('../models/User');
const socketService = require('./socketService');

/**
 * Core function to award a badge to a user.
 * Checks if the user already owns the badge; if not, adds it and emits a real-time notification.
 * @param {String} userId - The ID of the user receiving the badge.
 * @param {String} badgeName - The name of the badge to award.
 * @param {String} description - The description of the achievement.
 */
async function awardBadge(userId, badgeName, description) {
    try {
        const user = await User.findById(userId);
        if (!user) return;

        // 1. Tìm huy chương thật trong Collection Badge của Database
        const badgeDoc = await Badge.findOne({ name: badgeName });
        
        if (!badgeDoc) {
            console.log(`[CẢNH BÁO] Huy chương "${badgeName}" chưa được tạo trong Database. Hãy Insert nó vào Collection badges trước!`);
            return;
        }

        // 2. Kiểm tra xem User đã có huy chương này trong mảng earnedBadges chưa
        const alreadyOwned = user.earnedBadges.some(
            (eb) => eb.badgeId.toString() === badgeDoc._id.toString()
        );

        // 3. Nếu chưa có thì cấp phát chuẩn theo Schema
        if (!alreadyOwned) {
            user.earnedBadges.push({ 
                badgeId: badgeDoc._id, 
                earnedAt: new Date() 
            });
            await user.save();

            // 4. Bắn thông báo Socket
            await socketService.sendNotification({
                userId: user._id,
                title: `New Badge: ${badgeName}`,
                message: description,
                type: 'badge', 
                link: `/badges`
            });
        }
    } catch (error) {
        console.error("[BadgeService] Error awarding badge:", error);
    }
}

// ==== Test Controller Event Listener ====

/**
 * Event: Fired when a user successfully completes a test.
 * Payload: { userId, subject, percent }
 */
badgeEvents.on('test_completed', async ({ userId, subject, percent }) => {
    // The Perfect Mind (Achieved 100%)
    if (percent === 100) {
        await awardBadge(
            userId, 
            "The Perfect Mind", 
            "Excellent! You achieved a perfect 100% score on a test."
        );
    } 
    // High Achiever (Achieved >= 85%)
    else if (percent >= 85) {
        await awardBadge(
            userId, 
            "High Achiever", 
            "Great performance! You surpassed the 85% score mark."
        );
    }
});

/**
 * Event: Fired to evaluate answer streaks (Accuracy Streak).
 * Payload: { userId, subject, answers }
 */
// TẠO BỘ TỪ ĐIỂN ĐỂ DỊCH MÃ CODE THÀNH TÊN HUY CHƯƠNG ĐẸP
const SUBJECT_MAP = {
    math: "Mathematics",
    physics: "Physics",
    chemistry: "Chemistry",
    english: "English"
};

const TYPE_MAP = {
    mcq: "MCQ",
    tf: "TF",             // Hoặc "True/False" tùy theo cách bạn đặt tên trong DB
    boolean: "TF",        // Đề phòng trường hợp Frontend gửi lên là 'boolean'
    short_answer: "Short Answer",
    essay: "Essay"
};

// CÁC MỐC HUY CHƯƠNG THEO THIẾT KẾ CỦA BẠN
const MILESTONES = [
    { count: 10, level: "Explorer" },
    { count: 20, level: "Foundational" },
    { count: 50, level: "Insightful" },
    { count: 100, level: "Master" },
    { count: 200, level: "Scholarly" },
    { count: 500, level: "Enlightened" }
];

badgeEvents.on('answers_batch_submitted', async ({ userId, subject, answers }) => {
    if (!answers || answers.length === 0) return;

    const user = await User.findById(userId);
    if (!user) return;

    // Mảng tạm để chứa các huy chương đạt được trong lần nộp bài này
    const earnedNewBadges = [];

    answers.forEach(ans => {
        // Đồng bộ tên loại câu hỏi với schema trong User.js (vd: boolean -> tf)
        const schemaType = ans.type === 'boolean' ? 'tf' : ans.type;
        const isCorrect = ans.isCorrect || ans.score > 0;

        // Đảm bảo môn học và loại câu hỏi có tồn tại trong DB của user
        if (subject && schemaType && user.streaks[subject] && user.streaks[subject][schemaType]) {
            if (isCorrect) {
                // 1. Cộng dồn câu đúng
                user.streaks[subject][schemaType].current += 1;
                const currentStreak = user.streaks[subject][schemaType].current;
                
                // Cập nhật kỷ lục
                if (currentStreak > user.streaks[subject][schemaType].highest) {
                    user.streaks[subject][schemaType].highest = currentStreak;
                }

                // 2. KIỂM TRA MỐC HUY CHƯƠNG ĐỘNG
                // Dùng === để chỉ cấp huy chương 1 lần duy nhất ngay khi VỪA CHẠM MỐC
                const hitMilestone = MILESTONES.find(m => m.count === currentStreak);
                
                if (hitMilestone) {
                    const subjName = SUBJECT_MAP[subject] || subject;
                    const typeName = TYPE_MAP[schemaType] || schemaType;
                    
                    // Ghép tên theo đúng format: "Tên môn học + Loại câu hỏi + Cấp bậc"
                    const badgeName = `${subjName} ${typeName} ${hitMilestone.level}`;
                    
                    earnedNewBadges.push({
                        name: badgeName,
                        desc: `Outstanding! You've reached a streak of ${currentStreak} correct answers in ${subjName} ${typeName}.`
                    });
                }
            } else {
                // Trả về 0 nếu làm sai
                user.streaks[subject][schemaType].current = 0; 
            }
        }
    });

    // 3. LƯU DỮ LIỆU ĐIỂM SỐ TRƯỚC
    user.markModified('streaks'); 
    await user.save();

    // 4. CẤP HUY CHƯƠNG & BẮN THÔNG BÁO TỪNG CÁI MỘT
    // Vòng lặp này giúp xử lý việc nếu user đạt nhiều huy chương cùng lúc ở các môn/loại câu khác nhau
    for (const badge of earnedNewBadges) {
        await awardBadge(userId, badge.name, badge.desc);
    }
});

module.exports = { badgeEvents };