const mongoose = require("mongoose");
const dotenv = require("dotenv");
const bcrypt = require("bcryptjs");

const Admin = require("../models/Admin");

dotenv.config();

const createAdmin = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);

        const existingAdmin = await Admin.findOne({
            email: "admin@gmail.com",
        });

        if (existingAdmin) {
            console.log("Admin already exists");
            process.exit(0);
        }
        const hashedPassword = await bcrypt.hash("123456", 10);

        const admin = await Admin.create({
            name: "Rishu kumar",
            email: "admin@gmail.com",
            password: hashedPassword,
        });

        console.log("Admin created successfully");
        console.log({
            id: admin._id,
            name: admin.name,
            email: admin.email,
        });

        process.exit(0);
    } catch (error) {
        console.log("Admin creation failed:", error.message);
        process.exit(1);
    }
};

createAdmin();