// config/db.js
const mongoose = require("mongoose");

const connectDB = async () => {
        await mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/leave-management", { serverSelectionTimeoutMS: 5000 });
        console.log("MongoDB connected successfully");
};

module.exports = connectDB;
