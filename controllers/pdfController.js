const mongoose = require("mongoose");
const supabase = require("../config/supabase");
const { PDFDocument, rgb, degrees } = require("pdf-lib");
const Pdf = require("../models/Pdf");
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

// Check whether admin or assigned student has course access
const checkCourseAccess = async (userId, userRole, courseId) => {
    if (userRole === "admin") {
        return true;
    }

    const student = await User.findById(userId);

    if (!student) {
        return false;
    }

    return student.assignedCourses.some(
        (id) => id.toString() === courseId.toString()
    );
};

// Admin uploads PDF to Supabase and creates PDF record
const createPdf = async (req, res) => {
    try {
        const { course, title } = req.body;
        const file = req.file;

        if (!course || !title) {
            return sendError(res, 400, "Course and title are required");
        }

        if (!isValidObjectId(course)) {
            return sendError(res, 400, "Invalid course ID");
        }

        if (!file) {
            return sendError(res, 400, "PDF file is required");
        }

        if (file.mimetype !== "application/pdf") {
            return sendError(res, 400, "Only PDF files are allowed");
        }

        const safeFileName = file.originalname
            .replace(/\s+/g, "-")
            .replace(/[^a-zA-Z0-9.-]/g, "")
            .toLowerCase();

        const fileKey = `courses/${course}/${Date.now()}-${safeFileName}`;

        const { data, error } = await supabase.storage
            .from(process.env.SUPABASE_BUCKET)
            .upload(fileKey, file.buffer, {
                contentType: "application/pdf",
                upsert: false,
            });

        if (error) {
            console.error("Supabase Upload Error:", error);
            return sendError(res, 500, "Failed to upload PDF");
        }

        const pdf = await Pdf.create({
            course,
            title: title.trim(),
            fileKey: data.path,
            isDownloadAllowed: false,
        });

        return res.status(201).json({
            success: true,
            message: "PDF uploaded successfully",
            pdf,
        });
    } catch (error) {
        console.error("Create PDF Error:", error);
        return sendError(res, 500, "Internal server error");
    }
};

// Admin gets all PDFs
const getAllPdfs = async (req, res) => {
    try {
        const pdfs = await Pdf.find()
            .populate("course")
            .sort({ createdAt: -1 });

        return res.json({
            success: true,
            pdfs,
        });
    } catch (error) {
        console.error("Get All PDFs Error:", error);
        return sendError(res, 500, "Internal server error");
    }
};

// Student/Admin gets PDFs by course
const getPdfsByCourse = async (req, res) => {
    try {
        const courseId = req.params.courseId;

        if (!isValidObjectId(courseId)) {
            return sendError(res, 400, "Invalid course ID");
        }

        const hasAccess = await checkCourseAccess(
            req.user._id,
            req.userRole,
            courseId
        );

        if (!hasAccess) {
            return sendError(res, 403, "You do not have access to this course PDFs");
        }

        const pdfs = await Pdf.find({ course: courseId })
            .select("-fileKey")
            .populate("course")
            .sort({ createdAt: -1 });

        return res.json({
            success: true,
            pdfs,
        });
    } catch (error) {
        console.error("Get PDFs By Course Error:", error);
        return sendError(res, 500, "Internal server error");
    }
};

// Student/Admin gets short-time PDF viewer URL
const getPdfViewer = async (req, res) => {
    try {
        const pdfId = req.params.pdfId;

        if (!isValidObjectId(pdfId)) {
            return sendError(res, 400, "Invalid PDF ID");
        }

        const pdf = await Pdf.findById(pdfId).populate("course");

        if (!pdf) {
            return sendError(res, 404, "PDF not found");
        }

        const hasAccess = await checkCourseAccess(
            req.user._id,
            req.userRole,
            pdf.course._id
        );

        if (!hasAccess) {
            return sendError(res, 403, "You do not have access to this PDF");
        }

        return res.json({
            success: true,
            pdf: {
                id: pdf._id,
                title: pdf.title,
                course: pdf.course.title,
                isDownloadAllowed: false,
            },
            viewerUrl: `/api/pdfs/stream/${pdf._id}`,
            watermark: `${req.user.name} | ${req.user.studentId || req.user.email}`,
        });
    } catch (error) {
        console.error("Get PDF Viewer Error:", error);
        return sendError(res, 500, "Internal server error");
    }
};

