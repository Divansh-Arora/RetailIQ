# Entity-relationship diagram

```mermaid
erDiagram
    CUSTOMERS ||--o{ ORDERS : places
    CATEGORIES ||--o{ PRODUCTS : groups
    ORDERS ||--|{ ORDER_ITEMS : contains
    PRODUCTS ||--o{ ORDER_ITEMS : "sold as"
    ORDERS ||--o{ PAYMENTS : "paid by"
    PRODUCTS ||--o{ INVENTORY_MOVEMENTS : "audited by"

    CUSTOMERS { int customer_id PK
      string email UK
      string name
      string city
      bool is_active }
    CATEGORIES { int category_id PK
      string category_name UK }
    PRODUCTS { int product_id PK
      int category_id FK
      string sku UK
      decimal unit_price
      int stock_qty
      int reorder_level
      bool is_active }
    ORDERS { bigint order_id PK
      int customer_id FK
      datetime order_date
      enum status
      decimal total_amount
      string idempotency_key UK }
    ORDER_ITEMS { bigint order_item_id PK
      bigint order_id FK
      int product_id FK
      int quantity
      decimal unit_price "price snapshot" }
    PAYMENTS { bigint payment_id PK
      bigint order_id FK
      decimal amount
      enum payment_method
      enum status
      datetime paid_at }
    INVENTORY_MOVEMENTS { bigint movement_id PK
      int product_id FK
      int quantity_change
      string reason
      string reference_type "polymorphic, no FK"
      bigint reference_id }
```

Deletion policy: every foreign key is `ON DELETE RESTRICT`; orders and inventory movements are protected
by triggers. Deactivate (`is_active = 0`) instead of deleting.
