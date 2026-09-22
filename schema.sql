-- =======================================================
-- SupaFastSale (Nalbur Stok, Kasa, Cari, Teklif & Fiyat Listesi)
-- HATASIZ VE TEKRAR ÇALIŞTIRILABİLİR (IDEMPOTENT) SQL ŞEMASI
-- =======================================================

-- 1. TABLOLAR (DOĞRU BAĞLANTI SIRASIYLA)

-- 1.1 Ürünler Tablosu (Önce oluşturulmalı çünkü diğer tablolar referans verir)
create table if not exists products (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) default auth.uid() not null,
    barcode text,
    name text not null,
    category text not null,
    unit text not null default 'Adet',
    buy_price numeric default 0 not null,
    sell_price numeric default 0 not null,
    stock_quantity numeric default 0 not null,
    min_stock numeric default 5 not null,
    shelf_location text,
    notes text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 1.2 Fiyat Listeleri Başlık Tablosu
create table if not exists price_lists (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) default auth.uid() not null,
    name text not null,
    code text,
    description text,
    default_discount_percent numeric default 0,
    valid_from date,
    valid_until date,
    is_active boolean default true not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 1.3 Fiyat Listesi Kalemleri (Ürün Başına Özel Fiyat)
create table if not exists price_list_items (
    id uuid primary key default gen_random_uuid(),
    price_list_id uuid references price_lists(id) on delete cascade not null,
    product_id uuid references products(id) on delete cascade not null,
    price numeric not null,
    min_quantity numeric default 1 not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    constraint unique_pricelist_product unique (price_list_id, product_id)
);

-- 1.4 Cari Kartlar Tablosu (Müşteriler & Tedarikçiler)
create table if not exists customers (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) default auth.uid() not null,
    type text default 'CUSTOMER' not null,
    name text not null,
    phone text,
    email text,
    city text,
    address text,
    tax_office text,
    tax_number text,
    balance numeric default 0 not null,
    default_price_list_id uuid references price_lists(id) on delete set null,
    notes text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 1.5 Satış Fişleri Tablosu (Kasa / POS)
create table if not exists sales (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) default auth.uid() not null,
    customer_id uuid references customers(id) on delete set null,
    price_list_id uuid references price_lists(id) on delete set null,
    receipt_no text not null,
    total_amount numeric default 0 not null,
    payment_method text default 'Nakit' not null,
    customer_name text,
    note text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 1.6 Satış Detay Kalemleri Tablosu
