# E-commerce SOA

Nền tảng mẫu gồm 5 microservice độc lập và một API Gateway, bám theo case study trong bài tập. Các service dùng REST `/api/v1`; Payment còn công bố WSDL/SOAP và Notification nhận sự kiện bất đồng bộ theo contract sự kiện.

## Chạy các service

Mỗi service là một project độc lập, có `package.json`, `.env.example`, Dockerfile và README riêng.
Không cài dependency hoặc chạy Docker từ repository root. Vào thư mục service cần dùng và làm theo
README tại đó; ví dụ:

```bash
cd user-service
cp .env.example .env
npm ci
npm start
```

Khi chạy toàn hệ thống, mở từng service/container riêng và cấu hình URL service-to-service bằng
biến môi trường. API Gateway lắng nghe ở `3000`; các service mặc định dùng cổng `3001` đến `3005`.

Đăng ký tại `POST /api/v1/auth/register`, dùng `access_token` làm `Authorization: Bearer <token>`. Tài khoản mới có role `BUYER`; endpoint tạo sản phẩm cần `SELLER`/`ADMIN`.

## Kiến trúc và giới hạn demo

- Mỗi service sở hữu persistence và dependency riêng. Memory adapter, nếu có, chỉ dành cho test;
  xem README của service để cấu hình database managed hoặc container local.
- Order gọi Product để lấy snapshot giá và giữ kho; Payment callback cập nhật Order; Notification nhận các event nghiệp vụ.
- Gateway định tuyến, xác minh JWT, timeout 5 giây và giới hạn 100 request/phút/client.
- Production cần TLS, secret manager, durable database/message broker, outbox/inbox, distributed tracing và circuit breaker hoàn chỉnh.

Xem README trong từng thư mục service để biết endpoint và biến môi trường.

## API documentation

| Component            | Swagger UI                     | OpenAPI JSON                        |
| -------------------- | ------------------------------ | ----------------------------------- |
| API Gateway          | http://localhost:3000/api-docs | http://localhost:3000/api-docs.json |
| User Service         | http://localhost:3001/api-docs | http://localhost:3001/api-docs.json |
| Product Service      | http://localhost:3002/api-docs | http://localhost:3002/api-docs.json |
| Order Service        | http://localhost:3003/api-docs | http://localhost:3003/api-docs.json |
| Payment Service      | http://localhost:3004/api-docs | http://localhost:3004/api-docs.json |
| Notification Service | http://localhost:3005/api-docs | http://localhost:3005/api-docs.json |

SOAP WSDL của Payment Service ở http://localhost:3004/soap/payment.wsdl.

## Quy ước cấu trúc source

Mỗi service sử dụng cùng một cách tổ chức:

```text
src/
├── config/       # cấu hình và service registry (khi cần)
├── controllers/  # chuyển đổi HTTP request/response
├── middlewares/  # authentication, authorization, rate limit
├── routes/       # khai báo endpoint
├── services/     # nghiệp vụ và giao tiếp service-to-service
├── stores/       # persistence adapter/repository
├── app.js        # lắp ghép Express application
└── server.js     # bootstrap HTTP server
```

Một service chỉ tạo những thư mục thực sự dùng. Lệnh test, format và Docker được chạy trong thư mục
của từng service, không thông qua npm workspace ở repository root.
