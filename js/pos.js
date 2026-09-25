// ========================================================
// HIZLI TEZGAH SATIŞI (KASA / POS) MODÜLÜ (ÇOKLU FİYAT LİSTELİ)
// ========================================================

import { supabase, showLoader, hideLoader, showToast, formatCurrency, formatNumber } from './supabase.js';
import { ensureGenelCustomer } from './customers.js';

// DOM Elemanları - Ürün Seçimi
const posSearchInput = document.getElementById('pos-search-input');
const posCategoryChips = document.getElementById('pos-category-chips');
const posProductsGrid = document.getElementById('pos-products-grid');
const posPriceListSelect = document.getElementById('pos-price-list-select');

// DOM Elemanları - Sepet & Kasa
const posCartItems = document.getElementById('pos-cart-items');
const posClearCartBtn = document.getElementById('pos-clear-cart-btn');
const posTotalItemsCount = document.getElementById('pos-total-items-count');
const posTotalAmount = document.getElementById('pos-total-amount');
const posCustomerName = document.getElementById('pos-customer-name');
const posCheckoutBtn = document.getElementById('pos-checkout-btn');

// DOM Elemanları - Mobil POS Sekmeleri & Yüzen Sepet Barı
const posContainer = document.querySelector('.pos-container');
const posTabProductsBtn = document.getElementById('pos-tab-products-btn');
const posTabCartBtn = document.getElementById('pos-tab-cart-btn');
const posMobileCartBadge = document.getElementById('pos-mobile-cart-badge');
const posFloatingCartBar = document.getElementById('pos-floating-cart-bar');
const posFloatingBadge = document.getElementById('pos-floating-badge');
const posFloatingCount = document.getElementById('pos-floating-count');
const posFloatingTotal = document.getElementById('pos-floating-total');
const posFloatingOpenCartBtn = document.getElementById('pos-floating-open-cart-btn');

// DOM Elemanları - Ürün Miktar & Fiyat Modal (Popup)
const posItemModal = document.getElementById('pos-item-modal');
const posItemModalClose = document.getElementById('pos-item-modal-close');
const posItemCancelBtn = document.getElementById('pos-item-cancel-btn');
const posItemForm = document.getElementById('pos-item-form');
const posItemProductId = document.getElementById('pos-item-product-id');
const posItemModalName = document.getElementById('pos-item-modal-name');
const posItemModalBarcode = document.getElementById('pos-item-modal-barcode');
const posItemModalStock = document.getElementById('pos-item-modal-stock');
const posItemUnitLabel = document.getElementById('pos-item-unit-label');
const posItemQty = document.getElementById('pos-item-qty');
const posItemPrice = document.getElementById('pos-item-price');
const posItemTotalPreview = document.getElementById('pos-item-total-preview');

// Durum (State)
let posProducts = [];
let cart = []; // [{ product, quantity, unitPrice }]
let currentModalProduct = null;
let selectedCategory = 'all';
let selectedPaymentMethod = 'Nakit';
let availablePriceLists = [];
let selectedPriceListId = 'DEFAULT';
let currentPriceMap = {}; // { [productId]: customPrice }
let availableCustomers = [];
let selectedPosCustomerId = null;

const posCustomerDatalist = document.getElementById('pos-customer-datalist');
const posSelectedCustomerInfo = document.getElementById('pos-selected-customer-info');

// Sayfa Yüklendiğinde Dinle
document.addEventListener('view-pos-loaded', async () => {
    await Promise.all([fetchPosProducts(), loadPriceLists(), loadPosCustomers()]);
});

// ========================================================
// FİYAT LİSTELERİNİ YÜKLEME VE YÖNETME
// ========================================================
async function loadPriceLists() {
    if (!supabase || !posPriceListSelect) return;
    try {
        const { data, error } = await supabase
            .from('price_lists')
            .select('id, name, code')
            .eq('is_active', true)
            .order('name', { ascending: true });

        if (error) throw error;
        availablePriceLists = data || [];

        posPriceListSelect.innerHTML = '<option value="DEFAULT">Standart Perakende</option>';
        availablePriceLists.forEach(pl => {
            const opt = document.createElement('option');
            opt.value = pl.id;
            opt.textContent = `${pl.name} (${pl.code || 'Özel'})`;
            posPriceListSelect.appendChild(opt);
        });

    } catch (err) {
        console.error("Fiyat listeleri yüklenemedi:", err);
    }
}

