# Setup Guide

This guide explains how to run the project on your own computer from scratch.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Project Path](#project-path)
- [1. Clone the Repository](#1-clone-the-repository)
- [2. Create the Database](#2-create-the-database)
- [3. Configure the Server](#3-configure-the-server)
- [4. Install Backend Dependencies](#4-install-backend-dependencies)
- [5. Prepare Prisma](#5-prepare-prisma)
- [6. Start the Backend](#6-start-the-backend)
- [7. Install Frontend Dependencies](#7-install-frontend-dependencies)
- [8. Start the Frontend](#8-start-the-frontend)
- [9. First Run](#9-first-run)
- [CSV Import Notes](#csv-import-notes)
- [Common Problems](#common-problems)
- [Quick Start Commands](#quick-start-commands)

## Prerequisites

Install these first:

1. Git
2. Node.js LTS
3. npm
4. PostgreSQL

Check your versions:

```bash
git --version
node -v
npm -v
```

## Project Path

After cloning the repository, the runnable app is here:

```text
Free_Style/finance-tracker-mvp/
```

That folder contains:

```text
client/
server/
```

## 1. Clone the Repository

```bash
git clone <YOUR_REPO_URL>
cd Finance_Tracker/Free_Style/finance-tracker-mvp
```

If your local folder name is different, just go to the folder that contains `client/` and `server/`.

## 2. Create the Database

Create a PostgreSQL database named:

```text
moneycheck
```

You can do this with pgAdmin, Postgres.app, TablePlus, DBeaver, or `psql`.

## 3. Configure the Server

Create:

[`server/.env`](/Users/fedormalugin/Desktop/Finance_Tracker/Free_Style/finance-tracker-mvp/server/.env)

You can copy the template from:

[`server/.env.example`](/Users/fedormalugin/Desktop/Finance_Tracker/Free_Style/finance-tracker-mvp/server/.env.example)

Template:

```env
DATABASE_URL="postgresql://YOUR_DB_USER:YOUR_DB_PASSWORD@localhost:5432/moneycheck?schema=public"
JWT_SECRET="super_long_random_secret_change_me"
JWT_EXPIRES_IN="7d"
```

Example:

```env
DATABASE_URL="postgresql://john:my_password@localhost:5433/moneycheck?schema=public"
JWT_SECRET="replace_this_with_a_long_random_secret"
JWT_EXPIRES_IN="7d"
```

If your Postgres uses another port, replace `5432` with your real port.

## 4. Install Backend Dependencies

```bash
cd server
npm install
```

## 5. Prepare Prisma

Still inside `server/`, run:

```bash
npx prisma generate
npx prisma migrate dev
```

If Prisma reports schema drift on your local development DB and you do not need the existing data:

```bash
npx prisma migrate reset --force
```

Warning: this deletes the current contents of that development database.

## 6. Start the Backend

Inside `server/`:

```bash
npm run dev
```

Expected backend URL:

```text
http://localhost:3001
```

Useful checks:

```text
http://localhost:3001/health
http://localhost:3001/api-docs
```

## 7. Install Frontend Dependencies

Open a second terminal.

If you are inside `server/`:

```bash
cd ../client
npm install
```

Or from the repo root:

```bash
cd Free_Style/finance-tracker-mvp/client
npm install
```

## 8. Start the Frontend

Inside `client/`:

```bash
npm run dev
```

Expected frontend URL:

```text
http://localhost:5173
```

Vite may also use:

```text
http://127.0.0.1:5173
```

Both are fine for local development.

## 9. First Run

1. Open the frontend in your browser
2. Register a user
3. Log in
4. Add transactions or import a CSV backup

## CSV Import Notes

The import endpoint is:

```text
POST /api/backup/transactions/import
```

Important details:

- The request must be `multipart/form-data`
- The file field name must be `file`
- Data is imported for the currently logged-in user
- Duplicate imports are skipped using `importKey`

## Common Problems

### Backend does not start

Make sure you are inside:

```text
Free_Style/finance-tracker-mvp/server
```

Then run:

```bash
npm install
```

### Prisma cannot connect

Check:

- PostgreSQL is running
- Database `moneycheck` exists
- `DATABASE_URL` is correct
- The port matches your local Postgres instance

### Registration fails in browser

Check:

- Backend is running on `http://localhost:3001`
- Frontend is running on `http://localhost:5173` or `http://127.0.0.1:5173`
- `http://localhost:3001/health` opens correctly

### Frontend API calls fail

The client currently points to:

[`client/src/api/client.ts`](/Users/fedormalugin/Desktop/Finance_Tracker/Free_Style/finance-tracker-mvp/client/src/api/client.ts#L1)

```ts
export const API = "http://localhost:3001";
```

If you change the backend port, update that value.

If you later switch the client to env-based configuration, you can start from:

[`client/.env.example`](/Users/fedormalugin/Desktop/Finance_Tracker/Free_Style/finance-tracker-mvp/client/.env.example)

## Quick Start Commands

Terminal 1:

```bash
cd Free_Style/finance-tracker-mvp/server
npm install
npx prisma generate
npx prisma migrate dev
npm run dev
```

Terminal 2:

```bash
cd Free_Style/finance-tracker-mvp/client
npm install
npm run dev
```
