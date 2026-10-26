# API reference

Base URL `http://localhost:5000/api`. JSON in/out. Errors: `{ "error": { "code", "message", "details?" } }`.
Statuses: 200 ok · 201 created · 400 invalid input · 404 missing · 409 conflict (duplicate, insufficient stock, invalid state) · 500 unexpected (generic message only).

Common query params: `page`, `limit` (≤100), `sort`, `dir` (`asc|desc`; sort keys are allowlisted per endpoint), `from`/`to` (`YYYY-MM-DD`, inclusive).

| Method | Endpoint | Notes |
|---|---|---|
| GET | `/health` | DB connectivity check |
| GET | `/dashboard/summary` | revenue, orders, AOV, low-stock count, change vs previous equal-length period |
| GET | `/dashboard/monthly-sales` | monthly revenue with MoM % |
| GET | `/dashboard/top-products` | `limit`, `by=revenue\|units` |
| GET | `/dashboard/category-sales` | revenue + share % |
| GET/POST | `/products` | filters `search`, `category_id`, `low_stock`, `active`; sorts `sku,name,category,unit_price,stock_qty,created_at` |
| GET/PUT | `/products/:id` | PUT cannot change stock (use adjustments) |
| GET/POST | `/categories` | list includes `product_count` |
| GET/POST | `/customers` | `search`; sorts `name,email,city,created_at,total_orders,total_spent` |
| GET/PUT | `/customers/:id` | GET includes purchase summary + last 50 orders |
| GET/POST | `/orders` | filters `status`, `payment_status`, `customer_id`, `search`, `from`, `to` |
| GET | `/orders/:id` | items + payments |
| POST | `/orders/:id/cancel` | restores stock once; 409 if not COMPLETED |
| GET | `/inventory/low-stock` | |
| GET | `/inventory/movements` | `product_id`, `reason`, `from`, `to` |
| POST | `/inventory/adjustments` | `{product_id, quantity_change, reason: RESTOCK\|ADJUSTMENT, notes}`; never allows negative stock |
| GET | `/reports/revenue`, `/reports/category-sales`, `/reports/top-customers`, `/reports/top-products` | add `format=csv` to export the same scope |
| GET | `/reports/order-status` | counts by status |

## POST /orders
```json
{ "customer_id": 1, "payment_method": "UPI_DEMO", "payment_status": "SUCCESS",
  "items": [ { "product_id": 1, "quantity": 2 }, { "product_id": 5, "quantity": 1 } ] }
```
Prices/totals sent by the client are ignored. Duplicate product lines are merged. Send an
`Idempotency-Key` header (8–64 chars `[A-Za-z0-9_-]`) to make retries safe: a repeat returns the original
order with HTTP 200 and `"idempotent_replay": true`. Insufficient stock → 409 `INSUFFICIENT_STOCK`
with `details: [{product_id, name, requested, available}]`.
