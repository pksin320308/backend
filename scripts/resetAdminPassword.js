const mongoose = require("mongoose");
const dotenv = require("dotenv");
const bcrypt = require("bcryptjs");

const Admin = require("../models/Admin");

dotenv.config();

const resetAdminPassword = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);

        const email = process.argv[2];
        const newPassword = process.argv[3];

        if (!email || !newPassword) {
           
            process.exit(1);
        }

        if (newPassword.length < 8) {
            console.log("Password must be at least 8 characters long");
            process.exit(1);
        }

        const admin = await Admin.findOne({ email });

        if (!admin) {
            console.log("Admin not found with this email");
            process.exit(1);
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        admin.password = hashedPassword;
        await admin.save();

        console.log("Admin password reset successfully");
        

        process.exit(0);
    } catch (error) {
        console.log("Admin password reset failed:", error.message);
        process.exit(1);
    }
};

resetAdminPassword();