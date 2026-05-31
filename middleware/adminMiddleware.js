const adminOnly = (req, res, next) => {
    if (req.userRole !== "admin") {
        return res.status(403).json({
            success: false,
            message: "Only admin can access this route",
        });
    }

    next();
};

module.exports = adminOnly;