-- GENBA Phase 2 schema: 本人確認・精算・古物台帳

-- customers: 法定項目（職業・生年）
alter table customers add column occupation text;
alter table customers add column birth_year integer;

-- cases: 本人確認情報（その取引固有）
alter table cases add column verification_method text;
alter table cases add column id_media_id uuid references media(id);

-- settlements（精算）
create table settlements (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null unique references cases(id),
  buy_total integer not null,
  work_total integer not null,
  net_amount integer not null,
  cash_settled integer not null,
  settled_at timestamptz not null default now(),
  settled_by uuid references staff(id)
);

-- kobutsu_daicho（古物台帳・法定）
create table kobutsu_daicho (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references cases(id),
  purchase_item_id uuid not null references purchase_items(id),
  transaction_date date not null,
  item_description text not null,
  quantity integer not null default 1,
  item_characteristics text,
  price integer not null,
  customer_name text not null,
  customer_address text not null,
  customer_occupation text not null,
  customer_age integer not null,
  verification_method text not null,
  id_media_id uuid references media(id),
  created_at timestamptz not null default now()
);
create index idx_kobutsu_case on kobutsu_daicho(case_id);
create index idx_kobutsu_txdate on kobutsu_daicho(transaction_date);
