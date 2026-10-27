
let userId = null;

// Get HTML element
function getElement(id) {
    return document.getElementById(id);
}

// Display response messages
function showMessage(message, id = "response-message") {
    const element = getElement(id);

    if (element) {
        element.textContent = message;
    }
}

// Show or hide HTML sections
function toggleSection(id, show) {
    const element = getElement(id);

    if (element) {
        element.style.display = show ? "block" : "none";
    }
}

// Show login page
function showLogin() {
    toggleSection("login-section", true);
    toggleSection("registration-section", false);
}

// Show registration page
function showRegistration() {
    toggleSection("registration-section", true);
    toggleSection("login-section", false);
}

// Send API request

async function apiRequest(url, options = {}) {
    const response = await fetch(url, options);
    const responseText = await response.text();

    let data = {};

    if (responseText.trim()) {
        try {
            data = JSON.parse(responseText);
        } catch {
            console.error(
                "Invalid response from server:",
                responseText
            );

            throw new Error(
                "The server returned an invalid response. Check the API URL."
            );
        }
    }

    if (!response.ok) {
        throw new Error(
            data.message || `Request failed (${response.status})`
        );
    }

    if (!responseText.trim()) {
        throw new Error(
            "The server returned an empty response. Check the backend route."
        );
    }

    return data;
}

// Register new user
async function registerUser(event) {
    event.preventDefault();

    const username = getElement("username").value.trim();
    const email = getElement("reg-email").value.trim();
    const rollNumber = getElement("roll-number").value.trim();

    const casualLeave = Number(
        getElement("casual-leave").value
    );

    const medicalLeave = Number(
        getElement("medical-leave").value
    );

    if (!username || !email || !rollNumber) {
        showMessage(
            "Please fill all required fields",
            "registration-response"
        );
        return;
    }

    if (
        !Number.isInteger(casualLeave) ||
        casualLeave < 0 ||
        !Number.isInteger(medicalLeave) ||
        medicalLeave < 0
    ) {
        showMessage(
            "Leave balances must be non-negative whole numbers",
            "registration-response"
        );
        return;
    }

    try {
        const data = await apiRequest("/api/register", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                username,
                email,
                rollNumber,
                casualLeave,
                medicalLeave
            })
        });

        showMessage(
            data.message,
            "registration-response"
        );

        getElement("registration-form").reset();

        showLogin();

        showMessage("Registration successful. Please login.");

    } catch (error) {
        console.error("Registration error:", error);

        showMessage(
            error.message,
            "registration-response"
        );
    }
}

// Login user
async function loginUser(event) {
    event.preventDefault();

    const email = getElement("email").value.trim();

    if (!email) {
        showMessage("Please enter your email");
        return;
    }

    try {
        const data = await apiRequest("/api/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ email })
        });

        userId = data.userId;

        getElement("username-display").textContent =
            data.username;

        getElement("roll-number-display").textContent =
            data.rollNumber;

        getElement("casual-leave-display").textContent =
            data.casualLeave;

        getElement("medical-leave-display").textContent =
            data.medicalLeave;

        toggleSection("login-section", false);
        toggleSection("registration-section", false);
        toggleSection("balance-section", true);
        toggleSection("apply-leave-section", true);
        toggleSection("logout-button", true);

        showMessage("Login successful");

    } catch (error) {
        console.error("Login error:", error);
        showMessage(error.message);
    }
}

// Logout user
function logoutUser() {
    userId = null;

    toggleSection("balance-section", false);
    toggleSection("apply-leave-section", false);
    toggleSection("logout-button", false);
    toggleSection("registration-section", false);

    getElement("username-display").textContent = "";
    getElement("roll-number-display").textContent = "";

    getElement("casual-leave-display").textContent = "0";
    getElement("medical-leave-display").textContent = "0";

    getElement("login-form").reset();

    showLogin();

    showMessage("Logged out successfully");
}

// Refresh leave balance
async function refreshLeaveBalance() {
    if (!userId) {
        showMessage("Please login first");
        return;
    }

    try {
        const data = await apiRequest(
            `/api/leave-balance/${userId}`
        );

        getElement("casual-leave-display").textContent =
            data.casualLeave;

        getElement("medical-leave-display").textContent =
            data.medicalLeave;

        showMessage("Leave balance updated");

    } catch (error) {
        console.error("Balance error:", error);
        showMessage(error.message);
    }
}

// Apply for leave
async function applyLeave(event) {
    event.preventDefault();

    if (!userId) {
        showMessage("Please login first");
        return;
    }

    const type = getElement("leave-type").value;

    const days = Number(
        getElement("leave-days").value
    );

    if (!Number.isInteger(days) || days <= 0) {
        showMessage("Enter a valid number of days");
        return;
    }

    if (type !== "casual" && type !== "medical") {
        showMessage("Please select a valid leave type");
        return;
    }

    try {
        const data = await apiRequest(
            `/api/apply-leave/${userId}`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    type,
                    days
                })
            }
        );

        getElement("casual-leave-display").textContent =
            data.casualLeave;

        getElement("medical-leave-display").textContent =
            data.medicalLeave;

        showMessage(data.message);

        getElement("leave-form").reset();

    } catch (error) {
        console.error("Apply leave error:", error);
        showMessage(error.message);
    }
}

// Initialize application
document.addEventListener("DOMContentLoaded", () => {

    function addListener(id, event, handler) {
        const element = getElement(id);

        if (element) {
            element.addEventListener(event, handler);
        } else {
            console.error(`Missing HTML element: ${id}`);
        }
    }

    // Registration
    addListener(
        "registration-form",
        "submit",
        registerUser
    );

    // Login
    addListener(
        "login-form",
        "submit",
        loginUser
    );

    // Logout
    addListener(
        "logout-button",
        "click",
        logoutUser
    );

    // Refresh balance
    addListener(
        "refresh-balance",
        "click",
        refreshLeaveBalance
    );

    // Apply leave
    addListener(
        "leave-form",
        "submit",
        applyLeave
    );

    // Navigation
    addListener(
        "show-login",
        "click",
        showLogin
    );

    addListener(
        "show-registration",
        "click",
        showRegistration
    );

    // Initial display
    toggleSection("login-section", true);
    toggleSection("registration-section", false);
    toggleSection("balance-section", false);
    toggleSection("apply-leave-section", false);
    toggleSection("logout-button", false);

});
