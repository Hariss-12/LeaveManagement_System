const mongoose = require("mongoose");

const leaveApplicationSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  leaveType: { type: String, enum: ["casual", "medical"], required: true },
  fromDate: { type: Date, required: true },
  toDate: { type: Date, required: true },
  days: { type: Number, required: true, min: 1 },
  reason: { type: String, required: true, trim: true, maxlength: 1000 },
  status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending", index: true },
  remarks: { type: String, trim: true, maxlength: 1000, default: "" },
  reviewedBy: { type: String, default: "" },
  reviewedAt: Date,
}, { timestamps: true });

module.exports = mongoose.models.LeaveApplication || mongoose.model("LeaveApplication", leaveApplicationSchema);
