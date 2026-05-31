const jwt = require("jsonwebtoken");
const supabase = require("../config/supabase");
const { PDFDocument, rgb, degrees } = require("pdf-lib");
const Pdf = require("../models/Pdf");
const User = require("../models/User");

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
            return res.status(400).json({
                success: false,
                message: "Course and title are required",
            });
        }

        if (!file) {
            return res.status(400).json({
                success: false,
                message: "PDF file is required",
            });
        }

        if (file.mimetype !== "application/pdf") {
            return res.status(400).json({
                success: false,
                message: "Only PDF files are allowed",
            });
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
            return res.status(500).json({
                success: false,
                message: error.message,
            });
        }

        const pdf = await Pdf.create({
            course,
            title,
            fileKey: data.path,
            isDownloadAllowed: false,
        });

        res.status(201).json({
            success: true,
            message: "PDF uploaded successfully",
            pdf,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// Admin gets all PDFs
const getAllPdfs = async (req, res) => {
    try {
        const pdfs = await Pdf.find()
            .populate("course")
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            pdfs,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// Student/Admin gets PDFs by course
const getPdfsByCourse = async (req, res) => {
    try {
        const courseId = req.params.courseId;

        const hasAccess = await checkCourseAccess(
            req.user._id,
            req.userRole,
            courseId
        );

        if (!hasAccess) {
            return res.status(403).json({
                success: false,
                message: "You do not have access to this course PDFs",
            });
        }

        const pdfs = await Pdf.find({ course: courseId })
            .select("-fileKey")
            .populate("course")
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            pdfs,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// Student/Admin gets short-time PDF viewer URL
const getPdfViewer = async (req, res) => {
    try {
        const pdfId = req.params.pdfId;

        const pdf = await Pdf.findById(pdfId).populate("course");

        if (!pdf) {
            return res.status(404).json({
                success: false,
                message: "PDF not found",
            });
        }

        const hasAccess = await checkCourseAccess(
            req.user._id,
            req.userRole,
            pdf.course._id
        );

        if (!hasAccess) {
            return res.status(403).json({
                success: false,
                message: "You do not have access to this PDF",
            });
        }

        const pdfToken = jwt.sign(
            {
                userId: req.user._id,
                role: req.userRole,
                pdfId: pdf._id.toString(),
            },
            process.env.PDF_TOKEN_SECRET,
            { expiresIn: "5m" }
        );

        res.json({
            success: true,
            pdf: {
                id: pdf._id,
                title: pdf.title,
                course: pdf.course.title,
                isDownloadAllowed: false,
            },
            viewerUrl: `/api/pdfs/stream/${pdf._id}`,
            watermark: `${req.user.name} | ${req.user.email}`,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

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

// Protected Supabase PDF signed URL
const streamPdf = async (req, res) => {
    try {
        const { pdfId } = req.params;

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
                (courseId) =>
                    courseId.toString() === pdf.course._id.toString()
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
            return sendError(res, 500, "Failed to fetch PDF file");
        }

        const arrayBuffer = await fileResponse.arrayBuffer();
        const pdfBuffer = Buffer.from(arrayBuffer);

        const watermarkText = `${user.name || "User"} | ${user.studentId || user.email
            }`;

        const watermarkedPdf = await addWatermarkToPdf(
            pdfBuffer,
            watermarkText
        );

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
        const { title, course, isDownloadAllowed } = req.body;

        const pdf = await Pdf.findByIdAndUpdate(
            req.params.id,
            {
                ...(title && { title }),
                ...(course && { course }),
                ...(typeof isDownloadAllowed === "boolean" && {
                    isDownloadAllowed,
                }),
            },
            { new: true }
        );

        if (!pdf) {
            return res.status(404).json({
                success: false,
                message: "PDF not found",
            });
        }

        res.json({
            success: true,
            message: "PDF updated successfully",
            pdf,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// Admin deletes PDF from Supabase and DB
const deletePdf = async (req, res) => {
    try {
        const pdf = await Pdf.findById(req.params.id);

        if (!pdf) {
            return res.status(404).json({
                success: false,
                message: "PDF not found",
            });
        }

        const { error } = await supabase.storage
            .from(process.env.SUPABASE_BUCKET)
            .remove([pdf.fileKey]);

        if (error) {
            return res.status(500).json({
                success: false,
                message: error.message,
            });
        }

        await Pdf.findByIdAndDelete(req.params.id);

        res.json({
            success: true,
            message: "PDF deleted successfully",
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
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