-- GENBA Phase 4 schema: 紹介フィー
create type payee_type as enum ('ambassador','tk');
create type fee_status as enum ('accrued','paid');

create table tk (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact text,
  payment_info text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table ambassadors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  route_code text unique not null,
  tk_id uuid references tk(id),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table fee_settings (
  id uuid primary key default gen_random_uuid(),
  rate_buy numeric not null,
  rate_work numeric not null,
  tk_share numeric not null,
  ambassador_share numeric not null,
  effective_from date not null,
  created_at timestamptz not null default now()
);

create table referral_fees (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references cases(id),
  ambassador_id uuid not null references ambassadors(id),
  tk_id uuid references tk(id),
  fee_buy integer not null,
  fee_work integer not null,
  fee_total integer not null,
  pay_to payee_type not null,
  pay_to_id uuid,
  tk_portion integer,
  ambassador_portion integer,
  status fee_status not null default 'accrued',
  accrued_at timestamptz not null default now(),
  paid_at timestamptz
);
create index idx_referral_fees_status on referral_fees(status);
create index idx_referral_fees_case on referral_fees(case_id);

-- cases.referrer_ambassador_id に FK を付与（Phase 1 で列のみ作成済み）
alter table cases
  add constraint cases_referrer_ambassador_fk
  foreign key (referrer_ambassador_id) references ambassadors(id);
