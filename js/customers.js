// ========================================================
// CARİ HESAP YÖNETİMİ (MÜŞTERİ & TEDARİKÇİ) MODÜLÜ
// ========================================================

import { supabase, showLoader, hideLoader, showToast, showConfirmModal, showView, formatCurrency, formatDateTime } from './supabase.js';

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
                    <button class="btn-table-action" title="Cari Ekstresi & Hareketler" data-action="ledger" data-id="${c.id}" style="color: #6366f1;">
                        <i class="fa-solid fa-file-invoice"></i>
                    </button>
                    <button class="btn-table-action" title="Tahsilat / Ödeme Girişi" data-action="pay" data-id="${c.id}" style="color: var(--accent-success);">
                        <i class="fa-solid fa-hand-holding-dollar"></i>
                    </button>
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

            if (action === 'ledger') {
                openCustomerLedgerModal(customer);
            } else if (action === 'pay') {
                const defaultType = customer.type === 'CUSTOMER' ? 'COLLECTION' : 'PAYMENT';
                openTransactionModal(defaultType, customer.id);
            } else if (action === 'edit') {
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

// ========================================================
// TAHSİLAT / ÖDEME / DÜKKAN GİDERİ YÖNETİMİ
// ========================================================
const transactionModal = document.getElementById('transaction-modal');
const transactionModalTitle = document.getElementById('transaction-modal-title');
const transactionModalClose = document.getElementById('transaction-modal-close');
const transCancelBtn = document.getElementById('trans-cancel-btn');
const transactionForm = document.getElementById('transaction-form');
const transType = document.getElementById('trans-type');
const transCustomerGroup = document.getElementById('trans-customer-group');
const transCustomerId = document.getElementById('trans-customer-id');
const transExpenseCatGroup = document.getElementById('trans-expense-cat-group');
const transExpenseCat = document.getElementById('trans-expense-cat');
const transAmount = document.getElementById('trans-amount');
const transPaymentMethod = document.getElementById('trans-payment-method');
const transReceiptNo = document.getElementById('trans-receipt-no');
const transDate = document.getElementById('trans-date');
const transDescription = document.getElementById('trans-description');

const btnOpenNewTransaction = document.getElementById('btn-open-new-transaction');
const btnOpenNewExpense = document.getElementById('btn-open-new-expense');

function populateTransCustomerSelect(selectedId = null) {
    if (!transCustomerId) return;
    transCustomerId.innerHTML = '<option value="">-- Cari Seçin --</option>';

    allCustomers.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        const typeLabel = c.type === 'CUSTOMER' ? 'Müşteri' : 'Tedarikçi';
        opt.innerText = `${c.name} (${typeLabel} - Bakiye: ${formatCurrency(c.balance)})`;
        if (selectedId && c.id === selectedId) {
            opt.selected = true;
        }
        transCustomerId.appendChild(opt);
    });
}

function handleTransTypeChange() {
    const val = transType ? transType.value : 'COLLECTION';
    if (val === 'EXPENSE') {
        if (transExpenseCatGroup) transExpenseCatGroup.style.display = 'block';
        if (transCustomerGroup) transCustomerGroup.style.display = 'none';
        if (transCustomerId) transCustomerId.removeAttribute('required');
        if (transactionModalTitle) transactionModalTitle.innerHTML = `<i class="fa-solid fa-receipt" style="color: #f59e0b;"></i> Dükkan Harcaması / Gider Ekle`;
    } else if (val === 'COLLECTION') {
        if (transExpenseCatGroup) transExpenseCatGroup.style.display = 'none';
        if (transCustomerGroup) transCustomerGroup.style.display = 'block';
        if (transCustomerId) transCustomerId.setAttribute('required', 'true');
        if (transactionModalTitle) transactionModalTitle.innerHTML = `<i class="fa-solid fa-hand-holding-dollar" style="color: var(--accent-success);"></i> Müşteriden Tahsilat Al (Para Girişi)`;
    } else { // PAYMENT
        if (transExpenseCatGroup) transExpenseCatGroup.style.display = 'none';
        if (transCustomerGroup) transCustomerGroup.style.display = 'block';
        if (transCustomerId) transCustomerId.setAttribute('required', 'true');
        if (transactionModalTitle) transactionModalTitle.innerHTML = `<i class="fa-solid fa-money-bill-wave" style="color: var(--accent-danger);"></i> Tedarikçiye Ödeme Yap (Para Çıkışı)`;
    }
}

if (transType) transType.addEventListener('change', handleTransTypeChange);

