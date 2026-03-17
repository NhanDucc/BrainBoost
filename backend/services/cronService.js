const cron = require('node-cron');
const User = require('../models/User');
const TestResult = require('../models/TestResult');
const LessonProgress = require('../models/LessonProgress');
const { transporter } = require('../middleware/mailer');

/**
 * Sends a motivational reminder email to a student who has been inactive.
 * @param {String} email - The student's registered email address.
 * @param {String} fullname - The student's full name for personalization.
 */
const sendReminderEmail = async (email, fullname) => {
    // Construct the email payload using HTML for a better user experience
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
                    <a href="${process.env.FRONTEND_URL}/learning" 
                        style="background: #0057FF; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
                        Resume Learning
                    </a>
                </div>
                <p style="color: #6C757D; font-size: 14px; text-align: center; margin-top: 40px;">
                    <em>You are receiving this email because you enabled Study Reminders. You can turn this off in your <a href="${process.env.FRONTEND_URL}/settings" style="color: #0057FF;">Account Settings</a>.</em>
                </p>
            </div>
        `
    };

    try {
        // Dispatch the email via the configured Nodemailer transporter
        await transporter.sendMail(mailOptions);
        console.log(`Reminder sent to ${email}`);
    } catch (error) {
        console.error(`Failed to send reminder to ${email}:`, error);
    }
};

/**
 * Initializes and schedules background tasks (Cron Jobs) for the application.
 * Currently handles the Daily Study Reminder feature.
 */
const startCronJobs = () => {
    console.log("CRON Jobs initialized.");

    // Schedule the job to run every day at exactly 08:00 AM server time.
    // Cron syntax: 'minute hour day_of_month month day_of_week' ('0 8 * * *')
    cron.schedule('0 8 * * *', async () => {
        console.log("Running Daily Study Reminder Check...");
        try {
            // Fetch all users who have the 'student' role AND have opted-in for email notifications
            const users = await User.find({ 
                role: 'student',
                'preferences.notifyEmail': true 
            }).select('_id email fullname');

            const now = new Date();

            for (const user of users) {
                // Find the timestamp of the last test this student completed
                const lastTest = await TestResult.findOne({ student: user._id })
                    .sort({ completedAt: -1 })
                    .select('completedAt');

                // Find the timestamp of the last lesson this student accessed
                const lastLesson = await LessonProgress.findOne({ user: user._id })
                    .sort({ lastAccessed: -1 })
                    .select('lastAccessed');

                // Establish a baseline: Default to the account creation date if no activity is found
                let lastActiveDate = user._id.getTimestamp(); // Mặc định là ngày tạo tài khoản

                // Compare test completion date vs baseline
                if (lastTest && lastTest.completedAt) {
                    lastActiveDate = lastTest.completedAt;
                }
                
                // Compare lesson access date vs the current most recent activity date
                if (lastLesson && lastLesson.lastAccessed && lastLesson.lastAccessed > lastActiveDate) {
                    lastActiveDate = lastLesson.lastAccessed;
                }

                // Get the absolute difference in milliseconds, then convert to days
                const diffTime = Math.abs(now - lastActiveDate);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                // Trigger the reminder email ONLY if the student has been inactive for exactly 3 days
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