// ========================================================
// CARİ / MÜŞTERİ LİSTESİ YÜKLEME (POS İÇİN)
// ========================================================
async function loadPosCustomers() {
    if (!supabase || !posCustomerDatalist) return;
    try {
        // Varsayılan 'Genel' carisini garantiye al
        const genel = await ensureGenelCustomer();

        const { data, error } = await supabase
            .from('customers')
            .select('id, name, phone, balance, type')
            .order('name', { ascending: true });

        if (error) throw error;
        availableCustomers = data || [];

        // Genel cari listede yoksa ekle
        if (genel && !availableCustomers.some(c => c.id === genel.id)) {
            availableCustomers.unshift(genel);
        }

        posCustomerDatalist.innerHTML = '';
        availableCustomers.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.name;
            const bal = Number(c.balance) || 0;
            const balStr = bal < 0 ? `${formatCurrency(Math.abs(bal))} Borç` : (bal > 0 ? `${formatCurrency(bal)} Alacak` : 'Hesap Denk');
            const isGenel = (c.name || '').trim().toLowerCase() === 'genel';
            opt.label = `${c.phone || (isGenel ? 'Varsayılan Genel Cari' : 'Tel yok')} | ${balStr}`;
            posCustomerDatalist.appendChild(opt);
        });
    } catch (e) {
        console.warn("POS müşterileri yüklenemedi:", e);
    }
}

if (posCustomerName) {
    posCustomerName.addEventListener('input', () => {
        const val = posCustomerName.value.trim().toLowerCase();
        const matched = availableCustomers.find(c => c.name.toLowerCase() === val);
        if (matched) {
            selectedPosCustomerId = matched.id;
            if (posSelectedCustomerInfo) {
                const bal = Number(matched.balance) || 0;
                let balBadge = '<span style="color: var(--text-dim);">0,00 ₺</span>';
                if (bal < 0) balBadge = `<span style="color: var(--accent-danger); font-weight: 700;">${formatCurrency(bal)} (Borçlu)</span>`;
                else if (bal > 0) balBadge = `<span style="color: var(--accent-success); font-weight: 700;">+${formatCurrency(bal)} (Alacaklı)</span>`;
                
                posSelectedCustomerInfo.innerHTML = `<i class="fa-solid fa-user-check" style="color: var(--accent-success);"></i> <b>${matched.name}</b> ${matched.phone ? '(' + matched.phone + ')' : ''} — Bakiye: ${balBadge}`;
                posSelectedCustomerInfo.style.display = 'block';
            }
        } else {
            selectedPosCustomerId = null;
            if (posSelectedCustomerInfo) {
                posSelectedCustomerInfo.style.display = 'none';
            }
        }
    });
}

// Fiyat Listesi Değiştiğinde
if (posPriceListSelect) {
    posPriceListSelect.addEventListener('change', async () => {
        selectedPriceListId = posPriceListSelect.value;
        await updateActivePriceList();
    });
}

async function updateActivePriceList() {
    currentPriceMap = {};

    if (selectedPriceListId !== 'DEFAULT') {
        showLoader();
        try {
            const { data, error } = await supabase
                .from('price_list_items')
                .select('product_id, price')
                .eq('price_list_id', selectedPriceListId);

            if (error) throw error;
            (data || []).forEach(item => {
                currentPriceMap[item.product_id] = Number(item.price);
            });

            const selectedList = availablePriceLists.find(pl => pl.id === selectedPriceListId);
            showToast(`"${selectedList ? selectedList.name : 'Özel Liste'}" fiyat tarifesi aktif!`, "info");
        } catch (err) {
            console.error("Özel liste fiyatları alınamadı:", err);
        } finally {
            hideLoader();
        }
    } else {
        showToast("Standart Perakende fiyat tarifesine dönüldü.", "info");
    }

    // Katalog kartlarını ve sepetteki ürünlerin fiyatlarını güncelle
    filterAndRenderPosProducts();
    updateCartPrices();
}

