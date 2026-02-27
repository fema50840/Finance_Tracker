# Finance Tracker MVP (RU)

Простой fullstack-проект для ведения личного финансового дневника.

Проект демонстрирует:

* JWT-авторизацию
* REST API
* серверную пагинацию и фильтрацию
* работу с PostgreSQL через Prisma
* построение графиков на основе SQL
* CSV экспорт и импорт
* Swagger-документацию API

---

# 1. О проекте

## Цель

Приложение позволяет:

* регистрироваться и входить в систему
* добавлять доходы и расходы
* просматривать список транзакций
* фильтровать и сортировать данные
* видеть динамику баланса на графике
* экспортировать и импортировать данные в CSV

Это учебный fullstack-проект, который показывает взаимодействие:

```
React (frontend)
        ↓
Express API (backend)
        ↓
PostgreSQL (database)
```

---

# 2. Архитектура

## Общая схема

```
Browser (React + Vite)
        ↓ HTTP
Express server (Node.js)
        ↓ Prisma ORM
PostgreSQL
```

### Клиент:

* React 19
* React Router
* Recharts (графики)
* Vite (сборка)

### Сервер:

* Express
* Prisma ORM
* PostgreSQL
* JWT (jsonwebtoken)
* bcrypt
* Swagger UI
* multer + csv-parse

---

# 3. Структура проекта

```
finance-tracker-mvp/
  client/   → фронтенд (React)
  server/   → бэкенд (Express + Prisma)
```

## client/

### Основные файлы:

* `App.tsx` — маршрутизация
* `hooks/useAuth.ts` — управление токеном
* `api/client.ts` — createApiFetch
* `pages/`
  * AuthPage
  * DashboardPage
  * TransactionsPage
  * ChartsPage
* `components/`
  * ProtectedRoute
  * EditModal
  * DeleteModal

---

## server/

### Основные файлы:

* `src/index.ts` — все маршруты API
* `src/auth.ts` — JWT логика
* `src/swagger.ts` — OpenAPI
* `prisma/schema.prisma` — структура БД

---

# 4. Как работает авторизация

1. Пользователь регистрируется → сервер создаёт пользователя.
2. При логине сервер возвращает JWT токен.
3. Клиент сохраняет токен в `localStorage` (`ft_token`).
4. Каждый запрос к API отправляется с:

```
Authorization: Bearer <token>
```

Если токен истёк:

* сервер возвращает 401
* клиент очищает токен
* пользователь считается разлогиненным

---

# 5. Логика работы приложения

## 5.1 Transactions

Endpoint:

```
GET /api/transactions
```

Поддерживает:

* пагинацию (limit, offset)
* фильтрацию (type, card, category, q)
* сортировку (date_asc, date_desc, amount_asc, amount_desc)

Ответ сервера:

```json
{
  "total": 102,
  "items": [...],
  "limit": 20,
  "offset": 0
}
```

---

## 5.2 График баланса

Endpoint:

```
GET /api/balance-series?from=YYYY-MM-DD&to=YYYY-MM-DD
```

Логика:

* генерируется серия дат
* считается дневной delta
* считается накопительный баланс (running total)

Используется SQL + window functions.

---

## 5.3 CSV

### Экспорт

```
GET /api/backup/transactions.csv
```

### Импорт

```
POST /api/backup/transactions/import
```

Файл отправляется как `multipart/form-data`.

Есть защита от дубликатов через `importKey`.

---

# 6. Документация API

Swagger доступен по адресу:

```
http://localhost:3001/api-docs
```

Можно тестировать API прямо в браузере.

---

# 7. Тестирование через Postman

### Регистрация:

POST `/auth/register`

### Логин:

POST `/auth/login`

### Для защищённых запросов:

Header:

```
Authorization: Bearer <token>
```

---

# 8. Развёртывание проекта (с нуля)

Ниже инструкция для новичков.

---

## 8.1 Что нужно установить

### 1️⃣ Git

Проверка:

```
git --version
```

### 2️⃣ Node.js (LTS)

Проверка:

```
node -v
npm -v
```

### 3️⃣ PostgreSQL (Desktop версия)

* Windows → PostgreSQL Installer + pgAdmin
* Mac → Postgres.app

Создать базу данных:

```
moneycheck
```

---

## 8.2 Скачивание проекта

```
git clone <ССЫЛКА_НА_РЕПО>
cd finance-tracker-mvp
```

---

## 8.3 Настройка сервера

```
cd server
npm install
```

Создать файл:

```
server/.env
```

Пример:

```
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/moneycheck?schema=public"
JWT_SECRET="super_long_random_secret_change_me"
JWT_EXPIRES_IN="7d"
```

---

### Prisma

```
npx prisma generate
npx prisma migrate dev
```

---

### Запуск сервера

```
npm run dev
```

Проверка:

```
http://localhost:3001/health
```

---

## 8.4 Запуск клиента

Открыть второй терминал:

```
cd client
npm install
npm run dev
```

Открыть:

```
http://localhost:5173
```

---

# ⚠ Частые ошибки

### Prisma не подключается к БД

Проверь:

* порт
* пароль
* создана ли база

### npm не работает

Node не установлен.

### CORS

Фронт должен работать на `http://localhost:5173`.

---

# 📈 Возможные улучшения

* рефакторинг auth через Context
* refresh токены
* docker-compose
* мультикарточная система
* деплой на VPS
* unit тесты



# Finance Tracker MVP (EN)

A fullstack personal finance tracker built with  **React + Express + PostgreSQL** .

This project demonstrates:

* JWT authentication
* REST API design
* Server-side pagination & filtering
* PostgreSQL + Prisma ORM
* Balance time-series with SQL window functions
* CSV export & import
* Swagger API documentation
* Clean separation between client and server

