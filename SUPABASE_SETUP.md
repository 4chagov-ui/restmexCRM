# SUPABASE_SETUP

## Назначение

Этот документ описывает, как запустить MVP-базу данных RestMex IT в Supabase.

Используется файл:

- `DATABASE.sql`

Первая версия базы включает только MVP-таблицы:

- `profiles`;
- `locations`;
- `location_tags`;
- `requests`;
- `request_comments`;
- `request_events`;
- `attachments`.

Telegram AI-таблицы не входят в первую версию базы данных. Они будут добавлены отдельной миграцией в Phase 2.

## 1. Создать проект Supabase

1. Открыть [Supabase Dashboard](https://supabase.com/dashboard).
2. Нажать `New project`.
3. Выбрать организацию.
4. Заполнить:
   - `Project name`: например `restmex-it`;
   - `Database password`: сохранить в надежном месте;
   - `Region`: выбрать ближайший регион.
5. Нажать `Create new project`.
6. Дождаться завершения создания проекта.

## 2. Выполнить DATABASE.sql

1. В Supabase Dashboard открыть созданный проект.
2. Перейти в `SQL Editor`.
3. Нажать `New query`.
4. Открыть локальный файл `DATABASE.sql`.
5. Скопировать весь SQL из файла.
6. Вставить SQL в Supabase SQL Editor.
7. Нажать `Run`.

После успешного выполнения должны появиться:

- enum-типы;
- 7 MVP-таблиц;
- indexes;
- views;
- RLS-политики.

## 3. Проверить таблицы

В Supabase Dashboard открыть `Table Editor`.

Проверить наличие таблиц:

- `profiles`;
- `locations`;
- `location_tags`;
- `requests`;
- `request_comments`;
- `request_events`;
- `attachments`.

Проверить, что нет таблиц:

- `telegram_chats`;
- `telegram_messages`;
- `ai_extractions`;
- `deduplication_candidates`;
- `current_tasks`;
- `today_plan`;
- `outsource_tasks`;
- `kiks_tasks`.

## 4. Проверить views

В `Table Editor` или через `SQL Editor` проверить views:

- `new_requests_view`;
- `mechanic_current_tasks_view`;
- `outsource_requests_view`;
- `closed_requests_view`.

Проверочный SQL:

```sql
select * from public.new_requests_view limit 10;
select * from public.mechanic_current_tasks_view limit 10;
select * from public.outsource_requests_view limit 10;
select * from public.closed_requests_view limit 10;
```

На пустой базе запросы должны выполниться без ошибок и вернуть 0 строк.

## 5. Создать Storage bucket для вложений

1. В Supabase Dashboard открыть `Storage`.
2. Нажать `New bucket`.
3. Название bucket: `attachments`.
4. Для MVP можно оставить bucket private.
5. Нажать `Create bucket`.

Таблица `attachments` хранит `storage_path`, а сами файлы лежат в Supabase Storage.

## 6. Получить Supabase URL и ANON KEY

1. В Supabase Dashboard открыть `Project Settings`.
2. Перейти в `API`.
3. Скопировать:
   - `Project URL`;
   - `anon public` key.

Эти значения понадобятся для Next.js.

## 7. Подключить Next.js

В корне Next.js-проекта создать файл `.env.local`.

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Установить зависимости:

```bash
npm install @supabase/supabase-js @supabase/ssr
```

Рекомендуемая структура подключения:

```text
lib/
  supabase/
    client.ts
    server.ts
  db/
    requests.ts
    locations.ts
    attachments.ts
  services/
    request-service.ts
    planning-service.ts
    task-service.ts
```

Важно: бизнес-логику не размещать внутри UI-компонентов. Страницы Next.js должны вызывать application services, а services уже работают с Supabase.

## 8. Создать первого пользователя

1. В Supabase Dashboard открыть `Authentication`.
2. Создать пользователя через `Add user`.
3. Скопировать `User UID`.
4. Добавить профиль в таблицу `profiles`.

Пример SQL:

```sql
insert into public.profiles (id, full_name, role, phone)
values (
  'USER_UID_HERE',
  'Администратор',
  'admin',
  null
);
```

После этого пользователь сможет войти в приложение и получить роль из `profiles`.

## 9. Smoke test базы

Создать тестовое заведение:

```sql
insert into public.locations (name, address, city, client_name)
values ('Тестовое заведение', 'Тестовый адрес', 'Москва', 'Тестовый клиент')
returning *;
```

Создать тестовую заявку:

```sql
insert into public.requests (
  location_id,
  title,
  description,
  request_type,
  urgency,
  status,
  source,
  planned_date,
  queue_position
)
select
  id,
  'Тестовая заявка',
  'Проверка работы MVP базы',
  'repair',
  'normal',
  'planned',
  'manual',
  current_date,
  1
from public.locations
where name = 'Тестовое заведение'
limit 1
returning *;
```

Проверить текущие задачи:

```sql
select * from public.mechanic_current_tasks_view;
```

Если заявка появилась в `mechanic_current_tasks_view`, базовая логика маршрута работает.

## 10. Что добавлять в Phase 2

Отдельной миграцией добавить Telegram AI-пайплайн:

- `telegram_chats`;
- `telegram_messages`;
- `ai_extractions`;
- `deduplication_candidates`;
- Telegram webhook;
- AI-классификацию сообщений;
- автоматическое создание черновиков заявок.

Не добавлять эти таблицы в `DATABASE.sql` первой версии.
