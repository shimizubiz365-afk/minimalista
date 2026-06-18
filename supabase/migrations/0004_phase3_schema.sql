-- GENBA Phase 3 schema: 在庫・販売
create type product_status as enum ('in_stock','listed','sold');
create type sales_channel  as enum ('ebay','mercari','yahoo','store','other');

create table products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status product_status not null default 'in_stock',
  condition text,
  cost integer not null,
  acquired_case_id uuid references cases(id),
  acquired_customer_id uuid references customers(id),
  acquired_by_staff_id uuid references staff(id),
  created_at timestamptz not null default now(),
  listed_at timestamptz,
  sold_at timestamptz
);
create index idx_products_status on products(status);
create index idx_products_acquired_case on products(acquired_case_id);

create table product_source_items (
  product_id uuid not null references products(id) on delete cascade,
  purchase_item_id uuid not null references purchase_items(id),
  primary key (product_id, purchase_item_id)
);

create table sales (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id),
  sale_price integer not null,
  channel sales_channel,
  sold_at date not null,
  gross_profit integer not null,
  created_by uuid references staff(id),
  created_at timestamptz not null default now()
);
create index idx_sales_product on sales(product_id);
