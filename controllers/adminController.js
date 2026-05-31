const User = require("../models/User");
const Course = require("../models/Course");
const CourseRequest = require("../models/CourseRequest");

const getAllStudents = async (req, res) => {
    try {
        const students = await User.find()
            .select("-password")
            .populate("assignedCourses")
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            students,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// Admin sees all requests
const getAllCourseRequests = async (req, res) => {
    try {
        const requests = await CourseRequest.find()
            .populate("student", "name email studentId")
            .populate("course", "title description duration")
            .sort({ createdAt: -1 });

        res.json({ success: true, requests });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Admin approves/rejects request
const updateCourseRequestStatus = async (req, res) => {
    try {
        const { requestId } = req.params;
        const { status } = req.body;

        if (!["approved", "rejected"].includes(status)) {
            return res.status(400).json({ success: false, message: "Invalid status" });
        }

        const request = await CourseRequest.findById(requestId);
        if (!request) {
            return res.status(404).json({ success: false, message: "Request not found" });
        }

        if (request.status !== "pending") {
            return res.status(400).json({ success: false, message: "Request already processed" });
        }

        request.status = status;
        await request.save();

        if (status === "approved") {
            await User.findByIdAndUpdate(request.student, {
                $addToSet: { assignedCourses: request.course },
            });
        }

        res.json({
            success: true,
            message: `Course request ${status} successfully`,
            request,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
module.exports = {
    getAllStudents,
    getAllCourseRequests,
    updateCourseRequestStatus,
};