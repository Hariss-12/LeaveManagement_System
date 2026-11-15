const { test } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const connectDB = require("../config/db");

process.env.AUTH_SECRET ||= "api-test-secret-that-is-at-least-thirty-two-characters";
process.env.WARDEN_USERNAME ||= "test-warden";
process.env.WARDEN_PASSWORD ||= "test-warden-password";

const app = require("../app");
const User = require("../models/user");
const LeaveApplication = require("../models/leaveApplication");

test("registration, sessions, leave requests, and warden review", async () => {
  const mongoUri = process.env.TEST_MONGODB_URI || "mongodb://127.0.0.1:27017/leave-management-test";
  await connectDB(mongoUri, 5000);
  const stamp = Date.now();
  const email = `regression-${stamp}@example.com`;
  const rollNumber = `TEST-${stamp}`;
  let server;

  const request = async (base, path, body, cookie) => {
    const response = await fetch(base + path, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(cookie ? { Cookie: cookie } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: response.status, body: await response.json(), cookie: response.headers.get("set-cookie")?.split(";")[0] };
  };

  try {
    await User.init();
    server = app.listen(0, "127.0.0.1");
    await new Promise((resolve) => server.once("listening", resolve));
    const base = `http://127.0.0.1:${server.address().port}`;

    assert.equal((await fetch(base)).status, 200);
    assert.equal((await fetch(`${base}/style.css`)).status, 200);
    const health = await fetch(`${base}/api/health`);
    assert.equal(health.status, 200);
    assert.equal(health.headers.get("cache-control"), "no-store");

    const registration = { username: "Regression User", email, rollNumber, department: "Testing", password: "safe-test-password" };
    assert.equal((await request(base, "/api/auth/register", {})).status, 400);
    assert.equal((await request(base, "/api/auth/register", registration)).status, 201);
    assert.equal((await request(base, "/api/auth/register", registration)).status, 409);

    const login = await request(base, "/api/auth/login", { email: email.toUpperCase(), password: registration.password });
    assert.equal(login.status, 200);
    assert.ok(login.cookie);
    assert.equal((await request(base, "/api/auth/me", undefined, login.cookie)).body.user.email, email);

    const leaveDate = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
    const leave = await request(base, "/api/student/leaves", {
      leaveType: "casual", fromDate: leaveDate, toDate: leaveDate, reason: "Personal appointment",
    }, login.cookie);
    assert.equal(leave.status, 201);
    assert.equal(leave.body.application.days, 1);
    assert.equal((await request(base, "/api/student/leaves", undefined, login.cookie)).body.applications.length, 1);

    const wardenLogin = await request(base, "/api/auth/warden/login", {
      username: process.env.WARDEN_USERNAME, password: process.env.WARDEN_PASSWORD,
    });
    assert.equal(wardenLogin.status, 200);
    const queue = await request(base, `/api/warden/leaves?search=${rollNumber}`, undefined, wardenLogin.cookie);
    assert.equal(queue.status, 200);
    assert.equal(queue.body.applications.length, 1);

    const rejected = await fetch(`${base}/api/warden/leaves/${leave.body.application.id}/review`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: wardenLogin.cookie },
      body: JSON.stringify({ status: "rejected", remarks: "Please submit updated dates." }),
    });
    assert.equal(rejected.status, 200);
    const secondLeave = await request(base, "/api/student/leaves", {
      leaveType: "medical", fromDate: leaveDate, toDate: leaveDate, reason: "Medical appointment",
    }, login.cookie);
    assert.equal(secondLeave.status, 201);
    const approved = await fetch(`${base}/api/warden/leaves/${secondLeave.body.application.id}/review`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: wardenLogin.cookie },
      body: JSON.stringify({ status: "approved" }),
    });
    assert.equal(approved.status, 200);
    assert.equal((await approved.json()).application.status, "approved");
    assert.equal((await User.findOne({ email }).select("medicalLeave")).medicalLeave, 0);
    await User.updateOne({ email }, { $set: { medicalLeave: 2 } });
    const thirdLeave = await request(base, "/api/student/leaves", {
      leaveType: "medical", fromDate: leaveDate, toDate: leaveDate, reason: "Follow-up appointment",
    }, login.cookie);
    const approvedWithBalance = await fetch(`${base}/api/warden/leaves/${thirdLeave.body.application.id}/review`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: wardenLogin.cookie },
      body: JSON.stringify({ status: "approved" }),
    });
    assert.equal(approvedWithBalance.status, 200);
    assert.equal((await User.findOne({ email }).select("medicalLeave")).medicalLeave, 1);
    assert.equal((await request(base, "/api/auth/logout", {}, login.cookie)).status, 200);
  } finally {
    const user = await User.findOne({ email }).select("_id");
    if (user) await LeaveApplication.deleteMany({ student: user._id });
    await User.deleteMany({ email });
    if (server) await new Promise((resolve) => server.close(resolve));
    await mongoose.disconnect();
  }
});
