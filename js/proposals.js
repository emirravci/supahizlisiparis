// ========================================================
// SİPARİŞ VE TEKLİF (PROFORMA FATURA) MODÜLÜ
// ========================================================

import { supabase, showLoader, hideLoader, showToast, showConfirmModal, formatCurrency, formatDateTime, formatDateOnly } from './supabase.js';

// DOM Elemanları - Tablo & Filtreler
const proposalsTableTbody = document.getElementById('proposals-table-tbody');
const proposalsSearchInput = document.getElementById('proposals-search-input');
const proposalsStatusFilter = document.getElementById('proposals-status-filter');
const btnOpenNewProposal = document.getElementById('btn-open-new-proposal');

// DOM Elemanları - Teklif Formu Modalı
const proposalModal = document.getElementById('proposal-modal');
const proposalModalClose = document.getElementById('proposal-modal-close');
const proposalCancelBtn = document.getElementById('proposal-cancel-btn');
const proposalForm = document.getElementById('proposal-form');
const proposalId = document.getElementById('proposal-id');
const proposalCustomerSelect = document.getElementById('proposal-customer-select');
const proposalPriceListSelect = document.getElementById('proposal-price-list-select');
const proposalType = document.getElementById('proposal-type');
const proposalValidDays = document.getElementById('proposal-valid-days');
const proposalAddProduct = document.getElementById('proposal-add-product');
const proposalAddQty = document.getElementById('proposal-add-qty');
const proposalAddPrice = document.getElementById('proposal-add-price');
const proposalAddUnit = document.getElementById('proposal-add-unit');
const proposalAddItemBtn = document.getElementById('proposal-add-item-btn');
const proposalItemsTbody = document.getElementById('proposal-items-tbody');
const proposalTerms = document.getElementById('proposal-terms');

// Dip Toplam Alanları
const propSubtotal = document.getElementById('prop-subtotal');
const propDiscount = document.getElementById('prop-discount');
const propTaxRate = document.getElementById('prop-tax-rate');
const propTaxAmount = document.getElementById('prop-tax-amount');
const propGrandTotal = document.getElementById('prop-grand-total');

// DOM Elemanları - Proforma Görüntüleme Modalı
const proformaModal = document.getElementById('proforma-modal');
const proformaModalClose = document.getElementById('proforma-modal-close');
const proformaPrintContent = document.getElementById('proforma-print-content');
const btnPrintProforma = document.getElementById('btn-print-proforma');
const btnShareProposalWhatsapp = document.getElementById('btn-share-proposal-whatsapp');

// Durum (State)
let allProposals = [];
let availableCustomers = [];
let availableProducts = [];
let availablePriceLists = [];
let proposalPriceMap = {}; // { [productId]: customPrice }
let currentProposalItems = []; // [{ product_id, product_name, unit, quantity, unit_price, total_price }]
let activeViewingProposal = null;

// Sayfa Yüklendiğinde Dinle
document.addEventListener('view-proposals-loaded', async (e) => {
    await Promise.all([fetchProposals(), loadSelectData()]);
    if (e.detail && e.detail.selectedCustomerId) {
        openProposalModal(null, e.detail.selectedCustomerId);
    }
});

// ========================================================
// VERİLERİ GETİRME
// ========================================================
async function loadSelectData() {
    if (!supabase) return;
    try {
        const [custRes, prodRes, plRes] = await Promise.all([
            supabase.from('customers').select('id, name, phone, email, address, city, tax_office, tax_number, default_price_list_id').order('name'),
            supabase.from('products').select('id, name, unit, sell_price, stock_quantity').order('name'),
            supabase.from('price_lists').select('id, name, code').eq('is_active', true).order('name')
        ]);
        availableCustomers = custRes.data || [];
        availableProducts = prodRes.data || [];
        availablePriceLists = plRes.data || [];

        populateCustomerSelect();
        populateProductSelect();
        populateProposalPriceListSelect();
    } catch (err) {
        console.error("Müşteri, ürün ve fiyat listeleri yüklenemedi:", err);
    }
}

