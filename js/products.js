// ========================================================
// ÜRÜNLER VE STOK YÖNETİMİ MODÜLÜ
// ========================================================

import { supabase, showLoader, hideLoader, showToast, showConfirmModal, formatCurrency, formatNumber } from './supabase.js';

// DOM Elemanları - Tablo & Filtreler
const productsTableTbody = document.getElementById('products-table-tbody');
const productsSearchInput = document.getElementById('products-search-input');
const productsCategoryFilter = document.getElementById('products-category-filter');
const productsCriticalFilterBtn = document.getElementById('products-critical-filter-btn');
const btnOpenNewProduct = document.getElementById('btn-open-new-product');

// DOM Elemanları - Ürün Ekleme/Düzenleme Modalı
const productModal = document.getElementById('product-modal');
const productModalTitle = document.getElementById('product-modal-title');
const productModalClose = document.getElementById('product-modal-close');
const productCancelBtn = document.getElementById('product-cancel-btn');
const productForm = document.getElementById('product-form');
const productId = document.getElementById('product-id');
const productBarcode = document.getElementById('product-barcode');
const productCategory = document.getElementById('product-category');
const productName = document.getElementById('product-name');
const productUnit = document.getElementById('product-unit');
const productShelf = document.getElementById('product-shelf');
const productBuyPrice = document.getElementById('product-buy-price');
const productSellPrice = document.getElementById('product-sell-price');
const productStock = document.getElementById('product-stock');
const productMinStock = document.getElementById('product-min-stock');
const productNotes = document.getElementById('product-notes');
const productImageFile = document.getElementById('product-image-file');
const productImageUrl = document.getElementById('product-image-url');
const productImagePreview = document.getElementById('product-image-preview');
const productImagePlaceholderIcon = document.getElementById('product-image-placeholder-icon');
const productImageRemoveBtn = document.getElementById('product-image-remove-btn');

// Durum (State)
let selectedImageFile = null;

// DOM Elemanları - Stok Girişi Modalı
const stockInModal = document.getElementById('stock-in-modal');
const stockInModalClose = document.getElementById('stock-in-modal-close');
const stockInCancelBtn = document.getElementById('stock-in-cancel-btn');
const stockInForm = document.getElementById('stock-in-form');
const stockInProductId = document.getElementById('stock-in-product-id');
const stockInProductTitle = document.getElementById('stock-in-product-title');
const stockInCurrentQty = document.getElementById('stock-in-current-qty');
const stockInUnit = document.getElementById('stock-in-unit');
const stockInQty = document.getElementById('stock-in-qty');
const stockInPrice = document.getElementById('stock-in-price');
const stockInNote = document.getElementById('stock-in-note');

// Durum (State)
let allProducts = [];
let isCriticalFilterActive = false;

// Sayfa Yüklendiğinde Dinle
document.addEventListener('view-products-loaded', async (e) => {
    await fetchProducts();
    if (e.detail && e.detail.openNew) {
        openProductModal();
    }
});

// Başka view'lardan gelen stok girişi isteğini dinle
document.addEventListener('open-stock-in-modal', (e) => {
    if (e.detail) {
        openStockInModal(e.detail);
    }
});

// ========================================================
// VERİ ÇEKME & FİLTRELEME
// ========================================================
export async function fetchProducts() {
    if (!supabase) return;
    showLoader();
    try {
        const { data, error } = await supabase
            .from('products')
            .select('*')
            .order('name', { ascending: true });

        if (error) throw error;
        allProducts = data || [];
        applyFiltersAndRender();
    } catch (err) {
        console.error("Ürünler yüklenirken hata:", err);
        showToast("Ürünler listelenemedi.", "error");
    } finally {
        hideLoader();
    }
}

