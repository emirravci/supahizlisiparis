// ========================================================
// SOSYAL MEDYA DİJİTAL KATALOG VE AFİŞ OLUŞTURUCU MODÜLÜ
// ========================================================

import { supabase, showLoader, hideLoader, showToast, formatCurrency } from './supabase.js';

// DOM Elemanları - Ayarlar
const catalogTitleInput = document.getElementById('catalog-title-input');
const catalogSubtitleInput = document.getElementById('catalog-subtitle-input');
const catalogPhoneInput = document.getElementById('catalog-phone-input');
const catalogAddressInput = document.getElementById('catalog-address-input');
const catalogProductSelect = document.getElementById('catalog-product-select');
const catalogPromoPrice = document.getElementById('catalog-promo-price');
const catalogPromoTag = document.getElementById('catalog-promo-tag');
const catalogAddProductBtn = document.getElementById('catalog-add-product-btn');
const catalogCopyWhatsappBtn = document.getElementById('catalog-copy-whatsapp-btn');
const catalogPrintBtn = document.getElementById('catalog-print-btn');

// DOM Elemanları - Afiş Önizleme Alanı
const flyerDisplayTitle = document.getElementById('flyer-display-title');
const flyerDisplaySub = document.getElementById('flyer-display-sub');
const flyerDisplayPhone = document.getElementById('flyer-display-phone');
const flyerDisplayAddress = document.getElementById('flyer-display-address');
const flyerItemsGrid = document.getElementById('flyer-items-grid');

// DOM Elemanları - Tam Ekran Önizleme Modalı
const catalogPreviewModal = document.getElementById('catalog-preview-modal');
const catalogPreviewModalBtn = document.getElementById('catalog-preview-modal-btn');
const catalogPreviewModalClose = document.getElementById('catalog-preview-modal-close');
const catalogPreviewModalCancel = document.getElementById('catalog-preview-modal-cancel');
const catalogModalPrintBtn = document.getElementById('catalog-modal-print-btn');
const catalogPreviewModalPrintBottom = document.getElementById('catalog-preview-modal-print-bottom');
const catalogModalFlyerContainer = document.getElementById('catalog-modal-flyer-container');

// DOM Elemanları - Mobil Sekmeler
const tabBtnSettings = document.getElementById('tab-btn-catalog-settings');
const tabBtnView = document.getElementById('tab-btn-catalog-view');
const catalogContainer = document.querySelector('.catalog-builder-container');

// Durum (State)
let availableProducts = [];
let catalogItems = []; // [{ product, promoPrice, promoTag }]

// Sayfa Yüklendiğinde Dinle
document.addEventListener('view-catalog-loaded', async () => {
    await fetchCatalogProducts();
});

// ========================================================
// ÜRÜNLERİ GETİRME & SEÇİCİ
// ========================================================
async function fetchCatalogProducts() {
    if (!supabase) return;
    showLoader();
    try {
        const { data, error } = await supabase
            .from('products')
            .select('*')
            .order('name', { ascending: true });

        if (error) throw error;
        availableProducts = data || [];
        populateSelect();

        // İlk açılışta boşsa ilk 6 ürünü afişe otomatik ekle (demo doluluğu)
        if (catalogItems.length === 0 && availableProducts.length > 0) {
            const initialSelection = availableProducts.slice(0, 6);
            const demoTags = ['FIRSAT', 'ŞOK FİYAT', 'KAMPANYA', 'ÖZEL FİYAT', 'EN ÇOK SATAN', 'SINIRLI STOK'];
            initialSelection.forEach((p, idx) => {
                catalogItems.push({
                    product: p,
                    promoPrice: p.sell_price,
                    promoTag: demoTags[idx % demoTags.length]
                });
            });
            renderFlyerGrid();
        }

    } catch (err) {
        console.error("Katalog ürünleri yüklenemedi:", err);
        showToast("Katalog ürün listesi yüklenemedi.", "error");
    } finally {
        hideLoader();
    }
}

function populateSelect() {
    if (!catalogProductSelect) return;
    catalogProductSelect.innerHTML = '<option value="">-- Ürün Seçin --</option>';

    availableProducts.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = `${p.name} (${formatCurrency(p.sell_price)})`;
        opt.dataset.price = p.sell_price;
        catalogProductSelect.appendChild(opt);
    });
}

// Ürün seçildiğinde fiyatı doldur
if (catalogProductSelect) {
    catalogProductSelect.addEventListener('change', () => {
        const selected = catalogProductSelect.options[catalogProductSelect.selectedIndex];
        if (selected && selected.dataset.price) {
            catalogPromoPrice.value = selected.dataset.price;
        } else {
            catalogPromoPrice.value = '';
        }
    });
}

