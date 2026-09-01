# Order Service

Tạo đơn, snapshot giá, giữ kho và thực thi state machine `PENDING → CONFIRMED → PROCESSING → SHIPPED → DELIVERED`; cho phép hủy trước `SHIPPED` và hoàn lại reservation.

Chạy ở port `3003`. Biến môi trường: `PORT`, `JWT_SECRET`, `PRODUCT_SERVICE_URL`, `PAYMENT_SERVICE_URL`, `NOTIFICATION_SERVICE_URL`.

API Bearer JWT: `POST /api/v1/orders`, `GET /api/v1/orders?userId=...`, `GET /api/v1/orders/:id`, `POST /api/v1/orders/:id/confirm`, `POST /api/v1/orders/:id/cancel`, `PATCH /api/v1/orders/:id/status`. Endpoint `/api/v1/internal/orders/:id/payment-success` dành cho service nội bộ.

Swagger UI: `http://localhost:3003/api-docs`; OpenAPI JSON: `/api-docs.json`.