function applyFiltersAndRender() {
    const searchText = (productsSearchInput ? productsSearchInput.value : '').toLowerCase().trim();
    const selectedCategory = productsCategoryFilter ? productsCategoryFilter.value : 'all';

    const filtered = allProducts.filter(p => {
        // Arama (Barkod veya Ürün Adı)
        const matchesSearch = !searchText || 
            (p.name && p.name.toLowerCase().includes(searchText)) ||
            (p.barcode && p.barcode.toLowerCase().includes(searchText));

        // Kategori
        const matchesCategory = (selectedCategory === 'all') || (p.category === selectedCategory);

        // Kritik Stok
        const matchesCritical = !isCriticalFilterActive || (Number(p.stock_quantity) <= Number(p.min_stock));

        return matchesSearch && matchesCategory && matchesCritical;
    });

    renderProductsTable(filtered);
}

// Filtre Olay Dinleyicileri
if (productsSearchInput) {
    productsSearchInput.addEventListener('input', applyFiltersAndRender);
}
if (productsCategoryFilter) {
    productsCategoryFilter.addEventListener('change', applyFiltersAndRender);
}
if (productsCriticalFilterBtn) {
    productsCriticalFilterBtn.addEventListener('click', () => {
        isCriticalFilterActive = !isCriticalFilterActive;
        if (isCriticalFilterActive) {
            productsCriticalFilterBtn.classList.remove('btn-secondary');
            productsCriticalFilterBtn.classList.add('btn-danger');
            productsCriticalFilterBtn.innerHTML = `<i class="fa-solid fa-filter"></i> Kritik Stok Filtresi Aktif`;
        } else {
            productsCriticalFilterBtn.classList.remove('btn-danger');
            productsCriticalFilterBtn.classList.add('btn-secondary');
            productsCriticalFilterBtn.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="color: var(--accent-danger);"></i> Kritik Stoktakiler`;
        }
        applyFiltersAndRender();
    });
}

// ========================================================
// TABLO ÇİZİMİ
// ========================================================
function renderProductsTable(products) {
    if (!productsTableTbody) return;
    productsTableTbody.innerHTML = '';

    if (products.length === 0) {
        productsTableTbody.innerHTML = `
            <tr>
                <td colspan="9" class="empty-state">
                    <i class="fa-solid fa-boxes-stacked"></i>
                    <p>Kriterlere uygun ürün bulunamadı.</p>
                </td>
            </tr>
        `;
        return;
    }

    products.forEach(p => {
        const tr = document.createElement('tr');
        const isCritical = Number(p.stock_quantity) <= Number(p.min_stock);

        tr.innerHTML = `
            <td data-label="Barkod">
                <span class="mono-text" style="font-size: 0.82rem; color: var(--text-dim);">
                    ${p.barcode || '-'}
                </span>
            </td>
            <td data-label="Ürün Adı">
                <div style="font-weight: 700; color: var(--text-main);">${p.name}</div>
                ${p.notes ? `<div style="font-size: 0.76rem; color: var(--text-dim); margin-top: 2px;">${p.notes}</div>` : ''}
            </td>
            <td data-label="Kategori"><span class="badge badge-amber">${p.category}</span></td>
            <td data-label="Raf"><span style="font-size: 0.85rem; color: var(--text-muted);">${p.shelf_location || '-'}</span></td>
            <td data-label="Alış (₺)" class="mono-text">${formatCurrency(p.buy_price)}</td>
            <td data-label="Satış (₺)" class="mono-text" style="font-weight: 700; color: var(--accent-primary);">${formatCurrency(p.sell_price)}</td>
            <td data-label="Stok">
                <span class="mono-text" style="font-weight: 800; font-size: 0.95rem; color: ${isCritical ? 'var(--accent-danger)' : 'var(--accent-success)'};">
                    ${p.stock_quantity} ${p.unit}
                </span>
                ${isCritical ? '<i class="fa-solid fa-triangle-exclamation" style="color: var(--accent-danger); font-size: 0.8rem; margin-left: 4px;" title="Kritik Stok!"></i>' : ''}
            </td>
            <td data-label="Kritik" class="mono-text" style="color: var(--text-muted); font-size: 0.85rem;">
                ${p.min_stock} ${p.unit}
            </td>
            <td class="action-col">
                <div class="action-buttons">
                    <button class="btn-table-action stock-in" title="Hızlı Stok Ekle (Mal Kabul)" data-action="stock-in" data-id="${p.id}">
                        <i class="fa-solid fa-dolly"></i>
                    </button>
                    <button class="btn-table-action edit" title="Ürünü Düzenle" data-action="edit" data-id="${p.id}">
                        <i class="fa-solid fa-pen-to-square"></i>
                    </button>
                    <button class="btn-table-action delete" title="Ürünü Sil" data-action="delete" data-id="${p.id}">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </td>
        `;

        productsTableTbody.appendChild(tr);
    });

    // Tablo buton aksiyonları
    productsTableTbody.querySelectorAll('.btn-table-action').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const action = btn.getAttribute('data-action');
            const id = btn.getAttribute('data-id');
            const product = allProducts.find(p => p.id === id);

            if (!product) return;

            if (action === 'stock-in') {
                openStockInModal(product);
            } else if (action === 'edit') {
                openProductModal(product);
            } else if (action === 'delete') {
                confirmDeleteProduct(product);
            }
        });
    });
}

// ========================================================
// GÖRSEL SEÇİMİ, SIKIŞTIRMA & SUPABASE STORAGE YÜKLEME
// ========================================================
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // En fazla 5 MB

if (productImageFile) {
    productImageFile.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > MAX_IMAGE_SIZE) {
            showToast("Fotoğraf boyutu 5 MB'dan büyük olamaz! Lütfen daha küçük bir görsel seçin.", "error");
            productImageFile.value = '';
            return;
        }

        selectedImageFile = file;

        // Önizleme göster
        const reader = new FileReader();
        reader.onload = (event) => {
            if (productImagePreview) {
                productImagePreview.src = event.target.result;
                productImagePreview.style.display = 'block';
            }
            if (productImagePlaceholderIcon) productImagePlaceholderIcon.style.display = 'none';
            if (productImageRemoveBtn) productImageRemoveBtn.style.display = 'inline-block';
        };
        reader.readAsDataURL(file);
    });
}

if (productImageRemoveBtn) {
    productImageRemoveBtn.addEventListener('click', () => {
        selectedImageFile = null;
        if (productImageFile) productImageFile.value = '';
        if (productImageUrl) productImageUrl.value = '';
        if (productImagePreview) {
            productImagePreview.src = '';
            productImagePreview.style.display = 'none';
        }
        if (productImagePlaceholderIcon) productImagePlaceholderIcon.style.display = 'block';
        if (productImageRemoveBtn) productImageRemoveBtn.style.display = 'none';
    });
}

// Tarayıcı İçi Otomatik Görsel Sıkıştırma (800px genişlik ve ~80 KB'a optimize eder)
async function compressImage(file, maxWidth = 800, quality = 0.82) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                canvas.toBlob((blob) => {
                    resolve(blob || file);
                }, 'image/jpeg', quality);
            };
            img.onerror = () => resolve(file);
        };
        reader.onerror = () => resolve(file);
    });
}

// Supabase Storage'a Yükleme
async function uploadProductImage(file, prodId) {
    if (!supabase || !file) return null;

    try {
        const compressedBlob = await compressImage(file, 800, 0.82);
        const fileName = `${prodId || 'item'}_${Date.now()}.jpg`;
        const filePath = `catalog/${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from('product-images')
            .upload(filePath, compressedBlob, {
                cacheControl: '3600',
                upsert: true,
                contentType: 'image/jpeg'
            });

        if (uploadError) {
            console.warn("Storage yükleme uyarısı (Bucket yok veya RLS):", uploadError);
            return null;
        }

        const { data: { publicUrl } } = supabase.storage
            .from('product-images')
            .getPublicUrl(filePath);

        return publicUrl;
    } catch (err) {
        console.error("Görsel yüklenirken hata:", err);
        return null;
    }
}

// ========================================================
// YENİ ÜRÜN / DÜZENLEME MODAL İŞLEMLERİ
// ========================================================
function openProductModal(product = null) {
    if (!productModal) return;
    productForm.reset();
    selectedImageFile = null;
    if (productImageFile) productImageFile.value = '';

    if (product) {
        // Düzenleme modu
        productModalTitle.innerHTML = `<i class="fa-solid fa-pen-to-square" style="color: var(--accent-primary);"></i> Ürünü Düzenle`;
        productId.value = product.id;
        productBarcode.value = product.barcode || '';
        productCategory.value = product.category;
        productName.value = product.name;
        productUnit.value = product.unit || 'Adet';
        productShelf.value = product.shelf_location || '';
        productBuyPrice.value = product.buy_price || 0;
        productSellPrice.value = product.sell_price || 0;
        productStock.value = product.stock_quantity || 0;
        productMinStock.value = product.min_stock || 5;
        productNotes.value = product.notes || '';

        // Görsel önizlemesi
        if (product.image_url) {
            if (productImageUrl) productImageUrl.value = product.image_url;
            if (productImagePreview) {
                productImagePreview.src = product.image_url;
                productImagePreview.style.display = 'block';
            }
            if (productImagePlaceholderIcon) productImagePlaceholderIcon.style.display = 'none';
            if (productImageRemoveBtn) productImageRemoveBtn.style.display = 'inline-block';
        } else {
            if (productImageUrl) productImageUrl.value = '';
            if (productImagePreview) {
                productImagePreview.src = '';
                productImagePreview.style.display = 'none';
            }
            if (productImagePlaceholderIcon) productImagePlaceholderIcon.style.display = 'block';
            if (productImageRemoveBtn) productImageRemoveBtn.style.display = 'none';
        }
    } else {
        // Yeni ürün modu
        productModalTitle.innerHTML = `<i class="fa-solid fa-boxes-stacked" style="color: var(--accent-primary);"></i> Yeni Nalbur Ürünü`;
        productId.value = '';
        productStock.value = 0;
        productMinStock.value = 5;
        productBuyPrice.value = 0;
        if (productImageUrl) productImageUrl.value = '';
        if (productImagePreview) {
            productImagePreview.src = '';
            productImagePreview.style.display = 'none';
        }
        if (productImagePlaceholderIcon) productImagePlaceholderIcon.style.display = 'block';
        if (productImageRemoveBtn) productImageRemoveBtn.style.display = 'none';
    }

    productModal.classList.add('active');
}

function closeProductModal() {
    if (productModal) productModal.classList.remove('active');
    selectedImageFile = null;
}

if (btnOpenNewProduct) btnOpenNewProduct.addEventListener('click', () => openProductModal());
if (productModalClose) productModalClose.addEventListener('click', closeProductModal);
if (productCancelBtn) productCancelBtn.addEventListener('click', closeProductModal);

// Form Kaydet
if (productForm) {
    productForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = productId.value.trim();

        const payload = {
            barcode: productBarcode.value.trim() || null,
            category: productCategory.value,
            name: productName.value.trim(),
            unit: productUnit.value,
            shelf_location: productShelf.value.trim() || null,
            buy_price: parseFloat(productBuyPrice.value) || 0,
            sell_price: parseFloat(productSellPrice.value) || 0,
            stock_quantity: parseFloat(productStock.value) || 0,
            min_stock: parseFloat(productMinStock.value) || 5,
            notes: productNotes.value.trim() || null,
            updated_at: new Date().toISOString()
        };

        showLoader();
        try {
            let finalImageUrl = productImageUrl ? productImageUrl.value.trim() : null;

            // Yeni görsel dosyası seçildiyse Supabase Storage'a yükle
            if (selectedImageFile) {
                const uploadedUrl = await uploadProductImage(selectedImageFile, id);
                if (uploadedUrl) {
                    finalImageUrl = uploadedUrl;
                } else {
                    showToast("Görsel Storage'a yüklenemedi (Supabase'de 'product-images' bucket'ı oluşturulmalı), ürün görsel olmadan kaydediliyor.", "info");
                }
            }

            payload.image_url = finalImageUrl || null;

            if (id) {
                // Güncelleme
                const { error } = await supabase.from('products').update(payload).eq('id', id);
                if (error) throw error;
                showToast("Ürün başarıyla güncellendi.", "success");
            } else {
                // Yeni Kayıt
                const { error } = await supabase.from('products').insert([payload]);
                if (error) throw error;
                showToast("Yeni ürün stoğa eklendi.", "success");
            }

            closeProductModal();
            await fetchProducts();
        } catch (err) {
            console.error("Ürün kaydedilirken hata:", err);
            showToast(err.message || "Ürün kaydedilemedi.", "error");
        } finally {
            hideLoader();
        }
    });
}

// Ürün Silme
function confirmDeleteProduct(product) {
    showConfirmModal({
        title: "Ürün Silinecek",
        body: `"${product.name}" ürününü ve ilgili stok geçmişini kalıcı olarak silmek istediğinize emin misiniz?`,
        onConfirm: async () => {
            showLoader();
            try {
                const { error } = await supabase.from('products').delete().eq('id', product.id);
                if (error) throw error;
                showToast("Ürün sistemden silindi.", "success");
                await fetchProducts();
            } catch (err) {
                console.error("Silme hatası:", err);
                showToast("Ürün silinemedi: " + err.message, "error");
            } finally {
                hideLoader();
            }
        }
    });
}

// ========================================================
// HIZLI STOK GİRİŞİ (MAL KABUL) MODAL İŞLEMLERİ
// ========================================================
export function openStockInModal(product) {
    if (!stockInModal) return;
    stockInForm.reset();

    stockInProductId.value = product.id;
    stockInProductTitle.innerText = product.name;
    stockInCurrentQty.innerText = `${product.stock_quantity || 0} ${product.unit || 'Adet'}`;
    stockInUnit.innerText = product.unit || 'Adet';
    stockInPrice.value = product.buy_price || '';

    stockInModal.classList.add('active');
}

function closeStockInModal() {
    if (stockInModal) stockInModal.classList.remove('active');
}

if (stockInModalClose) stockInModalClose.addEventListener('click', closeStockInModal);
if (stockInCancelBtn) stockInCancelBtn.addEventListener('click', closeStockInModal);

if (stockInForm) {
    stockInForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const pId = stockInProductId.value;
        const addQty = parseFloat(stockInQty.value) || 0;
        const newBuyPrice = stockInPrice.value ? parseFloat(stockInPrice.value) : null;
        const note = stockInNote.value.trim() || 'Depo Mal Girişi';

        if (addQty <= 0) {
            showToast("Lütfen geçerli bir miktar girin.", "error");
            return;
        }

        const product = allProducts.find(p => p.id === pId);
        if (!product) return;

        showLoader();
        try {
            const newStockQty = (Number(product.stock_quantity) || 0) + addQty;
            const updateData = {
                stock_quantity: newStockQty,
                updated_at: new Date().toISOString()
            };
            if (newBuyPrice !== null && newBuyPrice >= 0) {
                updateData.buy_price = newBuyPrice;
            }

            // 1. Ürün stoğunu artır
            const { error: prodErr } = await supabase.from('products').update(updateData).eq('id', pId);
            if (prodErr) throw prodErr;

            // 2. Stok hareketini kaydet (IN)
            const movementPayload = {
                product_id: pId,
                movement_type: 'IN',
                quantity: addQty,
                unit_price: newBuyPrice || product.buy_price || 0,
                total_price: (newBuyPrice || product.buy_price || 0) * addQty,
                note: note
            };
            const { error: movErr } = await supabase.from('stock_movements').insert([movementPayload]);
            if (movErr) throw movErr;

            showToast(`${product.name} için +${addQty} ${product.unit} stok eklendi.`, "success");
            closeStockInModal();
            await fetchProducts();
        } catch (err) {
            console.error("Stok girişi hatası:", err);
            showToast("Stok eklenirken hata oluştu: " + err.message, "error");
        } finally {
            hideLoader();
        }
    });
}