export function openTransactionModal(type = 'COLLECTION', preselectedCustomerId = null) {
    if (!transactionModal) return;
    if (transactionForm) transactionForm.reset();

    populateTransCustomerSelect(preselectedCustomerId);

    if (transType) transType.value = type;
    if (transDate) transDate.value = new Date().toISOString().slice(0, 10);

    handleTransTypeChange();
    transactionModal.classList.add('active');
}

function closeTransactionModal() {
    if (transactionModal) transactionModal.classList.remove('active');
}

if (btnOpenNewTransaction) {
    btnOpenNewTransaction.addEventListener('click', () => openTransactionModal('COLLECTION'));
}

if (btnOpenNewExpense) {
    btnOpenNewExpense.addEventListener('click', () => openTransactionModal('EXPENSE'));
}

if (transactionModalClose) transactionModalClose.addEventListener('click', closeTransactionModal);
if (transCancelBtn) transCancelBtn.addEventListener('click', closeTransactionModal);

if (transactionForm) {
    transactionForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const type = transType.value;
        const amount = parseFloat(transAmount.value) || 0;
        if (amount <= 0) {
            showToast("Lütfen geçerli bir tutar girin.", "error");
            return;
        }

        const paymentMethod = transPaymentMethod.value;
        const custId = (type !== 'EXPENSE') ? transCustomerId.value : (transCustomerId.value || null);
        const receiptNo = transReceiptNo.value.trim() || null;
        const dateVal = transDate.value || new Date().toISOString().slice(0, 10);
        let desc = transDescription.value.trim();

        if (type !== 'EXPENSE' && !custId) {
            showToast("Lütfen işlem yapılacak cariyi seçin!", "error");
            return;
        }

        let debt = 0;
        let credit = 0;

        if (type === 'COLLECTION') {
            credit = amount;
            debt = 0;
            if (!desc) desc = `Tahsilat Alındı (${paymentMethod})`;
        } else if (type === 'PAYMENT') {
            debt = amount;
            credit = 0;
            if (!desc) desc = `Ödeme Yapıldı (${paymentMethod})`;
        } else if (type === 'EXPENSE') {
            const cat = transExpenseCat ? transExpenseCat.value : 'Genel Masraf';
            credit = amount;
            debt = 0;
            desc = desc ? `[${cat}] ${desc}` : `[${cat}] Harcaması`;
        }

        const payload = {
            customer_id: custId,
            transaction_type: type,
            payment_method: paymentMethod,
            debt: debt,
            credit: credit,
            amount: amount,
            receipt_no: receiptNo,
            description: desc,
            created_at: new Date(dateVal + 'T12:00:00Z').toISOString()
        };

        showLoader();
        try {
            const { error: insErr } = await supabase.from('customer_transactions').insert([payload]);
            if (insErr) throw insErr;

            // Cari bakiyesini güncelle
            if (custId) {
                const targetCust = allCustomers.find(c => c.id === custId);
                if (targetCust) {
                    const currentBal = Number(targetCust.balance) || 0;
                    // Müşteri tahsilatında (Alacak) eksi borç kapanır (+ eklenir)
                    // Tedarikçi ödemesinde (Borç) borcumuz kapanır (+ eklenir)
                    const newBal = currentBal + (credit - debt);
                    await supabase.from('customers').update({ balance: newBal }).eq('id', custId);
                }
            }

            showToast("Hareket başarıyla kaydedildi!", "success");
            closeTransactionModal();
            await fetchCustomers();
            document.dispatchEvent(new CustomEvent('transaction-saved'));

            // Eğer şu an aktif açık olan ekstre modalı varsa onu da güncelle
            if (activeLedgerCustomer && activeLedgerCustomer.id === custId) {
                await openCustomerLedgerModal(activeLedgerCustomer);
            }

        } catch (err) {
            console.error("Hareket kaydedilemedi:", err);
            showToast("Kayıt başarısız: " + (err.message || err), "error");
        } finally {
            hideLoader();
        }
    });
}

// ========================================================
// CARİ EKSTRESİ & HAREKET GEÇMİŞİ MODALI
// ========================================================
let activeLedgerCustomer = null;
let currentLedgerTransactions = [];

const customerLedgerModal = document.getElementById('customer-ledger-modal');
const ledgerCustomerName = document.getElementById('ledger-customer-name');
const ledgerCustomerInfo = document.getElementById('ledger-customer-info');
const ledgerBalanceDisplay = document.getElementById('ledger-balance-display');
const ledgerTbody = document.getElementById('ledger-tbody');
const ledgerModalClose = document.getElementById('ledger-modal-close');
const ledgerCloseBtn = document.getElementById('ledger-close-btn');
const ledgerBtnAddCollection = document.getElementById('ledger-btn-add-collection');
const ledgerBtnAddPayment = document.getElementById('ledger-btn-add-payment');
const ledgerBtnWhatsapp = document.getElementById('ledger-btn-whatsapp');