---

# 1. Project Overview

## Purpose

This application allows users to:

* Register and log in
* Add income and expense transactions
* Filter and paginate transaction history
* Track balance dynamically
* View charts of balance over time
* Export/import data via CSV

It is designed as an educational fullstack project demonstrating real-world backend + frontend interaction.

---

# 2. Architecture

## System Overview

```
Browser (React + Vite)
        ↓ HTTP
Express API (Node.js)
        ↓ Prisma ORM
PostgreSQL
```

### Frontend stack:

* React 19
* React Router
* Recharts (charts)
* Vite
* TypeScript

### Backend stack:

* Express
* Prisma ORM
* PostgreSQL
* JWT (jsonwebtoken)
* bcrypt
* Swagger UI
* multer + csv-parse

---

# 3. Project Structure

```
finance-tracker-mvp/
  client/   → frontend (React)
  server/   → backend (Express + Prisma)
```

---

## client/

### Key files:

* `App.tsx` — routing
* `hooks/useAuth.ts` — token management
* `api/client.ts` — API wrapper (createApiFetch)
* `pages/`
  * AuthPage
  * DashboardPage
  * TransactionsPage
  * ChartsPage
* `components/`
  * ProtectedRoute
  * EditModal
  * DeleteModal

---

## server/

### Key files:

* `src/index.ts` — main API routes
* `src/auth.ts` — JWT logic
* `src/swagger.ts` — OpenAPI config
* `prisma/schema.prisma` — database schema

---

# 4. Authentication Flow

1. User registers → server creates user.
2. On login → server returns a JWT token.
3. Client stores token in `localStorage` (`ft_token`).
4. Every protected request sends:

```
Authorization: Bearer <token>
```

If the token expires:

* server returns 401
* client clears token
* user becomes logged out

---

# 5. Core Application Logic

---

## 5.1 Transactions Endpoint

```
GET /api/transactions
```

Supports:

* Pagination (`limit`, `offset`)
* Filtering (`type`, `card`, `category`, `q`)
* Sorting (`date_asc`, `date_desc`, `amount_asc`, `amount_desc`)

Server response:

```json
{
  "total": 102,
  "items": [...],
  "limit": 20,
  "offset": 0
}
```

This enables proper server-side pagination for large datasets (500+ rows).

---

## 5.2 Balance Time Series

```
GET /api/balance-series?from=YYYY-MM-DD&to=YYYY-MM-DD
```

Logic:

* Generates a date series
* Calculates daily delta
* Uses SQL window functions to calculate cumulative balance

Demonstrates advanced PostgreSQL querying.

---

## 5.3 CSV Backup & Import

### Export:

```
GET /api/backup/transactions.csv
```

### Import:

```
POST /api/backup/transactions/import
```

* Uses `multipart/form-data`
* Supports idempotency (via `importKey`)
* Prevents duplicate records

---

# 6. API Documentation

Swagger UI available at:

```
http://localhost:3001/api-docs
```

You can test all endpoints directly from the browser.

---

# 7. Testing with Postman

### Register:

```
POST /auth/register
```

### Login:

```
POST /auth/login
```

### For protected routes:

Add header:

```
Authorization: Bearer <token>
```

---

# 8. Full Setup Guide (Beginner-Friendly)

This section explains how to run the project from scratch.

---

# 8.1 Required Software

### 1️⃣ Git

Check:

```
git --version
```

Download: [https://git-scm.com/](https://git-scm.com/)

---

### 2️⃣ Node.js (LTS)

Check:

```
node -v
npm -v
```

Download: [https://nodejs.org/](https://nodejs.org/)

---

### 3️⃣ PostgreSQL (Desktop Version Recommended)

* Windows → Official installer + pgAdmin
* Mac → Postgres.app

Create a database named:

```
moneycheck
```

---

# 📥 8.2 Clone the Repository

```
git clone <REPO_URL>
cd finance-tracker-mvp
```

---

# ⚙ 8.3 Backend Setup

```
cd server
npm install
```

---

## Create environment file

Create:

```
server/.env
```

Example:

```
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/moneycheck?schema=public"
JWT_SECRET="super_long_random_secret_change_me"
JWT_EXPIRES_IN="7d"
```

Replace:

* `YOUR_PASSWORD`
* database username if needed

---

## Prisma Setup

```
npx prisma generate
npx prisma migrate dev
```

This creates database tables.

---

## Start Backend

```
npm run dev
```

Test:

```
http://localhost:3001/health
```

Expected response:

```
{ "ok": true }
```

---

# 8.4 Frontend Setup

Open a second terminal:

```
cd client
npm install
npm run dev
```

Open:

```
http://localhost:5173
```

---

# ⚠ Common Issues

### Prisma can't connect

Check:

* database exists
* correct port
* correct password
* PostgreSQL is running

---

### npm not recognized

Node.js not installed properly.

---

### CORS issues

Frontend must run on:

```
http://localhost:5173
```

---

# Possible Improvements

* Auth Context refactor
* Refresh tokens
* Docker setup
* Multi-card dynamic configuration
* Unit tests
* Deployment to VPS
* CI/CD

---

# Educational Value

This project demonstrates:

* Clean API design
* JWT authentication
* Prisma ORM usage
* Advanced SQL queries
* Server-side pagination
* CSV data handling
* Fullstack architecture

It is suitable for:

* Junior/Middle Fullstack portfolio
* Backend fundamentals practice
* React + API interaction learning

---

If you’d like, next we can:

* Add architectural diagrams
* Add a “How to extend this project” section
* Add Docker instructions
* Or polish it into a portfolio-ready version

What’s the next move?