function populateProposalPriceListSelect() {
    if (!proposalPriceListSelect) return;
    proposalPriceListSelect.innerHTML = '<option value="DEFAULT">Standart Perakende Fiyatı</option>';
    availablePriceLists.forEach(pl => {
        const opt = document.createElement('option');
        opt.value = pl.id;
        opt.textContent = `${pl.name} (${pl.code || 'Özel'})`;
        proposalPriceListSelect.appendChild(opt);
    });
}

function populateCustomerSelect(selectedId = null) {
    if (!proposalCustomerSelect) return;
    proposalCustomerSelect.innerHTML = '<option value="">-- Müşteri Seçin --</option>';
    availableCustomers.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = `${c.name} (${c.phone || c.city || 'Kayıtlı Cari'})`;
        if (selectedId && c.id === selectedId) opt.selected = true;
        proposalCustomerSelect.appendChild(opt);
    });
}

// Müşteri seçildiğinde varsayılan fiyat listesini otomatik seç
if (proposalCustomerSelect) {
    proposalCustomerSelect.addEventListener('change', async () => {
        const custId = proposalCustomerSelect.value;
        const cust = availableCustomers.find(c => c.id === custId);
        if (cust && cust.default_price_list_id && proposalPriceListSelect) {
            proposalPriceListSelect.value = cust.default_price_list_id;
            await loadProposalPriceMap(cust.default_price_list_id);
        }
    });
}

// Fiyat Listesi değiştiğinde özel fiyatları çek
if (proposalPriceListSelect) {
    proposalPriceListSelect.addEventListener('change', async () => {
        const plId = proposalPriceListSelect.value;
        await loadProposalPriceMap(plId);
    });
}

async function loadProposalPriceMap(listId) {
    proposalPriceMap = {};
    if (listId && listId !== 'DEFAULT') {
        try {
            const { data } = await supabase.from('price_list_items').select('product_id, price').eq('price_list_id', listId);
            (data || []).forEach(it => {
                proposalPriceMap[it.product_id] = Number(it.price);
            });
        } catch (e) {
            console.error("Teklif için liste fiyatları alınamadı:", e);
        }
    }
    // Seçili ürün varsa birim fiyat kutusunu güncelle
    if (proposalAddProduct && proposalAddProduct.value) {
        updateAddProductPrice();
    }
}

function populateProductSelect() {
    if (!proposalAddProduct) return;
    proposalAddProduct.innerHTML = '<option value="">-- Ürün Seçin --</option>';
    availableProducts.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = `${p.name} - ${formatCurrency(p.sell_price)} (${p.unit})`;
        opt.dataset.unit = p.unit;
        opt.dataset.price = p.sell_price;
        proposalAddProduct.appendChild(opt);
    });
}

function updateAddProductPrice() {
    const selected = proposalAddProduct.options[proposalAddProduct.selectedIndex];
    if (selected && selected.value) {
        const prodId = selected.value;
        const customPrice = proposalPriceMap[prodId];
        const effectivePrice = customPrice !== undefined ? customPrice : (selected.dataset.price || 0);
        proposalAddPrice.value = effectivePrice;
        proposalAddUnit.value = selected.dataset.unit || 'Adet';
    } else {
        proposalAddPrice.value = '';
        proposalAddUnit.value = 'Adet';
    }
}

// Ürün seçildiğinde birim ve satış fiyatını otomatik doldur
if (proposalAddProduct) {
    proposalAddProduct.addEventListener('change', updateAddProductPrice);
}

export async function fetchProposals() {
    if (!supabase) return;
    showLoader();
    try {
        const { data, error } = await supabase
            .from('proposals')
            .select('*, proposal_items(*)')
            .order('created_at', { ascending: false });

        if (error) throw error;
        allProposals = data || [];
        filterAndRenderProposals();
    } catch (err) {
        console.error("Teklifler çekilirken hata:", err);
        showToast("Teklif listesi yüklenemedi.", "error");
    } finally {
        hideLoader();
    }
}

