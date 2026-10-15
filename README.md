# Registration — Supabase + PostgreSQL

Регистрация и вход через Supabase Auth, плюс приватная таблица профилей PostgreSQL с Row Level Security (RLS).

## Файлы
- `index.html` — интерфейс регистрации/входа и профиль текущего пользователя.
- `supabase/schema.sql` — таблица профилей, RLS-политики и безопасный триггер создания профиля.

## 1. Создай базу данных
1. Создай проект в [Supabase](https://supabase.com/dashboard).
2. Открой **SQL Editor → New query**.
3. Скопируй содержимое [supabase/schema.sql](./supabase/schema.sql), запусти его и убедись, что запрос завершился без ошибок.
4. В **Project Settings → API** скопируй Project URL и **publishable key** (или legacy anon key). Никогда не копируй service_role/secret key в браузер.

## 2. Подключи сайт
Открой `index.html` и замени только две заглушки в начале скрипта:
- `PASTE_YOUR_SUPABASE_PROJECT_URL_HERE`
- `PASTE_YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY_HERE`

Publishable/anon key предназначен для использования на клиенте, но он не является механизмом защиты сам по себе. Безопасность данных обеспечивают RLS, минимальные права доступа и настройки Auth. **Не публикуй service_role key, пароль БД или секретные ключи.**

## 3. Настрой Auth перед реальным использованием
В Supabase Dashboard:
1. В **Authentication → URL Configuration** задай Site URL и точные разрешённые redirect URL.
2. Включи подтверждение электронной почты и настрой SMTP для надёжной доставки писем.
3. Проверь лимиты запросов/входа и включи защиту от скомпрометированных паролей, если доступно на плане.
4. Перед публикацией протестируй регистрацию, подтверждение email, вход, выход и редактирование профиля.

## Защита таблицы профилей
Таблица `public.profiles` хранит только `id`, `display_name`, `created_at`, `updated_at`. Пароли и токены в ней не хранятся.
- RLS включён и принудительно применяется.
- Пользователь может читать только строку, где `id = auth.uid()`.
- Пользователь может обновлять только собственный профиль и только колонку `display_name`.
- Клиентским ролям не разрешены создание и удаление строк напрямую; профиль создаёт триггер при регистрации Auth.
- В интерфейсе не показывается список всех пользователей.

## Важные ограничения
- Настоящее подключение не заработает, пока не создан проект Supabase, не применён SQL и не заполнены две настройки в `index.html`.
- GitHub Pages — только статический хостинг; база и Auth находятся в Supabase.
- Нельзя обещать «абсолютную» защиту. Для production также нужны аудит конфигурации, тестирование RLS двумя и более аккаунтами, контроль лимитов, резервные копии, мониторинг и проверка требований приватности.
- Не храните персональные данные, которые не нужны приложению. Не коммитьте секреты в GitHub.

## Ссылки
- [Supabase Dashboard](https://supabase.com/dashboard)
- [Supabase Auth](https://supabase.com/docs/guides/auth)
- [Postgres Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [GitHub Pages setup](https://docs.github.com/pages/getting-started-with-github-pages/creating-a-github-pages-site)