export async function openCustomerLedgerModal(customer) {
    if (!customerLedgerModal) return;
    activeLedgerCustomer = customer;

    if (ledgerCustomerName) ledgerCustomerName.innerHTML = `<i class="fa-solid fa-file-invoice" style="color: var(--accent-primary);"></i> ${customer.name}`;
    if (ledgerCustomerInfo) {
        const typeBadge = customer.type === 'CUSTOMER' ? 'Müşteri' : 'Tedarikçi';
        ledgerCustomerInfo.innerText = `${typeBadge} | Tel: ${customer.phone || '-'} | Şehir: ${customer.city || '-'} | Vergi No: ${customer.tax_number || '-'}`;
    }

    customerLedgerModal.classList.add('active');
    await loadCustomerLedgerData(customer.id);
}

async function loadCustomerLedgerData(customerId) {
    if (!supabase || !ledgerTbody) return;
    ledgerTbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 2rem;"><i class="fa-solid fa-spinner fa-spin"></i> Hareketler yükleniyor...</td></tr>`;

    try {
        const { data, error } = await supabase
            .from('customer_transactions')
            .select('*')
            .eq('customer_id', customerId)
            .order('created_at', { ascending: true });

        if (error) throw error;
        currentLedgerTransactions = data || [];
        renderCustomerLedger(currentLedgerTransactions);
    } catch (err) {
        console.error("Cari ekstre yükleme hatası:", err);
        ledgerTbody.innerHTML = `<tr><td colspan="8" class="empty-state" style="color: var(--accent-danger);"><i class="fa-solid fa-triangle-exclamation"></i> Ekstre yüklenirken hata oluştu.</td></tr>`;
    }
}

function renderCustomerLedger(transactions) {
    if (!ledgerTbody) return;
    ledgerTbody.innerHTML = '';

    if (transactions.length === 0) {
        ledgerTbody.innerHTML = `
            <tr>
                <td colspan="8" class="empty-state" style="padding: 2rem;">
                    <i class="fa-solid fa-folder-open"></i>
                    <p style="margin-top: 0.5rem;">Bu cariye ait henüz bir hareket kaydı bulunmuyor.</p>
                </td>
            </tr>
        `;
        if (ledgerBalanceDisplay) {
            const bal = Number(activeLedgerCustomer?.balance) || 0;
            renderLedgerBalanceBadge(bal);
        }
        return;
    }

    let runningBalance = 0;

    transactions.forEach(t => {
        const tr = document.createElement('tr');
        const debt = Number(t.debt) || 0;
        const credit = Number(t.credit) || 0;

        // Borç eksiye, Alacak artıya götürür
        runningBalance = runningBalance + (credit - debt);

        let typeBadge = '';
        if (t.transaction_type === 'SALE') {
            typeBadge = '<span class="badge badge-amber"><i class="fa-solid fa-cart-shopping"></i> Satış</span>';
        } else if (t.transaction_type === 'COLLECTION') {
            typeBadge = '<span class="badge badge-green"><i class="fa-solid fa-hand-holding-dollar"></i> Tahsilat</span>';
        } else if (t.transaction_type === 'PAYMENT') {
            typeBadge = '<span class="badge badge-blue"><i class="fa-solid fa-money-bill-wave"></i> Ödeme</span>';
        } else if (t.transaction_type === 'EXPENSE') {
            typeBadge = '<span class="badge badge-red"><i class="fa-solid fa-receipt"></i> Gider</span>';
        } else {
            typeBadge = `<span class="badge">${t.transaction_type}</span>`;
        }

        let balText = '';
        if (runningBalance < 0) {
            balText = `<span class="mono-text" style="color: var(--accent-danger); font-weight: 700;">${formatCurrency(runningBalance)} (Borç)</span>`;
        } else if (runningBalance > 0) {
            balText = `<span class="mono-text" style="color: var(--accent-success); font-weight: 700;">+${formatCurrency(runningBalance)} (Alacak)</span>`;
        } else {
            balText = `<span class="mono-text" style="color: var(--text-dim);">0,00 ₺</span>`;
        }

        tr.innerHTML = `
            <td style="font-size: 0.82rem; white-space: nowrap;">${formatDateTime(t.created_at)}</td>
            <td>${typeBadge}</td>
            <td><span class="badge" style="background: var(--bg-input); font-size: 0.78rem;">${t.payment_method || 'Nakit'}</span></td>
            <td><span class="mono-text" style="font-size: 0.8rem; color: var(--text-dim);">${t.receipt_no || '-'}</span></td>
            <td style="font-size: 0.85rem; max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${t.description || ''}">${t.description || '-'}</td>
            <td style="text-align: right;" class="mono-text">${debt > 0 ? `<span style="color: var(--accent-danger); font-weight: 700;">${formatCurrency(debt)}</span>` : '-'}</td>
            <td style="text-align: right;" class="mono-text">${credit > 0 ? `<span style="color: var(--accent-success); font-weight: 700;">${formatCurrency(credit)}</span>` : '-'}</td>
            <td style="text-align: right;">${balText}</td>
        `;

        ledgerTbody.appendChild(tr);
    });

    renderLedgerBalanceBadge(runningBalance);
}

