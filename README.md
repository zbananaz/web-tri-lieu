# Trị Liệu — web tư vấn tâm lý

Khách sàng lọc → quản trị duyệt → phân cho chuyên gia → đặt lịch + nhắn tin. Quản trị đăng bài viết. Ba vai trò: `client`, `expert`, `admin`.

- `apps/api` — NestJS 12 (REST + Socket.IO), PostgreSQL 17, Drizzle ORM
- `apps/web` — Next.js 16 (App Router), Tailwind 4, responsive (375 / 768 / 1280 đã kiểm tra)
- `packages/shared` — schema zod, kiểu dùng chung, bảng chuyển trạng thái hồ sơ
- `packages/e2e` — Playwright (luồng chính + kiểm tra tràn ngang + phân quyền)

Thiết kế chi tiết: [docs/spec.md](docs/spec.md).

## Dựng lại từ đầu trên máy (Windows, mọi thứ nằm ở ổ D)

Công cụ và cache nằm trong `D:\Tool` (node/pnpm, PostgreSQL portable, trình duyệt Playwright). Mỗi shell mới:

```powershell
. D:\Project\WebTriLieu\scripts\env.ps1      # đặt cache, PATH về D:\Tool; không sửa registry/PATH hệ thống
```

```powershell
Copy-Item .env.example .env                    # rồi điền POSTGRES_PASSWORD, DATABASE_URL, SEED_PASSWORD (>= 10 ký tự)
.\scripts\db.ps1 init                          # lần đầu
.\scripts\db.ps1 start                         # cổng 54329, chỉ localhost
pnpm install
pnpm --filter "@wtl/shared" build
pnpm db:migrate
pnpm db:seed                                   # tài khoản mẫu, mật khẩu = SEED_PASSWORD
pnpm build
```

Chạy: `pnpm --filter "@wtl/api" start:prod` (cổng 4000) và `pnpm --filter "@wtl/web" start` (cổng 3000). Phát triển: `pnpm dev:api`, `pnpm dev:web`.

Tài khoản seed: `admin@webtrilieu.local`, `bsminh@webtrilieu.local`, `tlhoa@webtrilieu.local` (chuyên gia), `khach@webtrilieu.local`.

## Kiểm tra

```powershell
pnpm check                                     # build shared + typecheck + lint (api, web, e2e) + api: 7 unit + 72 e2e (DB test)
pnpm e2e                                       # Playwright: 33 test chạy + 12 ảnh chụp màn hình bị bỏ qua (chỉ chạy khi SHOTS=1) (desktop 1280, tablet 768, mobile 375); cần DB đã seed, tự khởi động API/web nếu chưa chạy. Bộ test đăng nhập hơn 20 lần/phút từ một IP nên API chạy cho e2e phải đặt `AUTH_RATE_LIMIT_PER_MIN=300` (config Playwright và `.claude/launch.json` đã đặt sẵn; production giữ mặc định 20)
.\scripts\db.ps1 status
.\scripts\db.ps1 backup                        # pg_dump -> D:\Tool\PostgreSQL\backups (giữ 14 bản); khôi phục: pg_restore -d webtrilieu <file>
```

Test API dùng DB `webtrilieu_test` (`TEST_DATABASE_URL`). `pnpm e2e` chạy trên DB dev thật (`webtrilieu`) vì đi qua API/web đang chạy: cuối mỗi lần chạy nó xoá bài viết thử, đóng hồ sơ thử, xoá ảnh đã tải lên và khoá tài khoản `e2e.*@example.test` (tài khoản bị khoá vẫn còn lại trong DB, ảnh thử trong `data/uploads` được xoá).

## Bảo mật (đã làm)

