const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const Course = require("../models/Course");
const CourseRequest = require("../models/CourseRequest");
const Admin = require("../models/Admin");
const User = require("../models/User");

// Generate JWT token with user id and role
const generateToken = (id, role) => {
    return jwt.sign({ id, role }, process.env.JWT_SECRET, {
        expiresIn: "7d",
    });
};

// Send common error response
const sendError = (res, statusCode, message) => {
    return res.status(statusCode).json({
        success: false,
        message,
    });
};

// Common cookie options
const getCookieOptions = () => {
    return {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
        maxAge: 15 * 60 * 1000,
    };
};

// Send login response and store role-based token in cookie
const sendLoginResponse = (res, user, role, message) => {
    const token = generateToken(user._id, role);

    const cookieName = role === "admin" ? "adminToken" : "studentToken";

    res.cookie(cookieName, token, getCookieOptions());

    return res.status(200).json({
        success: true,
        message,
        user: {
            id: user._id,
            studentId: role === "student" ? user.studentId : null,
            name: user.name,
            email: user.email,
            role,
        },
    });
};

// Generate unique student ID
const generateStudentId = async () => {
    const currentYear = new Date().getFullYear().toString().slice(-2);

    let studentId;
    let exists = true;

    while (exists) {
        const randomCode = crypto.randomBytes(3).toString("hex").toUpperCase();

        studentId = `CYN-${currentYear}-${randomCode}`;

        exists = await User.findOne({ studentId });
    }

    return studentId;
};

// Store captcha temporarily in memory
const captchaStore = new Map();

// Generate random captcha text
const generateCaptchaText = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";

    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    return code;
};

// Hash captcha before storing
const hashCaptcha = (captcha) => {
    return crypto
        .createHash("sha256")
        .update(captcha.toUpperCase())
        .digest("hex");
};

// Create and return new captcha
const getCaptcha = async (req, res) => {
    try {
        const captchaText = generateCaptchaText();
        const captchaId = crypto.randomBytes(16).toString("hex");

        captchaStore.set(captchaId, {
            hash: hashCaptcha(captchaText),
            expiresAt: Date.now() + 5 * 60 * 1000,
        });

        for (const [id, data] of captchaStore.entries()) {
            if (data.expiresAt < Date.now()) {
                captchaStore.delete(id);
            }
        }

        return res.status(200).json({
            success: true,
            captchaId,
            captchaText,
        });
    } catch (error) {
        console.error("Captcha Error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to generate captcha",
        });
    }
};

// Verify captcha input with stored hash
const verifyCaptcha = (captchaId, captchaInput) => {
    if (!captchaId || !captchaInput) {
        return false;
    }

    const captchaData = captchaStore.get(captchaId);

    if (!captchaData) {
        return false;
    }

    if (captchaData.expiresAt < Date.now()) {
        captchaStore.delete(captchaId);
        return false;
    }

    const inputHash = hashCaptcha(captchaInput);

    if (inputHash !== captchaData.hash) {
        return false;
    }

    captchaStore.delete(captchaId);

    return true;
};

// Validate password strength
const validatePassword = (password) => {
    if (!password || password.length < 8) {
        return "Password must be at least 8 characters long";
    }

    if (!/[A-Z]/.test(password)) {
        return "Password must contain at least one uppercase letter";
    }

    if (!/[a-z]/.test(password)) {
        return "Password must contain at least one lowercase letter";
    }

    if (!/[0-9]/.test(password)) {
        return "Password must contain at least one number";
    }

    if (!/[^A-Za-z0-9]/.test(password)) {
        return "Password must contain at least one special character";
    }

    return null;
};

// Register a new student
const registerStudent = async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return sendError(res, 400, "Name, email and password are required");
        }

        const passwordError = validatePassword(password);

        if (passwordError) {
            return sendError(res, 400, passwordError);
        }

        const existingStudent = await User.findOne({ email });
        const existingAdmin = await Admin.findOne({ email });

        if (existingStudent || existingAdmin) {
            return sendError(res, 400, "Email already exists");
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const studentId = await generateStudentId();

        const student = new User({
            name,
            email,
            password: hashedPassword,
            studentId,
        });

        await student.save();

        return res.status(201).json({
            success: true,
            message: "Student registered successfully",
            student: {
                id: student._id,
                studentId: student.studentId,
                name: student.name,
                email: student.email,
            },
        });
    } catch (error) {
        console.error("Register Student Error:", error);
        return sendError(res, 500, "Internal server error");
    }
};

