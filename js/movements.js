// ========================================================
// STOK HAREKETLERİ VE GEÇMİŞ MODÜLÜ
// ========================================================

import { supabase, showLoader, hideLoader, showToast, formatCurrency, formatDateTime, showConfirmModal } from './supabase.js';

// DOM Elemanları
const movementsTableTbody = document.getElementById('movements-table-tbody');
const movementsTypeFilter = document.getElementById('movements-type-filter');

// Durum (State)
let allMovements = [];

// Sayfa Yüklendiğinde Dinle
document.addEventListener('view-movements-loaded', async () => {
    await fetchMovements();
});

// Stok hareketi kaydedildiğinde yenile
document.addEventListener('movement-saved', async () => {
    await fetchMovements();
});

export async function fetchMovements() {
    if (!supabase) return;
    showLoader();
    try {
        const { data, error } = await supabase
            .from('stock_movements')
            .select('*, products(name, category, unit, barcode)')
            .order('created_at', { ascending: false })
            .limit(100);

        if (error) throw error;
        allMovements = data || [];
        filterAndRenderMovements();
    } catch (err) {
        console.error("Stok hareketleri yüklenirken hata:", err);
        showToast("Hareket kayıtları yüklenemedi.", "error");
    } finally {
        hideLoader();
    }
}

function filterAndRenderMovements() {
    const selectedType = movementsTypeFilter ? movementsTypeFilter.value : 'all';

    const filtered = allMovements.filter(m => {
        if (selectedType === 'all') return true;
        return m.movement_type === selectedType;
    });

    renderMovementsTable(filtered);
}

if (movementsTypeFilter) {
    movementsTypeFilter.addEventListener('change', filterAndRenderMovements);
}

function renderMovementsTable(movements) {
    if (!movementsTableTbody) return;
    movementsTableTbody.innerHTML = '';

    if (movements.length === 0) {
        movementsTableTbody.innerHTML = `
            <tr>
                <td colspan="9" class="empty-state">
                    <i class="fa-solid fa-clock-rotate-left"></i>
                    <p>Seçili filtreye uygun stok hareketi bulunamadı.</p>
                </td>
            </tr>
        `;
        return;
    }

    movements.forEach(m => {
        const pName = m.products ? m.products.name : 'Silinmiş Ürün';
        const pCat = m.products ? m.products.category : '-';
        const pUnit = m.products ? m.products.unit : 'Adet';

        let badge = '';
        let sign = '';
        let qtyColor = '';

        if (m.movement_type === 'IN') {
            badge = '<span class="badge badge-green"><i class="fa-solid fa-arrow-down"></i> Stok Girişi</span>';
            sign = '+';
            qtyColor = 'var(--accent-success)';
        } else if (m.movement_type === 'OUT') {
            badge = '<span class="badge badge-amber"><i class="fa-solid fa-arrow-up"></i> Tezgah Satışı</span>';
            sign = '-';
            qtyColor = 'var(--accent-primary)';
        } else if (m.movement_type === 'WASTE') {
            badge = '<span class="badge badge-red"><i class="fa-solid fa-ban"></i> Fire / Zayi</span>';
            sign = '-';
            qtyColor = 'var(--accent-danger)';
        } else {
            badge = '<span class="badge badge-blue"><i class="fa-solid fa-sliders"></i> Düzeltme</span>';
            sign = '';
            qtyColor = 'var(--accent-info)';
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td data-label="Tarih" style="font-size: 0.82rem; color: var(--text-muted);">${formatDateTime(m.created_at)}</td>
            <td data-label="Ürün">
                <div style="font-weight: 700; color: var(--text-main);">${pName}</div>
                ${m.products && m.products.barcode ? `<span class="mono-text" style="font-size: 0.72rem; color: var(--text-dim);">${m.products.barcode}</span>` : ''}
            </td>
            <td data-label="Kategori"><span class="badge badge-amber">${pCat}</span></td>
            <td data-label="Tür">${badge}</td>
            <td data-label="Miktar">
                <span class="mono-text" style="font-weight: 800; font-size: 0.95rem; color: ${qtyColor};">
                    ${sign}${m.quantity} ${pUnit}
                </span>
            </td>
            <td data-label="Birim Fiyat" class="mono-text" style="color: var(--text-muted);">${m.unit_price ? formatCurrency(m.unit_price) : '-'}</td>
            <td data-label="Toplam" class="mono-text" style="font-weight: 700;">${m.total_price ? formatCurrency(m.total_price) : '-'}</td>
            <td data-label="Not" style="font-size: 0.85rem; color: var(--text-dim);">${m.note || '-'}</td>
            <td>
                <button class="btn-table-action delete btn-delete-movement" title="Bu Stok Hareketini Sil" data-id="${m.id}">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </td>
        `;

        const delBtn = tr.querySelector('.btn-delete-movement');
        if (delBtn) {
            delBtn.addEventListener('click', () => confirmDeleteMovement(m));
        }

        movementsTableTbody.appendChild(tr);
    });
}

function confirmDeleteMovement(m) {
    const pName = m.products ? m.products.name : 'Ürün';
    const isReversible = (m.movement_type === 'IN' || m.movement_type === 'OUT' || m.movement_type === 'WASTE') && m.product_id;
    let extraNote = '';
    if (isReversible) {
        if (m.movement_type === 'OUT' || m.movement_type === 'WASTE') {
            extraNote = ` Çıkış kaydı silindiği için ${pName} stoğuna +${m.quantity} adet geri iade edilecektir.`;
        } else if (m.movement_type === 'IN') {
            extraNote = ` Giriş kaydı silindiği için ${pName} stoğundan -${m.quantity} adet düşülecektir.`;
        }
    }

    showConfirmModal({
        title: "Stok Hareketini Sil",
        body: `Bu stok hareket kaydını silmek istediğinize emin misiniz?${extraNote}`,
        onConfirm: async () => {
            showLoader();
            try {
                if (isReversible) {
                    const { data: prod, error: pErr } = await supabase
                        .from('products')
                        .select('id, stock_quantity')
                        .eq('id', m.product_id)
                        .maybeSingle();

                    if (!pErr && prod) {
                        const curQty = Number(prod.stock_quantity || 0);
                        const moveQty = Number(m.quantity || 0);
                        let nextQty = curQty;
                        if (m.movement_type === 'OUT' || m.movement_type === 'WASTE') {
                            nextQty = curQty + moveQty;
                        } else if (m.movement_type === 'IN') {
                            nextQty = Math.max(0, curQty - moveQty);
                        }
                        await supabase
                            .from('products')
                            .update({ stock_quantity: nextQty })
                            .eq('id', m.product_id);
                    }
                }

                const { error: delErr } = await supabase
                    .from('stock_movements')
                    .delete()
                    .eq('id', m.id);

                if (delErr) throw delErr;

                showToast("Stok hareketi başarıyla silindi.", "success");
                document.dispatchEvent(new CustomEvent('movement-saved'));
                document.dispatchEvent(new CustomEvent('product-saved'));
                await fetchMovements();
            } catch (err) {
                console.error("Stok hareketi silinemedi:", err);
                showToast("Hareket silinirken bir hata oluştu: " + (err.message || ''), "error");
            } finally {
                hideLoader();
            }
        }
    });
}