function getProductEffectivePrice(product) {
    if (currentPriceMap[product.id] !== undefined) {
        return currentPriceMap[product.id];
    }
    return Number(product.sell_price) || 0;
}

function updateCartPrices() {
    cart.forEach(item => {
        item.unitPrice = getProductEffectivePrice(item.product);
    });
    renderCart();
}

// ========================================================
// ÜRÜNLERİ ÇEKME & POS KATALOĞU
// ========================================================
async function fetchPosProducts() {
    if (!supabase) return;
    showLoader();
    try {
        const { data, error } = await supabase
            .from('products')
            .select('*')
            .order('name', { ascending: true });

        if (error) throw error;
        posProducts = data || [];
        filterAndRenderPosProducts();
    } catch (err) {
        console.error("POS ürünleri yüklenemedi:", err);
        showToast("Satış ürünleri yüklenirken hata oluştu.", "error");
    } finally {
        hideLoader();
    }
}

function filterAndRenderPosProducts() {
    const query = (posSearchInput ? posSearchInput.value : '').toLowerCase().trim();

    const filtered = posProducts.filter(p => {
        const matchesQuery = !query ||
            (p.name && p.name.toLowerCase().includes(query)) ||
            (p.barcode && p.barcode.toLowerCase().includes(query));

        const matchesCat = (selectedCategory === 'all') || (p.category === selectedCategory);

        return matchesQuery && matchesCat;
    });

    renderPosProductsGrid(filtered);
}

