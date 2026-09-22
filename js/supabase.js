// ========================================================
// Supabase İstemcisi, Oturum Yönetimi ve Ortak Arayüz Yardımcıları
// ========================================================

// Supabase Proje Bilgileri
export const SUPABASE_URL = "https://tfdestcakoppfxeosrpt.supabase.co";
export const SUPABASE_ANON_KEY = "sb_publishable_q_wg3KTKGyLwIYZ3D_Zstg_pXfHiIMl";

// Global Supabase İstemcisi
export const supabase = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

// DOM Elemanları
const authView = document.getElementById('auth-view');
const appContainer = document.getElementById('app-container');
const currentUserEmail = document.getElementById('current-user-email');
const btnLogoutSidebar = document.getElementById('btn-logout-sidebar');
const btnLogoutMobile = document.getElementById('btn-logout-mobile');

// Masaüstü ve Mobil Navigasyon Eşleştirmesi (7 Modül)
const navItems = {
    'dashboard': {
        desktop: document.getElementById('nav-dashboard'),
        mobile: document.getElementById('m-nav-dashboard')
    },
    'pos': {
        desktop: document.getElementById('nav-pos'),
        mobile: document.getElementById('m-nav-pos')
    },
    'proposals': {
        desktop: document.getElementById('nav-proposals'),
        mobile: document.getElementById('m-nav-proposals')
    },
    'products': {
        desktop: document.getElementById('nav-products'),
        mobile: document.getElementById('m-nav-products')
    },
    'pricelists': {
        desktop: document.getElementById('nav-pricelists'),
        mobile: document.getElementById('m-nav-pricelists')
    },
    'customers': {
        desktop: document.getElementById('nav-customers'),
        mobile: document.getElementById('m-nav-customers')
    },
    'catalog': {
        desktop: document.getElementById('nav-catalog'),
        mobile: document.getElementById('m-nav-catalog')
    },
    'movements': {
        desktop: document.getElementById('nav-movements'),
        mobile: null
    }
};

// ========================================================
// GLOBAL LOADER (SPINNER)
// ========================================================
export function showLoader() {
    const el = document.getElementById('global-loader');
    if (el) el.classList.add('active');
}

export function hideLoader() {
    const el = document.getElementById('global-loader');
    if (el) el.classList.remove('active');
}

// ========================================================
// TOAST BİLDİRİM SİSTEMİ
// ========================================================
export function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let icon = 'fa-circle-info';
    if (type === 'success') icon = 'fa-circle-check';
    if (type === 'error') icon = 'fa-triangle-exclamation';

    toast.innerHTML = `<i class="fa-solid ${icon}"></i><span>${message}</span>`;
    container.appendChild(toast);

    const removeToast = () => {
        toast.classList.add('fade-out');
        toast.addEventListener('animationend', () => toast.remove());
    };

    const timer = setTimeout(removeToast, 4000);
    toast.addEventListener('click', () => {
        clearTimeout(timer);
        removeToast();
    });
}

// ========================================================
// ONAY MODALI (CONFIRM DIALOG)
// ========================================================
let currentConfirmAction = null;
const confirmModal = document.getElementById('confirm-modal');
const confirmTitle = document.getElementById('confirm-modal-title');
const confirmBody = document.getElementById('confirm-modal-body');
const confirmOkBtn = document.getElementById('confirm-ok-btn');
const confirmCancelBtn = document.getElementById('confirm-cancel-btn');
const confirmCloseBtn = document.getElementById('confirm-modal-close');

