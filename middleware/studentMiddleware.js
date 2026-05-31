const studentOnly = (req, res, next) => {
    if (req.userRole !== "student") {
        return res.status(403).json({
            success: false,
            message: "Only student can access this route",
        });
    }

    next();
};

module.exports = studentOnly;