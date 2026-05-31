const express = require("express");

const {
    registerStudent,
    login,
    logout,
    profile,
    requestCourse,
    getCaptcha,
    getMyCourseRequests,
} = require("../controllers/authController");

const protect = require("../middleware/authMiddleware");
const studentOnly = require("../middleware/studentMiddleware");
const adminOnly = require("../middleware/adminMiddleware");

const router = express.Router();

router.get("/captcha", getCaptcha);
router.post("/register", registerStudent);
router.post("/login", login);
router.post("/logout", logout);
router.get("/admin/profile", protect("admin"), adminOnly, profile);

router.get("/student/profile", protect("student"), studentOnly, profile);

//course

router.post("/", protect("student"), studentOnly, requestCourse);
router.get("/my-requests", protect("student"), studentOnly, getMyCourseRequests);

module.exports = router;
