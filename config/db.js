// config/db.js
const mongoose = require("mongoose");

const connectDB = async () => {
    const mongoUri = process.env.MONGODB_URI;

    if (!mongoUri) {
        throw new Error(
            "MONGODB_URI is required. Set it to your MongoDB Atlas connection string."
        );
    }

    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 10000 });
    console.log("MongoDB connected successfully");
};

module.exports = connectDB;
