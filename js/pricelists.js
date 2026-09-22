// ========================================================
// ÇOKLU FİYAT LİSTELERİ VE TARİFELER MODÜLÜ
// ========================================================

import { supabase, showLoader, hideLoader, showToast, showConfirmModal, formatCurrency, formatDateOnly } from './supabase.js';

// DOM Elemanları - Tablo & Filtreler
const pricelistsTableTbody = document.getElementById('pricelists-table-tbody');
const pricelistsSearchInput = document.getElementById('pricelists-search-input');
const btnOpenNewPricelist = document.getElementById('btn-open-new-pricelist');

// DOM Elemanları - Liste Modalı
const pricelistModal = document.getElementById('pricelist-modal');
const pricelistModalTitle = document.getElementById('pricelist-modal-title');
const pricelistModalClose = document.getElementById('pricelist-modal-close');
const pricelistCancelBtn = document.getElementById('pricelist-cancel-btn');
const pricelistForm = document.getElementById('pricelist-form');
const pricelistId = document.getElementById('pricelist-id');
const pricelistName = document.getElementById('pricelist-name');
const pricelistCode = document.getElementById('pricelist-code');
const pricelistValidFrom = document.getElementById('pricelist-valid-from');
const pricelistValidUntil = document.getElementById('pricelist-valid-until');
const pricelistDesc = document.getElementById('pricelist-desc');

// DOM Elemanları - Liste Kalemleri Yönetim Modalı
const pricelistItemsModal = document.getElementById('pricelist-items-modal');
const pricelistItemsTitle = document.getElementById('pricelist-items-title');
const pricelistItemsModalClose = document.getElementById('pricelist-items-modal-close');
const pricelistItemsCloseBtn = document.getElementById('pricelist-items-close-btn');
const activePricelistId = document.getElementById('active-pricelist-id');
const plItemProductSelect = document.getElementById('pl-item-product-select');
const plItemStdPrice = document.getElementById('pl-item-std-price');
const plItemCustomPrice = document.getElementById('pl-item-custom-price');
const plItemMinQty = document.getElementById('pl-item-min-qty');
const plItemSaveBtn = document.getElementById('pl-item-save-btn');
const pricelistItemsTbody = document.getElementById('pricelist-items-tbody');

// Durum (State)
let allPriceLists = [];
let allProducts = [];
let activeListItems = [];
let currentManagingList = null;

// Sayfa Yüklendiğinde Dinle
document.addEventListener('view-pricelists-loaded', async () => {
    await Promise.all([fetchPriceLists(), fetchAllProducts()]);
});

// ========================================================
// VERİLERİ GETİRME
// ========================================================
async function fetchAllProducts() {
    if (!supabase) return;
    try {
        const { data, error } = await supabase
            .from('products')
            .select('id, name, unit, sell_price, category')
            .order('name', { ascending: true });
        if (error) throw error;
        allProducts = data || [];
        populatePlProductSelect();
    } catch (err) {
        console.error("Fiyat listesi için ürünler yüklenemedi:", err);
    }
}

function populatePlProductSelect() {
    if (!plItemProductSelect) return;
    plItemProductSelect.innerHTML = '<option value="">-- Ürün Seçin --</option>';
    allProducts.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = `${p.name} (${formatCurrency(p.sell_price)})`;
        opt.dataset.price = p.sell_price;
        opt.dataset.unit = p.unit;
        plItemProductSelect.appendChild(opt);
    });
}

// Ürün seçildiğinde standart fiyatı göster
if (plItemProductSelect) {
    plItemProductSelect.addEventListener('change', () => {
        const selected = plItemProductSelect.options[plItemProductSelect.selectedIndex];
        if (selected && selected.dataset.price) {
            plItemStdPrice.value = formatCurrency(selected.dataset.price);
            // Varsayılan olarak özel fiyata standart fiyatı getir (kullanıcı hızlı düzenlesin)
            if (!plItemCustomPrice.value) {
                plItemCustomPrice.value = selected.dataset.price;
            }
        } else {
            plItemStdPrice.value = '';
            plItemCustomPrice.value = '';
        }
    });
}

export async function fetchPriceLists() {
    if (!supabase) return;
    showLoader();
    try {
        const { data, error } = await supabase
            .from('price_lists')
            .select('*, price_list_items(id)')
            .order('name', { ascending: true });

        if (error) throw error;
        allPriceLists = data || [];
        filterAndRenderPriceLists();
    } catch (err) {
        console.error("Fiyat listeleri yüklenirken hata:", err);
        showToast("Fiyat listeleri yüklenemedi.", "error");
    } finally {
        hideLoader();
    }
}