function renderPosProductsGrid(products) {
    if (!posProductsGrid) return;
    posProductsGrid.innerHTML = '';

    if (products.length === 0) {
        posProductsGrid.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1;">
                <i class="fa-solid fa-magnifying-glass"></i>
                <p>Eşleşen nalbur malzemesi bulunamadı.</p>
            </div>
        `;
        return;
    }

    products.forEach(p => {
        const card = document.createElement('div');
        card.className = 'pos-item-card';

        const isLowStock = Number(p.stock_quantity) <= Number(p.min_stock);
        const stdPrice = Number(p.sell_price) || 0;
        const effectivePrice = getProductEffectivePrice(p);
        const hasCustomPrice = currentPriceMap[p.id] !== undefined;

        card.innerHTML = `
            <div>
                <div class="pos-item-cat">${p.category}</div>
                <div class="pos-item-title">${p.name}</div>
            </div>
            <div class="pos-item-footer">
                <div>
                    ${hasCustomPrice ? `<div class="price-old-striked" style="font-size: 0.76rem;">${formatCurrency(stdPrice)}</div>` : ''}
                    <div class="pos-item-price" style="color: ${hasCustomPrice ? 'var(--accent-success)' : 'var(--accent-primary)'};">
                        ${formatCurrency(effectivePrice)}
                    </div>
                    <div class="pos-item-stock ${isLowStock ? 'low' : ''}">
                        Stok: ${p.stock_quantity} ${p.unit}
                    </div>
                </div>
                <button class="btn btn-sm btn-primary" style="padding: 0 0.6rem; height: 32px;" title="Sepete Ekle">
                    <i class="fa-solid fa-plus"></i>
                </button>
            </div>
        `;

        card.addEventListener('click', () => {
            openPosItemModal(p);
        });

        posProductsGrid.appendChild(card);
    });
}

// Arama Dinleyicisi
if (posSearchInput) {
    posSearchInput.addEventListener('input', filterAndRenderPosProducts);

    posSearchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const query = posSearchInput.value.trim().toLowerCase();
            const exactMatch = posProducts.find(p => (p.barcode && p.barcode.toLowerCase() === query) || p.name.toLowerCase() === query);
            if (exactMatch) {
                openPosItemModal(exactMatch);
            }
        }
    });
}

// Kategori Hapları
if (posCategoryChips) {
    posCategoryChips.querySelectorAll('.chip-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            posCategoryChips.querySelectorAll('.chip-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedCategory = btn.getAttribute('data-cat') || 'all';
            filterAndRenderPosProducts();
        });
    });
}

// ========================================================
// ÜRÜN MİKTAR & FİYAT GİRİŞ MODALI (POPUP)
// ========================================================
function openPosItemModal(product) {
    if (!product || !posItemModal) return;

    currentModalProduct = product;
    if (posItemProductId) posItemProductId.value = product.id;
    if (posItemModalName) posItemModalName.innerText = product.name;
    if (posItemModalBarcode) {
        posItemModalBarcode.innerHTML = `<i class="fa-solid fa-barcode"></i> Barkod: ${product.barcode || 'Yok'}`;
    }
    if (posItemModalStock) {
        posItemModalStock.innerHTML = `<i class="fa-solid fa-boxes-stacked"></i> Mevcut Stok: <strong>${product.stock_quantity} ${product.unit || 'Adet'}</strong>`;
    }
    if (posItemUnitLabel) {
        posItemUnitLabel.innerText = product.unit || 'Adet';
    }

    // Default Değerler: Miktar = 1, Fiyat = Seçili Fiyat Listesi veya Standart Satış Fiyatı
    const defaultPrice = getProductEffectivePrice(product);
    if (posItemQty) posItemQty.value = "1";
    if (posItemPrice) posItemPrice.value = Number(defaultPrice).toFixed(2);

    updatePosItemTotalPreview();

    posItemModal.classList.add('active');

    // Miktar alanına otomatik odaklan ve seçili yap
    setTimeout(() => {
        if (posItemQty) {
            posItemQty.focus();
            posItemQty.select();
        }
    }, 60);
}

function closePosItemModal() {
    if (posItemModal) posItemModal.classList.remove('active');
    currentModalProduct = null;
}

function updatePosItemTotalPreview() {
    if (!posItemTotalPreview) return;
    const qty = parseFloat(posItemQty ? posItemQty.value : 0) || 0;
    const price = parseFloat(posItemPrice ? posItemPrice.value : 0) || 0;
    posItemTotalPreview.innerText = formatCurrency(qty * price);
}

if (posItemQty) posItemQty.addEventListener('input', updatePosItemTotalPreview);
if (posItemPrice) posItemPrice.addEventListener('input', updatePosItemTotalPreview);

if (posItemModalClose) posItemModalClose.addEventListener('click', closePosItemModal);
if (posItemCancelBtn) posItemCancelBtn.addEventListener('click', closePosItemModal);
if (posItemModal) {
    posItemModal.addEventListener('click', (e) => {
        if (e.target === posItemModal) closePosItemModal();
    });
}

// ESC tuşu ile modal kapatma
window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && posItemModal && posItemModal.classList.contains('active')) {
        closePosItemModal();
    }
});

// Modal Form Gönderimi (Sepete Ekle)
if (posItemForm) {
    posItemForm.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!currentModalProduct) return;

        const qty = parseFloat(posItemQty.value);
        const price = parseFloat(posItemPrice.value);

        if (isNaN(qty) || qty <= 0) {
            showToast("Lütfen geçerli bir miktar girin!", "error");
            if (posItemQty) posItemQty.focus();
            return;
        }

        if (isNaN(price) || price < 0) {
            showToast("Lütfen geçerli bir birim fiyat girin!", "error");
            if (posItemPrice) posItemPrice.focus();
            return;
        }

        addItemToCart(currentModalProduct, qty, price);
        closePosItemModal();

        // Arama kutusunu temizle ve odakla
        if (posSearchInput) {
            posSearchInput.value = '';
            filterAndRenderPosProducts();
            posSearchInput.focus();
        }
    });
}

// ========================================================
// SEPET YÖNETİMİ
// ========================================================
function addItemToCart(product, qty, unitPrice) {
    const existingIndex = cart.findIndex(item => item.product.id === product.id);

    if (existingIndex > -1) {
        cart[existingIndex].quantity += qty;
        cart[existingIndex].unitPrice = unitPrice;
    } else {
        cart.push({
            product: product,
            quantity: qty,
            unitPrice: unitPrice
        });
    }

    renderCart();
    const lineTotal = qty * unitPrice;
    showToast(`"${product.name}" sepete eklendi (${qty} ${product.unit || 'Adet'} × ${formatCurrency(unitPrice)} = ${formatCurrency(lineTotal)}).`, "success");
}

function updateCartItemQuantity(productId, newQty) {
    const index = cart.findIndex(item => item.product.id === productId);
    if (index === -1) return;

    if (newQty <= 0) {
        cart.splice(index, 1);
    } else {
        cart[index].quantity = newQty;
    }

    renderCart();
}

// Mobil POS Sekme Değiştirici (Ürünler <-> Sepet)
export function switchPosMobileTab(tab) {
    if (!posContainer) return;
    if (tab === 'cart') {
        posContainer.classList.add('mobile-show-cart');
        if (posTabCartBtn) posTabCartBtn.classList.add('active');
        if (posTabProductsBtn) posTabProductsBtn.classList.remove('active');
        if (posFloatingCartBar) posFloatingCartBar.style.display = 'none';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
        posContainer.classList.remove('mobile-show-cart');
        if (posTabProductsBtn) posTabProductsBtn.classList.add('active');
        if (posTabCartBtn) posTabCartBtn.classList.remove('active');
        if (posFloatingCartBar && cart.length > 0) {
            posFloatingCartBar.style.display = 'flex';
        }
    }
}

if (posTabProductsBtn) {
    posTabProductsBtn.addEventListener('click', () => switchPosMobileTab('products'));
}
if (posTabCartBtn) {
    posTabCartBtn.addEventListener('click', () => switchPosMobileTab('cart'));
}
if (posFloatingOpenCartBtn) {
    posFloatingOpenCartBtn.addEventListener('click', () => switchPosMobileTab('cart'));
}
if (posFloatingCartBar) {
    posFloatingCartBar.addEventListener('click', (e) => {
        if (e.target !== posFloatingOpenCartBtn && !posFloatingOpenCartBtn.contains(e.target)) {
            switchPosMobileTab('cart');
        }
    });
}

function removeFromCart(productId) {
    cart = cart.filter(item => item.product.id !== productId);
    renderCart();
}

function clearCart() {
    cart = [];
    renderCart();
    switchPosMobileTab('products');
}

if (posClearCartBtn) {
    posClearCartBtn.addEventListener('click', () => {
        if (cart.length > 0) {
            clearCart();
            showToast("Sepet temizlendi.", "info");
        }
    });
}

// Ödeme Türü Seçimi
const paymentButtons = document.querySelectorAll('.payment-btn');
paymentButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        paymentButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedPaymentMethod = btn.getAttribute('data-method') || 'Nakit';
    });
});

// Sepeti Ekrana Basma
function renderCart() {
    if (!posCartItems) return;
    posCartItems.innerHTML = '';

    if (cart.length === 0) {
        posCartItems.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-cart-arrow-down"></i>
                <p>Sepetiniz boş.<br>Ürünlere tıklayarak ekleyin.</p>
            </div>
        `;
        if (posTotalItemsCount) posTotalItemsCount.innerText = '0 kalem';
        if (posTotalAmount) posTotalAmount.innerText = '0,00 ₺';
        if (posMobileCartBadge) posMobileCartBadge.innerText = '0';
        if (posFloatingBadge) posFloatingBadge.innerText = '0';
        if (posFloatingCartBar) posFloatingCartBar.style.display = 'none';
        return;
    }

    let grandTotal = 0;
    let totalItems = 0;

    cart.forEach(item => {
        const p = item.product;
        const lineTotal = item.unitPrice * item.quantity;
        grandTotal += lineTotal;
        totalItems += 1;

        const cartItemEl = document.createElement('div');
        cartItemEl.className = 'cart-item';

        cartItemEl.innerHTML = `
            <div class="cart-item-header">
                <div class="cart-item-name">${p.name}</div>
                <button class="cart-item-remove" title="Sil" data-id="${p.id}">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>
            <div class="cart-item-controls">
                <div class="qty-control">
                    <button class="qty-btn btn-minus" data-id="${p.id}"><i class="fa-solid fa-minus"></i></button>
                    <input type="number" class="qty-input" value="${item.quantity}" min="0.1" step="any" data-id="${p.id}">
                    <button class="qty-btn btn-plus" data-id="${p.id}"><i class="fa-solid fa-plus"></i></button>
                    <span style="font-size: 0.78rem; color: var(--text-dim); margin-left: 2px;">${p.unit}</span>
                </div>
                <div class="cart-item-total" style="text-align: right;">
                    <div style="font-size: 0.74rem; color: var(--text-dim); font-weight: 500;">${formatCurrency(item.unitPrice)} / ${p.unit}</div>
                    <div style="font-weight: 700; color: var(--text-main);">${formatCurrency(lineTotal)}</div>
                </div>
            </div>
        `;

        cartItemEl.querySelector('.cart-item-remove').addEventListener('click', () => {
            removeFromCart(p.id);
        });

        cartItemEl.querySelector('.btn-minus').addEventListener('click', () => {
            updateCartItemQuantity(p.id, item.quantity - 1);
        });

        cartItemEl.querySelector('.btn-plus').addEventListener('click', () => {
            updateCartItemQuantity(p.id, item.quantity + 1);
        });

        const qtyInput = cartItemEl.querySelector('.qty-input');
        qtyInput.addEventListener('change', () => {
            const val = parseFloat(qtyInput.value) || 0;
            updateCartItemQuantity(p.id, val);
        });

        posCartItems.appendChild(cartItemEl);
    });

    if (posTotalItemsCount) posTotalItemsCount.innerText = `${totalItems} kalem`;
    if (posTotalAmount) posTotalAmount.innerText = formatCurrency(grandTotal);

    // Mobil rozetleri ve yüzen barı güncelle
    const badgeText = String(totalItems);
    if (posMobileCartBadge) posMobileCartBadge.innerText = badgeText;
    if (posFloatingBadge) posFloatingBadge.innerText = badgeText;
    if (posFloatingCount) posFloatingCount.innerText = `${totalItems} Kalem Ürün`;
    if (posFloatingTotal) posFloatingTotal.innerText = formatCurrency(grandTotal);

    if (posFloatingCartBar) {
        if (posContainer && !posContainer.classList.contains('mobile-show-cart')) {
            posFloatingCartBar.style.display = 'flex';
        } else {
            posFloatingCartBar.style.display = 'none';
        }
    }
}

