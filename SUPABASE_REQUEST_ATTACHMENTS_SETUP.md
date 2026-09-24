# SUPABASE_REQUEST_ATTACHMENTS_SETUP

Пошаговая инструкция после применения `SUPABASE_REQUEST_ATTACHMENTS.sql`.

## 1. SQL migration

1. Открыть Supabase Dashboard → SQL Editor.
2. Выполнить весь файл `SUPABASE_REQUEST_ATTACHMENTS.sql`.
3. Если секция Storage policies упала с ошибкой «bucket does not exist» — это нормально: сначала создайте bucket (шаг 2), затем выполните только блок Storage policies из конца SQL-файла.

## 2. Создать private bucket

1. Dashboard → Storage → New bucket.
2. Name: `request-attachments`
3. Public bucket: **OFF** (private).
4. File size limit: например `10 MB` (клиент уже сжимает фото).
5. Allowed MIME types (опционально):
   - `image/jpeg`
   - `image/png`
   - `image/webp`
6. Create bucket.

## 3. Storage policies

Если policies не применились вместе с migration:

1. SQL Editor → выполнить блок `storage.objects` из конца `SUPABASE_REQUEST_ATTACHMENTS.sql`
   (drop + create трёх policies: read / insert / delete).

Либо вручную в Storage → Policies для bucket `request-attachments`:

- SELECT / INSERT / DELETE для `authenticated`
- условие доступа через `can_access_request_media((storage.foldername(name))[1]::uuid)`

## 4. Проверка

```sql
select public.can_access_request_media('00000000-0000-0000-0000-000000000000');
-- должно вернуть false без ошибки

select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'attachments'
  and column_name in ('comment_id', 'file_size');
```

## 5. Путь файлов

`{request_id}/{attachment_uuid}.jpg` (или `.png` / `.webp`)

Первый сегмент пути = `request_id`. Именно его читают Storage policies.
