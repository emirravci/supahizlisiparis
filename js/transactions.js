// ========================================================
// CARİ & KASA HAREKETLERİ (TRANSACTIONS) MODÜLÜ
// ========================================================

import { supabase, showLoader, hideLoader, showToast, formatCurrency, formatDateTime } from './supabase.js';
import { openTransactionModal, syncSalesToCustomerTransactions } from './customers.js';

// DOM Elemanları - İstatistik Kartları
const ctxStatTodayRevenue = document.getElementById('ctx-stat-today-revenue');
const ctxStatMonthRevenue = document.getElementById('ctx-stat-month-revenue');
const ctxStatMonthCollection = document.getElementById('ctx-stat-month-collection');
const ctxStatTotalDebt = document.getElementById('ctx-stat-total-debt');
const ctxStatMonthExpense = document.getElementById('ctx-stat-month-expense');

// DOM Elemanları - Filtreler & Tablo
const ctxSearchInput = document.getElementById('ctx-search-input');
const ctxTypeFilter = document.getElementById('ctx-type-filter');
const ctxMethodFilter = document.getElementById('ctx-method-filter');
const ctxDateFilter = document.getElementById('ctx-date-filter');
const ctxTableTbody = document.getElementById('ctx-table-tbody');

// Butonlar
const ctxBtnNewCollection = document.getElementById('ctx-btn-new-collection');
const ctxBtnNewPayment = document.getElementById('ctx-btn-new-payment');
const ctxBtnNewExpense = document.getElementById('ctx-btn-new-expense');

if (ctxBtnNewCollection) ctxBtnNewCollection.addEventListener('click', () => openTransactionModal('COLLECTION'));
if (ctxBtnNewPayment) ctxBtnNewPayment.addEventListener('click', () => openTransactionModal('PAYMENT'));
if (ctxBtnNewExpense) ctxBtnNewExpense.addEventListener('click', () => openTransactionModal('EXPENSE'));

// Durum (State)
let allTransactions = [];
let allCustomers = [];

// Sayfa Yüklendiğinde Dinle
document.addEventListener('view-customer-transactions-loaded', async () => {
    await fetchTransactionsData();
});

// Yeni hareket eklendiğinde otomatik güncelle
document.addEventListener('transaction-saved', async () => {
    const section = document.getElementById('customer-transactions-view');
    if (section && section.classList.contains('active')) {
        await fetchTransactionsData();
    }
});

export async function fetchTransactionsData() {
    if (!supabase) return;
    showLoader();
    try {
        // Hızlı satışları cari hareketlerle senkronize et
        await syncSalesToCustomerTransactions();

        // Bugünün başlangıcı
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        const todayISO = startOfToday.toISOString();

        // Bu ayın başlangıcı
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);
        const monthISO = startOfMonth.toISOString();

        // Paralel Veri Çekimi
        const [transRes, salesTodayRes, salesMonthRes, custRes] = await Promise.all([
            // 1. Tüm Cari & Kasa Hareketleri
            supabase.from('customer_transactions')
                .select('*, customers(id, name, phone, type, balance)')
                .order('created_at', { ascending: false })
                .limit(300),

            // 2. Bugünkü Satış Cirosu
            supabase.from('sales')
                .select('total_amount')
                .gte('created_at', todayISO),

            // 3. Bu Ayki Satış Cirosu
            supabase.from('sales')
                .select('total_amount')
                .gte('created_at', monthISO),

            // 4. Müşteriler (Toplam Veresiye Alacak Hesabı)
            supabase.from('customers')
                .select('id, name, balance')
        ]);

        if (transRes.error) throw transRes.error;

        allTransactions = transRes.data || [];
        allCustomers = custRes.data || [];

        const salesToday = salesTodayRes.data || [];
        const salesMonth = salesMonthRes.data || [];

        // 1. Bugünkü Satış Cirosu
        const todayRev = salesToday.reduce((sum, s) => sum + (Number(s.total_amount) || 0), 0);
        if (ctxStatTodayRevenue) ctxStatTodayRevenue.innerText = formatCurrency(todayRev);

        // 2. Bu Ayki Satış Cirosu
        const monthRev = salesMonth.reduce((sum, s) => sum + (Number(s.total_amount) || 0), 0);
        if (ctxStatMonthRevenue) ctxStatMonthRevenue.innerText = formatCurrency(monthRev);

        // 3. Bu Ayki Tahsilat Toplamı
        const monthColl = allTransactions
            .filter(t => t.transaction_type === 'COLLECTION' && t.created_at >= monthISO)
            .reduce((sum, t) => sum + (Number(t.amount) || Number(t.credit) || 0), 0);
        if (ctxStatMonthCollection) ctxStatMonthCollection.innerText = formatCurrency(monthColl);

        // 4. Toplam Veresiye / Müşteri Borçları (Bizim Alacağımız)
        const totalPendingDebt = allCustomers.reduce((sum, c) => {
            const bal = Number(c.balance) || 0;
            return bal < 0 ? sum + Math.abs(bal) : sum;
        }, 0);
        if (ctxStatTotalDebt) ctxStatTotalDebt.innerText = formatCurrency(totalPendingDebt);

        // 5. Bu Ayki Dükkan Giderleri
        const monthExp = allTransactions
            .filter(t => t.transaction_type === 'EXPENSE' && t.created_at >= monthISO)
            .reduce((sum, t) => sum + (Number(t.amount) || Number(t.credit) || 0), 0);
        if (ctxStatMonthExpense) ctxStatMonthExpense.innerText = formatCurrency(monthExp);

        // Tabloyu Çiz
        filterAndRenderTransactions();

    } catch (err) {
        console.error("Cari hareketler yüklenirken hata:", err);
        showToast("Cari hareket verileri alınamadı.", "error");
    } finally {
        hideLoader();
    }
}

