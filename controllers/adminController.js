const User = require("../models/User");
const CourseRequest = require("../models/CourseRequest");

// Common error response
const sendError = (res, statusCode, message) => {
    return res.status(statusCode).json({
        success: false,
        message,
    });
};

// Admin gets all students
const getAllStudents = async (req, res) => {
    try {
        const students = await User.find()
            .select("-password")
            .populate("assignedCourses")
            .sort({ createdAt: -1 });

        return res.json({
            success: true,
            students,
        });
    } catch (error) {
        console.error("Get All Students Error:", error);

        return sendError(res, 500, "Internal server error");
    }
};

// Admin gets all course requests
const getAllCourseRequests = async (req, res) => {
    try {
        const requests = await CourseRequest.find()
            .populate("student", "name email studentId")
            .populate("course", "title description duration")
            .sort({ createdAt: -1 });

        return res.json({
            success: true,
            requests,
        });
    } catch (error) {
        console.error("Get All Course Requests Error:", error);

        return sendError(res, 500, "Internal server error");
    }
};

// Admin approves or rejects course request
const updateCourseRequestStatus = async (req, res) => {
    try {
        const { requestId } = req.params;
        const { status } = req.body;

        if (!["approved", "rejected"].includes(status)) {
            return sendError(res, 400, "Invalid status");
        }

        const request = await CourseRequest.findById(requestId);

        if (!request) {
            return sendError(res, 404, "Request not found");
        }

        if (request.status !== "pending") {
            return sendError(res, 400, "Request already processed");
        }

        request.status = status;
        await request.save();

        if (status === "approved") {
            await User.findByIdAndUpdate(request.student, {
                $addToSet: { assignedCourses: request.course },
            });
        }

        return res.json({
            success: true,
            message: `Course request ${status} successfully`,
            request,
        });
    } catch (error) {
        console.error("Update Course Request Status Error:", error);

        return sendError(res, 500, "Internal server error");
    }
};

module.exports = {
    getAllStudents,
    getAllCourseRequests,
    updateCourseRequestStatus,
};