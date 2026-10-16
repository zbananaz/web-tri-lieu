# Trị Liệu — web tư vấn tâm lý

Khách sàng lọc → quản trị duyệt → phân cho chuyên gia → đặt lịch + nhắn tin. Quản trị đăng bài viết. Ba vai trò: `client`, `expert`, `admin`.

- `apps/api` — NestJS 12 (REST + Socket.IO), PostgreSQL 17, Drizzle ORM
- `apps/web` — Next.js 16 (App Router), Tailwind 4, responsive (375 / 768 / 1280 đã kiểm tra)
- `packages/shared` — schema zod, kiểu dùng chung, bảng chuyển trạng thái hồ sơ
- `packages/e2e` — Playwright (luồng chính + kiểm tra tràn ngang + phân quyền)

Chạy trên máy: [docs/HUONG-DAN-CHAY-LOCAL.md](docs/HUONG-DAN-CHAY-LOCAL.md). Nhật ký làm việc cho các phiên sau: [docs/NHAT-KY-LAM-VIEC.md](docs/NHAT-KY-LAM-VIEC.md) (thêm mục mới sau mỗi việc xong). Thiết kế chi tiết: [docs/spec.md](docs/spec.md). Các tính năng Đợt 1 (tìm chuyên gia, tự đánh giá, nhật ký tâm trạng, bài tập, ghi chú, đánh giá, thông báo, quên mật khẩu qua email): [docs/wave1-spec.md](docs/wave1-spec.md).

## Tính năng (đối chiếu các web trị liệu tâm lý)

- **Tìm chuyên gia**: lọc theo lĩnh vực, hình thức, ngôn ngữ, chi phí tối đa; sắp xếp theo tên / có giờ trống sớm nhất / đánh giá cao nhất (`GET /experts`; bộ lọc nằm trong URL, hoạt động cả khi tắt JavaScript).
- **Tự đánh giá PHQ-9 / GAD-7** (`/tu-danh-gia`): chấm điểm ngay trên trình duyệt (máy chủ tính lại khi lưu), hiện đường dây nóng nếu điểm cao hoặc câu 9 khác 0. Nội dung tiếng Việt là **bản nháp, cần chuyên gia lâm sàng thẩm định**; kết quả không phải chẩn đoán.
- **Nhật ký tâm trạng + kết quả tự đánh giá đã lưu** (`/me/mood`): mặc định riêng tư; chỉ những mục khách bật "chia sẻ" mới hiện cho chuyên gia đang theo dõi ca đang mở (mỗi lần xem được ghi nhật ký). Quản trị viên không đọc được.
- **Bài tập giữa các buổi**: chuyên gia giao, khách nộp bài (một lần).
- **Ghi chú buổi**: riêng tư của chuyên gia (khách và quản trị không đọc được).
- **Đánh giá chuyên gia**: khách đánh giá buổi đã hoàn thành (mỗi buổi một lần); quản trị duyệt trước khi hiển thị công khai; đánh giá công khai không kèm tên khách.
- **Thông báo trong ứng dụng** (chuông, làm mới mỗi 30 giây): đổi trạng thái hồ sơ, đặt/xác nhận/hủy lịch, đánh giá được đăng.
- **Quên mật khẩu qua email**: liên kết một lần, hiệu lực 45 phút, tối đa 3 yêu cầu/giờ/tài khoản, trả lời giống nhau dù email có tồn tại hay không.

## Dựng lại từ đầu trên máy (Windows)

Cần: PowerShell 5.1+, Node.js 22+, pnpm 10.34.7, PostgreSQL 17 (các chương trình `pg_ctl`, `psql`... trên `PATH`), Git. Danh sách đầy đủ, cách cài, cách gom cache sang ổ khác (`WTL_TOOL_DIR`) và xử lý sự cố: **[docs/HUONG-DAN-CHAY-LOCAL.md](docs/HUONG-DAN-CHAY-LOCAL.md)**. Không có đường dẫn nào gắn cứng theo máy. Tại thư mục gốc repo, mỗi shell mới:

```powershell
. .\scripts\env.ps1      # nạp môi trường cho riêng cửa sổ này; không sửa registry/PATH hệ thống
```

