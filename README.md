# Servana Backend

Backend API for Servana, a web app that helps customers find local service vendors in Lagos. Built from the Servana technical PRD v3.0.

## Tech stack

* Node.js and Express (ES modules, plain JavaScript)
* PostgreSQL 16
* Prisma 6 (ORM and migrations)
* Joi (request validation)
* JWT and bcrypt (auth, coming in the auth sprint)

## Project structure

```text
.
├── server.js              starts the HTTP server
├── src
│   ├── app.js             Express app, routes and error handler
│   ├── config             env and Prisma client
│   └── middlewares        auth, role, ownership, validate, errorHandler
├── prisma
│   ├── schema.prisma      database models
│   ├── migrations         SQL history, never edit one after it has been applied
│   └── seed.js            Lagos zones, categories and the admin account
├── docker-compose.yml     PostgreSQL for local development
└── .env.example           copy this to .env
```

## Setup

1. Install dependencies

```bash
npm install
```

2. Create your env file and fill it in

```bash
cp .env.example .env
```

| Variable | What it is |
|---|---|
| `PORT` | Port the API runs on. Use 8080. |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | Database login. Docker uses these to create the database. |
| `DATABASE_URL` | Full connection string, for example `postgresql://USER:PASSWORD@localhost:5432/servana_db` |
| `JWT_SECRET`, `JWT_EXPIRES_IN` | Used by auth later |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | The admin account the seed creates. Use a strong password. |

Note: the API port (8080) and the database port (5432) are different things. Never set `PORT` to 5432.

3. Start PostgreSQL

With Docker:

```bash
docker compose up -d
```

No Docker? Install PostgreSQL 16 on your machine, create a database, and point `DATABASE_URL` at it. XAMPP will not work, because it ships MySQL and this project needs PostgreSQL.

4. Create the tables and load the starting data

```bash
npx prisma migrate dev
npx prisma generate
npx prisma db seed
```

5. Run the API

```bash
npm run dev
```

The API runs on `http://localhost:8080`.

## Health check

```text
GET /health
```

```json
{ "message": "Servana API is running successfully" }
```

## Database commands

| Command | When to use it |
|---|---|
| `npx prisma migrate dev --name what_changed` | Local only. Creates and applies a new migration after you change `schema.prisma`. |
| `npx prisma migrate deploy` | Staging and production. Applies existing migrations and never creates new ones. |
| `npx prisma generate` | Rebuilds the Prisma client. Run it after pulling schema changes. |
| `npx prisma db seed` | Loads or refreshes the zones, categories and admin. Safe to run more than once. `npm run seed` does the same. |
| `npx prisma migrate reset` | Local only. Wipes the database and reapplies everything. All data is lost. |
| `npx prisma studio` | Opens a browser view of the tables. |

A few rules:

* After you pull, run `npx prisma migrate dev` so your database gets the new migrations.
* Do not edit a migration after it has been applied. Make a new one instead.
* Some database rules (one primary category per vendor, price and rating checks) are raw SQL in `prisma/migrations/*_add_db_constraints`, because the Prisma schema cannot describe them. Prisma will not show them in `schema.prisma`.
* Do not accept a migration that drops `vendor_categories_one_primary_per_profile`.

## What the seed loads

* 8 Lagos zones with centre points. Lekki, Victoria Island and Ikoyi have a 1.5 boost price multiplier, the rest are 1.0.
* 5 top level categories (Beauty, Events, Food, Home, Tech and creative) with 20 services under them.
* 1 admin account, using `ADMIN_EMAIL` and `ADMIN_PASSWORD` from your `.env`.

## Git workflow

* Branch from `staging`, one branch per Trello card, for example `feat/seed-data`.
* Stage files by path, never `git add .`, and never commit `.env`.
* Always commit `package-lock.json` when dependencies change.
* Open a pull request into `staging`. Do not push to `staging` or `main` directly.

## Error format

The target shape for every API error is defined in section 9 of the PRD:

```json
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "...", "fieldErrors": { "email": "..." } } }
```

Errors are produced in `src/middlewares/errorHandler.js`.