const Course = require("../models/Course");
const User = require("../models/User");

// Admin creates course
const createCourse = async (req, res) => {
    try {
        const { title, description, duration } = req.body;

        if (!title || !description) {
            return res.status(400).json({
                success: false,
                message: "Title and description are required",
            });
        }

        const course = await Course.create({
            title,
            description,
            duration,
        });

        res.status(201).json({
            success: true,
            message: "Course created successfully",
            course,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// Admin gets all courses
const getAllCourses = async (req, res) => {
    try {
        const courses = await Course.find().sort({ createdAt: -1 });

        res.json({
            success: true,
            courses,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

//Student ko available courses dikhane ke liye
const getAvailableCourses = async (req, res) => {
    try {
        const courses = await Course.find({ isActive: true }).sort({
            createdAt: -1,
        });

        res.json({
            success: true,
            courses,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// Student gets assigned courses
const getMyCourses = async (req, res) => {
    try {
        const student = await User.findById(req.user._id)
            .select("-password")
            .populate("assignedCourses");

        res.json({
            success: true,
            courses: student.assignedCourses,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// Admin updates course
const updateCourse = async (req, res) => {
    try {
        const course = await Course.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
        });

        if (!course) {
            return res.status(404).json({
                success: false,
                message: "Course not found",
            });
        }

        res.json({
            success: true,
            message: "Course updated successfully",
            course,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// Admin deletes course
const deleteCourse = async (req, res) => {
    try {
        const course = await Course.findByIdAndDelete(req.params.id);

        if (!course) {
            return res.status(404).json({
                success: false,
                message: "Course not found",
            });
        }

        res.json({
            success: true,
            message: "Course deleted successfully",
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
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