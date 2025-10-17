const InstructorApplication = require('../models/InstructorApplication');

exports.apply = async (req, res) => {
    try {
        const { fullName, email, phone, expertise, experience, bio, resumeUrl } = req.body;

        if (!fullName?.trim() || !email?.trim()) {
            return res.status(400).json({ message: 'Fullname and Email are required.' });
        }

        const dup = await InstructorApplication.findOne({ email, status: 'pending' });
        if (dup) {
            return res.status(400).json({ message: 'Your application is already pending.' });
        }

        const app = await InstructorApplication.create({
        fullName, email, phone, expertise, experience, bio, resumeUrl
        });

        res.json({ message: 'Application submitted. We will contact you via email.', id: app._id });
    } catch (err) {
        res.status(500).json({ message: 'Submit failed', error: err.message });
    }
};
