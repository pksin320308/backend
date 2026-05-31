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

const router = express.Router();

router.get("/captcha", getCaptcha);
router.post("/register", registerStudent);
router.post("/login", login);
router.post("/logout", logout);
router.get("/profile", protect, profile);

//course

router.post("/", protect, studentOnly, requestCourse);
router.get("/my-requests", protect, studentOnly, getMyCourseRequests);

module.exports = router;