function filterAndRenderProposals() {
    const search = (proposalsSearchInput ? proposalsSearchInput.value : '').toLowerCase().trim();
    const statusFilter = proposalsStatusFilter ? proposalsStatusFilter.value : 'all';

    const filtered = allProposals.filter(p => {
        const matchesSearch = !search ||
            (p.proposal_no && p.proposal_no.toLowerCase().includes(search)) ||
            (p.customer_name && p.customer_name.toLowerCase().includes(search));

        const matchesStatus = (statusFilter === 'all') || (p.status === statusFilter);

        return matchesSearch && matchesStatus;
    });

    renderProposalsTable(filtered);
}

if (proposalsSearchInput) proposalsSearchInput.addEventListener('input', filterAndRenderProposals);
if (proposalsStatusFilter) proposalsStatusFilter.addEventListener('change', filterAndRenderProposals);

// ========================================================
// TABLO ÇİZİMİ
// ========================================================
function renderProposalsTable(proposals) {
    if (!proposalsTableTbody) return;
    proposalsTableTbody.innerHTML = '';

    if (proposals.length === 0) {
        proposalsTableTbody.innerHTML = `
            <tr>
                <td colspan="7" class="empty-state">
                    <i class="fa-solid fa-file-invoice-dollar"></i>
                    <p>Kayıtlı teklif veya sipariş bulunamadı.</p>
                </td>
            </tr>
        `;
        return;
    }

    proposals.forEach(p => {
        const tr = document.createElement('tr');

        let statusBadge = '';
        if (p.status === 'APPROVED') {
            statusBadge = '<span class="badge badge-green"><i class="fa-solid fa-circle-check"></i> Onaylandı (Satış)</span>';
        } else if (p.status === 'SENT') {
            statusBadge = '<span class="badge badge-blue"><i class="fa-solid fa-paper-plane"></i> Gönderildi</span>';
        } else if (p.status === 'REJECTED') {
            statusBadge = '<span class="badge badge-red"><i class="fa-solid fa-ban"></i> İptal</span>';
        } else {
            statusBadge = '<span class="badge badge-amber"><i class="fa-solid fa-pencil"></i> Taslak</span>';
        }

        tr.innerHTML = `
            <td>
                <span class="mono-text" style="font-weight: 700; color: var(--accent-primary);">
                    ${p.proposal_no}
                </span>
                <div style="font-size: 0.72rem; color: var(--text-dim);">${p.type === 'ORDER' ? 'Sipariş' : 'Proforma Teklif'}</div>
            </td>
            <td>
                <div style="font-weight: 700;">${p.customer_name}</div>
                ${p.customer_phone ? `<div style="font-size: 0.75rem; color: var(--text-dim);">${p.customer_phone}</div>` : ''}
            </td>
            <td style="font-size: 0.85rem; color: var(--text-muted);">${formatDateOnly(p.issue_date)}</td>
            <td style="font-size: 0.85rem; color: var(--text-muted);">${p.valid_until ? formatDateOnly(p.valid_until) : '-'}</td>
            <td class="mono-text" style="font-weight: 800; font-size: 1rem; color: var(--accent-success);">
                ${formatCurrency(p.total_amount)}
            </td>
            <td>${statusBadge}</td>
            <td>
                <div class="action-buttons">
                    <button class="btn-table-action" title="Proforma Yazdır / Görüntüle" data-action="view-proforma" data-id="${p.id}" style="color: var(--accent-primary);">
                        <i class="fa-solid fa-print"></i>
                    </button>
                    ${p.status !== 'APPROVED' ? `
                    <button class="btn-table-action stock-in" title="Onayla & Satışa Dönüştür (Stok Düşür)" data-action="convert-sale" data-id="${p.id}">
                        <i class="fa-solid fa-cart-arrow-down"></i>
                    </button>` : ''}
                    <button class="btn-table-action delete" title="Teklifi Sil" data-action="delete" data-id="${p.id}">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </td>
        `;

        proposalsTableTbody.appendChild(tr);
    });

    // Buton Dinleyicileri
    proposalsTableTbody.querySelectorAll('.btn-table-action').forEach(btn => {
        btn.addEventListener('click', () => {
            const action = btn.getAttribute('data-action');
            const id = btn.getAttribute('data-id');
            const proposal = allProposals.find(p => p.id === id);
            if (!proposal) return;

            if (action === 'view-proforma') {
                openProformaModal(proposal);
            } else if (action === 'convert-sale') {
                confirmConvertToSale(proposal);
            } else if (action === 'delete') {
                confirmDeleteProposal(proposal);
            }
        });
    });
}