function filterAndRenderPriceLists() {
    const search = (pricelistsSearchInput ? pricelistsSearchInput.value : '').toLowerCase().trim();

    const filtered = allPriceLists.filter(pl => {
        return !search ||
            (pl.name && pl.name.toLowerCase().includes(search)) ||
            (pl.code && pl.code.toLowerCase().includes(search));
    });

    renderPriceListsTable(filtered);
}

if (pricelistsSearchInput) pricelistsSearchInput.addEventListener('input', filterAndRenderPriceLists);

// ========================================================
// TABLO ÇİZİMİ
// ========================================================
function renderPriceListsTable(priceLists) {
    if (!pricelistsTableTbody) return;
    pricelistsTableTbody.innerHTML = '';

    if (priceLists.length === 0) {
        pricelistsTableTbody.innerHTML = `
            <tr>
                <td colspan="7" class="empty-state">
                    <i class="fa-solid fa-tags"></i>
                    <p>Henüz kayıtlı bir fiyat listesi yok. "Yeni Fiyat Listesi Oluştur" butonuna tıklayın.</p>
                </td>
            </tr>
        `;
        return;
    }

    priceLists.forEach(pl => {
        const tr = document.createElement('tr');
        const itemCount = pl.price_list_items ? pl.price_list_items.length : 0;

        let validText = '-';
        if (pl.valid_from && pl.valid_until) {
            validText = `${formatDateOnly(pl.valid_from)} - ${formatDateOnly(pl.valid_until)}`;
        } else if (pl.valid_until) {
            validText = `Son: ${formatDateOnly(pl.valid_until)}`;
        } else if (pl.valid_from) {
            validText = `Başlangıç: ${formatDateOnly(pl.valid_from)}`;
        } else {
            validText = 'Sürekli Geçerli';
        }

        const statusBadge = pl.is_active
            ? '<span class="badge badge-green"><i class="fa-solid fa-check"></i> Aktif</span>'
            : '<span class="badge badge-red"><i class="fa-solid fa-xmark"></i> Pasif</span>';

        tr.innerHTML = `
            <td>
                <div style="font-weight: 700; color: var(--text-main);">${pl.name}</div>
            </td>
            <td>
                <span class="badge badge-amber mono-text">${pl.code || 'ÖZEL'}</span>
            </td>
            <td>
                <span class="mono-text" style="font-weight: 700; color: var(--accent-primary);">
                    ${itemCount} Ürün
                </span>
            </td>
            <td style="font-size: 0.85rem; color: var(--text-muted);">${validText}</td>
            <td style="font-size: 0.85rem; color: var(--text-dim);">${pl.description || '-'}</td>
            <td>${statusBadge}</td>
            <td>
                <div class="action-buttons">
                    <button class="btn btn-sm btn-primary" data-action="manage-items" data-id="${pl.id}" style="height: 32px; padding: 0 10px; font-size: 0.8rem;">
                        <i class="fa-solid fa-list-check"></i> Fiyatları Belirle
                    </button>
                    <button class="btn-table-action edit" title="Listeyi Düzenle" data-action="edit" data-id="${pl.id}">
                        <i class="fa-solid fa-pen-to-square"></i>
                    </button>
                    <button class="btn-table-action delete" title="Listeyi Sil" data-action="delete" data-id="${pl.id}">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </td>
        `;

        pricelistsTableTbody.appendChild(tr);
    });

    // Buton Dinleyicileri
    pricelistsTableTbody.querySelectorAll('button[data-action]').forEach(btn => {
        btn.addEventListener('click', () => {
            const action = btn.getAttribute('data-action');
            const id = btn.getAttribute('data-id');
            const pl = allPriceLists.find(item => item.id === id);
            if (!pl) return;

            if (action === 'manage-items') {
                openPriceListItemsModal(pl);
            } else if (action === 'edit') {
                openPricelistModal(pl);
            } else if (action === 'delete') {
                confirmDeletePriceList(pl);
            }
        });
    });
}

