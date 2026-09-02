# Product Service

Product Service sở hữu catalog, tìm kiếm/lọc sản phẩm và tồn kho reservation. Service tách
repository khỏi HTTP layer: memory driver dùng cho test nhanh, còn
`PRODUCT_STORE_DRIVER=mongodb` dùng MongoDB Atlas làm catalog và reservation bền vững. Ảnh được upload
trực tiếp lên S3/MinIO bằng URL đã ký, không đưa credential storage vào client.

## Chạy

Yêu cầu Node.js 22 và npm khi chạy trực tiếp; Docker và Docker Compose khi chạy container.

Chạy nhanh bằng memory store, không cần MongoDB hay R2:

```bash
cd product-service
npm ci
NODE_ENV=development PRODUCT_STORE_DRIVER=memory npm start
```

Memory store chỉ dành cho test/development và mất dữ liệu khi process restart. Để chạy trực tiếp
với Atlas/R2, sao chép `.env.example` thành `.env`, thay toàn bộ placeholder rồi chạy `npm start`.

Container stack local với MongoDB replica set và MinIO, chạy từ thư mục `product-service`:

```bash
JWT_ACCESS_SECRET=local-access-secret-change-me \
S3_ENDPOINT=http://minio:9000 \
S3_PUBLIC_URL=http://localhost:9000/product-images \
docker compose up --build
```

Standalone compose exposes Product Service `3002`, MongoDB `27017`, và MinIO API/console
`9000/9001`. Stack tự khởi tạo MongoDB replica set, tạo bucket `product-images` và chạy service với
MongoDB driver. Không sao chép `.env.example` chưa chỉnh sửa cho stack local vì endpoint Atlas/R2
trong đó chỉ là placeholder.

```bash
curl http://localhost:3002/health
curl http://localhost:3002/ready
docker compose logs -f product-service
docker compose down                 # giữ volume
docker compose down --volumes       # xóa dữ liệu local
```

Service chạy cổng `3002`. Mọi request client nên đi qua API Gateway (`3000`); gọi trực tiếp `3002`
chỉ dành cho service-to-service hoặc kiểm thử.

## API

| Method | Endpoint                                     | Quyền                                |
| ------ | -------------------------------------------- | ------------------------------------ |
| GET    | `/api/v1/products`                           | Public; pagination/filter/sort       |
| GET    | `/api/v1/products/search?q=...`              | Public; full-text                    |
| GET    | `/api/v1/products/:id`                       | Public                               |
| POST   | `/api/v1/products`                           | SELLER/ADMIN                         |
| PUT    | `/api/v1/products/:id`                       | Owner SELLER hoặc ADMIN              |
| DELETE | `/api/v1/products/:id`                       | Owner SELLER hoặc ADMIN; soft delete |
| POST   | `/api/v1/inventory/reserve`                  | Bearer                               |
| POST   | `/api/v1/inventory/reservations/:id/release` | Owner hoặc ADMIN                     |
| POST   | `/api/v1/products/:id/images/presign`        | Owner SELLER/ADMIN                   |

`GET /products` hỗ trợ `page`, `limit` (1–100), `sort`, `order`, `category`, `min_price`,
`max_price`, `q`. Giá và quantity được kiểm tra chặt; SKU không phân biệt hoa thường và phải unique.

## Inventory

Reservation kiểm tra `available_stock = stock - reserved_stock` và trả `409` khi thiếu hàng hoặc
sản phẩm không khả dụng. Với MongoDB, reserve/release sản phẩm và reservation chạy trong transaction
để không giữ tồn kho dở dang và an toàn khi nhiều replica xử lý đồng thời. Memory driver chỉ dùng
mutex trong process cho automated test.

## Image storage

`POST /products/:id/images/presign` trả `upload_url`, `public_url`, object key và giới hạn kích
thước. Client upload trực tiếp lên S3/MinIO; cần cấu hình `S3_ENDPOINT`, `S3_BUCKET`,
`S3_PUBLIC_URL`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`. Nếu storage chưa cấu hình credential trả `503`.

Ví dụ upload object sau khi lấy presigned URL:

```bash
curl -X PUT "$UPLOAD_URL" -H "Content-Type: image/png" --data-binary @image.png
```

## Health và Swagger

- Liveness: `GET /health`
- Readiness: `GET /ready` (kiểm tra MongoDB nếu dùng driver đó và S3/MinIO nếu cấu hình)
- Swagger UI: `http://localhost:3002/api-docs`
- OpenAPI JSON: `http://localhost:3002/api-docs.json`

## Deploy Render với MongoDB Atlas

Tạo MongoDB Atlas M0 cluster, database user và Network Access cho Render, sau đó sao chép connection
string của Node.js driver vào `MONGODB_URI`. MongoDB collections và index được tạo tự động khi
service kết nối. Không commit URI thật vào Git.

Repository root có Blueprint `render.yaml` để Render build `product-service/Dockerfile`. Khi tạo
hoặc đồng bộ Blueprint, nhập `CORS_ORIGIN`, `JWT_ACCESS_SECRET` và `MONGODB_URI`.
`JWT_ACCESS_SECRET` phải giống chính xác giá trị của User Service. Render tự cấp `PORT`.

Các biến production bắt buộc:

```env
NODE_ENV=production
PRODUCT_STORE_DRIVER=mongodb
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/product_service
MONGODB_DATABASE=product_service
JWT_ACCESS_SECRET=the-same-secret-as-user-service
CORS_ORIGIN=https://your-frontend.example.com
```

Cloudflare R2 dùng `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY` và `S3_SECRET_KEY` để tạo presigned
upload URL. `S3_PUBLIC_URL` là URL `r2.dev` hoặc custom domain trỏ thẳng tới bucket, vì vậy không
thêm tên bucket vào cuối biến này. CORS của bucket chỉ cần thiết nếu JavaScript trong trình duyệt
upload trực tiếp; request giữa các microservice, curl và Postman không bị CORS chi phối.
Swagger dùng cùng origin nên truy cập được tại `https://<render-domain>/api-docs`.

## Kiểm thử

```bash
npm test
```

Test bao phủ validation, RBAC/ownership, SKU conflict, search/filter/pagination, soft delete,
reservation cạnh tranh, release ownership và image presign. Dữ liệu test dùng memory driver;
MongoDB Atlas và R2 cần được kiểm tra riêng bằng credential của môi trường, không được nhúng secret
vào test hoặc repository.
