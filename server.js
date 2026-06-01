const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const connectDB = require("./config/db");
const rateLimit = require("express-rate-limit");

// Load environment variables from .env file
dotenv.config();

const app = express();

// Trust proxy for correct IP detection on platforms like Render
app.set("trust proxy", 1);

// Connect application with MongoDB database
connectDB();

// Parse incoming JSON request body
app.use(express.json());

// Parse cookies from incoming requests
app.use(cookieParser());

// Define allowed frontend URLs for CORS
const allowedOrigins = [
    process.env.FRONTEND_URL,
    process.env.PRODUCTION_FRONTEND_URL,
];

// Configure CORS for frontend and backend communication
app.use(
    cors({
        origin: function (origin, callback) {
            // Allow requests without origin like Postman or server-to-server
            if (!origin) {
                return callback(null, true);
            }

            // Allow only trusted frontend origins
            if (allowedOrigins.includes(origin)) {
                return callback(null, true);
            }

            // Block requests from unknown origins
            return callback(new Error("Not allowed by CORS"));
        },
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
        allowedHeaders: ["Content-Type", "Authorization"],
        credentials: true,
    })
);

// Limit repeated login and register attempts
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    keyGenerator: (req) => {
        return req.body?.email?.toLowerCase()?.trim() || req.ip;
    },
    message: {
        success: false,
        message: "Too many attempts. Please try again after 15 minutes.",
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Apply rate limiter on login route
app.use("/api/auth/login", authLimiter);

// Apply rate limiter on register route
app.use("/api/auth/register", authLimiter);

// Mount authentication routes
app.use("/api/auth", require("./routes/authRoutes"));

// Mount admin routes
app.use("/api/admin", require("./routes/adminRoutes"));

// Mount course routes
app.use("/api/courses", require("./routes/courseRoutes"));

// Mount PDF routes
app.use("/api/pdfs", require("./routes/pdfRoutes"));

// Use environment port or default 5000
const PORT = process.env.PORT || 5000;

// Start Express server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});