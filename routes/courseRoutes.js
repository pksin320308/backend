const express = require("express");

const {
    createCourse,
    getAvailableCourses,
    getAllCourses,
    getMyCourses,
    updateCourse,
    deleteCourse,
} = require("../controllers/courseController");

const protect = require("../middleware/authMiddleware");
const adminOnly = require("../middleware/adminMiddleware");
const studentOnly = require("../middleware/studentMiddleware");

const router = express.Router();

// Student routes
router.get("/available", protect, studentOnly, getAvailableCourses);
router.get("/my-courses", protect, studentOnly, getMyCourses);

// Admin routes
router.post("/", protect, adminOnly, createCourse);
router.get("/", protect, adminOnly, getAllCourses);
router.put("/:id", protect, adminOnly, updateCourse);
router.delete("/:id", protect, adminOnly, deleteCourse);

module.exports = router;