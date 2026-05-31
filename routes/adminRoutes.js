const express = require("express");

const {
    getAllStudents,
    getAllCourseRequests,
    updateCourseRequestStatus,
} = require("../controllers/adminController");
const protect = require("../middleware/authMiddleware");
const adminOnly = require("../middleware/adminMiddleware");

const router = express.Router();

router.get("/students", protect, adminOnly, getAllStudents);

//course
router.get("/", protect, adminOnly, getAllCourseRequests);
router.put("/:requestId/status", protect, adminOnly, updateCourseRequestStatus);

module.exports = router;