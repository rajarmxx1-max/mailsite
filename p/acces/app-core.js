const firebaseConfig = {
    apiKey: "AIzaSyB9XOFZmVn5AoiLOPA1E3dqa8s4yraki58",
    authDomain: "pikjamail.firebaseapp.com",
    projectId: "pikjamail",
    storageBucket: "pikjamail.firebasestorage.app",
    messagingSenderId: "839359291424",
    appId: "1:839359291424:web:8a48b90e56a82373945c45",
    measurementId: "G-HBYVYR4MDE"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const auth = firebase.auth();
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(console.error);

async function isAdminFirebaseUser(firebaseUser, forceRefresh = false) {
    if (!firebaseUser) return false;
    try {
        const tokenResult = await firebaseUser.getIdTokenResult(forceRefresh);
        return tokenResult.claims && tokenResult.claims.admin === true;
    } catch (error) {
        console.error('Admin claim check:', error);
        return false;
    }
}

lucide.createIcons();

const DEFAULT_RULES = `<h4>Rules / Aturan Storan Gmail</h4><ol style="padding-left: 16px; margin-top: 6px;"><li>Gmail Harus Fresh (Baru dibuat).</li><li>Format wajib: email@gmail.com|password (Password wajib: <b>sgsg1122</b>).</li><li>Wajib mengikuti format angka yang ditentukan sebelum @gmail.com.</li></ol>`;
const DEFAULT_NOTICE_BLUE = "<strong>Wajib akhiri angka 1-100</strong><br>Angka harus tepat sebelum @gmail.com, tanpa huruf/simbol setelahnya.";
const DEFAULT_NOTICE_YELLOW = "<strong>Password wajib untuk Gmail yang disetor:</strong><br><code style='background: rgba(0,0,0,0.06); padding: 2px 4px; border-radius: 4px;'>sgsg1122</code>";

let currentUser = null;
let selectedWallet = "DANA";
let referralCodeFromUrl = "";
let clientIpAddress = "192.168.1." + Math.floor(Math.random() * 5 + 1);

let remoteSettings = {};
let remoteUsers = [];
let remoteStoran = [];
let remoteTarik = [];

let pendingRegistrationData = null;
let generatedOtpCode = "";

auth.onAuthStateChanged(async (firebaseUser) => {
    if (!firebaseUser) {
        currentUser = null;
        const panel = document.getElementById('admin-panel-container');
        if (panel) panel.style.display = 'none';
        return;
    }
    try {
        await restoreUserSession();
    } catch (e) {
        console.error('Firebase auth state:', e);
    }
});

window.addEventListener('DOMContentLoaded', () => {
    fetch('https://api.ipify.org?format=json')
        .then(response => response.json())
        .then(data => { if(data.ip) clientIpAddress = data.ip; })
        .catch(() => {});

    const urlParams = new URLSearchParams(window.location.search);
    referralCodeFromUrl = urlParams.get('ref');
    if(referralCodeFromUrl) localStorage.setItem('pending_ref', referralCodeFromUrl);

    db.ref('settings').on('value', (snapshot) => {
        remoteSettings = snapshot.val() || {};
        applySettingsToUI();
    });

    db.ref('users').on('value', (snapshot) => {
        const data = snapshot.val();
        remoteUsers = data ? Object.values(data) : [];
        if(currentUser === 'admin') renderAdminData();
        if (!currentUser && auth.currentUser) restoreUserSession();
    });

    db.ref('storan').on('value', (snapshot) => {
        const data = snapshot.val();
        remoteStoran = data ? Object.values(data) : [];
        updateStoranUI();
        if(document.getElementById('view-riwayat').classList.contains('active-view')) renderUserRiwayat();
        if(currentUser === 'admin') renderAdminData();
    });

    db.ref('tarik_dana').on('value', (snapshot) => {
        const data = snapshot.val();
        remoteTarik = data ? Object.values(data) : [];
        if(document.getElementById('view-saldo').classList.contains('active-view')) renderTarikRiwayat();
        if(currentUser === 'admin') renderAdminData();
    });

    navigateTo('view-auth');
});
