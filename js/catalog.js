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

        // İlk açılışta boşsa ilk 4-6 ürünü afişe otomatik ekle (demo doluluğu)
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

        card.innerHTML = `
            ${item.promoTag ? `<div class="catalog-card-promo">${item.promoTag}</div>` : ''}
            <div>
                <div class="catalog-card-cat">${p.category}</div>
                <div class="catalog-card-name">${p.name}</div>
            </div>
            <div class="catalog-card-price-box">
                <div class="catalog-card-price">${formatCurrency(item.promoPrice)}</div>
                <div class="catalog-card-unit">/ ${p.unit}</div>
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

        catalogItems.forEach((item, idx) => {
            const p = item.product;
            text += `🔹 *${p.name}*\n`;
            text += `   🏷️ Fiyat: *${formatCurrency(item.promoPrice)}* / ${p.unit}\n`;
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

// 2. Afişi Yazdır / PDF Olarak İndir
if (catalogPrintBtn) {
    catalogPrintBtn.addEventListener('click', () => {
        if (catalogItems.length === 0) {
            showToast("Katalogda yazdırılacak ürün bulunmuyor. Lütfen önce ürün ekleyin.", "error");
            return;
        }

        // Baskı modunu aktifleştir (Sadece şık A4 katalog sayfası basılacak)
        document.body.classList.remove('printing-proforma');
        document.body.classList.add('printing-catalog');

        const cleanUp = () => {
            document.body.classList.remove('printing-catalog');
            window.removeEventListener('afterprint', cleanUp);
        };
        window.addEventListener('afterprint', cleanUp);

        // Tarayıcı yazdırma diyaloğunu aç
        setTimeout(() => {
            window.print();
        }, 100);
    });
}
