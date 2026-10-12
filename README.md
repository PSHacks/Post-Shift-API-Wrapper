# Post-Shift Console

Minimal dark web console for [Post-Shift.Ru](https://post-shift.ru/) temporary email API.

The project wraps the Post-Shift API in a clean Next.js interface: token-based login, account management, mailbox creation, inbox refresh, message viewing, and balance checks. Paid API actions are intentionally user-triggered only.

## Features

- Login by Post-Shift API `hash`
- Register a new Post-Shift account by email
- Store multiple API hashes locally in the browser
- Check balance per account
- Import active mailbox keys with `getkeys`
- Create temporary mailboxes
- Copy active mailbox address
- Manually refresh inbox
- Open messages in an isolated sandboxed iframe
- Clear, delete, and extend mailboxes
- Dark tiled UI inspired by Windows 11

## API Cost Awareness

According to `api_types.json`, these actions spend API balance:

- `new`
- `getlist`
- `getmail`
- `update`

For that reason, the app does not call them automatically. They are only executed after an explicit button click, and paid buttons are marked with `-1`.

Free actions such as `balance`, `livetime`, `getkeys`, `clear`, and `delete` are still kept under user control where it makes sense.

## Tech Stack

- Next.js
- React
- TypeScript
- CSS modules-free global styling
- Next API route as a small proxy to avoid browser-side CORS issues

## Installation

Requirements:

- Node.js 20+ recommended
- npm

Install dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

Open:

```text
http://127.0.0.1:3000
```

Build for production:

```bash
npm run build
```

Start production server:

```bash
npm run start
```

## Project Structure

```text
app/
  api/post-shift/route.ts  API proxy route
  globals.css             Global dark UI styles
  layout.tsx              Root layout
  page.tsx                Main application UI
api_types.json            Full Post-Shift API method description
next.config.ts            Next.js configuration
package.json              Scripts and dependencies
```

## Data Storage

User data is stored in browser `localStorage`:

- API hashes
- account labels
- imported/created mailbox keys
- selected account and mailbox

No database is required. Nothing is persisted on the server by this app.

## Security Notes

- API hashes are sensitive and should not be committed or shared.
- The app stores hashes only in the current browser's `localStorage`.
- Email content is rendered through `srcDoc` inside a sandboxed iframe.
- `getmail` is called with `cut=html` and `base64=decode` to reduce rendering risks and improve readability.

## Russian

# Post-Shift Console

Минималистичная темная веб-консоль для API временной почты [Post-Shift.Ru](https://post-shift.ru/).

Проект оборачивает Post-Shift API в удобный Next.js интерфейс: вход по токену, управление несколькими аккаунтами, создание временных ящиков, обновление входящих, просмотр писем и проверка баланса. Платные действия API специально выполняются только вручную.

## Возможности

- Вход по Post-Shift API `hash`
- Регистрация нового аккаунта по email
- Хранение нескольких API hash локально в браузере
- Проверка баланса для каждого аккаунта
- Импорт активных ключей ящиков через `getkeys`
- Создание временных почтовых ящиков
- Копирование активного адреса
- Ручное обновление входящих
- Просмотр писем в изолированном sandboxed iframe
- Очистка, удаление и продление ящиков
- Темный плиточный интерфейс в духе Windows 11

## Учет платных запросов

Согласно `api_types.json`, баланс расходуют эти действия:

- `new`
- `getlist`
- `getmail`
- `update`

Поэтому приложение не вызывает их автоматически. Они выполняются только после явного нажатия кнопки, а платные кнопки помечены как `-1`.

Бесплатные действия вроде `balance`, `livetime`, `getkeys`, `clear` и `delete` тоже оставлены под контролем пользователя там, где это уместно.

## Стек

- Next.js
- React
- TypeScript
- Глобальные CSS-стили без CSS modules
- Next API route как небольшой proxy, чтобы не упираться в CORS на фронтенде

## Установка

Требования:

- Node.js 20+ рекомендуется
- npm

Установить зависимости:

```bash
npm install
```

Запустить dev-сервер:

```bash
npm run dev
```

Открыть:

```text
http://127.0.0.1:3000
```

Собрать production build:

```bash
npm run build
```

Запустить production server:

```bash
npm run start
```

## Структура проекта

```text
app/
  api/post-shift/route.ts  Proxy route к API
  globals.css             Глобальные темные стили интерфейса
  layout.tsx              Root layout
  page.tsx                Основной интерфейс приложения
api_types.json            Полное описание методов Post-Shift API
next.config.ts            Конфигурация Next.js
package.json              Скрипты и зависимости
```

## Хранение данных

Пользовательские данные хранятся в `localStorage` браузера:

- API hash
- подписи аккаунтов
- импортированные и созданные ключи ящиков
- выбранный аккаунт и ящик

База данных не требуется. На сервере это приложение ничего не сохраняет.

## Заметки по безопасности

- API hash является чувствительным значением, его не стоит коммитить или передавать другим.
- Приложение хранит hash только в `localStorage` текущего браузера.
- Содержимое писем рендерится через `srcDoc` внутри sandboxed iframe.
- `getmail` вызывается с `cut=html` и `base64=decode`, чтобы снизить риски при отображении и повысить читаемость.
