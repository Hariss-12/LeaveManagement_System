const express = require("express");
const mongoose = require("mongoose");
const User = require("../models/user");
const LeaveApplication = require("../models/leaveApplication");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
const studentOnly = requireAuth("student");
const wardenOnly = requireAuth("warden");
const dayMs = 24 * 60 * 60 * 1000;
const clean = (value) => typeof value === "string" ? value.trim() : "";
const asDay = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value || "") ? new Date(`${value}T00:00:00.000Z`) : null;
const studentView = (leave) => ({ id: leave._id, leaveType: leave.leaveType, fromDate: leave.fromDate, toDate: leave.toDate, days: leave.days, reason: leave.reason, status: leave.status, remarks: leave.remarks, submittedAt: leave.createdAt, reviewedAt: leave.reviewedAt });

router.post("/student/leaves", studentOnly, async (req, res) => {
  try {
    const leaveType = req.body?.leaveType;
    const fromDate = asDay(req.body?.fromDate);
    const toDate = asDay(req.body?.toDate);
    const reason = clean(req.body?.reason);
    if (!fromDate || !toDate || toDate < fromDate) return res.status(400).json({ success: false, message: "Choose valid leave dates; the end date must be on or after the start date" });
    if (fromDate < new Date(new Date().toISOString().slice(0, 10) + "T00:00:00.000Z")) return res.status(400).json({ success: false, message: "Leave dates cannot be in the past" });
    if (!["casual", "medical"].includes(leaveType)) return res.status(400).json({ success: false, message: "Choose a valid leave type" });
    if (reason.length < 5 || reason.length > 1000) return res.status(400).json({ success: false, message: "Reason must be between 5 and 1000 characters" });
    const days = Math.round((toDate - fromDate) / dayMs) + 1;
    const leave = await LeaveApplication.create({ student: req.auth.sub, leaveType, fromDate, toDate, days, reason });
    return res.status(201).json({ success: true, message: "Leave request submitted for review", application: studentView(leave) });
  } catch (error) {
    console.error("Leave submission error:", error);
    return res.status(500).json({ success: false, message: "Unable to submit leave request" });
  }
});

router.get("/student/leaves", studentOnly, async (req, res) => {
  const leaves = await LeaveApplication.find({ student: req.auth.sub }).sort({ createdAt: -1 }).lean();
  return res.json({ success: true, applications: leaves.map(studentView) });
});

router.get("/warden/leaves", wardenOnly, async (req, res) => {
  try {
    const status = clean(req.query.status);
    const search = clean(req.query.search);
    if (status && !["pending", "approved", "rejected"].includes(status)) return res.status(400).json({ success: false, message: "Invalid status filter" });
    const docs = await LeaveApplication.find(status ? { status } : {}).populate("student", "username rollNumber department email").sort({ createdAt: -1 }).lean();
    const normalizedSearch = search.toLocaleLowerCase();
    const applications = docs.filter((leave) => leave.student && (!normalizedSearch || leave.student.username.toLocaleLowerCase().includes(normalizedSearch) || leave.student.rollNumber.toLocaleLowerCase().includes(normalizedSearch))).map((leave) => ({ id: leave._id, student: { name: leave.student.username, registerNumber: leave.student.rollNumber, department: leave.student.department }, leaveType: leave.leaveType, fromDate: leave.fromDate, toDate: leave.toDate, days: leave.days, reason: leave.reason, status: leave.status, remarks: leave.remarks, submittedAt: leave.createdAt, reviewedAt: leave.reviewedAt }));
    const [total, pending, approved, rejected] = await Promise.all([LeaveApplication.countDocuments(), LeaveApplication.countDocuments({ status: "pending" }), LeaveApplication.countDocuments({ status: "approved" }), LeaveApplication.countDocuments({ status: "rejected" })]);
    return res.json({ success: true, stats: { total, pending, approved, rejected }, applications });
  } catch (error) {
    console.error("Warden applications error:", error);
    return res.status(500).json({ success: false, message: "Unable to load leave applications" });
  }
});

router.patch("/warden/leaves/:id/review", wardenOnly, async (req, res) => {
  if (!mongoose.isObjectIdOrHexString(req.params.id)) return res.status(400).json({ success: false, message: "Invalid application ID" });
  const decision = req.body?.status;
  const remarks = clean(req.body?.remarks);
  if (!["approved", "rejected"].includes(decision)) return res.status(400).json({ success: false, message: "Decision must be approve or reject" });
  if (decision === "rejected" && !remarks) return res.status(400).json({ success: false, message: "Add a remark when rejecting an application" });
  if (remarks.length > 1000) return res.status(400).json({ success: false, message: "Remarks cannot exceed 1000 characters" });
  try {
    const application = await LeaveApplication.findOneAndUpdate({ _id: req.params.id, status: "pending" }, { $set: { status: decision, remarks: decision === "rejected" ? remarks : "", reviewedBy: "Warden", reviewedAt: new Date() } }, { returnDocument: "after" });
    if (!application) {
      const exists = await LeaveApplication.exists({ _id: req.params.id });
      return exists ? res.status(409).json({ success: false, message: "This application has already been reviewed" }) : res.status(404).json({ success: false, message: "Application not found" });
    }
    if (decision === "approved") {
      const balanceField = application.leaveType === "casual" ? "casualLeave" : "medicalLeave";
      const student = await User.findOneAndUpdate({ _id: application.student, [balanceField]: { $gte: application.days } }, { $inc: { [balanceField]: -application.days } }, { returnDocument: "after" });
      if (!student) {
        await LeaveApplication.updateOne({ _id: application._id, status: "approved" }, { $set: { status: "pending", reviewedBy: "", reviewedAt: null } });
        return res.status(409).json({ success: false, message: "Student does not have enough leave balance to approve this request" });
      }
    }
    return res.json({ success: true, message: `Application ${decision}`, application: studentView(application) });
  } catch (error) {
    console.error("Leave review error:", error);
    return res.status(500).json({ success: false, message: "Unable to review application" });
  }
});

module.exports = router;
