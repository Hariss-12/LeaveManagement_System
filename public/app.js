const byId = (id) => document.getElementById(id);
const isGitHubPages = window.location.hostname === "github.io" ||
  window.location.hostname.endsWith(".github.io");
let selectedApplication = null;
let searchTimer;

async function apiRequest(url, options = {}) {
  const response = await fetch(url, {
    cache: "no-store",
    credentials: "same-origin",
    ...options,
    headers: { ...(options.body ? { "Content-Type": "application/json" } : {}), ...options.headers },
  });
  const text = await response.text();
  let data = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error("The server returned an invalid response.");
    }
  }
  if (!response.ok) {
    const error = new Error(data.message || `Request failed (${response.status})`);
    error.code = data.code;
    error.status = response.status;
    throw error;
  }
  return data;
}

function showMessage(message, isError = false) {
  const element = byId("response-message");
  element.textContent = message;
  element.classList.toggle("error", isError);
}

function showReviewMessage(message, isError = false) {
  const element = byId("review-message");
  element.textContent = message;
  element.classList.toggle("error", isError);
}

function showAuthPanel(panel) {
  byId("student-login-panel").hidden = panel !== "student";
  byId("warden-login-panel").hidden = panel !== "warden";
  byId("registration-panel").hidden = panel !== "registration";
  byId("auth-title").textContent = panel === "registration"
    ? "Create your student account"
    : panel === "warden" ? "Warden sign in" : "Student sign in";
  byId("auth-eyebrow").textContent = panel === "warden" ? "STAFF ACCESS" : "STUDENT PORTAL";
  byId("auth-description").textContent = panel === "warden"
    ? "Use your assigned staff credentials to continue."
    : "Use your registered college email and password to continue.";
  byId("auth-description").hidden = panel === "registration";
  showMessage("");
}

function showDashboard(user) {
  byId("auth-view").hidden = true;
  byId("student-dashboard").hidden = user.role !== "student";
  byId("warden-dashboard").hidden = user.role !== "warden";
  if (user.role === "student") {
    byId("profile-name").textContent = user.username;
    byId("profile-register-number").textContent = user.rollNumber;
    byId("profile-department").textContent = user.department;
    byId("profile-email").textContent = user.email;
    loadStudentLeaves();
  } else {
    loadWardenApplications();
  }
}

function showLogin() {
  byId("auth-view").hidden = false;
  byId("student-dashboard").hidden = true;
  byId("warden-dashboard").hidden = true;
  showAuthPanel("student");
}