// ========================================================
// YENİ TEKLİF FORMU & KALEM YÖNETİMİ
// ========================================================
function openProposalModal(proposal = null, preselectedCustomerId = null) {
    if (!proposalModal) return;
    proposalForm.reset();
    currentProposalItems = [];

    populateCustomerSelect(preselectedCustomerId);
    populateProductSelect();

    if (proposalTerms) {
        proposalTerms.value = "1. Fiyatlarımıza KDV dahildir.\n2. Teklifimiz düzenleme tarihinden itibaren geçerlidir.\n3. Malzemeler dükkanımızdan teslim edilecektir.";
    }

    renderProposalItems();
    calculateTotals();
    proposalModal.classList.add('active');
}

function closeProposalModal() {
    if (proposalModal) proposalModal.classList.remove('active');
}

if (btnOpenNewProposal) btnOpenNewProposal.addEventListener('click', () => openProposalModal());
if (proposalModalClose) proposalModalClose.addEventListener('click', closeProposalModal);
if (proposalCancelBtn) proposalCancelBtn.addEventListener('click', closeProposalModal);

// Kalem Ekleme Butonu
if (proposalAddItemBtn) {
    proposalAddItemBtn.addEventListener('click', () => {
        const prodId = proposalAddProduct.value;
        const prod = availableProducts.find(p => p.id === prodId);
        const qty = parseFloat(proposalAddQty.value) || 0;
        const price = parseFloat(proposalAddPrice.value) || 0;
        const unit = proposalAddUnit.value || 'Adet';

        if (!prodId || !prod) {
            showToast("Lütfen bir ürün seçin.", "error");
            return;
        }
        if (qty <= 0) {
            showToast("Lütfen geçerli bir miktar girin.", "error");
            return;
        }

        currentProposalItems.push({
            product_id: prod.id,
            product_name: prod.name,
            unit: unit,
            quantity: qty,
            unit_price: price,
            total_price: qty * price
        });

        // Formu temizle
        proposalAddProduct.value = '';
        proposalAddQty.value = '1';
        proposalAddPrice.value = '';

        renderProposalItems();
        calculateTotals();
    });
}

function renderProposalItems() {
    if (!proposalItemsTbody) return;
    proposalItemsTbody.innerHTML = '';

    if (currentProposalItems.length === 0) {
        proposalItemsTbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; color: var(--text-dim); padding: 1rem;">
                    Henüz ürün kalemi eklenmedi. Yukarıdaki panelden ürün ekleyin.
                </td>
            </tr>
        `;
        return;
    }

    currentProposalItems.forEach((item, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-weight: 600;">${item.product_name}</td>
            <td class="mono-text">${item.quantity}</td>
            <td>${item.unit}</td>
            <td class="mono-text">${formatCurrency(item.unit_price)}</td>
            <td class="mono-text" style="font-weight: 700; color: var(--accent-primary);">${formatCurrency(item.total_price)}</td>
            <td style="text-align: right;">
                <button type="button" class="btn-table-action delete" data-index="${index}" title="Kalemi Kaldır">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </td>
        `;

        tr.querySelector('.btn-table-action').addEventListener('click', () => {
            currentProposalItems.splice(index, 1);
            renderProposalItems();
            calculateTotals();
        });

        proposalItemsTbody.appendChild(tr);
    });
}

