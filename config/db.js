// config/db.js
const mongoose = require("mongoose");

const connectDB = async () => {
    const mongoUri = process.env.MONGODB_URI;

    if (!mongoUri) {
        throw new Error(
            "MONGODB_URI is required. Set it to your MongoDB Atlas connection string."
        );
    }

    if (!/^mongodb(?:\+srv)?:\/\//i.test(mongoUri) || /[<>]/.test(mongoUri)) {
        throw new Error(
            "MONGODB_URI is not a complete MongoDB connection string. Copy the URI from Atlas and replace its placeholders."
        );
    }

    try {
        await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 15000 });
    } catch (error) {
        if (/ENOTFOUND|EAI_AGAIN|querySrv/i.test(error.message)) {
            throw new Error(
                "MongoDB Atlas DNS lookup failed. Verify the cluster hostname in MONGODB_URI against Atlas's current application connection string.",
                { cause: error }
            );
        }
        throw error;
    }
    console.log("MongoDB connected successfully");
};

module.exports = connectDB;
