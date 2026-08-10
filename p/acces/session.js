// Session persistence: users only. Admin is NEVER persisted.
const USER_SESSION_KEY = "dafzgmail99_user_session_v1";

function saveUserSession(email) {
    if (!email || email === "admin") return;
    localStorage.setItem(USER_SESSION_KEY, email);
}

function clearUserSession() {
    localStorage.removeItem(USER_SESSION_KEY);
}

function restoreUserSession() {
    const saved = localStorage.getItem(USER_SESSION_KEY);
    if (!saved || saved === "admin") {
        if (saved === "admin") clearUserSession();
        return false;
    }
    const found = getUsers().find(u => u.email === saved);
    if (!found || found.isBanned) {
        clearUserSession();
        return false;
    }
    currentUser = found.email;
    const adminPanel = document.getElementById("admin-panel-container");
    if (adminPanel) adminPanel.style.display = "none";
    navigateTo("view-beranda");
    return true;
}

function appLogout() {
    clearUserSession();
    currentUser = null;
    navigateTo("view-auth");
}