function calculateTotals() {
    const subtotal = currentProposalItems.reduce((sum, it) => sum + it.total_price, 0);
    const discount = parseFloat(propDiscount.value) || 0;
    const base = Math.max(0, subtotal - discount);
    const taxRate = parseFloat(propTaxRate.value) || 0;
    const taxAmount = (base * taxRate) / 100;
    const grandTotal = base + taxAmount;

    if (propSubtotal) propSubtotal.innerText = formatCurrency(subtotal);
    if (propTaxAmount) propTaxAmount.innerText = formatCurrency(taxAmount);
    if (propGrandTotal) propGrandTotal.innerText = formatCurrency(grandTotal);

    return { subtotal, discount, taxRate, taxAmount, grandTotal };
}

if (propDiscount) propDiscount.addEventListener('input', calculateTotals);
if (propTaxRate) propTaxRate.addEventListener('change', calculateTotals);

// Teklifi Kaydet
if (proposalForm) {
    proposalForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const custId = proposalCustomerSelect.value;
        const customer = availableCustomers.find(c => c.id === custId);

        if (!custId || !customer) {
            showToast("Lütfen bir müşteri seçin.", "error");
            return;
        }

        if (currentProposalItems.length === 0) {
            showToast("Teklife en az 1 ürün kalemi eklemelisiniz.", "error");
            return;
        }

        const totals = calculateTotals();
        const validDays = parseInt(proposalValidDays.value) || 15;
        const validDate = new Date();
        validDate.setDate(validDate.getDate() + validDays);

        const dateCode = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const randomCode = Math.floor(100 + Math.random() * 900);
        const proposalNo = `TKF-${dateCode}-${randomCode}`;

        showLoader();
        try {
            // 1. Teklif Başlığını Ekle
            const selectedPlId = (proposalPriceListSelect && proposalPriceListSelect.value !== 'DEFAULT') ? proposalPriceListSelect.value : null;
            const { data: propData, error: propErr } = await supabase.from('proposals').insert([{
                proposal_no: proposalNo,
                type: proposalType.value,
                customer_id: customer.id,
                customer_name: customer.name,
                customer_phone: customer.phone,
                price_list_id: selectedPlId,
                status: 'SENT',
                issue_date: new Date().toISOString().slice(0, 10),
                valid_until: validDate.toISOString().slice(0, 10),
                subtotal: totals.subtotal,
                discount_amount: totals.discount,
                tax_rate: totals.taxRate,
                tax_amount: totals.taxAmount,
                total_amount: totals.grandTotal,
                terms: proposalTerms.value.trim()
            }]).select().single();

            if (propErr) throw propErr;

            // 2. Kalemleri Ekle
            const itemsPayload = currentProposalItems.map(it => ({
                proposal_id: propData.id,
                product_id: it.product_id,
                product_name: it.product_name,
                unit: it.unit,
                quantity: it.quantity,
                unit_price: it.unit_price,
                total_price: it.total_price
            }));

            const { error: itemsErr } = await supabase.from('proposal_items').insert(itemsPayload);
            if (itemsErr) throw itemsErr;

            showToast(`Teklif #${proposalNo} başarıyla oluşturuldu!`, "success");
            closeProposalModal();
            await fetchProposals();

            // Proforma faturayı hemen ekrana aç
            const createdProposal = allProposals.find(p => p.id === propData.id) || propData;
            createdProposal.proposal_items = itemsPayload;
            openProformaModal(createdProposal);

        } catch (err) {
            console.error("Teklif kaydedilemedi:", err);
            showToast("Teklif kaydedilemedi: " + err.message, "error");
        } finally {
            hideLoader();
        }
    });
}

