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
router.get("/available", protect("student"), studentOnly, getAvailableCourses);
router.get("/my-courses", protect("student"), studentOnly, getMyCourses);

// Admin routes
router.post("/", protect("admin"), adminOnly, createCourse);
router.get("/", protect("admin"), adminOnly, getAllCourses);
router.put("/:id", protect("admin"), adminOnly, updateCourse);
router.delete("/:id", protect("admin"), adminOnly, deleteCourse);

module.exports = router;