```powershell
Copy-Item .env.example .env                    # rồi điền POSTGRES_PASSWORD, DATABASE_URL, SEED_PASSWORD (>= 10 ký tự)
.\scripts\db.ps1 init                          # lần đầu: cụm PostgreSQL riêng, cổng 54329, chỉ localhost, dữ liệu trong data\pgdata
.\scripts\db.ps1 start                         # các lần sau
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
pnpm check                                     # build shared + typecheck + lint (api, web, e2e) + api: 7 unit + 92 e2e (DB test)
pnpm e2e                                       # Playwright: 66 test chạy + 12 ảnh chụp màn hình bị bỏ qua (chỉ chạy khi SHOTS=1) (desktop 1280, tablet 768, mobile 375); cần DB đã seed, tự khởi động API/web nếu chưa chạy. Bộ test đăng nhập hơn 20 lần/phút từ một IP nên API chạy cho e2e phải đặt `AUTH_RATE_LIMIT_PER_MIN=300` và `RATE_LIMIT_PER_MIN=2000` (config Playwright và `.claude/launch.json` đã đặt sẵn; production giữ mặc định 20)
.\scripts\db.ps1 status
.\scripts\db.ps1 backup                        # pg_dump -> thư mục backups cạnh thư mục dữ liệu DB (giữ 14 bản); khôi phục: pg_restore -d webtrilieu <file>
```

Test API dùng DB `webtrilieu_test` (`TEST_DATABASE_URL`). `pnpm e2e` chạy trên DB dev thật (`webtrilieu`) vì đi qua API/web đang chạy: cuối mỗi lần chạy nó xoá bài viết thử, đóng hồ sơ thử, xoá ảnh đã tải lên, xoá thư thử trong `data/outbox`, ẩn đánh giá thử (buổi hẹn "đã hoàn thành" thử được chèn thẳng vào DB dev bằng `psql` trên `PATH`, kết nối qua `DATABASE_URL`) và khoá tài khoản `e2e.*@example.test` / `wave1.*@example.test` (tài khoản bị khoá vẫn còn lại trong DB, ảnh thử trong `data/uploads` được xoá).

## Bảo mật (đã làm)

- Phiên đăng nhập là token ngẫu nhiên, DB chỉ lưu SHA-256; cookie `httpOnly`, `SameSite=Lax`, `Secure` ở production; mật khẩu argon2id; khóa tài khoản khi sai nhiều lần.
- Phân quyền kiểm tra ở máy chủ (guard theo vai trò + kiểm tra sở hữu từng hồ sơ). Hồ sơ không thuộc về người gọi trả 404, không 403.
- Kiểm tra `Origin` chống CSRF; rate limit toàn cục và riêng cho đăng nhập/chat; validate mọi input bằng zod.
- Chống trùng lịch bằng ràng buộc EXCLUDE của PostgreSQL (không phụ thuộc code ứng dụng).
- HTML bài viết được lọc phía máy chủ (allowlist); trang công khai chỉ trả bài đã xuất bản; xem trước trong iframe `sandbox`.
- Nhật ký kiểm toán cho thao tác của quản trị; chat ghi qua REST (có kiểm quyền), socket chỉ đẩy tin.
- Header an toàn (nosniff, DENY frame, Referrer-Policy, Permissions-Policy, HSTS ở production) và CSP (`default-src 'self'`, không frame, không object, `form-action 'self'`; còn `'unsafe-inline'` cho script vì Next cần — nên CSP không thay thế việc lọc HTML bài viết). Có test Playwright kiểm header, kiểm không có vi phạm CSP, kiểm khung xem trước bài viết không chạy script.
- Rate limit và nhật ký dùng IP thật qua `TRUST_PROXY_HOPS` (mặc định production = 2: reverse proxy + Next). Đặt sai số này thì mọi người dùng chung một IP hoặc khách giả được `X-Forwarded-For` — kiểm tra lại theo cách triển khai thật.
- Quên mật khẩu tự phục vụ: token 32 byte ngẫu nhiên, DB chỉ lưu SHA-256, hiệu lực 45 phút, dùng một lần; liên kết đặt trong *fragment* (`#token=`) nên không vào log máy chủ/Referer và được xóa khỏi thanh địa chỉ ngay khi mở; đặt lại xong thì hủy mọi phiên và mọi token còn lại; tài khoản bị khóa không nhận thư; yêu cầu trả 204 ngay và gửi thư ở nền để không lộ email nào tồn tại qua thời gian phản hồi. Gửi thư qua SMTP khi đặt `SMTP_URL` (vd `smtps://user:pass@host`) và `MAIL_FROM`; không có SMTP thì dev/test ghi thư ra `data/outbox/*.json`, còn **production không gửi và không ghi ra đĩa** (log lỗi lúc khởi động; `SMTP_URL` không bao giờ được log).
- Dữ liệu chăm sóc (ghi chú, nhật ký, bài tập, kết quả tự đánh giá): kiểm quyền theo từng ca bằng `assertParty` (chỉ khách sở hữu hoặc chuyên gia được phân; quản trị bị từ chối); bảng có ràng buộc CHECK và UNIQUE ở DB.
- Dự phòng quên mật khẩu qua quản trị: quản trị bấm "Cấp mật khẩu tạm" ở trang Tài khoản; mật khẩu ngẫu nhiên 14 ký tự hiện đúng một lần, hủy mọi phiên cũ, xóa khóa đăng nhập, và buộc đổi mật khẩu ngay (máy chủ chặn mọi API khác cho đến khi đổi). Không áp dụng cho quản trị viên khác; nếu quản trị quên mật khẩu, chạy trên máy chủ: `pnpm --filter "@wtl/api" admin:reset-password <email>`. Mọi lần cấp đều ghi nhật ký (không ghi mật khẩu).
- Tải ảnh (chỉ quản trị): nhận PNG/JPEG/WebP tối đa 3 MB, kiểm tra byte đầu tệp (không tin Content-Type), tên file ngẫu nhiên 128 bit, không nhận SVG; phục vụ công khai với `nosniff` và CSP `default-src 'none'`.
- `src/proxy.ts` chỉ điều hướng cho tiện (UX); không phải lớp bảo mật.