// Canlı Metin Senkronizasyonu
if (catalogTitleInput) {
    catalogTitleInput.addEventListener('input', () => {
        const val = catalogTitleInput.value.trim() || 'Haftanın Nalbur Fırsatları';
        const words = val.split(' ');
        if (words.length > 1) {
            const last = words.pop();
            if (flyerDisplayTitle) flyerDisplayTitle.innerHTML = `${words.join(' ')} <span>${last}</span>`;
        } else {
            if (flyerDisplayTitle) flyerDisplayTitle.innerHTML = val;
        }
    });
}
if (catalogSubtitleInput) {
    catalogSubtitleInput.addEventListener('input', () => {
        if (flyerDisplaySub) flyerDisplaySub.innerText = catalogSubtitleInput.value || '';
    });
}
if (catalogPhoneInput) {
    catalogPhoneInput.addEventListener('input', () => {
        if (flyerDisplayPhone) flyerDisplayPhone.innerText = catalogPhoneInput.value || '';
    });
}
if (catalogAddressInput) {
    catalogAddressInput.addEventListener('input', () => {
        if (flyerDisplayAddress) flyerDisplayAddress.innerText = catalogAddressInput.value || '';
    });
}

// Afişe Ürün Ekle Butonu
if (catalogAddProductBtn) {
    catalogAddProductBtn.addEventListener('click', () => {
        const prodId = catalogProductSelect.value;
        const prod = availableProducts.find(p => p.id === prodId);
        const price = parseFloat(catalogPromoPrice.value) || (prod ? prod.sell_price : 0);
        const tag = (catalogPromoTag ? catalogPromoTag.value.trim() : '') || 'KAMPANYA';

        if (!prodId || !prod) {
            showToast("Lütfen afişe eklemek için bir ürün seçin.", "error");
            return;
        }

        // Zaten ekli mi kontrol et
        const existingIdx = catalogItems.findIndex(it => it.product.id === prod.id);
        if (existingIdx > -1) {
            catalogItems[existingIdx].promoPrice = price;
            catalogItems[existingIdx].promoTag = tag;
        } else {
            catalogItems.push({
                product: prod,
                promoPrice: price,
                promoTag: tag
            });
        }

        renderFlyerGrid();
        showToast(`"${prod.name}" afişe eklendi.`, "success");

        // Seçiciyi sıfırla
        catalogProductSelect.value = '';
        catalogPromoPrice.value = '';
    });
}

function getCategoryIcon(cat) {
    if (!cat) return 'fa-box-archive';
    const c = cat.toLowerCase();
    if (c.includes('elektrot') || c.includes('kaynak')) return 'fa-bolt';
    if (c.includes('güvenlik') || c.includes('eldiven')) return 'fa-shield-halved';
    if (c.includes('vida') || c.includes('bağlantı') || c.includes('civata')) return 'fa-screwdriver';
    if (c.includes('kesici') || c.includes('aşındırıcı') || c.includes('taşlama')) return 'fa-circle-notch';
    if (c.includes('alet') || c.includes('anahtar') || c.includes('pense')) return 'fa-wrench';
    if (c.includes('boya') || c.includes('kimyasal') || c.includes('tiner')) return 'fa-paint-roller';
    if (c.includes('tesisat') || c.includes('musluk') || c.includes('boru')) return 'fa-faucet';
    if (c.includes('elektrik') || c.includes('kablo')) return 'fa-plug';
    return 'fa-box-archive';
}