// Login admin or student
const login = async (req, res) => {
    try {
        const { email, password, captchaId, captchaInput } = req.body;

        if (!email || !password) {
            return sendError(res, 400, "Email and password are required");
        }

        const isCaptchaValid = verifyCaptcha(captchaId, captchaInput);

        if (!isCaptchaValid) {
            return res.status(400).json({
                success: false,
                message: "Invalid or expired CAPTCHA",
            });
        }

        const admin = await Admin.findOne({ email });

        if (admin) {
            const isMatch = await bcrypt.compare(password, admin.password);

            if (!isMatch) {
                return sendError(res, 401, "Wrong password");
            }

            return sendLoginResponse(
                res,
                admin,
                "admin",
                "Admin login successful"
            );
        }

        const student = await User.findOne({ email });

        if (student) {
            const isMatch = await bcrypt.compare(password, student.password);

            if (!isMatch) {
                return sendError(res, 401, "Wrong password");
            }

            return sendLoginResponse(
                res,
                student,
                "student",
                "Student login successful"
            );
        }

        return sendError(res, 401, "Invalid email or password");
    } catch (error) {
        console.error("Controller Error:", error);
        return sendError(res, 500, "Internal server error");
    }
};

// Return logged-in user profile
const profile = async (req, res) => {
    try {
        return res.json({
            success: true,
            role: req.userRole,
            user: {
                id: req.user._id,
                studentId: req.userRole === "student" ? req.user.studentId : null,
                name: req.user.name,
                email: req.user.email,
                role: req.userRole,
            },
        });
    } catch (error) {
        console.error("Controller Error:", error);
        return sendError(res, 500, "Internal server error");
    }
};

// Send course access request
const requestCourse = async (req, res) => {
    try {
        const { courseId } = req.body;
        const studentId = req.user._id;

        if (!courseId) {
            return sendError(res, 400, "courseId is required");
        }

        const courseExists = await Course.exists({ _id: courseId });

        if (!courseExists) {
            return sendError(res, 404, "Course not found");
        }

        const alreadyAssigned = await User.exists({
            _id: studentId,
            assignedCourses: courseId,
        });

        if (alreadyAssigned) {
            return sendError(res, 400, "Course already assigned");
        }

        const existingPendingRequest = await CourseRequest.exists({
            student: studentId,
            course: courseId,
            status: "pending",
        });

        if (existingPendingRequest) {
            return sendError(res, 400, "Request already pending");
        }

        const request = await CourseRequest.create({
            student: studentId,
            course: courseId,
        });

        return res.status(201).json({
            success: true,
            message: "Course request sent successfully",
            request,
        });
    } catch (error) {
        console.error("Controller Error:", error);
        return sendError(res, 500, "Internal server error");
    }
};

// Get logged-in student's course requests
const getMyCourseRequests = async (req, res) => {
    try {
        const requests = await CourseRequest.find({
            student: req.user._id,
        })
            .populate("course", "title description duration")
            .sort({ createdAt: -1 });

        return res.json({
            success: true,
            requests,
        });
    } catch (error) {
        console.error("Controller Error:", error);
        return sendError(res, 500, "Internal server error");
    }
};

// Clear login cookies and logout user
const logout = async (req, res) => {
    const { role } = req.body;

    const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    };

    if (role === "admin") {
        res.clearCookie("adminToken", cookieOptions);

        return res.json({
            success: true,
            message: "Admin logout successful",
        });
    }

    if (role === "student") {
        res.clearCookie("studentToken", cookieOptions);

        return res.json({
            success: true,
            message: "Student logout successful",
        });
    }

    res.clearCookie("adminToken", cookieOptions);
    res.clearCookie("studentToken", cookieOptions);
    res.clearCookie("token", cookieOptions);

    return res.json({
        success: true,
        message: "Logout successful",
    });
};

module.exports = {
    registerStudent,
    login,
    logout,
    profile,
    requestCourse,
    getMyCourseRequests,
    getCaptcha,
};
