-- GENBA Phase 1 schema
-- enums
create type case_status as enum ('reserved','visiting','visited','pending_pickup','closed','cancelled');
create type lead_source as enum ('phone','line','email','referral');
create type media_kind  as enum ('purchase','collection','id_doc');
create type doc_type     as enum ('purchase_slip','receipt');

-- staff
create table staff (
  id uuid primary key default gen_random_uuid(),
  line_user_id text unique,
  auth_user_id uuid,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index idx_staff_line_user_id on staff(line_user_id);

-- customers + customer_no 採番
create sequence customer_no_seq;
create table customers (
  id uuid primary key default gen_random_uuid(),
  customer_no text unique not null,
  name text not null,
  name_kana text,
  phone text,
  address text,
  created_at timestamptz not null default now()
);
create index idx_customers_phone on customers(phone);

create or replace function set_customer_no() returns trigger as $$
begin
  if new.customer_no is null then
    new.customer_no := 'C-' || lpad(nextval('customer_no_seq')::text, 6, '0');
  end if;
  return new;
end;
$$ language plpgsql;
create trigger trg_set_customer_no before insert on customers
  for each row execute function set_customer_no();

-- cases
create table cases (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id),
  status case_status not null default 'reserved',
  visit_at timestamptz,
  area text,
  desired_items text,
  source lead_source not null,
  referrer_ambassador_id uuid,
  registered_by uuid references staff(id),
  assigned_to uuid references staff(id),
  memo text,
  created_at timestamptz not null default now(),
  closed_at timestamptz
);
create index idx_cases_status on cases(status);
create index idx_cases_customer on cases(customer_id);

-- call_logs
create table call_logs (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references cases(id),
  called_at timestamptz not null,
  result_memo text,
  created_by uuid references staff(id),
  created_at timestamptz not null default now()
);

-- purchase_items
create table purchase_items (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references cases(id),
  name text not null,
  brand text,
  model text,
  condition text,
  amount integer not null,
  created_by uuid references staff(id),
  created_at timestamptz not null default now()
);
create index idx_purchase_items_case on purchase_items(case_id);

-- collection_items
create table collection_items (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references cases(id),
  item_name text not null,
  work_fee integer not null,
  created_by uuid references staff(id),
  created_at timestamptz not null default now()
);
create index idx_collection_items_case on collection_items(case_id);

-- media
create table media (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references cases(id),
  kind media_kind not null,
  purchase_item_id uuid references purchase_items(id),
  collection_item_id uuid references collection_items(id),
  storage_path text not null,
  created_at timestamptz not null default now()
);
create index idx_media_case on media(case_id);

-- documents
create table documents (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references cases(id),
  type doc_type not null,
  storage_path text not null,
  issued_at timestamptz not null default now(),
  sent_at timestamptz,
  sent_method text
);
create index idx_documents_case on documents(case_id);
