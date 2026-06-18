-- private storage buckets for photos and generated PDFs
insert into storage.buckets (id, name, public) values ('media','media',false)
  on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('documents','documents',false)
  on conflict (id) do nothing;
