function getUserRecordByEmail(email) {
    const users = getUsers();
    return users.find(u => String(u.email || '').toLowerCase() === String(email || '').toLowerCase());
}

function userKey(email) {
    return String(email).replace(/[.\#$\[\]]/g, '_');
}

async function ensureUserRecord(firebaseUser, profile = {}) {
    const email = (firebaseUser.email || '').toLowerCase();
    if (!email) throw new Error('Akun Firebase tidak memiliki email.');

    let found = getUserRecordByEmail(email);
    if (found && found.isBanned) throw new Error('Akun ini telah diblokir (banned) oleh Admin.');

    if (!found) {
        const name = profile.name || firebaseUser.displayName || email.split('@')[0];
        const assignedRef = generateRefCode(name);
        const pendingRefCode = localStorage.getItem('pending_ref');
        let bonusAwal = 0;

        if (pendingRefCode && pendingRefCode !== assignedRef) {
            const referrer = getUsers().find(u => u.refCode === pendingRefCode);
            if (referrer) {
                referrer.bonusReferral = (referrer.bonusReferral || 0) + 5000;
                await db.ref('users/' + userKey(referrer.email)).set(referrer);
            }
        }

        found = { uid: firebaseUser.uid, name, email, role: 'User', refCode: assignedRef, bonusReferral: bonusAwal, ipAddress: clientIpAddress, isBanned: false };
        await db.ref('users/' + userKey(email)).set(found);
        localStorage.removeItem('pending_ref');
    } else {
        found.uid = firebaseUser.uid;
        found.ipAddress = clientIpAddress;
        await db.ref('users/' + userKey(email)).update({ uid: firebaseUser.uid, ipAddress: clientIpAddress });
    }
    return found;
}

async function signInFirebaseUser(firebaseUser) {
    if (!firebaseUser) throw new Error('Sesi Firebase tidak ditemukan.');

    const admin = await isAdminFirebaseUser(firebaseUser, true);
    if (admin) {
        clearUserSession();
        currentUser = 'admin';
        document.getElementById('admin-panel-container').style.display = 'block';
        navigateTo('view-beranda');
        renderAdminData();
        return;
    }

    const found = await ensureUserRecord(firebaseUser);
    currentUser = found.email;
    saveUserSession(found.email);
    document.getElementById('admin-panel-container').style.display = 'none';
    navigateTo('view-beranda');
    renderUserProfilData();
}

function initiateRegisterVerification() {
    const name = document.getElementById('reg-name').value.trim();
    const email = document.getElementById('reg-email').value.trim().toLowerCase();
    const pass = document.getElementById('reg-pass').value.trim();
    const emailRegex = /^[a-z0-9._%+-]+@gmail\.com$/;
    if (!emailRegex.test(email) || email.includes('..') || email.startsWith('.')) return alert('Pendaftaran gagal! Harap masukkan format @gmail.com yang valid.');
    if (!pass || pass.length < 6) return alert('Password minimal harus 6 karakter!');
    if (getUserRecordByEmail(email)) return alert('Email sudah terdaftar di sistem! Silakan masuk.');

    generatedOtpCode = Math.floor(100000 + Math.random() * 900000).toString();
    pendingRegistrationData = { name, email, pass };
    const btn = document.getElementById('btn-submit-reg');
    btn.innerText = 'Mengirim Kode ke Email...'; btn.disabled = true;
    const templateParams = { to_email: email, to_name: name, otp_code: generatedOtpCode };
    emailjs.send('service_default', 'template_default', templateParams)
        .then(() => openOtpModalAfterSend(btn, email))
        .catch(() => openOtpModalAfterSend(btn, email));
}

function openOtpModalAfterSend(btn, email) {
    btn.innerText = 'Daftar Akun'; btn.disabled = false;
    document.getElementById('otp-target-email').innerText = email;
    document.getElementById('otp-modal').classList.add('active');
}
function closeOtpModal() { document.getElementById('otp-modal').classList.remove('active'); }

async function verifyEmailOtpCode() {
    const enteredOtp = document.getElementById('otp-input-code').value.trim();
    if (enteredOtp !== generatedOtpCode) return alert('Kode verifikasi salah! Silakan periksa kembali email Anda.');
    closeOtpModal(); await finalizeRegistration(pendingRegistrationData);
}

async function finalizeRegistration(data) {
    if (!data) return;
    const { name, email, pass } = data;
    try {
        const credential = await auth.createUserWithEmailAndPassword(email, pass);
        const found = await ensureUserRecord(credential.user, { name });
        currentUser = found.email;
        saveUserSession(found.email);
        localStorage.removeItem('pending_ref');
        document.getElementById('reg-name').value = '';
        document.getElementById('reg-email').value = '';
        document.getElementById('reg-pass').value = '';
        document.getElementById('otp-input-code').value = '';
        alert('Pendaftaran berhasil! Akun Firebase Anda sudah aktif.');
        switchAuth('login'); navigateTo('view-beranda');
    } catch (error) {
        console.error(error);
        const msg = error.code === 'auth/email-already-in-use' ? 'Email sudah terdaftar di Firebase. Silakan masuk.' : error.code === 'auth/weak-password' ? 'Password Firebase terlalu lemah. Gunakan minimal 6 karakter.' : 'Pendaftaran gagal: ' + (error.message || error);
        alert(msg);
    } finally { pendingRegistrationData = null; }
}

async function handleCredentialResponse(response) {
    try {
        const credential = firebase.auth.GoogleAuthProvider.credential(response.credential);
        const result = await auth.signInWithCredential(credential);
        await signInFirebaseUser(result.user);
        closeGoogleModal();
        alert((await isAdminFirebaseUser(result.user, true)) ? 'Berhasil masuk sebagai Admin!' : 'Berhasil masuk dengan Google Sign-In!');
    } catch (error) {
        console.error(error); alert('Google Sign-In gagal: ' + (error.message || error));
    }
}

async function processLogin() {
    const inputUser = document.getElementById('login-email').value.trim().toLowerCase();
    const inputPass = document.getElementById('login-pass').value.trim();
    if (!inputUser || !inputPass) return alert('Email dan password wajib diisi.');

    try {
        const result = await auth.signInWithEmailAndPassword(inputUser, inputPass);
        const firebaseUser = result.user;
        const admin = await isAdminFirebaseUser(firebaseUser, true);
        if (admin) {
            clearUserSession(); currentUser = 'admin';
            document.getElementById('admin-panel-container').style.display = 'block';
            navigateTo('view-beranda'); renderAdminData();
            alert('Berhasil masuk sebagai Admin!'); return;
        }
        const found = getUserRecordByEmail(firebaseUser.email);
        if (found && found.isBanned) {
            await auth.signOut(); clearUserSession();
            return alert('Akun Anda telah diblokir (banned) oleh Admin.');
        }
        await signInFirebaseUser(firebaseUser); alert('Berhasil masuk!');
    } catch (error) {
        console.error(error);
        const messages = {'auth/invalid-email':'Format email tidak valid.','auth/user-not-found':'Akun Firebase tidak ditemukan.','auth/wrong-password':'Password salah.','auth/invalid-credential':'Email atau password salah.','auth/user-disabled':'Akun Firebase dinonaktifkan.','auth/too-many-requests':'Terlalu banyak percobaan. Coba lagi nanti.'};
        alert(messages[error.code] || ('Login gagal: ' + (error.message || error)));
    }
}

function openGoogleModal() { document.getElementById('google-modal').classList.add('active'); }
function closeGoogleModal() { document.getElementById('google-modal').classList.remove('active'); }
function switchAuth(type) {
    document.getElementById('tab-login').classList.toggle('active', type === 'login');
    document.getElementById('tab-register').classList.toggle('active', type === 'register');
    document.getElementById('form-auth-login').style.display = type === 'login' ? 'block' : 'none';
    document.getElementById('form-auth-reg').style.display = type === 'register' ? 'block' : 'none';
}