// ========================================================
// PROFORMA FATURA VE YAZDIRMA (A4 ŞABLONU)
// ========================================================
export function openProformaModal(proposal) {
    if (!proformaModal || !proformaPrintContent) return;
    activeViewingProposal = proposal;

    const customer = availableCustomers.find(c => c.id === proposal.customer_id) || {};
    const items = proposal.proposal_items || [];

    let itemsRowsHtml = '';
    items.forEach((it, idx) => {
        itemsRowsHtml += `
            <tr>
                <td style="text-align: center;">${idx + 1}</td>
                <td><b>${it.product_name}</b></td>
                <td style="text-align: center;">${it.quantity}</td>
                <td style="text-align: center;">${it.unit}</td>
                <td style="text-align: right;">${formatCurrency(it.unit_price)}</td>
                <td style="text-align: right; font-weight: 700;">${formatCurrency(it.total_price)}</td>
            </tr>
        `;
    });

    proformaPrintContent.innerHTML = `
        <div class="proforma-header">
            <div>
                <h1 style="font-size: 1.6rem; font-weight: 900; color: #1e3a8a; display: flex; align-items: center; gap: 0.5rem;">
                    <i class="fa-solid fa-hammer" style="color: #f59e0b;"></i> NALBUR & HIRDAVAT TİCARET
                </h1>
                <p style="color: #64748b; font-size: 0.85rem; margin-top: 4px;">
                    Kaynak Malzemeleri • İş Güvenliği • Civata & Bağlantı • El Aletleri
                </p>
                <p style="color: #64748b; font-size: 0.85rem;">
                    Sanayi Sitesi Girişi No:12 | Tel: 0532 000 00 00 | E-posta: nalbur@dukkan.com
                </p>
            </div>
            <div style="text-align: right;">
                <div class="proforma-title">${proposal.type === 'ORDER' ? 'SİPARİŞ FORMU' : 'PROFORMA FATURA'}</div>
                <div style="font-size: 1rem; font-weight: 800; color: #1e293b; margin-top: 4px;">${proposal.proposal_no}</div>
                <div style="font-size: 0.85rem; color: #64748b; margin-top: 2px;">Tarih: ${formatDateOnly(proposal.issue_date)}</div>
                ${proposal.valid_until ? `<div style="font-size: 0.85rem; color: #dc2626; font-weight: 600;">Geçerlilik: ${formatDateOnly(proposal.valid_until)}</div>` : ''}
            </div>
        </div>

        <div class="proforma-party-box">
            <div>
                <div style="font-size: 0.75rem; text-transform: uppercase; font-weight: 800; color: #64748b; margin-bottom: 4px;">SAYIN / FİRMA (MÜŞTERİ)</div>
                <div style="font-size: 1.1rem; font-weight: 800; color: #0f172a;">${proposal.customer_name}</div>
                ${customer.phone ? `<div><b>Tel:</b> ${customer.phone}</div>` : ''}
                ${customer.address ? `<div><b>Adres:</b> ${customer.address}</div>` : ''}
                ${customer.tax_office ? `<div><b>Vergi Dairesi / No:</b> ${customer.tax_office} - ${customer.tax_number || ''}</div>` : ''}
            </div>
            <div>
                <div style="font-size: 0.75rem; text-transform: uppercase; font-weight: 800; color: #64748b; margin-bottom: 4px;">ÖDEME VE TESLİMAT ŞARTLARI</div>
                <div style="font-size: 0.85rem; color: #334155; white-space: pre-line;">${proposal.terms || 'Belirtilen süre zarfında peşin/havale ödeme geçerlidir.'}</div>
            </div>
        </div>

        <table class="proforma-table">
            <thead>
                <tr>
                    <th style="width: 40px; text-align: center;">#</th>
                    <th>Ürün / Malzeme Açıklaması</th>
                    <th style="width: 70px; text-align: center;">Miktar</th>
                    <th style="width: 60px; text-align: center;">Birim</th>
                    <th style="width: 110px; text-align: right;">Birim Fiyat</th>
                    <th style="width: 120px; text-align: right;">Toplam Tutar</th>
                </tr>
            </thead>
            <tbody>
                ${itemsRowsHtml}
            </tbody>
        </table>

        <div class="proforma-totals-wrap">
            <table class="proforma-totals-table">
                <tr>
                    <td style="color: #64748b;">Ara Toplam:</td>
                    <td style="text-align: right; font-weight: 600;">${formatCurrency(proposal.subtotal)}</td>
                </tr>
                ${proposal.discount_amount > 0 ? `
                <tr>
                    <td style="color: #dc2626;">İskonto:</td>
                    <td style="text-align: right; color: #dc2626; font-weight: 600;">-${formatCurrency(proposal.discount_amount)}</td>
                </tr>` : ''}
                <tr>
                    <td style="color: #64748b;">KDV (%${proposal.tax_rate}):</td>
                    <td style="text-align: right; font-weight: 600;">${formatCurrency(proposal.tax_amount)}</td>
                </tr>
                <tr class="grand-total">
                    <td>GENEL TOPLAM:</td>
                    <td style="text-align: right;">${formatCurrency(proposal.total_amount)}</td>
                </tr>
            </table>
        </div>

        <div class="proforma-signatures">
            <div class="signature-box">
                DÜKKAN / YETKİLİ KAŞE & İMZA
            </div>
            <div class="signature-box">
                MÜŞTERİ KABUL / ONAY & İMZA
            </div>
        </div>
    `;

    proformaModal.classList.add('active');
}

