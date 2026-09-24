// ========================================================
// DASHBOARD (ÖZET PANEL) MODÜLÜ
// ========================================================

import { supabase, showLoader, hideLoader, showToast, showView, formatCurrency, formatNumber, formatDateTime } from './supabase.js';

// DOM Elemanları
const statTotalProducts = document.getElementById('stat-total-products');
const statTotalStock = document.getElementById('stat-total-stock');
const statCriticalCount = document.getElementById('stat-critical-count');
const statTodayRevenue = document.getElementById('stat-today-revenue');
const criticalBadgeCount = document.getElementById('critical-badge-count');
const criticalTbody = document.getElementById('dashboard-critical-tbody');
const recentTbody = document.getElementById('dashboard-recent-tbody');

// Butonlar
const dashBtnQuickSale = document.getElementById('dash-btn-quick-sale');
const dashBtnNewProduct = document.getElementById('dash-btn-new-product');
const dashViewAllMovements = document.getElementById('dash-view-all-movements');

if (dashBtnQuickSale) {
    dashBtnQuickSale.addEventListener('click', () => showView('pos'));
}

if (dashBtnNewProduct) {
    dashBtnNewProduct.addEventListener('click', () => showView('products', { openNew: true }));
}

if (dashViewAllMovements) {
    dashViewAllMovements.addEventListener('click', () => showView('movements'));
}

// Sayfa açıldığında son bilinen verileri önbellekten anında göster (F5'te 0 görünmesini önler)
function restoreCachedDashboardStats() {
    try {
        const cached = localStorage.getItem('nalbur_dashboard_stats');
        if (cached) {
            const data = JSON.parse(cached);
            if (statTotalProducts && data.totalProducts !== undefined) {
                statTotalProducts.innerText = formatNumber(data.totalProducts);
            }
            if (statTotalStock && data.totalStock !== undefined) {
                statTotalStock.innerText = formatNumber(data.totalStock);
            }
            if (statCriticalCount && data.criticalCount !== undefined) {
                statCriticalCount.innerText = formatNumber(data.criticalCount);
            }
            if (statTodayRevenue && data.todayRevenue !== undefined) {
                statTodayRevenue.innerText = formatCurrency(data.todayRevenue);
            }
            if (criticalBadgeCount && data.criticalCount !== undefined) {
                criticalBadgeCount.innerText = `${data.criticalCount} Ürün`;
            }
        }
    } catch (e) {
        console.warn("Önbellek okunamadı:", e);
    }
}
restoreCachedDashboardStats();

let isLoadingDashboard = false;

// Dashboard Sayfası Yüklendiğinde Dinle
document.addEventListener('view-dashboard-loaded', async () => {
    await loadDashboardData();
});

export async function loadDashboardData() {
    if (!supabase || isLoadingDashboard) return;

    // Oturumun hazır olduğunu kontrol et (RLS kuralları için auth.uid() gerekir)
    try {
        let { data: { session } } = await supabase.auth.getSession();
        if (!session || !session.user) {
            // Supabase auth depolama senkronizasyonu için kısa bir tolerans ver
            await new Promise(res => setTimeout(res, 200));
            const retry = await supabase.auth.getSession();
            session = retry.data?.session;
        }
        if (!session || !session.user) {
            console.warn("Dashboard: Oturum henüz aktif değil, veri çekimi ertelendi.");
            return;
        }
    } catch (e) {
        console.warn("Oturum kontrolü:", e);
    }

    isLoadingDashboard = true;
    showLoader();
    try {
        // Bugünün başlangıcı (00:00:00)
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        const todayISO = startOfToday.toISOString();

        // Paralel Veri Çekimi
        const [productsRes, todaySalesRes, recentMovementsRes] = await Promise.all([
            // 1. Tüm ürünler (Toplam sayı, toplam stok ve kritik stok analizi için)
            supabase.from('products').select('id, name, category, unit, stock_quantity, min_stock, buy_price, sell_price, shelf_location'),
            
            // 2. Bugünkü Satışlar (Ciro hesabı)
            supabase.from('sales').select('total_amount').gte('created_at', todayISO),
            
            // 3. Son 10 Stok Hareketi
            supabase.from('stock_movements').select('*, products(name, category, unit)')
                .order('created_at', { ascending: false })
                .limit(10)
        ]);

        if (productsRes.error) throw productsRes.error;
        if (todaySalesRes.error) throw todaySalesRes.error;

        const products = productsRes.data || [];
        const todaySales = todaySalesRes.data || [];
        const recentMovements = recentMovementsRes.data || [];

        // 1. İstatistikleri Hesapla
        const totalProductKinds = products.length;
        let totalStockCount = 0;
        const criticalProducts = [];

        products.forEach(p => {
            const qty = Number(p.stock_quantity) || 0;
            const min = Number(p.min_stock) || 0;
            totalStockCount += qty;

            if (qty <= min) {
                criticalProducts.push(p);
            }
        });

        const todayRev = todaySales.reduce((acc, sale) => acc + (Number(sale.total_amount) || 0), 0);

        // 2. Sayaçları Güncelle
        if (statTotalProducts) statTotalProducts.innerText = formatNumber(totalProductKinds);
        if (statTotalStock) statTotalStock.innerText = formatNumber(totalStockCount);
        if (statCriticalCount) statCriticalCount.innerText = formatNumber(criticalProducts.length);
        if (statTodayRevenue) statTodayRevenue.innerText = formatCurrency(todayRev);
        if (criticalBadgeCount) criticalBadgeCount.innerText = `${criticalProducts.length} Ürün`;

        // 3. Son verileri önbelleğe kaydet (F5 yapıldığında hemen gösterilmek üzere)
        try {
            localStorage.setItem('nalbur_dashboard_stats', JSON.stringify({
                totalProducts: totalProductKinds,
                totalStock: totalStockCount,
                criticalCount: criticalProducts.length,
                todayRevenue: todayRev
            }));
        } catch (e) {}

        // 4. Kritik Stok Tablosunu Çiz
        renderCriticalTable(criticalProducts);

        // 5. Son İşlemler Tablosunu Çiz
        renderRecentMovementsTable(recentMovements);

    } catch (err) {
        console.error("Dashboard verisi yüklenirken hata:", err);
        showToast("Dükkan verileri yüklenirken hata oluştu.", "error");
    } finally {
        isLoadingDashboard = false;
        hideLoader();
    }
}