// Add watermark text on every PDF page
const addWatermarkToPdf = async (pdfBuffer, watermarkText) => {
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const pages = pdfDoc.getPages();

    pages.forEach((page) => {
        const { width, height } = page.getSize();

        page.drawText(watermarkText, {
            x: width / 5,
            y: height / 2,
            size: 28,
            color: rgb(0.6, 0.6, 0.6),
            opacity: 0.25,
            rotate: degrees(-35),
        });
    });

    const watermarkedPdfBytes = await pdfDoc.save();
    return Buffer.from(watermarkedPdfBytes);
};

// Protected Supabase PDF stream route
const streamPdf = async (req, res) => {
    try {
        const { pdfId } = req.params;

        if (!isValidObjectId(pdfId)) {
            return sendError(res, 400, "Invalid PDF ID");
        }

        const pdf = await Pdf.findById(pdfId).populate("course");

        if (!pdf) {
            return sendError(res, 404, "PDF not found");
        }

        const user = req.user;

        if (!user) {
            return sendError(res, 401, "Unauthorized access");
        }

        if (req.userRole !== "admin") {
            const assignedCourses = user.assignedCourses || [];

            const hasCourseAccess = assignedCourses.some(
                (courseId) => courseId.toString() === pdf.course._id.toString()
            );

            if (!hasCourseAccess) {
                return sendError(res, 403, "You do not have access to this PDF");
            }
        }

        const { data, error } = await supabase.storage
            .from(process.env.SUPABASE_BUCKET)
            .createSignedUrl(pdf.fileKey, 60);

        if (error || !data?.signedUrl) {
            console.error("Supabase Signed URL Error:", error);
            return sendError(res, 500, "Failed to generate PDF URL");
        }

        const fileResponse = await fetch(data.signedUrl);

        if (!fileResponse.ok) {
            console.error("PDF Fetch Error:", fileResponse.status);
            return sendError(res, 500, "Failed to fetch PDF file");
        }

        const arrayBuffer = await fileResponse.arrayBuffer();
        const pdfBuffer = Buffer.from(arrayBuffer);

        const watermarkText = `${user.name || "User"} | ${user.studentId || user.email
            }`;

        const watermarkedPdf = await addWatermarkToPdf(pdfBuffer, watermarkText);

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", "inline; filename=protected.pdf");
        res.setHeader(
            "Cache-Control",
            "no-store, no-cache, must-revalidate, private"
        );
        res.setHeader("Pragma", "no-cache");
        res.setHeader("Expires", "0");

        return res.send(watermarkedPdf);
    } catch (error) {
        console.error("Stream PDF Error:", error);
        return sendError(res, 500, "Internal server error");
    }
};

// Admin updates PDF title/course only
const updatePdf = async (req, res) => {
    try {
        const { id } = req.params;

        if (!isValidObjectId(id)) {
            return sendError(res, 400, "Invalid PDF ID");
        }

        const { title, course, isDownloadAllowed } = req.body;

        const updateData = {};

        if (title !== undefined) {
            updateData.title = title.trim();
        }

        if (course !== undefined) {
            if (!isValidObjectId(course)) {
                return sendError(res, 400, "Invalid course ID");
            }

            updateData.course = course;
        }

        if (typeof isDownloadAllowed === "boolean") {
            updateData.isDownloadAllowed = isDownloadAllowed;
        }

        const pdf = await Pdf.findByIdAndUpdate(id, updateData, {
            new: true,
            runValidators: true,
        });

        if (!pdf) {
            return sendError(res, 404, "PDF not found");
        }

        return res.json({
            success: true,
            message: "PDF updated successfully",
            pdf,
        });
    } catch (error) {
        console.error("Update PDF Error:", error);
        return sendError(res, 500, "Internal server error");
    }
};

// Admin deletes PDF from Supabase and DB
const deletePdf = async (req, res) => {
    try {
        const { id } = req.params;

        if (!isValidObjectId(id)) {
            return sendError(res, 400, "Invalid PDF ID");
        }

        const pdf = await Pdf.findById(id);

        if (!pdf) {
            return sendError(res, 404, "PDF not found");
        }

        const { error } = await supabase.storage
            .from(process.env.SUPABASE_BUCKET)
            .remove([pdf.fileKey]);

        if (error) {
            console.error("Supabase Delete Error:", error);
            return sendError(res, 500, "Failed to delete PDF file");
        }

        await Pdf.findByIdAndDelete(id);

        return res.json({
            success: true,
            message: "PDF deleted successfully",
        });
    } catch (error) {
        console.error("Delete PDF Error:", error);
        return sendError(res, 500, "Internal server error");
    }
};

module.exports = {
    createPdf,
    getAllPdfs,
    getPdfsByCourse,
    getPdfViewer,
    streamPdf,
    updatePdf,
    deletePdf,
};