# Create .env file
After cloning the repository, create a new file in the root directory of the project named .env.
## JWT (JSON Web Token)
Create a long, complex, and random secret string.
You can use an online tool (e.g., https://www.lastpass.com/features/password-generator)
```
JWT_SECRET=
```

## Email Configuration (Using Gmail)
Note: You must use an "App Password" if you have 2FA enabled.
See guide: https://support.google.com/accounts/answer/185833
```
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-gmail-app-password  (no spaces between characters)
```

## SMTP Configuration (Defaults for Gmail)
Usually no need to change if using Gmail
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
```

## Application Configuration
Cookie name for storing the token (can be left as is)
```
JWT_COOKIE_NAME=access_token
```
Environment (development | production)
```
NODE_ENV=development
```

## Cloudinary (Image/Video hosting service)
Get these values from your Cloudinary Dashboard
```
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

# Project structure
```
├── backend
│   ├── controllers
│   │   ├── adminInstructorController.js
│   │   ├── authController.js
│   │   ├── contactController.js
│   │   ├── instructorController.js
│   │   ├── testController.js
│   │   └── userController.js
│   ├── middleware
│   │   ├── auth.js
│   │   ├── mailer.js
│   │   ├── otpHelper.js
│   │   ├── requireRole.js
│   │   ├── sendEmailOtp.js
│   │   └── uploadImage.js
│   ├── models
│   │   ├── InstructorApplication.js
│   │   ├── Otp.js
│   │   ├── Test.js
│   │   └── User.js
│   ├── routes
│   │   ├── adminInstructorRoutes.js
│   │   ├── adminRoutes.js
│   │   ├── authRoutes.js
│   │   ├── contactRoutes.js
│   │   ├── instructorRoutes.js
│   │   ├── testRoutes.js
│   │   └── userRoutes.js
│   ├── uploads
│   ├── cloudinaryConfig.js
│   ├── package-lock.json
│   ├── package.json
│   └── server.js
├── frontend
│   ├── public
│   │   ├── favicon.ico
│   │   ├── icon.png
│   │   ├── index.html
│   │   ├── logo192.png
│   │   ├── manifest.json
│   │   └── robots.txt
│   ├── src
│   │   ├── components
│   │   │   ├── AboutUs.js
│   │   │   ├── AdminDashboard.js
│   │   │   ├── AllCourses.js
│   │   │   ├── ApplyInstructor.js
│   │   │   ├── Contact.js
│   │   │   ├── CourseDetail.js
│   │   │   ├── Footer.js
│   │   │   ├── ForgotPassword.js
│   │   │   ├── Header.js
│   │   │   ├── HomePage.js
│   │   │   ├── InstructorDashboard.js
│   │   │   ├── Login.js
│   │   │   ├── Profile.js
│   │   │   ├── Register.js
│   │   │   ├── RequireAuth.js
│   │   │   ├── ScrollToTop.js
│   │   │   ├── TestEditor.js
│   │   │   ├── TestPlayer.js
│   │   │   ├── Tests.js
│   │   │   ├── UpdateProfile.js
│   │   │   └── VerifyCode.js
│   │   ├── context
│   │   │   └── UserContext.js
│   │   ├── css
│   │   │   ├── AboutUs.css
│   │   │   ├── Admin.css
│   │   │   ├── AllCourses.css
│   │   │   ├── Contact.css
│   │   │   ├── CourseDetail.css
│   │   │   ├── Footer.css
│   │   │   ├── ForgotPassword.css
│   │   │   ├── Header.css
│   │   │   ├── HomePage.css
│   │   │   ├── InstructorDashboard.css
│   │   │   ├── Login.css
│   │   │   ├── Profile.css
│   │   │   ├── Register.css
│   │   │   ├── TestEditor.css
│   │   │   ├── TestPlayer.css
│   │   │   ├── Tests.css
│   │   │   ├── UpdateProfile.css
│   │   │   └── VerifyCode.css
│   │   ├── data
│   │   │   └── courses.js
│   │   ├── images
│   │   │   ├── defaultAvatar.png
│   │   │   └── skills-placeholder.png
│   │   ├── pages
│   │   │   ├── Privacy.js
│   │   │   ├── Term.js
│   │   │   └── legal.css
│   │   ├── utils
│   │   │   └── url.js
│   │   ├── App.css
│   │   ├── App.js
│   │   ├── App.test.js
│   │   ├── api.js
│   │   ├── index.css
│   │   ├── index.js
│   │   ├── logo.svg
│   │   ├── reportWebVitals.js
│   │   └── setupTests.js
│   ├── .gitignore
│   ├── README.md
│   ├── package-lock.json
│   └── package.json
└── .gitignore
```
