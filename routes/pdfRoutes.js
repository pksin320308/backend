const express = require("express");
const multer = require("multer");

const {
    createPdf,
    getAllPdfs,
    getPdfsByCourse,
    getPdfViewer,
    streamPdf,
    updatePdf,
    deletePdf,
} = require("../controllers/pdfController");

const protect = require("../middleware/authMiddleware");
const adminOnly = require("../middleware/adminMiddleware");

const router = express.Router();

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 20 * 1024 * 1024, // 20 MB
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype !== "application/pdf") {
            return cb(new Error("Only PDF files are allowed"), false);
        }
        cb(null, true);
    },
});

// Admin only
router.post("/", protect, adminOnly, upload.single("pdf"), createPdf);
router.get("/", protect, adminOnly, getAllPdfs);
router.put("/:id", protect, adminOnly, updatePdf);
router.delete("/:id", protect, adminOnly, deletePdf);

// Student/Admin
router.get("/course/:courseId", protect, getPdfsByCourse);
router.get("/view/:pdfId", protect, getPdfViewer);

// Token based stream route
router.get("/stream/:pdfId", protect, streamPdf);

module.exports = router;