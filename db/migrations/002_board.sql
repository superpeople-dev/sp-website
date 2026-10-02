-- Bugs & Ideas, the roadmap and Completed: what Reflet kept until 02.10.2026, now our own tables
-- (lib/reflet.ts). Ids of what came from Reflet are kept, so links to items stay the same. Times are
-- epoch milliseconds, as in the code.

-- The type tags (bug-report, feature-request, ...: slug set) and the platforms (Game, Launcher, ...).
create table tags (
  id text primary key,
  name text not null,
  slug text,
  color text not null default '#9a9a9a',
  position int not null default 0
);

-- An idea, a bug report or a task. publication: "pending" while a new idea waits for review (only
-- admins see it), "approved" once anyone may. imported_votes: upvotes from Reflet whose voter is not
-- known (they count, but nobody's "voted" shows for them).
create table items (
  id text primary key,
  title text not null,
  description text not null default '',
  status text not null check (status in ('open', 'under_review', 'planned', 'in_progress', 'completed', 'closed')),
  publication text not null default 'approved' check (publication in ('internal', 'pending', 'approved', 'rejected')),
  author_id text,
  author_name text,
  author_avatar text,
  imported_votes int not null default 0,
  created_at bigint not null,
  updated_at bigint not null,
  completed_at bigint
);
create index items_by_status on items (status, created_at desc);

create table item_tags (
  item_id text not null references items (id) on delete cascade,
  tag_id text not null references tags (id) on delete cascade,
  primary key (item_id, tag_id)
);

-- Upvotes, one per user and item (Discord id). Downvotes are in the downvotes table (001).
create table votes (
  item_id text not null references items (id) on delete cascade,
  user_id text not null,
  at bigint not null,
  primary key (item_id, user_id)
);
create index votes_by_user on votes (user_id);

-- Comments, oldest first. The commenter's Discord profile is in authors, under the comment's id.
create table comments (
  id text primary key,
  item_id text not null references items (id) on delete cascade,
  author_id text,
  author_name text,
  author_avatar text,
  body text not null,
  is_official boolean not null default false,
  created_at bigint not null,
  updated_at bigint not null
);
create index comments_by_item on comments (item_id, created_at);

-- Images and videos on a post, in the branch's object storage (bucket "media", key below).
create table media (
  id text primary key,
  item_id text not null references items (id) on delete cascade,
  key text not null,
  mime_type text not null,
  filename text not null,
  size bigint not null,
  created_at bigint not null
);
create index media_by_item on media (item_id, created_at);
