alter table appearance
  add column if not exists header_bg text,
  add column if not exists footer_bg text,
  add column if not exists card_bg text,
  add column if not exists tabs_bg text,
  add column if not exists preview_bg text,
  add column if not exists primary_btn_bg text,
  add column if not exists primary_btn_text text,
  add column if not exists secondary_btn_bg text,
  add column if not exists secondary_btn_text text;