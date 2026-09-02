# Order Service

Microservice quản lý vòng đời đơn hàng, snapshot giá, giữ kho và state machine:

`PENDING → CONFIRMED → PROCESSING → SHIPPED → DELIVERED`

Đơn có thể bị hủy trước trạng thái `SHIPPED`; reservation tương ứng sẽ được hoàn lại. Service chạy mặc định tại port `3003`.

## Yêu cầu

- Node.js 22+ và npm, hoặc Docker + Docker Compose.
- PostgreSQL khi dùng persistence thật. Chế độ `memory` chỉ phù hợp để phát triển và test vì dữ liệu mất khi service khởi động lại.
- User service để cấp JWT; product, payment và notification service nếu muốn chạy đầy đủ luồng nghiệp vụ.

## Chạy nhanh bằng Docker

Sao chép cấu hình mẫu và thay các secret:

```bash
cp .env.example .env
docker compose up --build
```

Compose tự chạy PostgreSQL 16, cấu hình `ORDER_STORE_DRIVER=postgres` và lưu dữ liệu trong volume `order-data`.

- Order API: `http://localhost:3003`
- Swagger UI: `http://localhost:3003/api-docs`
- PostgreSQL từ máy host: `localhost:5433`

Nếu port `3003` hoặc `5433` đã được sử dụng, đổi port phía bên trái trong `docker-compose.yml`. Các URL mặc định `host.docker.internal` cho phép container gọi các microservice đang chạy trực tiếp trên máy host.

Kiểm tra sau khi khởi động:

```bash
curl http://localhost:3003/health
curl http://localhost:3003/ready
docker compose ps
```

`/ready` phải trả về `status: "ready"` và `database: "up"`.

## Chạy trực tiếp bằng Node.js

```bash
cp .env.example .env
npm ci
npm test
node --env-file=.env src/server.js
```

Script `npm start` phù hợp khi biến môi trường đã được export hoặc được nền tảng triển khai inject sẵn; ứng dụng không tự nạp file `.env`.

Mặc định `.env.example` dùng `ORDER_STORE_DRIVER=memory`. Để lưu dữ liệu vào PostgreSQL, đặt:

```env
ORDER_STORE_DRIVER=postgres
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE
DATABASE_SSL=true
```

Schema và index của bảng `orders` được tạo tự động ở lần truy cập dữ liệu đầu tiên; database user cần quyền tạo và thay đổi bảng.

## Kết nối managed PostgreSQL

Có thể sử dụng bất kỳ dịch vụ PostgreSQL tương thích nào. Một số lựa chọn dễ bắt đầu:

