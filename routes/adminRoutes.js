const express = require("express");

const {
    getAllStudents,
    getAllCourseRequests,
    updateCourseRequestStatus,
} = require("../controllers/adminController");
const protect = require("../middleware/authMiddleware");
const adminOnly = require("../middleware/adminMiddleware");

const router = express.Router();

router.get("/students", protect("admin"), adminOnly, getAllStudents);

//course
router.get("/", protect("admin"), adminOnly, getAllCourseRequests);
router.put("/:requestId/status", protect("admin"), adminOnly, updateCourseRequestStatus);

module.exports = router;