function closeProformaModal() {
    if (proformaModal) proformaModal.classList.remove('active');
    activeViewingProposal = null;
}

if (proformaModalClose) proformaModalClose.addEventListener('click', closeProformaModal);

// Yazdır / PDF Butonu
if (btnPrintProforma) {
    btnPrintProforma.addEventListener('click', () => {
        document.body.classList.remove('printing-catalog');
        document.body.classList.add('printing-proforma');

        const cleanUp = () => {
            document.body.classList.remove('printing-proforma');
            window.removeEventListener('afterprint', cleanUp);
        };
        window.addEventListener('afterprint', cleanUp);

        setTimeout(() => {
            window.print();
        }, 100);
    });
}

// WhatsApp Paylaşım Butonu
if (btnShareProposalWhatsapp) {
    btnShareProposalWhatsapp.addEventListener('click', () => {
        if (!activeViewingProposal) return;
        const p = activeViewingProposal;

        let msg = `Sayın *${p.customer_name}*,\n\n`;
        msg += `*${p.proposal_no}* numaralı proforma fiyat teklifimiz aşağıda bilginize sunulmuştur:\n\n`;

        (p.proposal_items || []).forEach((it, idx) => {
            msg += `${idx + 1}. ${it.product_name} - ${it.quantity} ${it.unit} x ${formatCurrency(it.unit_price)} = *${formatCurrency(it.total_price)}*\n`;
        });

        msg += `\n*GENEL TOPLAM (KDV Dahil): ${formatCurrency(p.total_amount)}*\n`;
        if (p.valid_until) msg += `_Geçerlilik Tarihi: ${formatDateOnly(p.valid_until)}_\n`;
        msg += `\nNalbur & Hırdavat Malzemeleri\nİyi çalışmalar dileriz.`;

        const encodedMsg = encodeURIComponent(msg);
        const cleanPhone = (p.customer_phone || '').replace(/[^0-9]/g, '');

        let waUrl = `https://wa.me/?text=${encodedMsg}`;
        if (cleanPhone.length >= 10) {
            const intlPhone = cleanPhone.startsWith('90') ? cleanPhone : (cleanPhone.startsWith('0') ? '9' + cleanPhone : '90' + cleanPhone);
            waUrl = `https://wa.me/${intlPhone}?text=${encodedMsg}`;
        }

        window.open(waUrl, '_blank');
    });
}

