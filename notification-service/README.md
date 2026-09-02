# Notification Service

Nhận domain event từ order/payment, tạo thông báo cho user và lưu lịch sử gửi. Event được deduplicate theo `event_id + recipient`; API event là internal, API đọc notification yêu cầu JWT.

## API

- `POST /api/v1/events` — internal event consumer (`X-Internal-Service-Secret` khi cấu hình).
- `GET /api/v1/notifications` — user xem notification của mình; ADMIN có thể truyền `recipient`.
- `POST /api/v1/notifications/:id/read` — đánh dấu đã đọc.
- `GET /health`, `GET /ready`, Swagger tại `/api-docs`.

Persistence mặc định là memory cho test. Production dùng PostgreSQL với `NOTIFICATION_STORE_DRIVER=postgres` và `DATABASE_URL`. Delivery provider là tùy chọn qua `DELIVERY_PROVIDER_URL`; service retry lỗi 5xx/timeout và đánh dấu `FAILED` nếu không gửi được.

Chạy local: `npm install && npm test && npm start`.
Chạy Docker kèm PostgreSQL: `docker compose up --build`.

Không commit secret; điền các biến trong Render Dashboard theo `.env.example`.

Consumer sự kiện và adapter gửi thông báo. Bản demo ghi notification vào memory/log; các adapter SendGrid, Twilio và FCM có thể thay vào mà giữ nguyên event contract.

Chạy ở port `3005`. Biến môi trường: `PORT`.

`POST /api/v1/events` nhận `{ type, data, occurred_at }`. Hỗ trợ `OrderCreated`, `PaymentSuccess`, `OrderConfirmed`, `OrderShipped`, `OrderDelivered`, `LowStock`. `GET /api/v1/notifications?recipient=...` dùng kiểm tra demo; `GET /health` dùng health check.

Swagger UI: `http://localhost:3005/api-docs`; OpenAPI JSON: `/api-docs.json`.