// ========================================================
// FİYAT LİSTESİ OLUŞTURMA / DÜZENLEME MODALI
// ========================================================
export function openPricelistModal(pl = null) {
    if (!pricelistModal) return;
    pricelistForm.reset();

    if (pl) {
        pricelistModalTitle.innerHTML = `<i class="fa-solid fa-pen-to-square" style="color: var(--accent-primary);"></i> Fiyat Listesini Düzenle`;
        pricelistId.value = pl.id;
        pricelistName.value = pl.name;
        pricelistCode.value = pl.code || '';
        pricelistValidFrom.value = pl.valid_from || '';
        pricelistValidUntil.value = pl.valid_until || '';
        pricelistDesc.value = pl.description || '';
    } else {
        pricelistModalTitle.innerHTML = `<i class="fa-solid fa-tags" style="color: var(--accent-primary);"></i> Yeni Fiyat Listesi`;
        pricelistId.value = '';
    }

    pricelistModal.classList.add('active');
}

function closePricelistModal() {
    if (pricelistModal) pricelistModal.classList.remove('active');
}

if (btnOpenNewPricelist) btnOpenNewPricelist.addEventListener('click', () => openPricelistModal());
if (pricelistModalClose) pricelistModalClose.addEventListener('click', closePricelistModal);
if (pricelistCancelBtn) pricelistCancelBtn.addEventListener('click', closePricelistModal);

if (pricelistForm) {
    pricelistForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = pricelistId.value.trim();

        const payload = {
            name: pricelistName.value.trim(),
            code: pricelistCode.value.trim() ? pricelistCode.value.trim().toUpperCase() : null,
            valid_from: pricelistValidFrom.value || null,
            valid_until: pricelistValidUntil.value || null,
            description: pricelistDesc.value.trim() || null
        };

        showLoader();
        try {
            if (id) {
                const { error } = await supabase.from('price_lists').update(payload).eq('id', id);
                if (error) throw error;
                showToast("Fiyat listesi güncellendi.", "success");
            } else {
                const { error } = await supabase.from('price_lists').insert([payload]);
                if (error) throw error;
                showToast("Yeni fiyat listesi oluşturuldu.", "success");
            }

            closePricelistModal();
            await fetchPriceLists();
        } catch (err) {
            console.error("Fiyat listesi kaydedilemedi:", err);
            showToast(err.message || "Kaydedilemedi.", "error");
        } finally {
            hideLoader();
        }
    });
}

function confirmDeletePriceList(pl) {
    showConfirmModal({
        title: "Fiyat Listesini Sil",
        body: `"${pl.name}" fiyat listesini ve içindeki özel fiyat tanımlarını silmek istediğinize emin misiniz?`,
        onConfirm: async () => {
            showLoader();
            try {
                const { error } = await supabase.from('price_lists').delete().eq('id', pl.id);
                if (error) throw error;
                showToast("Fiyat listesi silindi.", "success");
                await fetchPriceLists();
            } catch (err) {
                console.error("Fiyat listesi silinemedi:", err);
                showToast("Silinemedi: " + err.message, "error");
            } finally {
                hideLoader();
            }
        }
    });
}

// ========================================================
// FİYAT LİSTESİ ÜRÜNLERİNİ YÖNETME MODALI
// ========================================================
export async function openPriceListItemsModal(priceList) {
    if (!pricelistItemsModal) return;
    currentManagingList = priceList;
    activePricelistId.value = priceList.id;

    if (pricelistItemsTitle) {
        pricelistItemsTitle.innerHTML = `<i class="fa-solid fa-tags" style="color: var(--accent-primary);"></i> ${priceList.name} - Özel Fiyatlar`;
    }

    // Formu sıfırla
    if (plItemProductSelect) plItemProductSelect.value = '';
    if (plItemStdPrice) plItemStdPrice.value = '';
    if (plItemCustomPrice) plItemCustomPrice.value = '';
    if (plItemMinQty) plItemMinQty.value = '1';

    pricelistItemsModal.classList.add('active');
    await loadPriceListItems(priceList.id);
}

function closePriceListItemsModal() {
    if (pricelistItemsModal) pricelistItemsModal.classList.remove('active');
    currentManagingList = null;
    activeListItems = [];
    fetchPriceLists(); // Ürün sayılarını yenile
}

if (pricelistItemsModalClose) pricelistItemsModalClose.addEventListener('click', closePriceListItemsModal);
if (pricelistItemsCloseBtn) pricelistItemsCloseBtn.addEventListener('click', closePriceListItemsModal);