create table if not exists sale_items (
    id uuid primary key default gen_random_uuid(),
    sale_id uuid references sales(id) on delete cascade not null,
    product_id uuid references products(id) on delete set null,
    product_name text not null,
    quantity numeric not null,
    unit text not null default 'Adet',
    unit_price numeric not null,
    total_price numeric not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 1.7 Teklif ve Siparişler Tablosu (Proforma Fatura)
create table if not exists proposals (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) default auth.uid() not null,
    proposal_no text not null,
    type text default 'PROPOSAL' not null,
    customer_id uuid references customers(id) on delete set null,
    price_list_id uuid references price_lists(id) on delete set null,
    customer_name text not null,
    customer_phone text,
    status text default 'DRAFT' not null,
    issue_date date default current_date not null,
    valid_until date,
    subtotal numeric default 0 not null,
    discount_amount numeric default 0 not null,
    tax_rate numeric default 20 not null,
    tax_amount numeric default 0 not null,
    total_amount numeric default 0 not null,
    terms text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 1.8 Teklif & Sipariş Kalemleri
create table if not exists proposal_items (
    id uuid primary key default gen_random_uuid(),
    proposal_id uuid references proposals(id) on delete cascade not null,
    product_id uuid references products(id) on delete set null,
    product_name text not null,
    unit text default 'Adet' not null,
    quantity numeric not null,
    unit_price numeric not null,
    total_price numeric not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 1.9 Stok Hareketleri Tablosu (Giriş / Çıkış / Zayi / Düzeltme)
create table if not exists stock_movements (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) default auth.uid() not null,
    customer_id uuid references customers(id) on delete set null,
    product_id uuid references products(id) on delete cascade not null,
    movement_type text not null,
    quantity numeric not null,
    unit_price numeric default 0,
    total_price numeric default 0,
    reference_id uuid,
    note text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- =======================================================
-- 2. İNDEKSLER (PERFORMANS VE HIZLI ARAMA)
-- =======================================================

create index if not exists idx_products_user on products(user_id);
create index if not exists idx_products_category on products(category);
create index if not exists idx_products_barcode on products(barcode);
create index if not exists idx_products_name on products(name);

create index if not exists idx_price_lists_user on price_lists(user_id);
create index if not exists idx_price_list_items_list on price_list_items(price_list_id);
create index if not exists idx_price_list_items_product on price_list_items(product_id);

create index if not exists idx_customers_user on customers(user_id);
create index if not exists idx_customers_name on customers(name);
create index if not exists idx_customers_phone on customers(phone);

create index if not exists idx_sales_user on sales(user_id);
create index if not exists idx_sales_created on sales(created_at desc);

create index if not exists idx_proposals_user on proposals(user_id);
create index if not exists idx_proposals_no on proposals(proposal_no);

create index if not exists idx_stock_movements_user on stock_movements(user_id);
create index if not exists idx_stock_movements_product on stock_movements(product_id);

-- =======================================================
-- 3. GÜVENLİK (ROW LEVEL SECURITY - RLS)
-- =======================================================

alter table products enable row level security;
alter table price_lists enable row level security;
alter table price_list_items enable row level security;
alter table customers enable row level security;
alter table sales enable row level security;
alter table sale_items enable row level security;
alter table proposals enable row level security;
alter table proposal_items enable row level security;
alter table stock_movements enable row level security;

-- Var olan politikaları güvenle temizle (tekrar çalıştırıldığında çakışmayı önler)
drop policy if exists "Users can manage their own products" on products;
drop policy if exists "Users can manage their own price lists" on price_lists;
drop policy if exists "Users can manage their own price list items" on price_list_items;
drop policy if exists "Users can manage their own customers" on customers;
drop policy if exists "Users can manage their own sales" on sales;
drop policy if exists "Users can manage their own sale items" on sale_items;
drop policy if exists "Users can manage their own proposals" on proposals;
drop policy if exists "Users can manage their own proposal items" on proposal_items;
drop policy if exists "Users can manage their own stock movements" on stock_movements;

-- Yeniden Oluştur:
create policy "Users can manage their own products"
on products for all to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can manage their own price lists"
on price_lists for all to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can manage their own price list items"
on price_list_items for all to authenticated
using (
    exists (
        select 1 from price_lists
        where price_lists.id = price_list_items.price_list_id
        and price_lists.user_id = auth.uid()
    )
)
with check (
    exists (
        select 1 from price_lists
        where price_lists.id = price_list_items.price_list_id
        and price_lists.user_id = auth.uid()
    )
);

create policy "Users can manage their own customers"
on customers for all to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can manage their own sales"
on sales for all to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can manage their own sale items"
on sale_items for all to authenticated
using (
    exists (
        select 1 from sales
        where sales.id = sale_items.sale_id
        and sales.user_id = auth.uid()
    )
)
with check (
    exists (
        select 1 from sales
        where sales.id = sale_items.sale_id
        and sales.user_id = auth.uid()
    )
);

create policy "Users can manage their own proposals"
on proposals for all to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can manage their own proposal items"
on proposal_items for all to authenticated
using (
    exists (
        select 1 from proposals
        where proposals.id = proposal_items.proposal_id
        and proposals.user_id = auth.uid()
    )
)
with check (
    exists (
        select 1 from proposals
        where proposals.id = proposal_items.proposal_id
        and proposals.user_id = auth.uid()
    )
);

create policy "Users can manage their own stock movements"
on stock_movements for all to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- =======================================================
-- 4. BİRLEŞTİRİLMİŞ GÖRÜNÜM (VIEW)
-- =======================================================

drop view if exists active_stock_movements;

create or replace view active_stock_movements with (security_invoker = on) as
select
    sm.id as movement_id,
    sm.movement_type,
    sm.quantity,
    sm.unit_price,
    sm.total_price,
    sm.reference_id,
    sm.note,
    sm.created_at,
    sm.user_id,
    p.id as product_id,
    p.name as product_name,
    p.category as product_category,
    p.unit as product_unit,
    p.barcode as product_barcode,
    p.shelf_location,
    c.name as customer_name
from stock_movements sm
join products p on sm.product_id = p.id
left join customers c on sm.customer_id = c.id;