## Trước khi đưa lên thật — cần người quyết định

1. **Pháp lý**: dữ liệu sức khỏe tâm thần là dữ liệu cá nhân nhạy cảm (Luật BVDLCN 91/2025/QH15). Cần luật sư xác nhận: đánh giá tác động (DPIA), đồng ý của khách, nơi lưu dữ liệu (có thể phải đặt tại Việt Nam), thời hạn lưu.
2. **Nội dung lâm sàng**: bộ câu hỏi sàng lọc, mức nguy cơ, đường dây nóng (mặc định 115 và 111, đổi bằng `HOTLINES`) và bài viết mẫu chỉ là dữ liệu mẫu; trung tâm cần thẩm định trước khi dùng.
3. **Hosting**: chưa chọn nhà cung cấp. Cần Node 22+, PostgreSQL 17, HTTPS. Đặt API và web cùng domain (web proxy `/api` và `/socket.io`) để cookie `SameSite=Lax` hoạt động; nếu tách domain, đặt `NEXT_PUBLIC_REALTIME_URL` và cấu hình `WEB_ORIGIN`. WebSocket qua rewrite của `next start` đã chạy được ở local (cần `skipTrailingSlashRedirect` và rewrite `/socket.io` → `/socket.io/` trong `next.config.ts`, vì engine.io chỉ phục vụ đường dẫn có dấu `/` cuối); đã kiểm thêm qua một reverse proxy Node tự viết (WebSocket upgrade đi qua proxy → Next → API, server trả lỗi `unauthorized` ở tầng ứng dụng, tức đường truyền thông), nhưng chưa kiểm với nginx/Caddy/nhà cung cấp thật (cần bật chuyển tiếp `Upgrade`/`Connection` và timeout dài) — nếu lỗi, chat tự quay về hỏi định kỳ 8 giây.
4. **Email**: đã chọn **Brevo** (gói miễn phí ~300 thư/ngày, giao thức SMTP chuẩn nên đổi nhà cung cấp khác như Gmail/Mailgun/Amazon SES chỉ cần đổi `SMTP_URL`). Đường gửi SMTP đã có test tự động với máy chủ SMTP giả (`apps/api/test/mailer-smtp.e2e-spec.ts`, kể cả tiếng Việt có dấu). Chủ trung tâm tự tạo tài khoản Brevo, tạo SMTP key, xác minh địa chỉ gửi rồi điền `SMTP_URL`, `MAIL_FROM` vào `.env` (chi tiết trong `.env.example`); mã này không tạo tài khoản hay lưu khóa thay bạn. Nhắc lịch hẹn qua email chưa làm.
5. **Chưa có**: lịch sao lưu tự động (đã có lệnh `db.ps1 backup`, cần đặt lịch chạy), giám sát/log tập trung, ứng dụng di động (làm sau, dùng lại API này). Ảnh tải lên lưu ở `data/uploads` (hoặc `UPLOAD_DIR`) trên đĩa của máy chủ: khi lên hosting cần đĩa bền (volume) và sao lưu thư mục này cùng database.
