const Otp = require('../models/Otp');

exports.saveOtpToDB = async (email, otp) => {
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    await Otp.findOneAndUpdate(
        { email },
        { otp, expiresAt },
        { upsert: true }
    );
};