export function showConfirmModal({ title = 'Onay Gerekli', body = 'Bu işlemi onaylıyor musunuz?', onConfirm }) {
    if (!confirmModal) return;
    if (confirmTitle) confirmTitle.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="color: var(--accent-danger);"></i> ${title}`;
    if (confirmBody) confirmBody.innerText = body;
    currentConfirmAction = onConfirm;
    confirmModal.classList.add('active');
}

function closeConfirmModal() {
    if (confirmModal) confirmModal.classList.remove('active');
    currentConfirmAction = null;
}

if (confirmCancelBtn) confirmCancelBtn.addEventListener('click', closeConfirmModal);
if (confirmCloseBtn) confirmCloseBtn.addEventListener('click', closeConfirmModal);
if (confirmOkBtn) {
    confirmOkBtn.addEventListener('click', async () => {
        if (typeof currentConfirmAction === 'function') {
            await currentConfirmAction();
        }
        closeConfirmModal();
    });
}

// ========================================================
// SPA GÖRÜNÜM GEÇİŞİ (VIEW SWITCHER)
// ========================================================
export function showView(viewId, extraData = null) {
    // Tüm view section'ları gizle
    document.querySelectorAll('.view-section').forEach(section => {
        section.classList.remove('active');
    });

    // Aktif view'ı aç
    const targetSection = document.getElementById(`${viewId}-view`);
    if (targetSection) {
        targetSection.classList.add('active');
    }

    // Masaüstü ve Mobil menü butonlarının aktifliğini güncelle
    Object.entries(navItems).forEach(([key, items]) => {
        const isCurrent = key === viewId;
        if (items.desktop) {
            if (isCurrent) items.desktop.classList.add('active');
            else items.desktop.classList.remove('active');
        }
        if (items.mobile) {
            if (isCurrent) items.mobile.classList.add('active');
            else items.mobile.classList.remove('active');
        }
    });

    // Sayfa yukarı kaydırılsın
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Modüllere özel event tetikle (Örn: view-dashboard-loaded)
    const eventName = `view-${viewId}-loaded`;
    document.dispatchEvent(new CustomEvent(eventName, { detail: extraData }));
}

// Navigasyon butonlarına tıklama dinleyicilerini bağla
Object.entries(navItems).forEach(([viewId, items]) => {
    if (items.desktop) {
        items.desktop.addEventListener('click', () => showView(viewId));
    }
    if (items.mobile) {
        items.mobile.addEventListener('click', () => showView(viewId));
    }
});

// ========================================================
// FORMATLAYICI FONKSİYONLAR
// ========================================================
export function formatCurrency(amount) {
    const num = Number(amount) || 0;
    return num.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₺';
}

export function formatNumber(val) {
    const num = Number(val) || 0;
    return num.toLocaleString('tr-TR');
}

export function formatDateTime(isoString) {
    if (!isoString) return '-';
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('tr-TR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

export function formatDateOnly(isoString) {
    if (!isoString) return '-';
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('tr-TR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

// ========================================================
// OTURUM YÖNETİMİ (AUTH: SADECE GİRİŞ YAP)
// ========================================================
const authForm = document.getElementById('auth-form');
const authEmail = document.getElementById('auth-email');
const authPassword = document.getElementById('auth-password');

// Form Gönderimi (Giriş Yap)
if (authForm) {
    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = authEmail.value.trim();
        const password = authPassword.value.trim();

        if (!email || !password) {
            showToast("Lütfen e-posta ve şifrenizi girin.", "error");
            return;
        }

        if (password.length < 6) {
            showToast("Şifre en az 6 karakter olmalıdır.", "error");
            return;
        }

        showLoader();
        try {
            const { data, error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;
            showToast("Dükkana başarıyla giriş yapıldı!", "success");
        } catch (err) {
            console.error("Giriş hatası:", err);
            let msg = err.message || "Giriş yapılamadı. Lütfen bilgilerinizi kontrol edin.";
            if (msg.includes("Invalid login credentials")) {
                msg = "Hatalı e-posta adresi veya şifre!";
            } else if (msg.includes("Email not confirmed")) {
                msg = "E-posta henüz onaylanmamış. Supabase panelinden 'Confirm email' ayarını kapatın veya onay linkine tıklayın.";
            } else if (msg.includes("Password should be at least")) {
                msg = "Şifre en az 6 karakter olmalıdır.";
            }
            showToast(msg, "error");
        } finally {
            hideLoader();
        }
    });
}

// Çıkış Yap
async function handleLogout() {
    showLoader();
    try {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        showToast("Oturum kapatıldı.", "info");
    } catch (err) {
        console.error("Çıkış hatası:", err);
        showToast("Çıkış yapılırken bir hata oluştu.", "error");
    } finally {
        hideLoader();
    }
}

if (btnLogoutSidebar) btnLogoutSidebar.addEventListener('click', handleLogout);
if (btnLogoutMobile) btnLogoutMobile.addEventListener('click', handleLogout);

// Supabase Auth Değişikliklerini Dinle & İlk Oturum Kontrolü
if (supabase) {
    supabase.auth.onAuthStateChange((event, session) => {
        if (session && session.user) {
            // Kullanıcı oturum açtı
            if (authView) authView.style.display = 'none';
            if (appContainer) appContainer.style.display = 'block';
            if (currentUserEmail) currentUserEmail.innerText = session.user.email;
            if (authForm) authForm.reset();

            // Varsayılan olarak Dashboard'u aç
            showView('dashboard');
        } else {
            // Kullanıcı oturumu kapalı
            if (appContainer) appContainer.style.display = 'none';
            if (authView) authView.style.display = 'flex';
            if (currentUserEmail) currentUserEmail.innerText = '';
        }
    });

    // Sayfa açılışında anlık oturum kontrolü
    supabase.auth.getSession().then(({ data: { session } }) => {
        if (session && session.user) {
            if (authView) authView.style.display = 'none';
            if (appContainer) appContainer.style.display = 'block';
            if (currentUserEmail) currentUserEmail.innerText = session.user.email;
            showView('dashboard');
        } else {
            if (appContainer) appContainer.style.display = 'none';
            if (authView) authView.style.display = 'flex';
        }
    }).catch(err => {
        console.warn("İlk oturum kontrolü:", err);
    });
}
