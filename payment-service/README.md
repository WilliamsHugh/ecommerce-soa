# Payment Service

Payment Service quản lý vòng đời giao dịch `PENDING`, `AUTHORIZED`, `CAPTURED`, `FAILED`,
`REFUNDED`, `CANCELLED`. REST API dùng JWT và kiểm tra ownership; ADMIN có thể tra cứu payment của
mọi user. Callback gateway và SOAP endpoint dùng `X-Internal-Service-Secret`. Service không nhận hay
lưu PAN/CVV.

HTTP được bảo vệ bằng Helmet và CORS allowlist từ `CORS_ORIGIN` (nhiều origin phân tách bằng dấu
phẩy). Docker Compose có healthcheck readiness cho cả service lẫn PostgreSQL.

## Chạy local

Yêu cầu Node.js 22. Memory store chỉ dùng cho development/test:

```bash
cp .env.example .env
npm ci
npm test
npm start
```

Chạy với PostgreSQL bằng Docker:

```bash
JWT_ACCESS_SECRET=local-access-secret-change-me \
INTERNAL_SERVICE_SECRET=local-internal-secret-change-me \
docker compose up --build
```

Service chạy tại `http://localhost:3004`. Liveness là `/health`; readiness `/ready` kiểm tra kết nối
database. Swagger UI ở `/api-docs`, OpenAPI JSON ở `/api-docs.json`, WSDL ở
`/soap/payment.wsdl`.

## API

| Method | Endpoint                           | Quyền                                           |
| ------ | ---------------------------------- | ----------------------------------------------- |
| POST   | `/api/v1/payments`                 | Bearer JWT + `Idempotency-Key`                  |
| GET    | `/api/v1/payments/:id`             | Owner hoặc ADMIN                                |
| GET    | `/api/v1/payments/order/:order_id` | Payment của owner; ADMIN xem toàn bộ            |
| POST   | `/api/v1/payments/:id/refund`      | Owner hoặc ADMIN; payment phải `CAPTURED`       |
| POST   | `/api/v1/payments/callback`        | `X-Internal-Service-Secret`                     |
| POST   | `/soap/gateway`                    | `X-Internal-Service-Secret` + `Idempotency-Key` |

Callback yêu cầu `event_id`, một trong `payment_id`/`gateway_reference`, và status. Khi chuyển sang
`CAPTURED`, payment, webhook event và outbox message được lưu trong cùng transaction PostgreSQL.
Callback trả thành công ngay sau commit; worker nền gửi `payment-success` tới Order Service với
timeout, retry giới hạn và exponential backoff. Vì vậy Order Service tạm ngừng không làm payment bị
rollback hoặc callback trả 502; lỗi 4xx không được retry trong một delivery attempt.
Idempotency của tạo payment được scope theo `(user_id, order_id, idempotency_key)`.

SOAP giữ các element `orderId`, `amount`, `currency`; caller có thể gửi `X-User-Id`, nếu thiếu dùng
principal nội bộ `internal-soap`.

## Payment gateway provider

`PAYMENT_GATEWAY_PROVIDER=soap_sandbox` là mặc định local. Để nối provider HTTP thật, đặt
`PAYMENT_GATEWAY_PROVIDER=http`, `PAYMENT_GATEWAY_API_URL` và `PAYMENT_GATEWAY_API_KEY`. Adapter gửi
Bearer credential, idempotency key, amount/currency và dùng cùng dependency timeout. Provider cần
trả `{ "reference": "...", "status": "PENDING|AUTHORIZED" }`. Đây là contract adapter trung lập;
đường dẫn, ký webhook hoặc OAuth riêng của Stripe/Adyen/VNPay cần được triển khai thành adapter cụ
thể nếu nhà cung cấp được chọn có contract khác. Không lưu API key trong Git.

## PostgreSQL và deploy Render

Production bắt buộc `PAYMENT_STORE_DRIVER=postgres`, `DATABASE_URL`, secret JWT và internal secret.
Đặt `DATABASE_SSL=true` cho managed PostgreSQL cần TLS. Schema được bootstrap idempotently lúc truy
cập lần đầu; SQL tương ứng nằm trong `migrations/001_create_payments.sql` để audit/provision riêng.
Render có thể build trực tiếp bằng `payment-service/Dockerfile`; cấu hình biến theo `.env.example`,
đồng thời dùng cùng JWT issuer/audience/secret với User Service và cùng internal secret với Order
Service. Không commit `.env` hoặc credential thật.

## Kiểm thử

```bash
npm test
npm run test:coverage
# Khi PostgreSQL Compose đang chạy:
TEST_DATABASE_URL=postgresql://payment:payment@localhost:55434/payment_service npm run test:postgres
npx prettier --check .
docker compose config --quiet
```
