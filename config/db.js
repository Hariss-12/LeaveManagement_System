
const mongoose = require("mongoose");

const connectDB = async () => {
    const mongoUri = process.env.MONGODB_URI;

    // Check whether MongoDB URI exists
    if (!mongoUri) {
        throw new Error(
            "MONGODB_URI is required. Set it to your MongoDB Atlas connection string."
        );
    }

    // Validate MongoDB connection string
    if (
        !/^mongodb(?:\+srv)?:\/\//i.test(mongoUri) ||
        /[<>]/.test(mongoUri)
    ) {
        throw new Error(
            "MONGODB_URI is not a valid MongoDB connection string."
        );
    }

    try {
        await mongoose.connect(mongoUri, {
            serverSelectionTimeoutMS: 15000
        });

        console.log("MongoDB connected successfully");

    } catch (error) {
        if (/ENOTFOUND|EAI_AGAIN|querySrv/i.test(error.message)) {
            throw new Error(
                "MongoDB Atlas DNS lookup failed. Verify your cluster hostname.",
                { cause: error }
            );
        }

        throw error;
    }
};

module.exports = connectDB;