function renderLedgerBalanceBadge(bal) {
    if (!ledgerBalanceDisplay) return;
    if (bal < 0) {
        ledgerBalanceDisplay.innerHTML = `<span style="color: var(--accent-danger);">${formatCurrency(bal)} (Müşteri Borçlu)</span>`;
    } else if (bal > 0) {
        ledgerBalanceDisplay.innerHTML = `<span style="color: var(--accent-success);">+${formatCurrency(bal)} (Alacaklı)</span>`;
    } else {
        ledgerBalanceDisplay.innerHTML = `<span style="color: var(--text-dim);">0,00 ₺ (Hesap Denk)</span>`;
    }
}

function closeCustomerLedgerModal() {
    if (customerLedgerModal) customerLedgerModal.classList.remove('active');
    activeLedgerCustomer = null;
    currentLedgerTransactions = [];
}

if (ledgerModalClose) ledgerModalClose.addEventListener('click', closeCustomerLedgerModal);
if (ledgerCloseBtn) ledgerCloseBtn.addEventListener('click', closeCustomerLedgerModal);

if (ledgerBtnAddCollection) {
    ledgerBtnAddCollection.addEventListener('click', () => {
        if (activeLedgerCustomer) {
            openTransactionModal('COLLECTION', activeLedgerCustomer.id);
        }
    });
}

if (ledgerBtnAddPayment) {
    ledgerBtnAddPayment.addEventListener('click', () => {
        if (activeLedgerCustomer) {
            openTransactionModal('PAYMENT', activeLedgerCustomer.id);
        }
    });
}

if (ledgerBtnWhatsapp) {
    ledgerBtnWhatsapp.addEventListener('click', () => {
        if (!activeLedgerCustomer) return;
        const phone = activeLedgerCustomer.phone ? activeLedgerCustomer.phone.replace(/[^0-9]/g, '') : null;
        if (!phone) {
            showToast("Bu carinin telefon numarası kayıtlı değil.", "error");
            return;
        }

        const bal = Number(activeLedgerCustomer.balance) || 0;
        let balStatus = "0,00 ₺ (Hesap Denk)";
        if (bal < 0) balStatus = `${formatCurrency(Math.abs(bal))} Borç`;
        else if (bal > 0) balStatus = `${formatCurrency(bal)} Alacak`;

        let msg = `Sayın *${activeLedgerCustomer.name}*,\n\n`;
        msg += `📋 *Cari Hesap Bakiye Özeti*\n`;
        msg += `📅 Tarih: ${new Date().toLocaleDateString('tr-TR')}\n`;
        msg += `💰 Güncel Bakiye: *${balStatus}*\n\n`;

        if (currentLedgerTransactions.length > 0) {
            msg += `*Son Hareketler:*\n`;
            const recent = currentLedgerTransactions.slice(-5);
            recent.forEach(t => {
                const dateStr = new Date(t.created_at).toLocaleDateString('tr-TR');
                const debt = Number(t.debt) || 0;
                const credit = Number(t.credit) || 0;
                const amt = debt > 0 ? `-${formatCurrency(debt)} (Satış/Borç)` : `+${formatCurrency(credit)} (Tahsilat)`;
                msg += `• ${dateStr} - ${amt} ${t.description ? '(' + t.description + ')' : ''}\n`;
            });
            msg += `\n`;
        }

        msg += `Hayırlı işler dileriz.`;

        const targetPhone = phone.startsWith('0') ? '90' + phone.substring(1) : (phone.startsWith('90') ? phone : '90' + phone);
        const url = `https://wa.me/${targetPhone}?text=${encodeURIComponent(msg)}`;
        window.open(url, '_blank');
    });
}

