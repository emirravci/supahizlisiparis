// ========================================================
// HIZLI TEZGAH SATIŞI (KASA / POS) MODÜLÜ (ÇOKLU FİYAT LİSTELİ)
// ========================================================

import { supabase, showLoader, hideLoader, showToast, formatCurrency, formatNumber } from './supabase.js';

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

// Durum (State)
let posProducts = [];
let cart = []; // [{ product, quantity, unitPrice }]
let selectedCategory = 'all';
let selectedPaymentMethod = 'Nakit';
let availablePriceLists = [];
let selectedPriceListId = 'DEFAULT';
let currentPriceMap = {}; // { [productId]: customPrice }

// Sayfa Yüklendiğinde Dinle
document.addEventListener('view-pos-loaded', async () => {
    await Promise.all([fetchPosProducts(), loadPriceLists()]);
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
            addToCart(p);
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
                addToCart(exactMatch);
                posSearchInput.value = '';
                filterAndRenderPosProducts();
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
// SEPET YÖNETİMİ
// ========================================================
function addToCart(product) {
    const existingIndex = cart.findIndex(item => item.product.id === product.id);
    const unitPrice = getProductEffectivePrice(product);

    if (existingIndex > -1) {
        cart[existingIndex].quantity += 1;
        cart[existingIndex].unitPrice = unitPrice;
    } else {
        cart.push({
            product: product,
            quantity: 1,
            unitPrice: unitPrice
        });
    }

    renderCart();
    showToast(`"${product.name}" sepete eklendi (${formatCurrency(unitPrice)}).`, "info");
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

function removeFromCart(productId) {
    cart = cart.filter(item => item.product.id !== productId);
    renderCart();
}

function clearCart() {
    cart = [];
    renderCart();
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
                <div class="cart-item-total">${formatCurrency(lineTotal)}</div>
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

        const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const randomPart = Math.floor(1000 + Math.random() * 9000);
        const receiptNo = `NAL-${datePart}-${randomPart}`;

        const customer = posCustomerName ? posCustomerName.value.trim() : null;
        const totalAmount = cart.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);

        showLoader();
        try {
            // 1. Satış Kaydı Oluştur
            const { data: saleData, error: saleError } = await supabase.from('sales').insert([{
                receipt_no: receiptNo,
                total_amount: totalAmount,
                payment_method: selectedPaymentMethod,
                customer_name: customer,
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
                    movement_type: 'OUT',
                    quantity: item.quantity,
                    unit_price: item.unitPrice,
                    total_price: lineTotal,
                    reference_id: saleId,
                    note: `Satış #${receiptNo} - ${customer || 'Perakende Müşteri'}`
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

            showToast(`Satış #${receiptNo} başarıyla tamamlandı! Toplam: ${formatCurrency(totalAmount)}`, "success");

            clearCart();
            if (posCustomerName) posCustomerName.value = '';

            await fetchPosProducts();

        } catch (err) {
            console.error("Satış işlemi sırasında hata:", err);
            showToast("Satış kaydedilemedi: " + err.message, "error");
        } finally {
            hideLoader();
        }
    });
}
