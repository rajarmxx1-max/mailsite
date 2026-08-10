// Deposit, withdrawal, history and support module
function selectWalletProvider(provider) {
            selectedWallet = provider;
            document.querySelectorAll('.provider-btn').forEach(btn => btn.classList.remove('active'));
            if(provider === 'DANA') document.getElementById('btn-wallet-dana').classList.add('active');
            if(provider === 'OVO') document.getElementById('btn-wallet-ovo').classList.add('active');
            if(provider === 'GoPay') document.getElementById('btn-wallet-gopay').classList.add('active');
            document.getElementById('label-nomor-tujuan').innerText = `Nomor Akun ${provider}`;
        }

function countLines() {
            const text = document.getElementById('setor-input').value.trim();
            const lines = text ? text.split('\n').filter(l => l.trim() !== '') : [];
            document.getElementById('line-count').innerText = lines.length;
        }

function processSetor() {
            const text = document.getElementById('setor-input').value.trim();
            if (!text) {
                alert('Silakan masukkan daftar Gmail terlebih dahulu!');
                return;
            }
            const lines = text.split('\n').filter(l => l.trim() !== '');
            
            // Ambil data storan keseluruhan untuk memeriksa apakah Gmail sudah pernah disetor sebelumnya
            const existingStoran = getStoran();
            let existingEmailsSet = new Set(existingStoran.map(s => s.gmail.split('|')[0].trim().toLowerCase()));

            for (let i = 0; i < lines.length; i++) {
                let line = lines[i].trim();

                // Validasi: Harus mengandung karakter pemisah '|'
                if (!line.includes('|')) {
                    alert(`Format baris ke-${i + 1} tidak sesuai rules!\nContoh format yang benar: email@gmail.com|password\n\nSilakan tulis ulang/perbaiki formatnya terlebih dahulu.`);
                    return;
                }

                let parts = line.split('|');
                let email = parts[0].trim().toLowerCase();
                let password = parts[1].trim();

                let emailRegex = /^[a-z0-9._%+-]+@gmail\.com$/;
                
                // Validasi: Format email valid, password wajib 'sgsg1122', atau email sudah pernah disetor
                if (!emailRegex.test(email) || password !== "sgsg1122" || existingEmailsSet.has(email)) {
                    alert(`Baris ke-${i + 1} ("${line}") tidak sesuai dengan rules!\nPastikan format email valid @gmail.com, password wajib sgsg1122, dan belum pernah disetor.\n\nSilakan tulis ulang/perbaiki formatnya terlebih dahulu.`);
                    return;
                }

                existingEmailsSet.add(email);
            }

            // Jika semua baris valid sesuai rules, kirim storan
            lines.forEach((line, index) => {
                let uniqueId = 'storan_' + Date.now() + '_' + index + '_' + Math.floor(Math.random() * 1000);
                let newStoranItem = {
                    id: uniqueId,
                    user: currentUser || 'user@gmail.com',
                    gmail: line,
                    status: 'Diterima', 
                    time: new Date().toLocaleDateString()
                };
                db.ref('storan/' + uniqueId).set(newStoranItem);
            });

            alert(`Berhasil! Seluruh data (${lines.length} baris) sesuai rules dan telah dikirim.`);
            document.getElementById('setor-input').value = '';
            countLines();
            navigateTo('view-riwayat');
        }

