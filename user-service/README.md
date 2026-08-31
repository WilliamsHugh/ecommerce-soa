# User Service

Service sở hữu tài khoản, authentication, profile và RBAC của hệ thống. Dữ liệu người dùng
được lưu trong MySQL; refresh session và access-token blacklist được lưu trong Redis.

## Chức năng

- Đăng ký buyer, đăng nhập và trả public profile cùng JWT pair.
- Access token 1 giờ, refresh token 7 ngày; thời gian có thể cấu hình.
- Refresh-token rotation: refresh token chỉ được dùng một lần.
- Logout một session hoặc toàn bộ session; `token_version` thu hồi ngay mọi access token.
- Đổi mật khẩu, quên/reset mật khẩu bằng token một lần có TTL trên Redis.
- Profile `/users/me` và quản trị user theo ID.
- Danh sách user có phân trang/lọc/tìm kiếm; thêm và gỡ role; security audit log.
- Role `BUYER`, `SELLER`, `ADMIN`; status `ACTIVE`, `INACTIVE`, `BANNED`.
- bcrypt cost 12, validation chặt và không bao giờ trả `password_hash`.
- JWT giới hạn HS256, issuer/audience; login rate limit độc lập tại service.
- Swagger, liveness `/health` và dependency readiness `/ready`.

## Cấu hình và chạy

```bash
cd user-service
cp .env.example .env
# Điền JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, MYSQL_PASSWORD và ADMIN_PASSWORD
npm install
npm run db:migrate
npm run db:seed      # tùy chọn, tạo admin đầu tiên
npm start
```

Không commit `.env`. Hai JWT secret phải dài, ngẫu nhiên và khác nhau. Khi chạy toàn hệ thống,
`docker compose --env-file user-service/.env up --build` tự chờ MySQL/Redis khỏe và chạy
migration trước khi khởi động service. Tham số `--env-file` truyền cùng credential MySQL cho
container database.

## API

| Method | Endpoint                       | Quyền                  |
| ------ | ------------------------------ | ---------------------- |
| POST   | `/api/v1/auth/register`        | Public                 |
| POST   | `/api/v1/auth/login`           | Public                 |
| POST   | `/api/v1/auth/refresh`         | Public + refresh token |
| POST   | `/api/v1/auth/logout`          | Bearer token           |
| POST   | `/api/v1/auth/logout-all`      | Bearer token           |
| POST   | `/api/v1/auth/change-password` | Bearer token           |
| POST   | `/api/v1/auth/forgot-password` | Public                 |
| POST   | `/api/v1/auth/reset-password`  | Public + reset token   |
| GET    | `/api/v1/users/me`             | Bearer token           |
| PUT    | `/api/v1/users/me`             | Bearer token           |
| GET    | `/api/v1/users/:id`            | Chính chủ hoặc ADMIN   |
| PUT    | `/api/v1/users/:id`            | ADMIN                  |
| POST   | `/api/v1/users/:id/roles`      | ADMIN                  |
| DELETE | `/api/v1/users/:id/roles`      | ADMIN                  |
| GET    | `/api/v1/users`                | ADMIN                  |
| GET    | `/api/v1/users/audit-logs`     | ADMIN                  |
| DELETE | `/api/v1/users/:id`            | ADMIN                  |

Swagger UI: `http://localhost:3001/api-docs`; OpenAPI JSON: `/api-docs.json`.

## Database

Migration được chạy theo tên file và ghi vào `schema_migrations`. `001` tạo user/RBAC; `002`
thêm `token_version` và `audit_logs`.

- `users`: email/username unique, password hash và trạng thái.
- `roles`: ba role chuẩn.
- `user_roles`: quan hệ nhiều-nhiều, cascade khi xóa user.

Redis sử dụng các key có prefix `REDIS_KEY_PREFIX`:

- `refresh:<jti>`: session refresh token có TTL.
- `user-refresh:<user-id>`: tập session của user để logout toàn bộ.
- `blacklist:<jti>`: access token đã logout, tự hết hạn cùng JWT.
- `password-reset:<token>`: reset token một lần, mặc định 15 phút.

`USER_STORE_DRIVER=memory` chỉ dành cho automated test. Chế độ chạy thông thường mặc định kết
nối MySQL và Redis, vì vậy dữ liệu không mất khi restart service.

## Kiểm thử

```bash
npm test
npm run test:coverage
# Khi service, MySQL và Redis đang chạy:
npm run test:integration
```

Test kiểm tra auth, refresh rotation, revoke access token, password recovery, RBAC, phân trang,
quản trị trạng thái, role và audit log.
Lệnh coverage áp ngưỡng line coverage tối thiểu 80%.

Trong môi trường development/test, endpoint quên mật khẩu trả `reset_token` để thử bằng Swagger.
Trong production token không được trả về; lớp gửi email/notification cần nhận token qua event hoặc
adapter hạ tầng của môi trường triển khai.

## Deploy lên Render bằng Docker

Repository có sẵn `user-service/Dockerfile` và Blueprint `render.yaml`. Trên Render, chọn
**New > Blueprint**, kết nối repository và deploy Blueprint ở thư mục gốc. Render tự build đúng
Docker context của `user-service`, chạy migration trước khi start và kiểm tra readiness tại
`/ready`. Không cần tự khai báo `PORT`; Render cấp biến này lúc chạy.

Trước lần deploy đầu tiên, điền các biến được Render đánh dấu yêu cầu nhập:

- `CORS_ORIGIN`: URL frontend/API gateway được phép gọi service; nhiều URL cách nhau bằng dấu phẩy.
- `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_DATABASE`, `MYSQL_USER`, `MYSQL_PASSWORD`: thông tin MySQL
  managed bên ngoài Render (hoặc MySQL server có thể truy cập từ Render).
- `REDIS_URL`: connection string Redis, ví dụ `rediss://default:password@host:6379`.

`JWT_ACCESS_SECRET` và `JWT_REFRESH_SECRET` được Blueprint sinh độc lập. Không đặt
`USER_STORE_DRIVER=memory` trên production. Có thể kiểm tra image ở local từ thư mục gốc:

```bash
docker build -f user-service/Dockerfile -t ecommerce-user-service ./user-service
docker run --rm -p 3001:3001 --env-file user-service/.env ecommerce-user-service
```
