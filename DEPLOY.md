# Deployment Notes

This project is currently set up first for local development. This file outlines what to prepare when deploying it to a real server or VPS.

## Table of Contents

- [Current Architecture](#current-architecture)
- [Before Deploying](#before-deploying)
- [Recommended Production Setup](#recommended-production-setup)
- [Backend Requirements](#backend-requirements)
- [Prisma in Production](#prisma-in-production)
- [Build and Run](#build-and-run)
- [Frontend Deployment](#frontend-deployment)
- [Reverse Proxy and HTTPS](#reverse-proxy-and-https)
- [Production Checklist](#production-checklist)
- [Recommended Future Improvements](#recommended-future-improvements)
- [Summary](#summary)

## Current Architecture

- Frontend: Vite + React
- Backend: Express
- Database: PostgreSQL
- ORM: Prisma

## Before Deploying

You should decide:

1. Where the frontend will be hosted
2. Where the backend will run
3. Where PostgreSQL will live
4. Which domain names will point to the frontend and backend
5. How environment variables will be managed

## Recommended Production Setup

One common approach:

- Frontend hosted on Vercel, Netlify, or served by Nginx
- Backend hosted on a VPS, Railway, Render, or Fly.io
- PostgreSQL hosted on Neon, Supabase, Railway, Render, or a managed VPS database

## Backend Requirements

Your production backend needs:

- Node.js
- npm
- PostgreSQL connection
- Environment variables

Required environment variables:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/moneycheck?schema=public"
JWT_SECRET="use_a_long_random_secret"
JWT_EXPIRES_IN="7d"
```

## Prisma in Production

Instead of `prisma migrate dev`, production deployments should usually use:

```bash
npx prisma migrate deploy
```

This applies existing migrations without using the development workflow.

Optional:

```bash
npx prisma generate
```

## Build and Run

This repository does not yet include a dedicated production server build/start script.

Right now, the server is started in development mode with:

[`server/package.json`](/Users/fedormalugin/Desktop/Finance_Tracker/Free_Style/finance-tracker-mvp/server/package.json)

```json
"dev": "ts-node-dev src/index.ts"
```

Before a real deployment, it would be better to add:

- a TypeScript build step
- a production start script
- environment-specific config

For example:

```json
"build": "tsc",
"start": "node dist/index.js"
```

## Frontend Deployment

The client currently uses a hardcoded API URL in:

[`client/src/api/client.ts`](/Users/fedormalugin/Desktop/Finance_Tracker/Free_Style/finance-tracker-mvp/client/src/api/client.ts#L1)

```ts
export const API = "http://localhost:3001";
```

Before deployment, this should be changed to an environment variable such as `VITE_API_URL`.

Example:

```ts
export const API = import.meta.env.VITE_API_URL;
```

Then in production:

```env
VITE_API_URL=https://api.your-domain.com
```

## Reverse Proxy and HTTPS

For a VPS deployment, it is recommended to use:

- Nginx or Caddy as a reverse proxy
- HTTPS with Let's Encrypt
- A separate domain or subdomain for the API

Example:

- Frontend: `https://app.example.com`
- Backend: `https://api.example.com`

## Production Checklist

- Create a production PostgreSQL database
- Set production `DATABASE_URL`
- Set a strong production `JWT_SECRET`
- Run `npx prisma migrate deploy`
- Configure the frontend API URL
- Configure CORS for production origins
- Use HTTPS
- Set up process management with `pm2`, Docker, systemd, or your hosting platform
- Add logging and monitoring

## Recommended Future Improvements

Before production, these upgrades would help a lot:

- Add `build` and `start` scripts to the backend
- Move frontend API URL to env vars
- Add Docker and `docker-compose`
- Add validation and error-handling improvements
- Add tests
- Add CI/CD

## Summary

The app is ready for local use now. For production deployment, the main missing pieces are:

- production build/start flow for the backend
- environment-based frontend API configuration
- production-safe hosting, HTTPS, and secrets management
