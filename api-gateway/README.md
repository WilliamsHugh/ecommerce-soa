# API Gateway

API Gateway là cổng HTTP duy nhất cho hệ thống e-commerce. Client gọi gateway tại port `3000`; gateway giữ nguyên path và query string rồi chuyển request đến service sở hữu resource:

| Prefix | Upstream |
| --- | --- |
| `/api/v1/auth`, `/api/v1/users` | user-service |
| `/api/v1/products`, `/api/v1/inventory` | product-service |
| `/api/v1/orders` | order-service |
| `/api/v1/payments` | payment-service |
| `/api/v1/notifications` | notification-service |

Gateway xử lý CORS, request ID, JWT, rate limit, timeout và phản hồi lỗi upstream tập trung. Nghiệp vụ vẫn nằm trong từng microservice.

## Chạy local

Khởi động năm service ở port `3001` đến `3005`, sau đó:

```bash
cp .env.example .env
npm ci
npm test
node --env-file=.env src/server.js
```

- Gateway: `http://localhost:3000`
- Swagger UI: `http://localhost:3000/api-docs`
- OpenAPI JSON: `http://localhost:3000/api-docs.json`
- Liveness: `GET /health`
- Readiness tổng hợp: `GET /ready`

## Chạy bằng Docker

```bash
cp .env.example .env
docker compose up --build
```

Compose sử dụng `host.docker.internal` để gateway trong container gọi các service đang chạy trên máy host. Trên Linux, mapping này được khai báo bằng `extra_hosts`.

Nếu tất cả service chạy trong cùng một Compose network, thay URL bằng Docker service name, ví dụ:

```env
USER_SERVICE_URL=http://user-service:3001
PRODUCT_SERVICE_URL=http://product-service:3002
ORDER_SERVICE_URL=http://order-service:3003
PAYMENT_SERVICE_URL=http://payment-service:3004
NOTIFICATION_SERVICE_URL=http://notification-service:3005
```

## Xác thực

Các route public:

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/forgot-password`
- `POST /api/v1/auth/reset-password`
- Toàn bộ `GET /api/v1/products...`

Các route khác yêu cầu `Authorization: Bearer <access-token>`. Ba biến sau phải giống user-service và các service xác minh JWT:

```env
JWT_ACCESS_SECRET=replace-with-a-long-random-secret
JWT_ISSUER=ecommerce-user-service
JWT_AUDIENCE=ecommerce-api
```

Gateway chỉ xác thực token trước khi proxy. Việc kiểm tra role, quyền sở hữu resource và luật nghiệp vụ vẫn do service đích thực hiện.

## Biến môi trường

| Biến | Mặc định | Mô tả |
| --- | --- | --- |
| `PORT` | `3000` | Port gateway; nền tảng như Render tự inject. |
| `NODE_ENV` | `development` | Đặt `production` khi triển khai. |
| `CORS_ORIGIN` | `http://localhost:3000` | Danh sách origin phân cách bằng dấu phẩy. |
| `JWT_ACCESS_SECRET` | development secret | Bắt buộc thay trong production. |
| `JWT_ISSUER` | `ecommerce-user-service` | Issuer hợp lệ. |
| `JWT_AUDIENCE` | `ecommerce-api` | Audience hợp lệ. |
| `*_SERVICE_URL` | `http://127.0.0.1:3001..3005` | Base URL có thể truy cập của từng service. |
| `UPSTREAM_TIMEOUT_MS` | `5000` | Timeout request được proxy. |
| `READINESS_TIMEOUT_MS` | `3000` | Timeout mỗi health check trong `/ready`. |
| `RATE_LIMIT_WINDOW_MS` | `60000` | Cửa sổ rate limit. |
| `RATE_LIMIT_MAX` | `100` | Request tối đa mỗi client/cửa sổ. |
| `MAX_BODY_BYTES` | `2097152` | Kích thước request body tối đa, mặc định 2 MiB. |

## Triển khai

Khi mỗi service được triển khai độc lập, đặt URL thật trên dashboard của gateway:

```env
USER_SERVICE_URL=https://user-service.example.com
PRODUCT_SERVICE_URL=https://product-service.example.com
ORDER_SERVICE_URL=https://order-service.example.com
PAYMENT_SERVICE_URL=https://payment-service.example.com
NOTIFICATION_SERVICE_URL=https://notification-service.example.com
```

Không dùng `localhost` để gọi một service nằm trong container hoặc máy chủ khác. Ưu tiên private/internal URL nếu nền tảng cung cấp và các service cùng region/network.

Sau khi deploy, kiểm tra:

```bash
curl https://gateway.example.com/health
curl https://gateway.example.com/ready
curl https://gateway.example.com/api/v1/products
```

`/health` chỉ xác nhận gateway đang chạy. `/ready` trả HTTP `200` khi cả năm upstream trả health thành công, hoặc `503` kèm trạng thái từng service khi có dependency down.

## Mã lỗi của gateway

- `401`: thiếu, hết hạn hoặc sai JWT trên route được bảo vệ.
- `404`: route/resource không được gateway hỗ trợ.
- `413`: request body vượt `MAX_BODY_BYTES`.
- `429`: vượt rate limit.
- `503`: không thể kết nối upstream.
- `504`: upstream vượt timeout.

Gateway chuyển tiếp `x-request-id` nếu client gửi, hoặc tự tạo UUID để trace request qua các service.
