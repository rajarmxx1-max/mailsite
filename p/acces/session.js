const USER_SESSION_KEY = "dafzgmail99_user_session_v3";

function saveUserSession(email) {
    if (!email) return;
    localStorage.setItem(USER_SESSION_KEY, String(email).toLowerCase());
}

function clearUserSession() { localStorage.removeItem(USER_SESSION_KEY); }

async function restoreUserSession() {
    if (!auth || !auth.currentUser) return false;
    try {
        const firebaseUser = auth.currentUser;
        const admin = await isAdminFirebaseUser(firebaseUser, true);
        if (admin) {
            clearUserSession(); currentUser = 'admin';
            const panel = document.getElementById('admin-panel-container');
            if (panel) panel.style.display = 'block';
            navigateTo('view-beranda'); renderAdminData(); return true;
        }

        const found = await ensureUserRecord(firebaseUser);
        if (found && found.isBanned) {
            clearUserSession(); await auth.signOut(); return false;
        }
        currentUser = found.email; saveUserSession(found.email);
        const panel = document.getElementById('admin-panel-container');
        if (panel) panel.style.display = 'none';
        navigateTo('view-beranda'); renderUserProfilData(); return true;
    } catch (error) {
        console.error('restoreUserSession:', error); clearUserSession(); return false;
    }
}

async function appLogout() {
    clearUserSession(); currentUser = null;
    try { await auth.signOut(); } catch (e) { console.error(e); }
    const panel = document.getElementById('admin-panel-container');
    if (panel) panel.style.display = 'none';
    navigateTo('view-auth');
}