- Phiên đăng nhập là token ngẫu nhiên, DB chỉ lưu SHA-256; cookie `httpOnly`, `SameSite=Lax`, `Secure` ở production; mật khẩu argon2id; khóa tài khoản khi sai nhiều lần.
- Phân quyền kiểm tra ở máy chủ (guard theo vai trò + kiểm tra sở hữu từng hồ sơ). Hồ sơ không thuộc về người gọi trả 404, không 403.
- Kiểm tra `Origin` chống CSRF; rate limit toàn cục và riêng cho đăng nhập/chat; validate mọi input bằng zod.
- Chống trùng lịch bằng ràng buộc EXCLUDE của PostgreSQL (không phụ thuộc code ứng dụng).
- HTML bài viết được lọc phía máy chủ (allowlist); trang công khai chỉ trả bài đã xuất bản; xem trước trong iframe `sandbox`.
- Nhật ký kiểm toán cho thao tác của quản trị; chat ghi qua REST (có kiểm quyền), socket chỉ đẩy tin.
- Header an toàn (nosniff, DENY frame, Referrer-Policy, Permissions-Policy, HSTS ở production) và CSP (`default-src 'self'`, không frame, không object, `form-action 'self'`; còn `'unsafe-inline'` cho script vì Next cần — nên CSP không thay thế việc lọc HTML bài viết). Có test Playwright kiểm header, kiểm không có vi phạm CSP, kiểm khung xem trước bài viết không chạy script.
- Rate limit và nhật ký dùng IP thật qua `TRUST_PROXY_HOPS` (mặc định production = 2: reverse proxy + Next). Đặt sai số này thì mọi người dùng chung một IP hoặc khách giả được `X-Forwarded-For` — kiểm tra lại theo cách triển khai thật.
- Quên mật khẩu (chưa có email): quản trị bấm "Cấp mật khẩu tạm" ở trang Tài khoản; mật khẩu ngẫu nhiên 14 ký tự hiện đúng một lần, hủy mọi phiên cũ, xóa khóa đăng nhập, và buộc đổi mật khẩu ngay (máy chủ chặn mọi API khác cho đến khi đổi). Không áp dụng cho quản trị viên khác; nếu quản trị quên mật khẩu, chạy trên máy chủ: `pnpm --filter "@wtl/api" admin:reset-password <email>`. Mọi lần cấp đều ghi nhật ký (không ghi mật khẩu).
- Tải ảnh (chỉ quản trị): nhận PNG/JPEG/WebP tối đa 3 MB, kiểm tra byte đầu tệp (không tin Content-Type), tên file ngẫu nhiên 128 bit, không nhận SVG; phục vụ công khai với `nosniff` và CSP `default-src 'none'`.
- `src/proxy.ts` chỉ điều hướng cho tiện (UX); không phải lớp bảo mật.

## Trước khi đưa lên thật — cần người quyết định

1. **Pháp lý**: dữ liệu sức khỏe tâm thần là dữ liệu cá nhân nhạy cảm (Luật BVDLCN 91/2025/QH15). Cần luật sư xác nhận: đánh giá tác động (DPIA), đồng ý của khách, nơi lưu dữ liệu (có thể phải đặt tại Việt Nam), thời hạn lưu.
2. **Nội dung lâm sàng**: bộ câu hỏi sàng lọc, mức nguy cơ, đường dây nóng (mặc định 115 và 111, đổi bằng `HOTLINES`) và bài viết mẫu chỉ là dữ liệu mẫu; trung tâm cần thẩm định trước khi dùng.
3. **Hosting**: chưa chọn nhà cung cấp. Cần Node 22+, PostgreSQL 17, HTTPS. Đặt API và web cùng domain (web proxy `/api` và `/socket.io`) để cookie `SameSite=Lax` hoạt động; nếu tách domain, đặt `NEXT_PUBLIC_REALTIME_URL` và cấu hình `WEB_ORIGIN`. WebSocket qua rewrite của `next start` đã chạy được ở local (cần `skipTrailingSlashRedirect` và rewrite `/socket.io` → `/socket.io/` trong `next.config.ts`, vì engine.io chỉ phục vụ đường dẫn có dấu `/` cuối); đã kiểm thêm qua một reverse proxy Node tự viết (WebSocket upgrade đi qua proxy → Next → API, server trả lỗi `unauthorized` ở tầng ứng dụng, tức đường truyền thông), nhưng chưa kiểm với nginx/Caddy/nhà cung cấp thật (cần bật chuyển tiếp `Upgrade`/`Connection` và timeout dài) — nếu lỗi, chat tự quay về hỏi định kỳ 8 giây.
4. **Chưa có**: gửi email (nhắc lịch; quên mật khẩu hiện do quản trị cấp mật khẩu tạm, chưa tự phục vụ), lịch sao lưu tự động (đã có lệnh `db.ps1 backup`, cần đặt lịch chạy), giám sát/log tập trung, ứng dụng di động (làm sau, dùng lại API này). Ảnh tải lên lưu ở `data/uploads` (hoặc `UPLOAD_DIR`) trên đĩa của máy chủ: khi lên hosting cần đĩa bền (volume) và sao lưu thư mục này cùng database.