async function loadPriceListItems(listId) {
    showLoader();
    try {
        const { data, error } = await supabase
            .from('price_list_items')
            .select('*, products(name, sell_price, unit, category)')
            .eq('price_list_id', listId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        activeListItems = data || [];
        renderPriceListItems();
    } catch (err) {
        console.error("Liste kalemleri yüklenemedi:", err);
        showToast("Liste ürünleri yüklenemedi.", "error");
    } finally {
        hideLoader();
    }
}

function renderPriceListItems() {
    if (!pricelistItemsTbody) return;
    pricelistItemsTbody.innerHTML = '';

    if (activeListItems.length === 0) {
        pricelistItemsTbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; color: var(--text-dim); padding: 1.5rem;">
                    Bu listeye henüz özel ürün fiyatı tanımlanmadı. Yukarıdan ürün seçip özel fiyatını ekleyin.
                </td>
            </tr>
        `;
        return;
    }

    activeListItems.forEach(item => {
        const p = item.products || {};
        const stdPrice = Number(p.sell_price) || 0;
        const customPrice = Number(item.price) || 0;
        const diff = stdPrice - customPrice;
        const diffPercent = stdPrice > 0 ? Math.round((diff / stdPrice) * 100) : 0;

        let diffBadge = '';
        if (diff > 0) {
            diffBadge = `<span class="badge badge-green">-%${diffPercent} İndirimli</span>`;
        } else if (diff < 0) {
            diffBadge = `<span class="badge badge-amber">+%${Math.abs(diffPercent)} Fark</span>`;
        } else {
            diffBadge = `<span class="badge badge-blue">Aynı Fiyat</span>`;
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <div style="font-weight: 700;">${p.name || 'Bilinmeyen Ürün'}</div>
                <div style="font-size: 0.75rem; color: var(--text-dim);">${p.category || ''}</div>
            </td>
            <td><span class="mono-text price-old-striked">${formatCurrency(stdPrice)}</span></td>
            <td>
                <span class="mono-text" style="font-weight: 800; font-size: 1rem; color: var(--accent-primary);">
                    ${formatCurrency(customPrice)}
                </span>
                <span style="font-size: 0.78rem; color: var(--text-dim);">/ ${p.unit || 'Adet'}</span>
            </td>
            <td>${diffBadge}</td>
            <td class="mono-text">${item.min_quantity} ${p.unit || 'Adet'}</td>
            <td style="text-align: right;">
                <button class="btn-table-action delete" title="Listeden Çıkar" data-id="${item.id}">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </td>
        `;

        tr.querySelector('.delete').addEventListener('click', async () => {
            await deletePriceListItem(item.id);
        });

        pricelistItemsTbody.appendChild(tr);
    });
}

// Kalem Kaydet
if (plItemSaveBtn) {
    plItemSaveBtn.addEventListener('click', async () => {
        const listId = activePricelistId.value;
        const prodId = plItemProductSelect.value;
        const customPrice = parseFloat(plItemCustomPrice.value);
        const minQty = parseFloat(plItemMinQty.value) || 1;

        if (!listId) return;
        if (!prodId) {
            showToast("Lütfen bir ürün seçin.", "error");
            return;
        }
        if (isNaN(customPrice) || customPrice < 0) {
            showToast("Lütfen geçerli bir özel fiyat girin.", "error");
            return;
        }

        showLoader();
        try {
            // Upsert (varsa güncelle, yoksa ekle)
            const { error } = await supabase.from('price_list_items').upsert({
                price_list_id: listId,
                product_id: prodId,
                price: customPrice,
                min_quantity: minQty
            }, { onConflict: 'price_list_id,product_id' });

            if (error) throw error;
            showToast("Ürün özel fiyatı listeye tanımlandı!", "success");

            // Sıfırla ve yeniden çek
            plItemProductSelect.value = '';
            plItemStdPrice.value = '';
            plItemCustomPrice.value = '';
            plItemMinQty.value = '1';

            await loadPriceListItems(listId);
        } catch (err) {
            console.error("Özel fiyat kaydedilemedi:", err);
            showToast("Hata: " + err.message, "error");
        } finally {
            hideLoader();
        }
    });
}

async function deletePriceListItem(itemId) {
    showLoader();
    try {
        const { error } = await supabase.from('price_list_items').delete().eq('id', itemId);
        if (error) throw error;
        showToast("Ürün listeden çıkarıldı.", "info");
        await loadPriceListItems(activePricelistId.value);
    } catch (err) {
        console.error("Kalem silinemedi:", err);
        showToast("Silinemedi: " + err.message, "error");
    } finally {
        hideLoader();
    }
}