// ========================================================
// AFİŞ KARTLARININ ÇİZİMİ
// ========================================================
function renderFlyerGrid() {
    if (!flyerItemsGrid) return;
    flyerItemsGrid.innerHTML = '';

    if (catalogItems.length === 0) {
        flyerItemsGrid.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1; padding: 2rem;">
                <i class="fa-solid fa-tags"></i>
                <p>Afişte henüz ürün yok. Soldan ürün seçip "Afişe Ekle" butonuna basın.</p>
            </div>
        `;
        return;
    }

    catalogItems.forEach((item, index) => {
        const p = item.product;
        const card = document.createElement('div');
        card.className = 'catalog-card';
        const hasImage = Boolean(p.image_url);

        card.innerHTML = `
            ${item.promoTag ? `<div class="catalog-card-promo">${item.promoTag}</div>` : ''}
            <div class="catalog-card-img-wrap ${hasImage ? '' : 'placeholder'}">
                ${hasImage 
                    ? `<img src="${p.image_url}" alt="${p.name}" class="catalog-card-img" loading="lazy" onerror="this.parentElement.classList.add('placeholder'); this.outerHTML='<i class=\\\'fa-solid ${getCategoryIcon(p.category)}\\\'></i>';">`
                    : `<i class="fa-solid ${getCategoryIcon(p.category)}"></i>`
                }
            </div>
            <div>
                <div class="catalog-card-cat">${p.category || 'Nalbur'}</div>
                <div class="catalog-card-name">${p.name}</div>
            </div>
            <div class="catalog-card-price-box">
                <div class="catalog-card-price">${formatCurrency(item.promoPrice)}</div>
                <div class="catalog-card-unit">/ ${p.unit || 'Adet'}</div>
            </div>
            <button class="btn-table-action delete" style="position: absolute; bottom: 8px; right: 8px;" title="Afişten Çıkar">
                <i class="fa-solid fa-trash"></i>
            </button>
        `;

        card.querySelector('.btn-table-action.delete').addEventListener('click', (e) => {
            e.stopPropagation();
            catalogItems.splice(index, 1);
            renderFlyerGrid();
        });

        flyerItemsGrid.appendChild(card);
    });
}

// ========================================================
// DIŞA AKTARMA VE SOSYAL MEDYA PAYLAŞIMI
// ========================================================

// 1. WhatsApp Formatında Metin Kopyala
if (catalogCopyWhatsappBtn) {
    catalogCopyWhatsappBtn.addEventListener('click', () => {
        if (catalogItems.length === 0) {
            showToast("Afişte paylaşılabilecek ürün bulunmuyor!", "error");
            return;
        }

        const title = catalogTitleInput ? catalogTitleInput.value.trim() : 'Haftanın Nalbur Fırsatları';
        const sub = catalogSubtitleInput ? catalogSubtitleInput.value.trim() : '';
        const phone = catalogPhoneInput ? catalogPhoneInput.value.trim() : '';
        const address = catalogAddressInput ? catalogAddressInput.value.trim() : '';

        let text = `🔥 *${title.toUpperCase()}* 🔥\n`;
        if (sub) text += `_${sub}_\n\n`;

        catalogItems.forEach((item) => {
            const p = item.product;
            text += `🔹 *${p.name}*\n`;
            text += `   🏷️ Fiyat: *${formatCurrency(item.promoPrice)}* / ${p.unit || 'Adet'}\n`;
        });

        text += `\n⚡ *Toptan ve Perakende Sipariş İçin:*\n`;
        if (phone) text += `📞 İletişim: ${phone}\n`;
        if (address) text += `📍 Adres: ${address}\n`;
        text += `\n_Hızlı teslimat ve kaliteli nalbur malzemeleri!_`;

        // Panoya Kopyala
        navigator.clipboard.writeText(text).then(() => {
            showToast("WhatsApp ve Sosyal Medya metni kopyalandı! Durum veya grupta paylaşabilirsiniz.", "success");
        }).catch(() => {
            showToast("Metin kopyalanamadı, lütfen izinleri kontrol edin.", "error");
        });
    });
}

// ========================================================
// İZOLE IFRAME İLE KUSURSUZ AFİŞ YAZDIRMA / PDF MOTORU
// ========================================================
export function printCatalogFlyer() {
    if (catalogItems.length === 0) {
        showToast("Katalogda yazdırılacak ürün bulunmuyor. Lütfen önce ürün ekleyin.", "error");
        return;
    }

    // Varsa eski yazdırma iframe'ini temizle
    const existingIframe = document.getElementById('catalog-print-iframe');
    if (existingIframe) existingIframe.remove();

    // 1. Gizli, izole iframe oluştur
    const iframe = document.createElement('iframe');
    iframe.id = 'catalog-print-iframe';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.style.visibility = 'hidden';
    document.body.appendChild(iframe);

    // 2. Afiş metin bilgilerini al
    const rawTitle = catalogTitleInput?.value?.trim() || 'Haftanın Nalbur Fırsatları';
    const sub = catalogSubtitleInput?.value?.trim() || 'Stoklarla sınırlı toptan ve perakende şok fiyatlar!';
    const phone = catalogPhoneInput?.value?.trim() || '0532 000 00 00';
    const address = catalogAddressInput?.value?.trim() || 'Sanayi Sitesi';

    // Başlık son kelime vurgusu
    const words = rawTitle.split(' ');
    let formattedTitle = rawTitle;
    if (words.length > 1) {
        const last = words.pop();
        formattedTitle = `${words.join(' ')} <span class="highlight">${last}</span>`;
    }

    // Ürün kartları HTML'i
    const cardsHtml = catalogItems.map(item => {
        const p = item.product;
        const hasImage = Boolean(p.image_url);
        return `
            <div class="card">
                ${item.promoTag ? `<div class="tag">${item.promoTag}</div>` : ''}
                <div class="img-wrap">
                    ${hasImage 
                        ? `<img src="${p.image_url}" alt="${p.name}" onerror="this.parentElement.innerHTML='<i class=\\\'fa-solid ${getCategoryIcon(p.category)}\\\'></i>';">` 
                        : `<i class="fa-solid ${getCategoryIcon(p.category)}"></i>`
                    }
                </div>
                <div>
                    <div class="cat">${p.category || 'Nalbur Malzemeleri'}</div>
                    <div class="name">${p.name}</div>
                </div>
                <div class="price-row">
                    <span class="price">${formatCurrency(item.promoPrice)}</span>
                    <span class="unit">/ ${p.unit || 'Adet'}</span>
                </div>
            </div>
        `;
    }).join('');

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(`
        <!DOCTYPE html>
        <html lang="tr">
        <head>
            <meta charset="UTF-8">
            <title>${rawTitle} - Nalbur Fırsat Afişi</title>
            <link rel="preconnect" href="https://fonts.googleapis.com">
            <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
            <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800;900&family=JetBrains+Mono:wght@700;800;900&display=swap" rel="stylesheet">
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
            <style>
                @page {
                    size: A4 portrait;
                    margin: 8mm 10mm;
                }
                * {
                    box-sizing: border-box;
                    margin: 0;
                    padding: 0;
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                }
                body {
                    font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
                    background: #ffffff;
                    color: #0f172a;
                    padding: 8px;
                }
                .flyer-container {
                    border: 2.5px solid #0f172a;
                    border-radius: 12px;
                    padding: 18px 20px;
                    background: #ffffff;
                    max-width: 100%;
                }
                .header {
                    text-align: center;
                    background: #f8fafc;
                    border: 1.5px solid #e2e8f0;
                    border-bottom: 2.5px solid #0f172a;
                    border-radius: 8px;
                    padding: 14px 18px;
                    margin-bottom: 16px;
                }
                .badge {
                    display: inline-block;
                    background: #d97706;
                    color: #ffffff;
                    font-size: 11px;
                    font-weight: 800;
                    letter-spacing: 1px;
                    text-transform: uppercase;
                    padding: 3px 14px;
                    border-radius: 20px;
                    margin-bottom: 4px;
                }
                h1 {
                    font-size: 26px;
                    font-weight: 900;
                    color: #0f172a;
                    line-height: 1.2;
                    margin: 4px 0;
                }
                h1 .highlight {
                    color: #d97706;
                }
                .subtitle {
                    font-size: 12px;
                    color: #475569;
                    font-weight: 600;
                }
                .grid {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 12px;
                    margin-bottom: 16px;
                }
                .card {
                    position: relative;
                    border: 1.5px solid #cbd5e1;
                    border-radius: 8px;
                    padding: 12px;
                    background: #ffffff;
                    display: flex;
                    flex-direction: column;
                    justify-content: space-between;
                    page-break-inside: avoid;
                    min-height: 165px;
                }
                .tag {
                    position: absolute;
                    top: 6px;
                    right: 6px;
                    background: #dc2626;
                    color: #ffffff;
                    font-size: 9px;
                    font-weight: 800;
                    padding: 2px 7px;
                    border-radius: 4px;
                    text-transform: uppercase;
                }
                .img-wrap {
                    width: 100%;
                    height: 90px;
                    background: #f8fafc;
                    border: 1px solid #e2e8f0;
                    border-radius: 6px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin-bottom: 8px;
                    overflow: hidden;
                }
                .img-wrap img {
                    max-width: 100%;
                    max-height: 100%;
                    object-fit: contain;
                }
                .img-wrap i {
                    font-size: 28px;
                    color: #94a3b8;
                }
                .cat {
                    font-size: 9px;
                    font-weight: 800;
                    color: #d97706;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    margin-bottom: 2px;
                }
                .name {
                    font-size: 13px;
                    font-weight: 800;
                    color: #0f172a;
                    line-height: 1.25;
                    margin-bottom: 8px;
                    word-break: break-word;
                }
                .price-row {
                    border-top: 1.5px dashed #cbd5e1;
                    padding-top: 6px;
                    display: flex;
                    align-items: baseline;
                    justify-content: space-between;
                }
                .price {
                    font-family: 'JetBrains Mono', monospace;
                    font-size: 17px;
                    font-weight: 900;
                    color: #0f172a;
                }
                .unit {
                    font-size: 10px;
                    color: #64748b;
                    font-weight: 700;
                }
                .footer {
                    background: #f8fafc;
                    border: 1.5px solid #e2e8f0;
                    border-radius: 8px;
                    padding: 10px 16px;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                }
                .footer-contact {
                    display: flex;
                    gap: 16px;
                    font-size: 11px;
                    font-weight: 700;
                    color: #0f172a;
                }
                .footer-contact i {
                    color: #d97706;
                    margin-right: 4px;
                }
                .footer-tag {
                    color: #d97706;
                    font-weight: 800;
                    font-size: 11px;
                }
            </style>
        </head>
        <body>
            <div class="flyer-container">
                <div class="header">
                    <div class="badge">🔥 GÜNCEL FİYAT BÜLTENİ</div>
                    <h1>${formattedTitle}</h1>
                    <p class="subtitle">${sub}</p>
                </div>
                <div class="grid">
                    ${cardsHtml}
                </div>
                <div class="footer">
                    <div class="footer-contact">
                        ${phone ? `<span><i class="fa-solid fa-phone"></i> Sipariş / İletişim: <b>${phone}</b></span>` : ''}
                        ${address ? `<span><i class="fa-solid fa-location-dot"></i> <b>${address}</b></span>` : ''}
                    </div>
                    <div class="footer-tag">⚡ Hızlı Teslimat & Kaliteli Malzeme</div>
                </div>
            </div>
        </body>
        </html>
    `);
    doc.close();

    showToast("Afiş PDF / Baskı penceresi hazırlanıyor...", "info");

    setTimeout(() => {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
        setTimeout(() => {
            if (iframe.parentNode) {
                iframe.parentNode.removeChild(iframe);
            }
        }, 3000);
    }, 500);
}

// Ana "Afişi Yazdır / PDF" Butonu Dinleyicisi
if (catalogPrintBtn) {
    catalogPrintBtn.addEventListener('click', () => {
        printCatalogFlyer();
    });
}

// ========================================================
// TAM EKRAN AFİŞ ÖNİZLEME MODALI
// ========================================================
function openPreviewModal() {
    if (!catalogPreviewModal || !catalogModalFlyerContainer) return;
    if (catalogItems.length === 0) {
        showToast("Önizlenecek ürün bulunmuyor. Lütfen önce ürün ekleyin.", "error");
        return;
    }

    const flyerEl = document.getElementById('catalog-flyer-preview');
    if (!flyerEl) return;

    // Temiz bir kopya oluştur ve silme butonlarını gizle/sil
    const flyerClone = flyerEl.cloneNode(true);
    flyerClone.querySelectorAll('.btn-table-action.delete').forEach(btn => btn.remove());
    flyerClone.style.maxWidth = '100%';
    flyerClone.style.margin = '0 auto';

    catalogModalFlyerContainer.innerHTML = '';
    catalogModalFlyerContainer.appendChild(flyerClone);

    catalogPreviewModal.classList.add('active');
}

function closePreviewModal() {
    if (catalogPreviewModal) catalogPreviewModal.classList.remove('active');
}

if (catalogPreviewModalBtn) catalogPreviewModalBtn.addEventListener('click', openPreviewModal);
if (catalogPreviewModalClose) catalogPreviewModalClose.addEventListener('click', closePreviewModal);
if (catalogPreviewModalCancel) catalogPreviewModalCancel.addEventListener('click', closePreviewModal);
if (catalogModalPrintBtn) catalogModalPrintBtn.addEventListener('click', () => {
    printCatalogFlyer();
});
if (catalogPreviewModalPrintBottom) catalogPreviewModalPrintBottom.addEventListener('click', () => {
    printCatalogFlyer();
});

// Modal dışına tıklanırsa kapat
if (catalogPreviewModal) {
    catalogPreviewModal.addEventListener('click', (e) => {
        if (e.target === catalogPreviewModal) {
            closePreviewModal();
        }
    });
}

// ========================================================
// MOBİL SEKME GEÇİŞLERİ (AYARLAR & CANLI AFİŞ)
// ========================================================
if (tabBtnSettings && tabBtnView && catalogContainer) {
    tabBtnSettings.addEventListener('click', () => {
        tabBtnSettings.classList.add('active');
        tabBtnView.classList.remove('active');
        catalogContainer.classList.add('tab-view-settings');
        catalogContainer.classList.remove('tab-view-flyer');
    });

    tabBtnView.addEventListener('click', () => {
        tabBtnView.classList.add('active');
        tabBtnSettings.classList.remove('active');
        catalogContainer.classList.add('tab-view-flyer');
        catalogContainer.classList.remove('tab-view-settings');
    });
}