function filterAndRenderTransactions() {
    const searchText = (ctxSearchInput ? ctxSearchInput.value : '').toLowerCase().trim();
    const typeFilter = ctxTypeFilter ? ctxTypeFilter.value : 'all';
    const methodFilter = ctxMethodFilter ? ctxMethodFilter.value : 'all';
    const dateFilter = ctxDateFilter ? ctxDateFilter.value : 'all';

    // Tarih filtre sınırları
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    
    // Bu haftanın pazartesisi
    const dayOfWeek = now.getDay() || 7;
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek + 1).getTime();

    // Bu ayın başlangıcı
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    const filtered = allTransactions.filter(t => {
        // Metin Araması
        const custName = t.customers?.name ? t.customers.name.toLowerCase() : '';
        const desc = t.description ? t.description.toLowerCase() : '';
        const receipt = t.receipt_no ? t.receipt_no.toLowerCase() : '';
        const matchesSearch = !searchText || custName.includes(searchText) || desc.includes(searchText) || receipt.includes(searchText);

        // Tür Filtresi
        const matchesType = (typeFilter === 'all') || (t.transaction_type === typeFilter);

        // Ödeme Yöntemi Filtresi
        const matchesMethod = (methodFilter === 'all') || (t.payment_method === methodFilter);

        // Tarih Filtresi
        let matchesDate = true;
        if (dateFilter !== 'all') {
            const itemTime = new Date(t.created_at).getTime();
            if (dateFilter === 'today') {
                matchesDate = itemTime >= startOfToday;
            } else if (dateFilter === 'this_week') {
                matchesDate = itemTime >= startOfWeek;
            } else if (dateFilter === 'this_month') {
                matchesDate = itemTime >= startOfMonth;
            }
        }

        return matchesSearch && matchesType && matchesMethod && matchesDate;
    });

    renderTransactionsTable(filtered);
}

if (ctxSearchInput) ctxSearchInput.addEventListener('input', filterAndRenderTransactions);
if (ctxTypeFilter) ctxTypeFilter.addEventListener('change', filterAndRenderTransactions);
if (ctxMethodFilter) ctxMethodFilter.addEventListener('change', filterAndRenderTransactions);
if (ctxDateFilter) ctxDateFilter.addEventListener('change', filterAndRenderTransactions);

function renderTransactionsTable(items) {
    if (!ctxTableTbody) return;
    ctxTableTbody.innerHTML = '';

    if (items.length === 0) {
        ctxTableTbody.innerHTML = `
            <tr>
                <td colspan="9" class="empty-state" style="padding: 2.5rem;">
                    <i class="fa-solid fa-receipt" style="font-size: 2rem; color: var(--text-dim);"></i>
                    <p style="margin-top: 0.5rem;">Arama kriterlerine uygun cari veya kasa hareketi bulunamadı.</p>
                </td>
            </tr>
        `;
        return;
    }

    items.forEach(t => {
        const tr = document.createElement('tr');
        const debt = Number(t.debt) || 0;
        const credit = Number(t.credit) || 0;
        const amount = Number(t.amount) || (debt > 0 ? debt : credit);

        // Tür Rozeti
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

        // Ödeme Yöntemi
        let methodBadge = `<span class="badge" style="background: var(--bg-input); font-size: 0.78rem;">${t.payment_method || 'Nakit'}</span>`;

        // Cari Adı
        const isGenel = (t.customers?.name || '').toLowerCase() === 'genel' || !t.customers;
        const customerName = t.customers?.name 
            ? `<div style="display: flex; align-items: center; gap: 6px;">
                <span style="font-weight: 700; color: ${isGenel ? 'var(--accent-primary)' : 'var(--text-main)'};">${t.customers.name}</span>
                ${isGenel ? '<span class="badge" style="font-size: 0.68rem; background: rgba(245, 158, 11, 0.15); color: var(--accent-primary); padding: 1px 5px;">Genel Cari</span>' : ''}
               </div>
               ${t.customers.phone ? `<div style="font-size: 0.75rem; color: var(--text-dim);">${t.customers.phone}</div>` : ''}`
            : `<div style="display: flex; align-items: center; gap: 6px;">
                <span style="font-weight: 700; color: var(--accent-primary);">Genel</span>
                <span class="badge" style="font-size: 0.68rem; background: rgba(245, 158, 11, 0.15); color: var(--accent-primary); padding: 1px 5px;">Genel Cari</span>
               </div>`;

        tr.innerHTML = `
            <td style="font-size: 0.82rem; white-space: nowrap;">${formatDateTime(t.created_at)}</td>
            <td>${customerName}</td>
            <td>${typeBadge}</td>
            <td>${methodBadge}</td>
            <td><span class="mono-text" style="font-size: 0.8rem; color: var(--text-dim);">${t.receipt_no || '-'}</span></td>
            <td style="font-size: 0.85rem; max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${t.description || ''}">${t.description || '-'}</td>
            <td style="text-align: right;" class="mono-text">${debt > 0 ? `<span style="color: var(--accent-danger); font-weight: 700;">${formatCurrency(debt)}</span>` : '-'}</td>
            <td style="text-align: right;" class="mono-text">${credit > 0 ? `<span style="color: var(--accent-success); font-weight: 700;">${formatCurrency(credit)}</span>` : '-'}</td>
            <td style="text-align: right;" class="mono-text" style="font-weight: 800;">${formatCurrency(amount)}</td>
        `;

        ctxTableTbody.appendChild(tr);
    });
}