// ========================================================
// TEKLİFİ SATIŞA / SİPARİŞE DÖNÜŞTÜR (STOK DÜŞÜRME)
// ========================================================
function confirmConvertToSale(proposal) {
    showConfirmModal({
        title: "Teklifi Satışa Dönüştür",
        body: `"${proposal.proposal_no}" numaralı teklif onaylanıp satışa dönüştürülsün mü? Ürün stokları depodan otomatik olarak düşülecektir.`,
        onConfirm: async () => {
            showLoader();
            try {
                // 1. Satış Kaydı Oluştur
                const { data: saleData, error: saleErr } = await supabase.from('sales').insert([{
                    customer_id: proposal.customer_id,
                    receipt_no: proposal.proposal_no.replace('TKF-', 'STS-'),
                    total_amount: proposal.total_amount,
                    payment_method: 'Veresiye',
                    customer_name: proposal.customer_name,
                    note: `Tekliften Satışa Döndü (#${proposal.proposal_no})`
                }]).select().single();

                if (saleErr) throw saleErr;

                // 2. Kalemleri ve Stok Çıkışlarını Ekle
                const items = proposal.proposal_items || [];
                for (const it of items) {
                    // Stok hareket kaydı (OUT)
                    await supabase.from('stock_movements').insert([{
                        customer_id: proposal.customer_id,
                        product_id: it.product_id,
                        movement_type: 'OUT',
                        quantity: it.quantity,
                        unit_price: it.unit_price,
                        total_price: it.total_price,
                        reference_id: saleData.id,
                        note: `Teklif Onayı Satışı (#${proposal.proposal_no})`
                    }]);

                    // Ürün stoğunu düşür
                    const { data: prodData } = await supabase.from('products').select('stock_quantity').eq('id', it.product_id).single();
                    if (prodData) {
                        const newStock = (Number(prodData.stock_quantity) || 0) - it.quantity;
                        await supabase.from('products').update({ stock_quantity: newStock }).eq('id', it.product_id);
                    }
                }

                // 3. Cari Hareketi Kaydı & Müşteri Borç Güncelleme
                if (proposal.customer_id) {
                    await supabase.from('customer_transactions').insert([{
                        customer_id: proposal.customer_id,
                        transaction_type: 'SALE',
                        payment_method: 'Açık Hesap',
                        debt: proposal.total_amount,
                        credit: 0,
                        amount: proposal.total_amount,
                        reference_id: saleData.id,
                        receipt_no: proposal.proposal_no,
                        description: `Teklif Onayı Satışı (#${proposal.proposal_no})`
                    }]);

                    const { data: custData } = await supabase.from('customers').select('balance').eq('id', proposal.customer_id).single();
                    if (custData) {
                        const newBal = (Number(custData.balance) || 0) - Number(proposal.total_amount);
                        await supabase.from('customers').update({ balance: newBal }).eq('id', proposal.customer_id);
                    }
                    document.dispatchEvent(new CustomEvent('transaction-saved'));
                }

                // 4. Teklif Durumunu Güncelle (APPROVED)
                await supabase.from('proposals').update({ status: 'APPROVED' }).eq('id', proposal.id);

                showToast(`Teklif #${proposal.proposal_no} onaylandı, satış kaydedildi, stoklar düşüldü ve cariye işlendi!`, "success");
                await fetchProposals();

            } catch (err) {
                console.error("Satışa dönüştürme hatası:", err);
                showToast("Dönüştürme başarısız: " + err.message, "error");
            } finally {
                hideLoader();
            }
        }
    });
}

function confirmDeleteProposal(proposal) {
    showConfirmModal({
        title: "Teklifi Sil",
        body: `"${proposal.proposal_no}" numaralı teklifi silmek istediğinize emin misiniz?`,
        onConfirm: async () => {
            showLoader();
            try {
                const { error } = await supabase.from('proposals').delete().eq('id', proposal.id);
                if (error) throw error;
                showToast("Teklif silindi.", "success");
                await fetchProposals();
            } catch (err) {
                console.error("Teklif silinemedi:", err);
                showToast("Teklif silinemedi: " + err.message, "error");
            } finally {
                hideLoader();
            }
        }
    });
}
