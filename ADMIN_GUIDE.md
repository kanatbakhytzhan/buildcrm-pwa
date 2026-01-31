# Админка BuildCRM

## Доступ администратора
- Администратор определяется полем is_admin в таблице users.
- Установите is_admin = true для нужного пользователя (например, в БД).
- Все админ-эндпоинты должны проверять Bearer token и is_admin.

## Вход
- URL: /admin/login
- Используйте логин/пароль администратора.

## Управление пользователями
- URL: /admin/users
- Доступные действия:
  - Создать пользователя (email, пароль, компания).
  - Сбросить пароль пользователя.
  - Активировать/деактивировать пользователя.

## Необходимые эндпоинты backend
- GET /api/admin/users
- POST /api/admin/users
- PATCH /api/admin/users/:id
- POST /api/admin/users/:id/reset-password

Все запросы должны требовать Authorization: Bearer <token>.