| Nền tảng | Gợi ý sử dụng |
| --- | --- |
| [Neon](https://neon.com/docs/connect/connection-pooling) | Có gói Free và connection pooling. Sao chép pooled connection string trong mục **Connect** cho ứng dụng. |
| [Supabase](https://supabase.com/docs/guides/database/connecting-to-postgres) | Có shared pooler. Dùng **Session mode** cho backend Node.js chạy lâu dài, nhất là môi trường chỉ hỗ trợ IPv4. |
| [Aiven for PostgreSQL](https://aiven.io/docs/products/postgresql/concepts/pg-free-tier) | Có free tier giới hạn tài nguyên/kết nối. Lấy Service URI trong trang Overview. |
| [Render PostgreSQL](https://render.com/docs/postgresql-creating-connecting) | Tiện khi order-service cũng chạy trên Render. Dùng Internal Database URL nếu cùng account và region; free database có thời hạn nên chỉ phù hợp demo/test. |

Quy trình cấu hình chung:

1. Tạo database/project và lấy PostgreSQL connection string đầy đủ.
2. Nếu mật khẩu chứa ký tự đặc biệt như `@`, `:`, `/` hoặc `#`, URL-encode mật khẩu trước khi đưa vào URL.
3. Khai báo các biến sau trên dashboard của nơi chạy order-service:

   ```env
   NODE_ENV=production
   ORDER_STORE_DRIVER=postgres
   DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE?sslmode=require
   DATABASE_SSL=true
   ```

4. Cho phép kết nối mạng từ nền tảng triển khai nếu nhà cung cấp database có IP allowlist/firewall.
5. Redeploy rồi gọi `/ready`. Nếu nhận HTTP `503`, kiểm tra hostname, port, user/password, tên database, SSL và network access.

`DATABASE_SSL=true` hiện bật TLS với `rejectUnauthorized: false`, phù hợp với phần lớn managed PostgreSQL khi không mount CA certificate riêng. Không đặt URL thật trong `.env.example` hoặc commit `.env`.

## Kết nối các microservice

Trên môi trường triển khai, các URL phải là địa chỉ mà container/service có thể truy cập, không dùng `localhost` để trỏ sang một service khác:

```env
PRODUCT_SERVICE_URL=https://product-service.example.com
PAYMENT_SERVICE_URL=https://payment-service.example.com
NOTIFICATION_SERVICE_URL=https://notification-service.example.com
```

Nếu các service cùng chạy trong một Docker Compose network, dùng service name, ví dụ `http://product-service:3002`. Nếu chạy trên Render, có thể dùng URL public `https://...onrender.com` hoặc private service hostname khi gói và kiến trúc hỗ trợ.

Các secret cần đồng bộ:

- `JWT_ACCESS_SECRET`, `JWT_ISSUER`, `JWT_AUDIENCE` phải khớp với user-service để xác minh access token.
- `INTERNAL_SERVICE_SECRET` phải là một chuỗi mạnh, giống nhau ở order-service và payment-service. Payment callback gửi chuỗi này qua header `x-internal-service-secret`.

Không để `INTERNAL_SERVICE_SECRET` rỗng trong production vì khi rỗng endpoint callback nội bộ không yêu cầu xác thực.

## Biến môi trường

| Biến | Bắt buộc | Mô tả |
| --- | --- | --- |
| `PORT` | Không | Port HTTP, mặc định `3003`; nền tảng như Render tự cấp biến này. |
| `NODE_ENV` | Production | Đặt `production` khi triển khai. |
| `JWT_ACCESS_SECRET` | Production | Secret xác minh JWT, phải giống user-service. |
| `JWT_ISSUER` | Có | Issuer JWT, mặc định `ecommerce-user-service`. |
| `JWT_AUDIENCE` | Có | Audience JWT, mặc định `ecommerce-api`. |
| `ORDER_STORE_DRIVER` | Có | `memory` hoặc `postgres`; production nên dùng `postgres`. |
| `DATABASE_URL` | Khi dùng PostgreSQL | PostgreSQL connection string đầy đủ. |
| `DATABASE_SSL` | Managed DB | Đặt `true` khi nhà cung cấp yêu cầu TLS. |
| `PRODUCT_SERVICE_URL` | Có | Base URL của product-service. |
| `PAYMENT_SERVICE_URL` | Có | Base URL của payment-service. |
| `NOTIFICATION_SERVICE_URL` | Có | Base URL của notification-service. |
| `DEPENDENCY_TIMEOUT_MS` | Không | Timeout mỗi request tới service khác, mặc định `5000`. |
| `DEPENDENCY_RETRIES` | Không | Số lần retry dependency, mặc định `2`. |
| `INTERNAL_SERVICE_SECRET` | Production | Secret bảo vệ callback giữa các service. |

## API và xác thực

Các endpoint nghiệp vụ sử dụng Bearer JWT:

- `POST /api/v1/orders`
- `GET /api/v1/orders?userId=...`
- `GET /api/v1/orders/:id`
- `POST /api/v1/orders/:id/confirm`
- `POST /api/v1/orders/:id/cancel`
- `PATCH /api/v1/orders/:id/status`

Endpoint `POST /api/v1/internal/orders/:id/payment-success` dành cho payment-service và sử dụng header `x-internal-service-secret`.

Khi tạo đơn, nên gửi header `Idempotency-Key` duy nhất để retry an toàn mà không tạo đơn trùng.

## Kiểm tra trước khi triển khai

```bash
npm ci
npm test
docker compose config --quiet
docker build -t order-service:local .
```

Sau khi triển khai, xác nhận:

- `GET /health` trả HTTP 200.
- `GET /ready` trả HTTP 200 và database `up`.
- `GET /api-docs` mở được Swagger UI.
- JWT do user-service cấp được chấp nhận.
- Order-service truy cập được product/payment/notification service bằng các URL đã khai báo.