// ========================================================
// SATIŞI TAMAMLAMA (CHECKOUT İŞLEMİ)
// ========================================================
if (posCheckoutBtn) {
    posCheckoutBtn.addEventListener('click', async () => {
        if (cart.length === 0) {
            showToast("Sepette ürün bulunmuyor!", "error");
            return;
        }

        // 0. Cari Belirleme (Cari seçilmemişse varsayılan 'Genel' atanır)
        let targetCustomerId = selectedPosCustomerId;
        let targetCustomerName = posCustomerName ? posCustomerName.value.trim() : '';

        // İsim elle girilmişse ve kayıtlı carilerle eşleşiyorsa al
        if (!targetCustomerId && targetCustomerName) {
            const matched = availableCustomers.find(c => c.name.toLowerCase() === targetCustomerName.toLowerCase());
            if (matched) {
                targetCustomerId = matched.id;
                targetCustomerName = matched.name;
            }
        }

        // Cari seçilmemişse veya boşsa varsayılan 'Genel' carisini ata
        if (!targetCustomerId) {
            const genel = await ensureGenelCustomer();
            if (genel) {
                targetCustomerId = genel.id;
                targetCustomerName = 'Genel';
            }
        }

        // Veresiye Satış Kontrolü (Veresiye Genel'e yapılamaz, kayıtlı gerçek bir cari seçilmelidir)
        if (selectedPaymentMethod === 'Veresiye') {
            if (!targetCustomerId || targetCustomerName.toLowerCase() === 'genel') {
                showToast("Veresiye satışı yapabilmek için lütfen 'Genel' dışında kayıtlı bir Müşteri / Cari seçin!", "error");
                if (posCustomerName) posCustomerName.focus();
                return;
            }
        }

        const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const randomPart = Math.floor(1000 + Math.random() * 9000);
        const receiptNo = `NAL-${datePart}-${randomPart}`;

        const totalAmount = cart.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);

        showLoader();
        try {
            // 1. Satış Kaydı Oluştur
            const { data: saleData, error: saleError } = await supabase.from('sales').insert([{
                receipt_no: receiptNo,
                total_amount: totalAmount,
                payment_method: selectedPaymentMethod,
                customer_id: targetCustomerId || null,
                customer_name: targetCustomerName || 'Genel',
                price_list_id: selectedPriceListId !== 'DEFAULT' ? selectedPriceListId : null,
                note: `Hızlı Tezgah Satışı (${selectedPaymentMethod})${selectedPriceListId !== 'DEFAULT' ? ' - Özel Liste' : ''}`
            }]).select().single();

            if (saleError) throw saleError;
            const saleId = saleData.id;

            // 2. Kalemleri Hazırla ve Ekle (sale_items & stock_movements)
            const saleItemsPayload = [];
            const movementsPayload = [];

            for (const item of cart) {
                const lineTotal = item.unitPrice * item.quantity;

                saleItemsPayload.push({
                    sale_id: saleId,
                    product_id: item.product.id,
                    product_name: item.product.name,
                    quantity: item.quantity,
                    unit: item.product.unit || 'Adet',
                    unit_price: item.unitPrice,
                    total_price: lineTotal
                });

                movementsPayload.push({
                    product_id: item.product.id,
                    customer_id: targetCustomerId || null,
                    movement_type: 'OUT',
                    quantity: item.quantity,
                    unit_price: item.unitPrice,
                    total_price: lineTotal,
                    reference_id: saleId,
                    note: `Satış #${receiptNo} - ${targetCustomerName || 'Genel'}`
                });
            }

            const { error: itemsError } = await supabase.from('sale_items').insert(saleItemsPayload);
            if (itemsError) throw itemsError;

            const { error: moveError } = await supabase.from('stock_movements').insert(movementsPayload);
            if (moveError) throw moveError;

            // 3. Ürün Stoklarını Otomatik Düşür
            for (const item of cart) {
                const currentQty = Number(item.product.stock_quantity) || 0;
                const newQty = currentQty - item.quantity;

                await supabase.from('products')
                    .update({ 
                        stock_quantity: newQty,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', item.product.id);
            }

            // 4. Cari Hareketleri Kaydı (TÜM Satışlar İstisnasız Cari Hareketlere Yazılır)
            const isVeresiye = selectedPaymentMethod === 'Veresiye';
            const transPayload = {
                customer_id: targetCustomerId,
                transaction_type: 'SALE',
                payment_method: isVeresiye ? 'Açık Hesap' : selectedPaymentMethod,
                debt: totalAmount, // Satış bedeli borç olarak işlenir
                credit: isVeresiye ? 0 : totalAmount, // Peşin satışta anında tahsil edildiği için alacak da eşitlenir
                amount: totalAmount, // Sattığı fiyat
                reference_id: saleId,
                receipt_no: receiptNo,
                description: `Hızlı Satış #${receiptNo} - ${cart.length} Kalem (${selectedPaymentMethod})`
            };

            const { error: transErr } = await supabase.from('customer_transactions').insert([transPayload]);
            if (transErr) console.warn("Cari hareketi oluşturulamadı:", transErr);

            // Eğer Veresiye ise müşterinin bakiyesini borçlandır
            if (isVeresiye && targetCustomerId) {
                const targetCust = availableCustomers.find(c => c.id === targetCustomerId);
                const currentBal = Number(targetCust?.balance) || 0;
                const newBal = currentBal - totalAmount; // Borç eksiye çeker
                await supabase.from('customers').update({ balance: newBal }).eq('id', targetCustomerId);
            }

            // Cari hareketler ve stok hareketleri modüllerine sinyal gönder
            document.dispatchEvent(new CustomEvent('transaction-saved'));
            document.dispatchEvent(new CustomEvent('movement-saved'));

            showToast(`Satış #${receiptNo} başarıyla tamamlandı! Toplam: ${formatCurrency(totalAmount)} (${targetCustomerName || 'Genel'})`, "success");

            clearCart();
            selectedPosCustomerId = null;
            if (posCustomerName) posCustomerName.value = '';
            if (posSelectedCustomerInfo) posSelectedCustomerInfo.style.display = 'none';

            await Promise.all([fetchPosProducts(), loadPosCustomers()]);

        } catch (err) {
            console.error("Satış işlemi sırasında hata:", err);
            showToast("Satış kaydedilemedi: " + err.message, "error");
        } finally {
            hideLoader();
        }
    });
}
