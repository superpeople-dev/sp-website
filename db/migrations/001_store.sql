-- What the site kept in Upstash Redis until 02.10.2026 (lib/store.ts, lib/downloads.ts,
-- lib/consentstore.ts, lib/ipv4.ts), now in Postgres. Records keep the shape the code already uses,
-- as jsonb; times are epoch milliseconds (bigint), as in the code.

-- Bans (lib/store.ts Ban), by Discord id.
create table bans (
  id text primary key,
  data jsonb not null
);

-- The profile saved with each idea or comment, by Reflet item id.
create table authors (
  item_id text primary key,
  data jsonb not null
);

-- Everyone's Discord profile as of their last sign-in, by Discord id.
create table profiles (
  id text primary key,
  data jsonb not null
);

-- Admins as the owners set them (lib/staff.ts StaffEntry), by Discord id.
create table staff (
  id text primary key,
  data jsonb not null
);

-- Downvotes: one row per item and user. Reflet keeps the upvotes.
create table downvotes (
  item_id text not null,
  user_id text not null,
  primary key (item_id, user_id)
);
create index downvotes_by_user on downvotes (user_id);

-- The admin activity log, newest last; the last 5,000 are kept.
create table events (
  seq bigserial primary key,
  data jsonb not null
);

-- Items whose comments an admin turned off.
create table comments_off (
  item_id text primary key
);

-- Who works on an item: an admin's Discord id. No row: the whole team's.
create table assignees (
  item_id text primary key,
  staff_id text not null,
  by_id text not null,
  at bigint not null
);

-- Notifications, newest last; the last 50 per user are kept.
create table notices (
  seq bigserial primary key,
  user_id text not null,
  data jsonb not null
);
create index notices_by_user on notices (user_id, seq desc);

-- When each user last opened their notifications.
create table notices_seen (
  user_id text primary key,
  at bigint not null
);

-- Admins' API keys, by the SHA-256 of the key (the key itself is never stored). last_used_at apart:
-- a use that races a revoke must not write the key back.
create table api_keys (
  hash text primary key,
  data jsonb not null,
  last_used_at bigint
);

-- The terms each player accepted in the launcher, by Discord id.
create table launcher_terms (
  id text primary key,
  version text not null,
  at bigint not null
);

-- Each Discord account's data choice (lib/consent.ts).
create table consent (
  user_id text primary key,
  choice jsonb not null,
  version int not null,
  at bigint not null
);

-- Short-lived values that Redis kept with an expiry: launcher sign-in codes, who changed an item's
-- status, tasks just created, a player's IPv4, download links handed out. Read only while
-- expires_at is ahead; old rows are swept now and then.
create table expiring (
  key text primary key,
  value jsonb not null,
  expires_at timestamptz not null
);
create index expiring_by_expiry on expiring (expires_at);

-- Counts per key and hour: bytes downloaded per account and IP (lib/downloads.ts), and how many
-- times something happened this hour (countThisHour).
create table hourly (
  key text not null,
  hour bigint not null,
  amount bigint not null,
  primary key (key, hour)
);

-- Download blocks (lib/downloads.ts), under "account:<id>" and "ip:<ip>".
create table download_blocks (
  key text primary key,
  data jsonb not null,
  until bigint not null
);
