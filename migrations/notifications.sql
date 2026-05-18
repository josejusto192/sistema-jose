-- Centro de notificações in-app
create table if not exists notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  title      text not null,
  body       text,
  url        text,
  type       text not null default 'default',
  read       boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_id_idx on notifications(user_id);
create index if not exists notifications_read_idx    on notifications(user_id, read);

alter table notifications enable row level security;

create policy "users manage own notifications"
  on notifications for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);
