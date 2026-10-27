
const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const User = require("../models/user");

// Helper functions
const clean = (value) =>
    typeof value === "string" ? value.trim() : "";

const validBalance = (value) =>
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0;

const userResponse = (user) => ({
    userId: user._id,
    username: user.username,
    email: user.email,
    rollNumber: user.rollNumber,
    casualLeave: user.casualLeave,
    medicalLeave: user.medicalLeave,
});

// Validate MongoDB user IDs
router.param("id", (req, res, next, id) => {
    if (!mongoose.isObjectIdOrHexString(id)) {
        return res.status(400).json({
            success: false,
            message: "Invalid user ID",
        });
    }

    next();
});

// Register a new user
router.post("/register", async (req, res) => {
    try {
        const body = req.body || {};

        const username = clean(body.username);
        const email = clean(body.email).toLowerCase();
        const rollNumber = clean(body.rollNumber);

        const casualLeave = body.casualLeave ?? 0;
        const medicalLeave = body.medicalLeave ?? 0;

        // Validate required fields
        if (!username || !email || !rollNumber) {
            return res.status(400).json({
                success: false,
                message: "All fields are required",
            });
        }

        // Validate email format
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!emailPattern.test(email)) {
            return res.status(400).json({
                success: false,
                message: "Invalid email format",
            });
        }

        // Validate initial leave balances
        if (
            !validBalance(casualLeave) ||
            !validBalance(medicalLeave)
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Leave balances must be non-negative whole numbers",
            });
        }

        // Check for an existing email or roll number
        const existingUser = await User.findOne({
            $or: [{ email }, { rollNumber }],
        });

        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: "Email or roll number already exists",
            });
        }

        // Create the user
        const user = await User.create({
            username,
            email,
            rollNumber,
            casualLeave,
            medicalLeave,
        });

        return res.status(201).json({
            success: true,
            message: "User created successfully",
            ...userResponse(user),
        });
    } catch (error) {
        console.error("Registration error:", error);

        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: "Email or roll number already exists",
            });
        }

        if (error.name === "ValidationError") {
            return res.status(400).json({
                success: false,
                message: "Invalid user data",
            });
        }

        return res.status(500).json({
            success: false,
            message: "Registration failed due to a server error",
        });
    }
});

// Login using email
router.post("/login", async (req, res) => {
    try {
        const email = clean(req.body?.email).toLowerCase();

        if (!email) {
            return res.status(400).json({
                success: false,
                message: "Email is required",
            });
        }

        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Login successful",
            ...userResponse(user),
        });
    } catch (error) {
        console.error("Login error:", error);

        return res.status(500).json({
            success: false,
            message: "Login failed due to a server error",
        });
    }
});

// Get leave balance
router.get("/leave-balance/:id", async (req, res) => {
    try {
        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        return res.status(200).json({
            success: true,
            casualLeave: user.casualLeave,
            medicalLeave: user.medicalLeave,
        });
    } catch (error) {
        console.error("Leave balance error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to retrieve leave balance",
        });
    }
});

// Apply for casual or medical leave
router.post("/apply-leave/:id", async (req, res) => {
    try {
        const { type, days } = req.body || {};

        if (!validBalance(days) || days === 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid number of days",
            });
        }

        if (type !== "casual" && type !== "medical") {
            return res.status(400).json({
                success: false,
                message: "Invalid leave type",
            });
        }

        const field =
            type === "casual" ? "casualLeave" : "medicalLeave";

        // Atomically check and deduct the leave balance
        const user = await User.findOneAndUpdate(
            {
                _id: req.params.id,
                [field]: { $gte: days },
            },
            {
                $inc: { [field]: -days },
            },
            {
                returnDocument: "after",
                runValidators: true,
            }
        );

        if (!user) {
            const existingUser = await User.exists({
                _id: req.params.id,
            });

            if (!existingUser) {
                return res.status(404).json({
                    success: false,
                    message: "User not found",
                });
            }

            return res.status(400).json({
                success: false,
                message: "Insufficient leave balance",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Leave applied successfully",
            casualLeave: user.casualLeave,
            medicalLeave: user.medicalLeave,
        });
    } catch (error) {
        console.error("Apply leave error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to apply for leave",
        });
    }
});

module.exports = router;
