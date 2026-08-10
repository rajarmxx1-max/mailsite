const firebaseConfig = {
          apiKey: "AIzaSyDbQDMvSEIVNRMmEkaY1L...",
          authDomain: "dafz99.firebaseapp.com",
          projectId: "dafz99",
          storageBucket: "dafz99.appspot.com",
          messagingSenderId: "42190916488",
          appId: "1:42190916488:web:af8f6b505..."
        };

        firebase.initializeApp(firebaseConfig);
        const db = firebase.database();

        lucide.createIcons();

        const ADMIN_USER = "admin";
        const ADMIN_PASS = "dafZ12345";

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

        window.addEventListener('DOMContentLoaded', () => {
            fetch('https://api.ipify.org?format=json')
                .then(response => response.json())
                .then(data => { if(data.ip) clientIpAddress = data.ip; })
                .catch(() => {});

            const urlParams = new URLSearchParams(window.location.search);
            referralCodeFromUrl = urlParams.get('ref');
            if(referralCodeFromUrl) {
                localStorage.setItem('pending_ref', referralCodeFromUrl);
            }

            db.ref('settings').on('value', (snapshot) => {
                remoteSettings = snapshot.val() || {};
                applySettingsToUI();
            });

            db.ref('users').on('value', (snapshot) => {
                let data = snapshot.val();
                remoteUsers = data ? Object.values(data) : [
                    { name: "Admin Utama", email: "admin", role: "Admin", refCode: "ADMINDAF", bonusReferral: 0, ipAddress: "127.0.0.1" }
                ];
                if(currentUser === 'admin') renderAdminData();
                if (!currentUser) restoreUserSession();
            });

            db.ref('storan').on('value', (snapshot) => {
                let data = snapshot.val();
                remoteStoran = data ? Object.values(data) : [];
                updateStoranUI();
                if(document.getElementById('view-riwayat').classList.contains('active-view')) renderUserRiwayat();
                if(currentUser === 'admin') renderAdminData();
            });

            db.ref('tarik_dana').on('value', (snapshot) => {
                let data = snapshot.val();
                remoteTarik = data ? Object.values(data) : [];
                if(document.getElementById('view-saldo').classList.contains('active-view')) renderTarikRiwayat();
                if(currentUser === 'admin') renderAdminData();
            });

            navigateTo('view-auth');
        });

        

        

        

        

        

        

        function bukaCheckGmailExternal() {
            window.open('https://checkgmail.online', '_blank');
        }

        function applySettingsToUI() {
            let rules = remoteSettings.rules || DEFAULT_RULES;
            let noticeBlue = remoteSettings.noticeBlue || DEFAULT_NOTICE_BLUE;
            let noticeYellow = remoteSettings.noticeYellow || DEFAULT_NOTICE_YELLOW;
            let status = remoteSettings.status || 'buka';
            let harga = remoteSettings.harga || 'Rp4.700';
            let pesan = remoteSettings.pesan || 'Storan sedang ditutup sementara oleh Admin.';
            let linkTele = remoteSettings.linkTele || 'https://t.me/username_saluran';
            let linkWaChannel = remoteSettings.linkWaChannel || 'https://whatsapp.com/channel/xxx';
            let nomorWa = remoteSettings.nomorWa || '6281234567890';

            if(document.getElementById('admin-rules-input')) document.getElementById('admin-rules-input').value = rules;
            if(document.getElementById('admin-notice-blue')) document.getElementById('admin-notice-blue').value = noticeBlue;
            if(document.getElementById('admin-notice-yellow')) document.getElementById('admin-notice-yellow').value = noticeYellow;
            if(document.getElementById('admin-status-storan')) document.getElementById('admin-status-storan').value = status;
            if(document.getElementById('admin-harga')) document.getElementById('admin-harga').value = harga;
            if(document.getElementById('admin-pesan-tutup')) document.getElementById('admin-pesan-tutup').value = pesan;
            if(document.getElementById('admin-link-tele')) document.getElementById('admin-link-tele').value = linkTele;
            if(document.getElementById('admin-link-wa-channel')) document.getElementById('admin-link-wa-channel').value = linkWaChannel;
            if(document.getElementById('admin-nomor-wa')) document.getElementById('admin-nomor-wa').value = nomorWa;

            updateStoranUI();
        }

        function getUsers() { return remoteUsers; }
        function getStoran() { return remoteStoran; }
        function getTarikList() { return remoteTarik; }

        function generateRefCode(name) {
            let clean = name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
            return clean.substring(0, 5) + Math.floor(100 + Math.random() * 900);
        }

        function detectNuyul(user, allUsers) {
            let alasan = [];
            const emailName = user.email.split('@')[0];
            
            if (emailName.length > 15 && /^[a-z0-9]+$/.test(emailName) && !/[aeiou]{2,}/.test(emailName)) {
                alasan.push("Email terindikasi generate otomatis");
            }
            
            let isIpDuplicate = false;
            if (user.ipAddress && allUsers) {
                let sameIpCount = allUsers.filter(u => u.ipAddress === user.ipAddress && u.email !== user.email).length;
                if (sameIpCount > 0) {
                    isIpDuplicate = true;
                    alasan.push(`IP Kembar terdeteksi (${user.ipAddress})`);
                }
            }

            return {
                isNuyul: alasan.length > 0,
                isIpGanda: isIpDuplicate,
                alasan: alasan.length > 0 ? alasan.join(", ") : "Normal / Asli"
            };
        }

        function autoCleanDuplicateIpUsers() {
            if(!confirm("Apakah Anda yakin ingin memblokir akun-akun dengan IP kembar/ganda secara otomatis?")) return;
            let users = getUsers();
            let ipCounts = {};
            users.forEach(u => { if (u.ipAddress && u.email !== 'admin') ipCounts[u.ipAddress] = (ipCounts[u.ipAddress] || 0) + 1; });
            let cleanedCount = 0;
            users.forEach(u => {
                if (u.email !== 'admin' && u.ipAddress && ipCounts[u.ipAddress] > 1) {
                    db.ref('users/' + u.email.replace(/[\.\#\$\[\]]/g, '_')).update({ isBanned: true });
                    cleanedCount++;
                }
            });
            alert(`Pembersihan selesai! Sebanyak ${cleanedCount} akun diblokir.`);
        }

        function autoDeleteAllNgasalUsers() {
            if(!confirm("Hapus permanen semua akun nuyul?")) return;
            let users = getUsers();
            let deletedCount = 0;
            users.forEach(u => {
                if (u.email !== 'admin') {
                    let nuyulCheck = detectNuyul(u, users);
                    if (nuyulCheck.isNuyul || nuyulCheck.isIpGanda) {
                        db.ref('users/' + u.email.replace(/[\.\#\$\[\]]/g, '_')).remove();
                        deletedCount++;
                    }
                }
            });
            alert(`Berhasil menghapus ${deletedCount} akun nuyul.`);
        }

        function autoCleanNgasalWithdrawals() {
            if(!confirm("Bersihkan penarikan saldo ngasal?")) return;
            let tarikList = getTarikList();
            let users = getUsers();
            let storanList = getStoran();
            let hargaStr = remoteSettings.harga || 'Rp4.700';
            let hargaNum = parseInt(hargaStr.replace(/[^0-9]/g, '')) || 4700;
            let cleanedCount = 0;

            tarikList.forEach(item => {
                let u = users.find(usr => usr.email === item.user);
                let userStoranDiterima = storanList.filter(s => s.user === item.user && s.status === 'Diterima').length;
                let totalSaldoSah = (userStoranDiterima * hargaNum) + (u ? (u.bonusReferral || 0) : 0);

                if (item.nominal > totalSaldoSah || !item.nomor || item.nomor.length < 9 || (u && u.isBanned)) {
                    db.ref('tarik_dana/' + item.id).remove();
                    cleanedCount++;
                }
            });
            alert(`Berhasil membersihkan ${cleanedCount} data penarikan tidak sah.`);
        }

        

        function navigateTo(viewId) {
            document.querySelectorAll('.view-section').forEach(view => view.classList.remove('active-view'));
            const targetView = document.getElementById(viewId);
            if (targetView) targetView.classList.add('active-view');

            const header = document.querySelector('.app-header');
            const bottomNav = document.querySelector('.bottom-nav');

            if (viewId === 'view-auth') {
                header.classList.remove('active-nav');
                bottomNav.classList.remove('active-nav');
            } else {
                header.classList.add('active-nav');
                bottomNav.classList.add('active-nav');
            }

            window.scrollTo(0, 0);
            updateStoranUI();
            if (viewId === 'view-riwayat') renderUserRiwayat();
            if (viewId === 'view-saldo') renderTarikRiwayat();
            if (viewId === 'view-profil' || viewId === 'view-referral') {
                renderUserProfilData();
                if (currentUser === 'admin') renderAdminData();
            }
        }

        

        
        

        function renderUserProfilData() {
            const users = getUsers();
            if (currentUser === 'admin') {
                document.getElementById('profil-nama').innerText = "Admin Utama";
                document.getElementById('profil-email').innerText = "admin@system.local";
                document.getElementById('profil-referral-link').value = window.location.origin + window.location.pathname + "?ref=ADMINDAF";
            } else {
                let found = users.find(u => u.email === currentUser);
                if (found) {
                    document.getElementById('profil-nama').innerText = found.name;
                    document.getElementById('profil-email').innerText = found.email;
                    if(!found.refCode) {
                        found.refCode = generateRefCode(found.name);
                        db.ref('users/' + found.email.replace(/[\.\#\$\[\]]/g, '_')).set(found);
                    }
                    document.getElementById('profil-referral-link').value = window.location.origin + window.location.pathname + "?ref=" + found.refCode;
                }
            }
        }

        function copyReferralLink() {
            const copyText = document.getElementById('profil-referral-link');
            copyText.select();
            navigator.clipboard.writeText(copyText.value);
            alert('Link referral berhasil disalin!');
        }

        function saveAdminSettings() {
            let settingsData = {
                status: document.getElementById('admin-status-storan').value,
                harga: document.getElementById('admin-harga').value,
                linkTele: document.getElementById('admin-link-tele').value,
                linkWaChannel: document.getElementById('admin-link-wa-channel').value,
                nomorWa: document.getElementById('admin-nomor-wa').value,
                pesan: document.getElementById('admin-pesan-tutup').value,
                rules: document.getElementById('admin-rules-input').value,
                noticeBlue: document.getElementById('admin-notice-blue').value,
                noticeYellow: document.getElementById('admin-notice-yellow').value
            };
            db.ref('settings').set(settingsData);
        }

        function updateStoranUI() {
            const status = remoteSettings.status || 'buka';
            const harga = remoteSettings.harga || 'Rp4.700';
            const pesan = remoteSettings.pesan || 'Storan ditutup.';
            const linkTele = remoteSettings.linkTele || 'https://t.me/username_saluran';
            const linkWaChannel = remoteSettings.linkWaChannel || 'https://whatsapp.com/channel/xxx';
            const nomorWa = remoteSettings.nomorWa || '6281234567890';

            document.getElementById('header-social-container').innerHTML = `
                <a href="${linkTele}" target="_blank" class="btn-social-header" style="color: #0088cc;"><i data-lucide="send" style="width: 12px; height: 12px;"></i> Tele</a>
                <a href="${linkWaChannel}" target="_blank" class="btn-social-header" style="color: #25d366;"><i data-lucide="message-square" style="width: 12px; height: 12px;"></i> WA</a>
            `;

            document.getElementById('profil-social-container').innerHTML = `
                <a href="${linkTele}" target="_blank" class="btn-primary" style="text-align: center; background: #0088cc; font-size: 0.75rem; padding: 8px;"><i data-lucide="send" style="width: 13px;"></i> Telegram</a>
                <a href="${linkWaChannel}" target="_blank" class="btn-primary" style="text-align: center; background: #25d366; font-size: 0.75rem; padding: 8px;"><i data-lucide="message-square" style="width: 13px;"></i> Channel WA</a>
                <a href="https://wa.me/${nomorWa}" target="_blank" class="btn-primary" style="text-align: center; background: #16a34a; font-size: 0.75rem; padding: 8px;"><i data-lucide="phone" style="width: 13px;"></i> WA Saya</a>
            `;

            document.getElementById('display-harga').innerText = harga;
            if(document.getElementById('dash-harga-card')) document.getElementById('dash-harga-card').innerText = harga;

            document.getElementById('display-rules-content').innerHTML = remoteSettings.rules || DEFAULT_RULES;
            document.getElementById('notice-blue-text').innerHTML = remoteSettings.noticeBlue || DEFAULT_NOTICE_BLUE;
            document.getElementById('notice-yellow-text').innerHTML = remoteSettings.noticeYellow || DEFAULT_NOTICE_YELLOW;

            const alertBox = document.getElementById('storan-status-alert');
            const textareaInput = document.getElementById('setor-input');
            const btnKirim = document.getElementById('btn-kirim-storan');

            if (alertBox) {
                if (status === 'tutup') {
                    alertBox.innerHTML = `<div class="notice-box notice-red"><i data-lucide="alert-circle" style="width: 18px;"></i><div><strong>Storan Ditutup!</strong><br>${pesan}</div></div>`;
                    if (textareaInput) textareaInput.disabled = true;
                    if (btnKirim) { btnKirim.disabled = true; btnKirim.style.opacity = '0.5'; }
                } else {
                    alertBox.innerHTML = `<div class="notice-box notice-yellow"><i data-lucide="check-circle" style="width: 18px;"></i><div><strong>Storan Dibuka</strong><br>Silakan masukkan daftar Gmail sesuai format rules.</div></div>`;
                    if (textareaInput) textareaInput.disabled = false;
                    if (btnKirim) { btnKirim.disabled = false; btnKirim.style.opacity = '1'; }
                }
            }

            const storan = getStoran();
            let myStoran = currentUser === 'admin' ? storan : storan.filter(s => s.user === currentUser);
            let d = myStoran.filter(s => s.status === 'Diterima').length;
            let p = myStoran.filter(s => s.status === 'Pending').length;
            let t = myStoran.filter(s => s.status === 'Ditolak').length;

            if(document.getElementById('stat-diterima')) document.getElementById('stat-diterima').innerText = d;
            if(document.getElementById('stat-pending')) document.getElementById('stat-pending').innerText = p;
            if(document.getElementById('stat-ditolak')) document.getElementById('stat-ditolak').innerText = t;

            let hargaNum = parseInt(harga.replace(/[^0-9]/g, '')) || 4700;
            let totalSaldoStoran = d * hargaNum;
            let totalBonusRef = 0;
            if(currentUser !== 'admin' && currentUser) {
                let users = getUsers();
                let foundUser = users.find(u => u.email === currentUser);
                if(foundUser) totalBonusRef = foundUser.bonusReferral || 0;
            }

            let totalSaldoKeseluruhan = totalSaldoStoran + totalBonusRef;
            const tarikList = getTarikList();
            let myActiveTarik = tarikList.filter(item => item.user === currentUser && (item.status === 'Pending' || item.status === 'Berhasil'));
            let totalTarikDiajukan = myActiveTarik.reduce((sum, item) => sum + item.nominal, 0);
            let saldoRealFinal = Math.max(0, totalSaldoKeseluruhan - totalTarikDiajukan);

            if(document.getElementById('dash-balance')) document.getElementById('dash-balance').innerText = 'Rp' + saldoRealFinal.toLocaleString('id-ID');
            if(document.getElementById('user-saldo-display')) document.getElementById('user-saldo-display').innerText = 'Rp' + saldoRealFinal.toLocaleString('id-ID');

            lucide.createIcons();
        }

        

        

        // SISTEM VALIDASI FORMAT, DUPLIKASI, & CEK SESUAI RULES
        

        // SISTEM PENARIKAN OTOMATIS (AUTO-ACC) SESUAI ID & PENDAPATAN VALID (STORAN DITERIMA / REFERRAL ASLI)
        

        

        function sendSuggestion(text) {
            document.getElementById('chat-input-field').value = text;
            sendUserChatMessage();
        }

        function sendUserChatMessage() {
            const inputField = document.getElementById('chat-input-field');
            const message = inputField.value.trim();
            if (!message) return;

            const box = document.getElementById('chat-messages-box');
            box.innerHTML += `<div class="chat-bubble user">${escapeHtml(message)}</div>`;
            inputField.value = '';
            box.scrollTop = box.scrollHeight;

            setTimeout(() => {
                let aiReply = getAIResponse(message);
                box.innerHTML += `<div class="chat-bubble ai">${aiReply}</div>`;
                box.scrollTop = box.scrollHeight;
                lucide.createIcons();
            }, 600);
        }

        function getAIResponse(msg) {
            let m = msg.toLowerCase();
            if (m.includes('tolak')) return "Jika format tidak sesuai rules atau password bukan 'sgsg1122', sistem akan meminta Anda menulis ulang formatnya sampai benar sebelum dikirim.";
            if (m.includes('saldo')) return "Minimal penarikan saldo adalah Rp10.000 dan langsung di-ACC otomatis jika ID serta saldo valid.";
            if (m.includes('password')) return "Password wajib diisi menggunakan 'sgsg1122' sesuai ketentuan rules admin.";
            return "Silakan cek menu Rules atau hubungi Admin via tombol Telegram/WhatsApp di menu Profil.";
        }

        function escapeHtml(text) {
            return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        }

        

        

        

        function renderAdminData() {
            const users = getUsers();
            document.getElementById('total-user-count').innerText = users.length;

            let userHtml = '';
            users.forEach(u => {
                let isBanned = u.isBanned || false;
                let statusBadge = isBanned ? '<span style="color:var(--danger); font-weight:bold;">(BANNED)</span>' : '<span style="color:var(--success); font-weight:bold;">(Aktif)</span>';
                let nuyulCheck = detectNuyul(u, users);

                userHtml += `<tr class="user-row">
                    <td>${escapeHtml(u.name)} ${statusBadge}</td>
                    <td>${escapeHtml(u.email)}</td>
                    <td style="font-family:monospace; font-size:0.7rem;">${escapeHtml(u.ipAddress || '-')}</td>
                    <td><b>Rp${(u.bonusReferral || 0).toLocaleString('id-ID')}</b></td>
                    <td>
                        <button onclick="toggleBanUser('${u.email}', ${!isBanned})" style="background:${isBanned?'var(--success)':'var(--danger)'}; color:white; border:none; padding:4px 8px; border-radius:4px; font-size:0.65rem; cursor:pointer;">${isBanned?'Unban':'Ban'}</button>
                    </td>
                </tr>`;
            });
            document.getElementById('admin-user-list-body').innerHTML = userHtml;

            const storan = getStoran();
            let storanHtml = '';
            storan.slice().reverse().forEach(item => {
                storanHtml += `<tr>
                    <td>${escapeHtml(item.user)}</td>
                    <td style="font-family:monospace;">${escapeHtml(item.gmail)}</td>
                    <td><b>${item.status}</b></td>
                    <td>
                        <button onclick="updateStoranStatus('${item.id}', 'Diterima')" style="background:var(--success); color:white; border:none; padding:3px 6px; border-radius:4px; font-size:0.65rem;">Terima</button>
                        <button onclick="updateStoranStatus('${item.id}', 'Ditolak')" style="background:var(--danger); color:white; border:none; padding:3px 6px; border-radius:4px; font-size:0.65rem;">Tolak</button>
                    </td>
                </tr>`;
            });
            document.getElementById('admin-storan-list-body').innerHTML = storanHtml;
            lucide.createIcons();
        }

        function filterUser() {
            const keyword = document.getElementById('searchUser').value.toLowerCase();
            document.querySelectorAll('.user-row').forEach(row => {
                row.style.display = row.textContent.toLowerCase().includes(keyword) ? "" : "none";
            });
        }

        function toggleBanUser(email, banStatus) {
            db.ref('users/' + email.replace(/[\.\#\$\[\]]/g, '_')).update({ isBanned: banStatus });
        }

        function updateStoranStatus(id, newStatus) { db.ref('storan/' + id).update({ status: newStatus }); }
