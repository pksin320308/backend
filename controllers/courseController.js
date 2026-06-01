const mongoose = require("mongoose");
const Course = require("../models/Course");
const User = require("../models/User");

// Common error response
const sendError = (res, statusCode, message) => {
    return res.status(statusCode).json({
        success: false,
        message,
    });
};

// Validate MongoDB ObjectId
const isValidObjectId = (id) => {
    return mongoose.Types.ObjectId.isValid(id);
};

// Admin creates course
const createCourse = async (req, res) => {
    try {
        const { title, description, duration } = req.body;

        if (!title || !description) {
            return sendError(res, 400, "Title and description are required");
        }

        const course = await Course.create({
            title: title.trim(),
            description: description.trim(),
            duration: duration?.trim() || "",
        });

        return res.status(201).json({
            success: true,
            message: "Course created successfully",
            course,
        });
    } catch (error) {
        console.error("Create Course Error:", error);

        return sendError(res, 500, "Internal server error");
    }
};

// Admin gets all courses
const getAllCourses = async (req, res) => {
    try {
        const courses = await Course.find().sort({ createdAt: -1 });

        return res.json({
            success: true,
            courses,
        });
    } catch (error) {
        console.error("Get All Courses Error:", error);

        return sendError(res, 500, "Internal server error");
    }
};

// Student gets available active courses
const getAvailableCourses = async (req, res) => {
    try {
        const courses = await Course.find({ isActive: true }).sort({
            createdAt: -1,
        });

        return res.json({
            success: true,
            courses,
        });
    } catch (error) {
        console.error("Get Available Courses Error:", error);

        return sendError(res, 500, "Internal server error");
    }
};

// Student gets assigned courses
const getMyCourses = async (req, res) => {
    try {
        const student = await User.findById(req.user._id)
            .select("-password")
            .populate("assignedCourses");

        if (!student) {
            return sendError(res, 404, "Student not found");
        }

        return res.json({
            success: true,
            courses: student.assignedCourses,
        });
    } catch (error) {
        console.error("Get My Courses Error:", error);

        return sendError(res, 500, "Internal server error");
    }
};

// Admin updates course
const updateCourse = async (req, res) => {
    try {
        const { id } = req.params;

        if (!isValidObjectId(id)) {
            return sendError(res, 400, "Invalid course ID");
        }

        const { title, description, duration, isActive } = req.body;

        const updateData = {};

        if (title !== undefined) updateData.title = title.trim();
        if (description !== undefined) updateData.description = description.trim();
        if (duration !== undefined) updateData.duration = duration.trim();
        if (isActive !== undefined) updateData.isActive = isActive;

        const course = await Course.findByIdAndUpdate(id, updateData, {
            new: true,
            runValidators: true,
        });

        if (!course) {
            return sendError(res, 404, "Course not found");
        }

        return res.json({
            success: true,
            message: "Course updated successfully",
            course,
        });
    } catch (error) {
        console.error("Update Course Error:", error);

        return sendError(res, 500, "Internal server error");
    }
};

// Admin deletes course
const deleteCourse = async (req, res) => {
    try {
        const { id } = req.params;

        if (!isValidObjectId(id)) {
            return sendError(res, 400, "Invalid course ID");
        }

        const course = await Course.findByIdAndDelete(id);

        if (!course) {
            return sendError(res, 404, "Course not found");
        }

        return res.json({
            success: true,
            message: "Course deleted successfully",
        });
    } catch (error) {
        console.error("Delete Course Error:", error);

        return sendError(res, 500, "Internal server error");
    }
};

module.exports = {
    createCourse,
    getAllCourses,
    getAvailableCourses,
    getMyCourses,
    updateCourse,
    deleteCourse,
};