// Kritik Stok Tablosu
function renderCriticalTable(items) {
    if (!criticalTbody) return;
    criticalTbody.innerHTML = '';

    if (items.length === 0) {
        criticalTbody.innerHTML = `
            <tr>
                <td colspan="5" class="empty-state" style="padding: 1.5rem;">
                    <i class="fa-solid fa-circle-check" style="color: var(--accent-success); font-size: 1.8rem;"></i>
                    <p style="margin-top: 0.35rem;">Harika! Kritik seviyede tükenmekte olan ürün bulunmuyor.</p>
                </td>
            </tr>
        `;
        return;
    }

    items.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <div style="font-weight: 700;">${item.name}</div>
                <div style="font-size: 0.75rem; color: var(--text-dim);">${item.shelf_location ? 'Raf: ' + item.shelf_location : ''}</div>
            </td>
            <td><span class="badge badge-amber">${item.category}</span></td>
            <td>
                <span class="mono-text" style="color: var(--accent-danger); font-weight: 800;">
                    ${item.stock_quantity} ${item.unit}
                </span>
            </td>
            <td class="mono-text" style="color: var(--text-muted);">${item.min_stock} ${item.unit}</td>
            <td>
                <button class="btn btn-sm btn-success quick-stock-in-btn" data-id="${item.id}" data-name="${item.name}" data-unit="${item.unit}" data-stock="${item.stock_quantity}">
                    <i class="fa-solid fa-plus"></i> Giriş Yap
                </button>
            </td>
        `;
        criticalTbody.appendChild(tr);
    });

    // Giriş Yap butonlarını bağla
    criticalTbody.querySelectorAll('.quick-stock-in-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const prod = {
                id: btn.getAttribute('data-id'),
                name: btn.getAttribute('data-name'),
                unit: btn.getAttribute('data-unit'),
                stock_quantity: btn.getAttribute('data-stock')
            };
            // products modülündeki stok modalını aç
            const event = new CustomEvent('open-stock-in-modal', { detail: prod });
            document.dispatchEvent(event);
        });
    });
}

// Son Stok Hareketleri Tablosu
function renderRecentMovementsTable(movements) {
    if (!recentTbody) return;
    recentTbody.innerHTML = '';

    if (movements.length === 0) {
        recentTbody.innerHTML = `
            <tr>
                <td colspan="5" class="empty-state" style="padding: 1.5rem;">
                    <i class="fa-solid fa-clock-rotate-left" style="font-size: 1.8rem;"></i>
                    <p style="margin-top: 0.35rem;">Henüz kayıtlı bir stok veya satış hareketi yok.</p>
                </td>
            </tr>
        `;
        return;
    }

    movements.forEach(m => {
        const prodName = m.products ? m.products.name : 'Ürün';
        const unit = m.products ? m.products.unit : 'Adet';
        
        let typeBadge = '';
        if (m.movement_type === 'IN') {
            typeBadge = '<span class="badge badge-green"><i class="fa-solid fa-arrow-down"></i> Giriş</span>';
        } else if (m.movement_type === 'OUT') {
            typeBadge = '<span class="badge badge-amber"><i class="fa-solid fa-arrow-up"></i> Satış</span>';
        } else if (m.movement_type === 'WASTE') {
            typeBadge = '<span class="badge badge-red"><i class="fa-solid fa-ban"></i> Fire</span>';
        } else {
            typeBadge = '<span class="badge badge-blue"><i class="fa-solid fa-sliders"></i> Düzeltme</span>';
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-size: 0.82rem; color: var(--text-muted);">${formatDateTime(m.created_at)}</td>
            <td style="font-weight: 600;">${prodName}</td>
            <td>${typeBadge}</td>
            <td class="mono-text" style="font-weight: 700;">${m.quantity} ${unit}</td>
            <td class="mono-text">${m.total_price ? formatCurrency(m.total_price) : '-'}</td>
        `;
        recentTbody.appendChild(tr);
    });
}