async function submitLogin(event, endpoint) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"]');
  const originalText = button.textContent;
  const body = Object.fromEntries(new FormData(form));
  button.disabled = true;
  button.textContent = "Signing in…";
  try {
    const result = await apiRequest(endpoint, { method: "POST", body: JSON.stringify(body) });
    showDashboard(result.user);
  } catch (error) {
    showMessage(error.message, true);
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

async function registerStudent(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"]');
  const originalText = button.textContent;
  const body = Object.fromEntries(new FormData(form));
  button.disabled = true;
  button.textContent = "Creating account…";
  try {
    const result = await apiRequest("/api/auth/register", { method: "POST", body: JSON.stringify(body) });
    byId("student-login-email").value = body.email.trim();
    form.reset();
    showAuthPanel("student");
    showMessage(result.message);
  } catch (error) {
    if (error.code === "EMAIL_EXISTS") {
      byId("student-login-email").value = body.email.trim();
      form.reset();
      showAuthPanel("student");
      showMessage("That email already has an account. Sign in with it below.");
    } else {
      showMessage(error.message, true);
    }
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

function formatDate(value) {
  return new Date(value).toLocaleDateString();
}

function addTextCell(row, value) {
  const cell = document.createElement("td");
  cell.textContent = value;
  row.append(cell);
  return cell;
}

async function loadStudentLeaves() {
  try {
    const result = await apiRequest("/api/student/leaves");
    for (const type of ["casual", "medical"]) {
      const balance = result.balances[type];
      byId(`${type}-leave-balance`).textContent = balance.remaining;
      byId(`${type}-leave-used`).textContent = `${balance.used} of ${balance.total} days used · ${balance.pending} pending`;
    }
    const list = byId("student-leave-list");
    list.replaceChildren();
    if (!result.applications.length) {
      const empty = document.createElement("p");
      empty.className = "muted";
      empty.textContent = "No leave applications yet.";
      list.append(empty);
      return;
    }
    for (const application of result.applications) {
      const card = document.createElement("article");
      card.className = "application-card";
      const title = document.createElement("h3");
      title.textContent = `${application.leaveType} leave · ${application.days} day${application.days === 1 ? "" : "s"}`;
      const dates = document.createElement("p");
      dates.textContent = `${formatDate(application.fromDate)} – ${formatDate(application.toDate)}`;
      const status = document.createElement("p");
      status.className = `status status-${application.status}`;
      status.textContent = application.status;
      const reason = document.createElement("p");
      reason.textContent = application.reason;
      card.append(title, dates, status, reason);
      if (application.remarks) {
        const remarks = document.createElement("p");
        remarks.textContent = `Warden remarks: ${application.remarks}`;
        card.append(remarks);
      }
      list.append(card);
    }
  } catch (error) {
    showMessage(error.message, true);
  }
}

async function loadWardenApplications() {
  const query = new URLSearchParams();
  const status = byId("status-filter").value;
  const search = byId("application-search").value.trim();
  if (status) query.set("status", status);
  if (search) query.set("search", search);
  try {
    const result = await apiRequest(`/api/warden/leaves?${query}`);
    for (const key of ["total", "pending", "approved", "rejected"]) {
      byId(`stat-${key}`).textContent = result.stats[key];
    }
    const rows = byId("warden-application-rows");
    rows.replaceChildren();
    if (!result.applications.length) {
      const row = document.createElement("tr");
      const cell = addTextCell(row, "No applications found.");
      cell.colSpan = 8;
      cell.className = "muted";
      rows.append(row);
      return;
    }
    for (const application of result.applications) {
      const row = document.createElement("tr");
      addTextCell(row, application.student.name);
      addTextCell(row, application.student.registerNumber);
      addTextCell(row, application.student.department);
      addTextCell(row, `${application.leaveType} (${application.days} days)`);
      addTextCell(row, `${formatDate(application.fromDate)} – ${formatDate(application.toDate)}`);
      addTextCell(row, formatDate(application.submittedAt));
      const statusCell = addTextCell(row, application.status);
      statusCell.className = `status status-${application.status}`;
      const actionCell = document.createElement("td");
      const viewButton = document.createElement("button");
      viewButton.type = "button";
      viewButton.className = "link-btn";
      viewButton.textContent = "View";
      viewButton.addEventListener("click", () => openApplication(application));
      actionCell.append(viewButton);
      row.append(actionCell);
      rows.append(row);
    }
  } catch (error) {
    showMessage(error.message, true);
  }
}

function openApplication(application) {
  selectedApplication = application;
  const details = byId("application-details");
  details.replaceChildren();
  const values = [
    ["Student", application.student.name],
    ["Register number", application.student.registerNumber],
    ["Department", application.student.department],
    ["Leave type", application.leaveType],
    ["Dates", `${formatDate(application.fromDate)} – ${formatDate(application.toDate)}`],
    ["Reason", application.reason],
    ["Status", application.status],
  ];
  for (const [label, value] of values) {
    const line = document.createElement("p");
    const heading = document.createElement("strong");
    heading.textContent = `${label}: `;
    line.append(heading, document.createTextNode(value));
    details.append(line);
  }
  byId("review-form").hidden = application.status !== "pending";
  byId("review-remarks").value = "";
  showReviewMessage("");
  byId("application-dialog").showModal();
}

async function reviewApplication(status) {
  if (!selectedApplication) return;
  try {
    const remarks = byId("review-remarks").value.trim();
    const result = await apiRequest(`/api/warden/leaves/${selectedApplication.id}/review`, {
      method: "PATCH",
      body: JSON.stringify({ status, remarks }),
    });
    byId("application-dialog").close();
    showMessage(result.message);
    await loadWardenApplications();
  } catch (error) {
    showReviewMessage(error.message, true);
  }
}

async function logout() {
  try {
    await apiRequest("/api/auth/logout", { method: "POST" });
  } catch (error) {
    console.error("Logout error:", error);
  } finally {
    showLogin();
  }
}

async function restoreSession() {
  try {
    const result = await apiRequest("/api/auth/me");
    showDashboard(result.user);
  } catch {
    showLogin();
  }
}

byId("student-login-form").addEventListener("submit", (event) => submitLogin(event, "/api/auth/login"));
byId("warden-login-form").addEventListener("submit", (event) => submitLogin(event, "/api/auth/warden/login"));
byId("registration-form").addEventListener("submit", registerStudent);
byId("show-registration").addEventListener("click", () => showAuthPanel("registration"));
byId("show-login").addEventListener("click", () => showAuthPanel("student"));
byId("show-warden-login").addEventListener("click", () => showAuthPanel("warden"));
byId("show-student-login").addEventListener("click", () => showAuthPanel("student"));
document.querySelectorAll(".logout-button").forEach((button) => button.addEventListener("click", logout));
byId("leave-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const body = Object.fromEntries(new FormData(form));
  try {
    const result = await apiRequest("/api/student/leaves", { method: "POST", body: JSON.stringify(body) });
    showMessage(result.message);
    form.reset();
    await loadStudentLeaves();
  } catch (error) {
    showMessage(error.message, true);
  }
});
byId("refresh-history").addEventListener("click", loadStudentLeaves);
byId("status-filter").addEventListener("change", loadWardenApplications);
byId("application-search").addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(loadWardenApplications, 200);
});
byId("approve-application").addEventListener("click", () => reviewApplication("approved"));
byId("reject-application").addEventListener("click", () => reviewApplication("rejected"));
byId("close-application-dialog").addEventListener("click", () => byId("application-dialog").close());

if (isGitHubPages) {
  if (window.location.search) {
    window.history.replaceState(window.history.state, "", window.location.pathname + window.location.hash);
  }
  document.querySelectorAll("#auth-view input, #auth-view button").forEach((control) => {
    control.disabled = true;
  });
  showMessage("Opening the live leave-management app…");
  window.location.replace("https://leavemanagement-system-1.onrender.com/");
} else {
  restoreSession();
}
