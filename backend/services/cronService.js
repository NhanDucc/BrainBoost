const cron = require('node-cron');
const User = require('../models/User');
const TestResult = require('../models/TestResult');
const LessonProgress = require('../models/LessonProgress');
const { transporter } = require('../middleware/mailer'); // Đảm bảo đường dẫn này đúng với file mailer.js của bạn

// Hàm gửi email nhắc nhở
const sendReminderEmail = async (email, fullname) => {
    const mailOptions = {
        from: `"BrainBoost" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'We miss you at BrainBoost!',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e7ecf8; border-radius: 12px;">
                <h2 style="color: #0057FF;">Hi ${fullname},</h2>
                <p style="color: #333; font-size: 16px; line-height: 1.5;">
                    It's been <strong>3 days</strong> since your last study session on BrainBoost. 
                    Consistency is the key to success! 
                </p>
                <p style="color: #333; font-size: 16px; line-height: 1.5;">
                    Jump back in to continue your learning journey and keep your streak alive.
                </p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/learning" 
                       style="background: #0057FF; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
                        Resume Learning
                    </a>
                </div>
                <p style="color: #6C757D; font-size: 14px; text-align: center; margin-top: 40px;">
                    <em>You are receiving this email because you enabled Study Reminders. You can turn this off in your <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/settings" style="color: #0057FF;">Account Settings</a>.</em>
                </p>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`Reminder sent to ${email}`);
    } catch (error) {
        console.error(`Failed to send reminder to ${email}:`, error);
    }
};

// Hàm khởi tạo các Cron Job
const startCronJobs = () => {
    console.log("CRON Jobs initialized.");

    // Lên lịch chạy vào lúc 08:00 Sáng mỗi ngày
    // Cú pháp cron: '0 8 * * *' (Phút 0, Giờ 8, Mọi ngày)
    cron.schedule('0 8 * * *', async () => {
        console.log("Running Daily Study Reminder Check...");
        try {
            // 1. Tìm tất cả user là student và có bật thông báo notifyEmail
            const users = await User.find({ 
                role: 'student',
                'preferences.notifyEmail': true 
            }).select('_id email fullname');

            const now = new Date();

            for (const user of users) {
                // 2. Tìm ngày hoạt động cuối cùng từ TestResult
                const lastTest = await TestResult.findOne({ student: user._id })
                    .sort({ completedAt: -1 })
                    .select('completedAt');

                // 3. Tìm ngày hoạt động cuối cùng từ LessonProgress
                const lastLesson = await LessonProgress.findOne({ user: user._id })
                    .sort({ lastAccessed: -1 })
                    .select('lastAccessed');

                let lastActiveDate = user._id.getTimestamp(); // Mặc định là ngày tạo tài khoản

                if (lastTest && lastTest.completedAt) {
                    lastActiveDate = lastTest.completedAt;
                }
                
                if (lastLesson && lastLesson.lastAccessed && lastLesson.lastAccessed > lastActiveDate) {
                    lastActiveDate = lastLesson.lastAccessed;
                }

                // 4. Tính toán số ngày không hoạt động
                const diffTime = Math.abs(now - lastActiveDate);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                // Nếu đúng 3 ngày (hoặc có thể dùng >= 3 tùy logic của bạn, nhưng dùng == 3 để tránh gửi spam mỗi ngày)
                if (diffDays === 3) {
                    await sendReminderEmail(user.email, user.fullname);
                }
            }
        } catch (error) {
            console.error("Error in Study Reminder CRON:", error);
        }
    });
};

module.exports = { startCronJobs };