
const mongoose = require("mongoose");

// User schema
const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, "Username is required"],
      trim: true,
    },

    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      trim: true,
      lowercase: true,
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        "Please enter a valid email address",
      ],
    },

    rollNumber: {
      type: String,
      required: [true, "Roll number is required"],
      trim: true,
      unique: true,
    },

    department: { type: String, trim: true, default: "Not specified" },
    passwordHash: { type: String, select: false },
    role: { type: String, enum: ["student"], default: "student" },

  },
  {
    timestamps: true,
  }
);

// Export the User model without recompiling it
const User =
  mongoose.models.User ||
  mongoose.model("User", userSchema);

module.exports = User;
