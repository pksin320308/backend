const mongoose = require("mongoose");

const pdfSchema = new mongoose.Schema(
    {
        course: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Course",
            required: true,
        },

        title: {
            type: String,
            required: true,
            trim: true,
        },

        fileKey: {
            type: String,
            required: true,
        },

        isDownloadAllowed: {
            type: Boolean,
            default: false,
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model("Pdf", pdfSchema);