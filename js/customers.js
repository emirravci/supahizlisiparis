// ========================================================
// CARİ HESAP YÖNETİMİ (MÜŞTERİ & TEDARİKÇİ) MODÜLÜ
// ========================================================

import { supabase, showLoader, hideLoader, showToast, showConfirmModal, showView, formatCurrency } from './supabase.js';

// DOM Elemanları - Tablo & Filtreler
const customersTableTbody = document.getElementById('customers-table-tbody');
const customersSearchInput = document.getElementById('customers-search-input');
const customersTypeFilter = document.getElementById('customers-type-filter');
const btnOpenNewCustomer = document.getElementById('btn-open-new-customer');

// DOM Elemanları - Cari Modalı
const customerModal = document.getElementById('customer-modal');
const customerModalTitle = document.getElementById('customer-modal-title');
const customerModalClose = document.getElementById('customer-modal-close');
const customerCancelBtn = document.getElementById('customer-cancel-btn');
const customerForm = document.getElementById('customer-form');
const customerId = document.getElementById('customer-id');
const customerType = document.getElementById('customer-type');
const customerName = document.getElementById('customer-name');
const customerPhone = document.getElementById('customer-phone');
const customerEmail = document.getElementById('customer-email');
const customerCity = document.getElementById('customer-city');
const customerBalance = document.getElementById('customer-balance');
const customerTaxOffice = document.getElementById('customer-tax-office');
const customerTaxNumber = document.getElementById('customer-tax-number');
const customerAddress = document.getElementById('customer-address');
const customerNotes = document.getElementById('customer-notes');

// Durum (State)
let allCustomers = [];

// Sayfa Yüklendiğinde Dinle
document.addEventListener('view-customers-loaded', async () => {
    await fetchCustomers();
});

// ========================================================
// CARİLERİ GETİR & FİLTRELE
// ========================================================
export async function fetchCustomers() {
    if (!supabase) return;
    showLoader();
    try {
        const { data, error } = await supabase
            .from('customers')
            .select('*')
            .order('name', { ascending: true });

        if (error) throw error;
        allCustomers = data || [];
        filterAndRenderCustomers();
    } catch (err) {
        console.error("Cariler yüklenirken hata:", err);
        showToast("Cari hesaplar listelenemedi.", "error");
    } finally {
        hideLoader();
    }
}

function filterAndRenderCustomers() {
    const searchText = (customersSearchInput ? customersSearchInput.value : '').toLowerCase().trim();
    const selectedType = customersTypeFilter ? customersTypeFilter.value : 'all';

    const filtered = allCustomers.filter(c => {
        const matchesSearch = !searchText ||
            (c.name && c.name.toLowerCase().includes(searchText)) ||
            (c.phone && c.phone.toLowerCase().includes(searchText)) ||
            (c.city && c.city.toLowerCase().includes(searchText));

        const matchesType = (selectedType === 'all') || (c.type === selectedType);

        return matchesSearch && matchesType;
    });

    renderCustomersTable(filtered);
}

if (customersSearchInput) customersSearchInput.addEventListener('input', filterAndRenderCustomers);
if (customersTypeFilter) customersTypeFilter.addEventListener('change', filterAndRenderCustomers);

// ========================================================
// TABLO ÇİZİMİ
// ========================================================
function renderCustomersTable(customers) {
    if (!customersTableTbody) return;
    customersTableTbody.innerHTML = '';

    if (customers.length === 0) {
        customersTableTbody.innerHTML = `
            <tr>
                <td colspan="7" class="empty-state">
                    <i class="fa-solid fa-address-book"></i>
                    <p>Kayıtlı cari hesap bulunamadı.</p>
                </td>
            </tr>
        `;
        return;
    }

    customers.forEach(c => {
        const tr = document.createElement('tr');
        const isCustomer = c.type === 'CUSTOMER';
        const typeBadge = isCustomer
            ? '<span class="badge badge-blue"><i class="fa-solid fa-user"></i> Müşteri</span>'
            : '<span class="badge badge-amber"><i class="fa-solid fa-truck"></i> Tedarikçi</span>';

        const bal = Number(c.balance) || 0;
        let balBadge = '<span class="mono-text" style="color: var(--text-dim);">0,00 ₺ (Kapalı)</span>';
        if (bal > 0) {
            balBadge = `<span class="mono-text" style="color: var(--accent-success); font-weight: 700;">+${formatCurrency(bal)} (Alacak)</span>`;
        } else if (bal < 0) {
            balBadge = `<span class="mono-text" style="color: var(--accent-danger); font-weight: 700;">${formatCurrency(bal)} (Borç)</span>`;
        }

        tr.innerHTML = `
            <td>
                <div style="font-weight: 700; color: var(--text-main);">${c.name}</div>
                ${c.address ? `<div style="font-size: 0.76rem; color: var(--text-dim); margin-top: 2px;">${c.address}</div>` : ''}
            </td>
            <td>${typeBadge}</td>
            <td>
                ${c.phone ? `<a href="tel:${c.phone}" style="color: var(--accent-primary); font-weight: 600;"><i class="fa-solid fa-phone" style="font-size: 0.75rem;"></i> ${c.phone}</a>` : '-'}
            </td>
            <td><span style="font-size: 0.85rem; color: var(--text-muted);">${c.city || '-'}</span></td>
            <td>
                <div style="font-size: 0.82rem; color: var(--text-muted);">${c.tax_office || '-'}</div>
                <div class="mono-text" style="font-size: 0.75rem; color: var(--text-dim);">${c.tax_number || ''}</div>
            </td>
            <td>${balBadge}</td>
            <td>
                <div class="action-buttons">
                    ${isCustomer ? `
                    <button class="btn-table-action" title="Hızlı Teklif / Sipariş Oluştur" data-action="new-proposal" data-id="${c.id}" style="color: var(--accent-primary);">
                        <i class="fa-solid fa-file-invoice-dollar"></i>
                    </button>` : ''}
                    <button class="btn-table-action edit" title="Cariyi Düzenle" data-action="edit" data-id="${c.id}">
                        <i class="fa-solid fa-pen-to-square"></i>
                    </button>
                    <button class="btn-table-action delete" title="Cariyi Sil" data-action="delete" data-id="${c.id}">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </td>
        `;

        customersTableTbody.appendChild(tr);
    });

    // Buton Dinleyicileri
    customersTableTbody.querySelectorAll('.btn-table-action').forEach(btn => {
        btn.addEventListener('click', () => {
            const action = btn.getAttribute('data-action');
            const id = btn.getAttribute('data-id');
            const customer = allCustomers.find(c => c.id === id);
            if (!customer) return;

            if (action === 'edit') {
                openCustomerModal(customer);
            } else if (action === 'delete') {
                confirmDeleteCustomer(customer);
            } else if (action === 'new-proposal') {
                // Teklif modülüne yönlendir ve bu müşteriyi seç
                showView('proposals', { selectedCustomerId: customer.id });
            }
        });
    });
}

