
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
    },

    casualLeave: {
      type: Number,
      default: 0,
      min: [0, "Casual leave cannot be negative"],
      validate: {
        validator: Number.isSafeInteger,
        message: "Casual leave must be a whole number",
      },
    },

    medicalLeave: {
      type: Number,
      default: 0,
      min: [0, "Medical leave cannot be negative"],
      validate: {
        validator: Number.isSafeInteger,
        message: "Medical leave must be a whole number",
      },
    },
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