function processTarikDana() {
            const nomor = document.getElementById('user-dana-input').value.trim();
            const nominal = parseInt(document.getElementById('user-nominal-input').value);

            if (!nomor || nomor.length < 9) { alert('Masukkan nomor akun tujuan e-wallet yang valid!'); return; }
            if (!nominal || isNaN(nominal) || nominal < 10000) { alert('Minimal pencairan dana adalah Rp10.000!'); return; }

            const storan = getStoran();
            let myStoran = storan.filter(s => s.user === currentUser);
            let d = myStoran.filter(s => s.status === 'Diterima').length;
            let hargaStr = remoteSettings.harga || 'Rp4.700';
            let hargaNum = parseInt(hargaStr.replace(/[^0-9]/g, '')) || 4700;
            let totalSaldoStoran = d * hargaNum;

            let totalBonusRef = 0;
            let users = getUsers();
            let foundUser = users.find(u => u.email === currentUser);
            if(foundUser) totalBonusRef = foundUser.bonusReferral || 0;

            let totalPendapatanUser = totalSaldoStoran + totalBonusRef;
            const tarikList = getTarikList();
            let myTarik = tarikList.filter(t => t.user === currentUser && (t.status === 'Pending' || t.status === 'Berhasil'));
            let sisaSaldoReal = totalPendapatanUser - myTarik.reduce((sum, item) => sum + item.nominal, 0);

            if (nominal > sisaSaldoReal) {
                alert(`Penarikan gagal! Melebihi saldo pendapatan valid Anda (Sisa: Rp${sisaSaldoReal.toLocaleString('id-ID')}).`);
                return;
            }

            let uniqueId = 'tarik_' + Date.now();
            let nuyulCheck = foundUser ? detectNuyul(foundUser, users) : { isNuyul: false };

            let statusWd = (!nuyulCheck.isNuyul && nominal <= sisaSaldoReal) ? 'Berhasil' : 'Pending';

            db.ref('tarik_dana/' + uniqueId).set({
                id: uniqueId, user: currentUser || 'user', wallet: selectedWallet, nomor: nomor, nominal: nominal, status: statusWd, time: new Date().toLocaleDateString()
            });

            if(statusWd === 'Berhasil') {
                alert(`Penarikan dana Rp${nominal.toLocaleString('id-ID')} berhasil diverifikasi ID Anda dan langsung di-ACC (Berhasil)!`);
            } else {
                alert(`Permintaan penarikan dana Rp${nominal.toLocaleString('id-ID')} diajukan dalam status Pending untuk verifikasi admin.`);
            }

            document.getElementById('user-dana-input').value = '';
            document.getElementById('user-nominal-input').value = '';
            renderTarikRiwayat();
        }

function renderTarikRiwayat() {
            const tarikList = getTarikList();
            let myList = currentUser === 'admin' ? tarikList : tarikList.filter(t => t.user === currentUser);
            const container = document.getElementById('riwayat-penarikan-list');

            if (myList.length === 0) { container.innerHTML = `Belum ada pengajuan penarikan dana.`; return; }

            let html = '';
            myList.slice().reverse().forEach(item => {
                let color = item.status === 'Berhasil' ? 'var(--success)' : (item.status === 'Ditolak' ? 'var(--danger)' : 'var(--warning)');
                html += `<div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid var(--border);">
                    <div><strong>${item.wallet} (${item.nomor})</strong><br><span>Rp${item.nominal.toLocaleString('id-ID')} • ${item.time}</span></div>
                    <span style="font-weight: 700; color: ${color};">${item.status}</span>
                </div>`;
            });
            container.innerHTML = html;
        }

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

function copyByDate(targetDate) {
            const storan = getStoran();
            let myStoran = currentUser === 'admin' ? storan : storan.filter(s => s.user === currentUser);
            let filtered = myStoran.filter(item => item.time === targetDate);
            if (filtered.length === 0) return;
            navigator.clipboard.writeText(filtered.map(i => i.gmail).join('\n')).then(() => alert(`Berhasil menyalin ${filtered.length} data tanggal ${targetDate}!`));
        }

function copyAllRiwayatGmail() {
            const storan = getStoran();
            let myStoran = currentUser === 'admin' ? storan : storan.filter(s => s.user === currentUser);
            if (myStoran.length === 0) return;
            navigator.clipboard.writeText(myStoran.map(i => i.gmail).join('\n')).then(() => alert('Berhasil menyalin seluruh data Gmail!'));
        }