// ========================================================
// CARİ EKLE / DÜZENLE MODALI
// ========================================================
export function openCustomerModal(customer = null) {
    if (!customerModal) return;
    customerForm.reset();

    if (customer) {
        customerModalTitle.innerHTML = `<i class="fa-solid fa-pen-to-square" style="color: var(--accent-primary);"></i> Cariyi Düzenle`;
        customerId.value = customer.id;
        customerType.value = customer.type || 'CUSTOMER';
        customerName.value = customer.name;
        customerPhone.value = customer.phone || '';
        customerEmail.value = customer.email || '';
        customerCity.value = customer.city || '';
        customerBalance.value = customer.balance || 0;
        customerTaxOffice.value = customer.tax_office || '';
        customerTaxNumber.value = customer.tax_number || '';
        customerAddress.value = customer.address || '';
        customerNotes.value = customer.notes || '';
    } else {
        customerModalTitle.innerHTML = `<i class="fa-solid fa-address-book" style="color: var(--accent-primary);"></i> Yeni Cari Tanımı`;
        customerId.value = '';
        customerType.value = 'CUSTOMER';
        customerBalance.value = 0;
    }

    customerModal.classList.add('active');
}

function closeCustomerModal() {
    if (customerModal) customerModal.classList.remove('active');
}

if (btnOpenNewCustomer) btnOpenNewCustomer.addEventListener('click', () => openCustomerModal());
if (customerModalClose) customerModalClose.addEventListener('click', closeCustomerModal);
if (customerCancelBtn) customerCancelBtn.addEventListener('click', closeCustomerModal);

if (customerForm) {
    customerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = customerId.value.trim();

        const payload = {
            type: customerType.value,
            name: customerName.value.trim(),
            phone: customerPhone.value.trim() || null,
            email: customerEmail.value.trim() || null,
            city: customerCity.value.trim() || null,
            balance: parseFloat(customerBalance.value) || 0,
            tax_office: customerTaxOffice.value.trim() || null,
            tax_number: customerTaxNumber.value.trim() || null,
            address: customerAddress.value.trim() || null,
            notes: customerNotes.value.trim() || null
        };

        showLoader();
        try {
            if (id) {
                const { error } = await supabase.from('customers').update(payload).eq('id', id);
                if (error) throw error;
                showToast("Cari hesap bilgileri güncellendi.", "success");
            } else {
                const { error } = await supabase.from('customers').insert([payload]);
                if (error) throw error;
                showToast("Yeni cari hesap başarıyla oluşturuldu.", "success");
            }

            closeCustomerModal();
            await fetchCustomers();
        } catch (err) {
            console.error("Cari kaydedilirken hata:", err);
            showToast(err.message || "Cari kaydedilemedi.", "error");
        } finally {
            hideLoader();
        }
    });
}

function confirmDeleteCustomer(customer) {
    showConfirmModal({
        title: "Cari Hesap Silinecek",
        body: `"${customer.name}" adlı cariyi silmek istediğinize emin misiniz?`,
        onConfirm: async () => {
            showLoader();
            try {
                const { error } = await supabase.from('customers').delete().eq('id', customer.id);
                if (error) throw error;
                showToast("Cari hesap silindi.", "success");
                await fetchCustomers();
            } catch (err) {
                console.error("Cari silinemedi:", err);
                showToast("Cari silinemedi: " + err.message, "error");
            } finally {
                hideLoader();
            }
        }
    });
}
