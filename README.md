# RetailIQ — Retail Sales & Inventory Analytics System

Full-stack demo (MySQL 8 · Node/Express · React/Vite · Recharts) built from the RetailIQ PRD.
**All data is synthetic; payments are simulated; there is no authentication (MVP, local/demo use).**

## What's included
- **Database** (`database/`): 7 normalised InnoDB tables with PK/FK/UNIQUE/CHECK constraints, indexes, 7 views, 2 stored procedures, 3 triggers (append-only audit log), deterministic seed (100 products, 200 customers, 500 orders, 1,145 items, 1,420 stock movements), and `reports.sql` with 22 documented queries (joins, CTEs, window functions, subqueries, reconciliation checks, `EXPLAIN`).
- **API** (`backend/`): routes → controllers → services, `mysql2` pool, validation, allow-listed sorting, structured errors, CSV export, transaction-safe order creation (row locks in id order, bounded deadlock retry, idempotency keys, cancellation that restores stock once).
- **UI** (`frontend/`): Dashboard, Products, Categories, Customers, Orders (multi-line order form), Inventory (adjustments + history), Reports (CSV export), About; loading/empty/error states, responsive, keyboard accessible.
- **Tests** (`tests/`): 48 integration tests against a real MySQL (constraints, rollback, concurrency/no-oversell, idempotency, cancellation, hand-calculated analytics, validation, injection input, no error leakage).
- **Docs** (`docs/`): ER diagram, API reference, EXPLAIN notes.

## Prerequisites
Node.js 18+ (developed on 22), MySQL 8.0.16+ (CHECK constraints need it).

## Setup
```bash
# 1. Backend config
cd backend
cp .env.example .env          # edit DB_PASSWORD and DB_ADMIN_PASSWORD
npm install

# 2. Create the database, schema, views, triggers and seed data
npm run db:init               # uses DB_ADMIN_* (needs CREATE privileges). Add --no-seed via db:init:schema-only

# 3. (Recommended) least-privilege runtime user — run in the mysql client as admin
#    CREATE USER 'retailiq_app'@'localhost' IDENTIFIED BY 'your-password';
#    GRANT SELECT, INSERT, UPDATE ON retailiq.* TO 'retailiq_app'@'localhost';
#    (no DELETE/DDL needed; the API never deletes rows)

# 4. Run the API (http://localhost:5000)
npm run dev

# 5. Run the UI (new terminal, http://localhost:5173; /api is proxied to the API)
cd ../frontend && npm install && npm run dev
```
Without Node you can load the SQL manually, in order: `schema → indexes → views → procedures → triggers → seed`
(`mysql -u root -p retailiq < database/schema.sql`, etc.). Regenerate the seed with `node database/generate_seed.js`.

## Environment variables (`backend/.env`)
| Name | Purpose |
|---|---|
| `PORT`, `NODE_ENV` | API port / mode |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | runtime connection (least privilege) |
| `DB_ADMIN_USER`, `DB_ADMIN_PASSWORD` | used only by `npm run db:init` |
| `CLIENT_ORIGIN` | allowed CORS origin(s), comma-separated |

Frontend (`frontend/.env`, optional): `VITE_API_URL` (production API URL ending in `/api`), `VITE_CURRENCY` (default `INR`), `VITE_LOCALE`.

## Tests
```bash
cd backend
npm test        # creates/resets database "retailiq_test" (name must end in _test) using DB_ADMIN_* credentials
```
Result when built: 48 tests, 48 passing (MySQL 8.0.46, Node 22).

## Key business rules
- **Revenue** = quantity × price-at-sale of items on `COMPLETED` orders, by `order_date`; it never joins payments, so multiple payment rows cannot inflate it. One view (`v_completed_sales`) feeds every report, endpoint and chart.
- **Stock** (`products.stock_qty`) changes only through orders, cancellations, openings or audited adjustments; `inventory_movements` is append-only and reconciles to the balance (`reports.sql` Q15 returns 0 rows).
- **Orders** are created `COMPLETED` with stock deducted in the same transaction. `PENDING` exists in the enum but holds no stock in this MVP. Cancelling adds compensating `CANCELLATION` movements; refunds are out of scope (pending payments become failed, successful ones are left as-is).
- **Payments**: demo only (`CASH`, `CARD_DEMO`, `UPI_DEMO`); status derived per order as Paid / Partial / Pending / Failed / No payment.
- `reference_id` in movements is polymorphic (not a FK) — a documented trade-off.

## Deployment notes
Build the UI with `npm run build` (static `dist/`), set `VITE_API_URL`; host the API anywhere Node runs with the env vars above and a managed MySQL 8 database; run the SQL scripts (or `db:init`) first; use HTTPS and restrict DB network access. **Add authentication/authorization before exposing this publicly** — the MVP has none. Verify current hosting/database limits at deploy time.

## Not included / honest limits
No auth/roles, real payments, returns/refunds, multi-warehouse, screenshots, or live deployment. The frontend was verified to build and to be served/proxied correctly, but was not browser-tested in this environment, so please click through the screens once after setup.
