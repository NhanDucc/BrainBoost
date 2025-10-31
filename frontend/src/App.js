import React from "react";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import Register from "./components/Register";
import Login from "./components/Login";
import VerifyCode from './components/VerifyCode';
import ForgotPassword from './components/ForgotPassword';
import AllCourses from "./components/AllCourses";
import CourseDetail from "./components/CourseDetail";
import ScrollToTop from "./components/ScrollToTop";
import Profile from "./components/Profile";
import UpdateProfile from "./components/UpdateProfile";
import Privacy from "./pages/Privacy"
import Terms from "./pages/Term"
import AboutUs from "./components/AboutUs";
import Contact from "./components/Contact"
import RequireAuth from "./components/RequireAuth";
import AdminDashboard from "./components/AdminDashboard";
import InstructorDashboard from "./components/InstructorDashboard";
import TestEditor from "./components/TestEditor";
import CourseEditor from "./components/CourseEditor";
import StudentHome from "./components/HomePage";
import ApplyInstructor from "./components/ApplyInstructor";
import AllTests from "./components/AllTests";
import TestPlayer from "./components/TestPlayer";

const App = () => {
  return (
    <Router>
      <ScrollToTop />
      <Routes>
        {/*Public route */}
        <Route path="/register" element={<Register />} />
        <Route path="/login" element={<Login />} />
        <Route path="/verify" element={<VerifyCode />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/courses" element={<AllCourses />} />
        <Route path="/courses/:courseId" element={<CourseDetail />} />
        <Route path="/tests" element={<AllTests />} />
        <Route path="/tests/:id" element={<TestPlayer />} />
        <Route path="/privacy-policy" element={<Privacy />} />
        <Route path="/terms-of-use" element={<Terms />} />
        <Route path="/about" element={<AboutUs />} />

        {/* Route by role */}
        {/*Student (Public) */}
        <Route path="/" element={<StudentHome />} />  

        {/*Auth */}
        <Route element={<RequireAuth />}>
          <Route path="/profile" element={<Profile />} />
          <Route path="/update-profile" element={<UpdateProfile />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/apply-instructor" element={<ApplyInstructor />} />
          <Route path="/admin/*" element={<AdminDashboard />} />
          <Route path="/instructor" element={<InstructorDashboard />} />
          <Route path="/instructor/tests/new" element={<TestEditor />} />
          <Route path="/instructor/tests/:id/edit" element={<TestEditor />} />
          <Route path="/instructor/courses/new" element={<CourseEditor />} />
          <Route path="/instructor/courses/:id/edit" element={<CourseEditor />} />
        </Route>
      </Routes>
    </Router>
  );
};

export default App;