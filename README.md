# 2GIS Bot / Lead Finder

Полностью готовая версия проекта: Telegram-бот + Vue/Vite + PostgreSQL.

> Важно: текущий поиск использует Geoapify/OpenStreetMap. Это не 2GIS API.

## Структура

```text
2gis-bot/
├── bot.js
├── db.js
├── schema.sql
├── package.json
├── .env            (локально, не в git)
├── .gitignore
├── index.html
├── src/
│   ├── main.js
│   └── style.css
└── public/
```

## 1. Установка

```bash
npm install
```

## 2. PostgreSQL

Создай базу:

```sql
CREATE DATABASE leadfinder;
```

Если PostgreSQL установлен через Homebrew:

```bash
brew services start postgresql
```

## 3. .env

Создай в корне проекта файл `.env` со своими ключами:

```env
API_TOKEN=токен_бота
GEOAPIFY_KEY=ключ_geoapify
OWNER_ID=твой_telegram_id
DATABASE_URL=postgresql://postgres:пароль@localhost:5432/leadfinder
DEFAULT_CITY=Алматы
MAX_PLACES=1500
MAX_PLACES_KZ=3000
```

`OWNER_ID` обязателен.

`MAX_PLACES` — сколько мест проверять при поиске по одному городу, `MAX_PLACES_KZ` — при поиске по всему Казахстану (делится поровну между 17 областями и городами Астана, Алматы, Шымкент).

## 4. Запуск бота

```bash
npm start
```

При первом запуске таблицы PostgreSQL создаются автоматически.

## 5. Frontend

Отдельно:

```bash
npm run frontend
```

или production build:

```bash
npm run build
```

## Команды бота

```text
/search кафе Алматы
/search все Алматы
/business Алматы
/search кафе Казахстан
/business весь Казахстан
/categories
/social
/mobile
/export
/template текст
/stats
/last
/clear
```

Вместо города можно написать `Казахстан`, `весь Казахстан`, `КЗ` или `РК` — тогда поиск идёт по всем областям страны. Такой поиск дольше (до пары минут) и тратит больше запросов Geoapify.

## Что хранится в PostgreSQL

- пользователи и настройки;
- найденные компании;
- поиски;
- результаты поисков;
- отметки «написал».

После перезапуска история не теряется.

## Безопасность

`.env` не коммитится благодаря `.gitignore`.
Токены и пароль PostgreSQL нельзя помещать в GitHub.
