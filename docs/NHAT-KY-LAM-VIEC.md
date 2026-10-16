# Nhật ký làm việc (để các phiên sau tra cứu)

Quy ước: **sau mỗi việc làm xong, thêm một mục mới ở đầu danh sách "Nhật ký"** (ngày, đã làm gì, vì sao, cách kiểm chứng, việc còn dở). Không ghi mật khẩu, khóa, token hay `SMTP_URL`.

## Bối cảnh cố định

- Mục tiêu của chủ dự án (`/goal`): web hoàn chỉnh front-end + back-end, đầy đủ phân quyền, bảo mật, responsive; tự lên kế hoạch và thiết kế; mọi công cụ cài ở ổ D, công cụ nào nằm trong thư mục riêng dưới `D:\Tool`; hạn chế ghi lên ổ C.
- Ba vai trò: `client`, `expert`, `admin`. Luồng: sàng lọc → quản trị duyệt → phân chuyên gia → đặt lịch + nhắn tin. Quản trị đăng bài viết.
- Phạm vi hiện tại: **chỉ web**. Ứng dụng di động làm sau (dùng lại API). **Chưa chọn hosting** (đã loại khỏi phiên đầu). Flutter đã bỏ.
- Nhánh làm việc: `phananh/build-web`, remote `git@github.com:zbananaz/web-tri-lieu.git`. Commit kèm dòng `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Tài liệu liên quan: `README.md`, `docs/spec.md` (thiết kế), `docs/wave1-spec.md` (tính năng đợt 1), `docs/HUONG-DAN-CHAY-LOCAL.md` (cách chạy).
- Quy tắc an toàn: không tạo tài khoản dịch vụ hay nhập khóa thay chủ dự án; không ghi `SMTP_URL` vào log; production không ghi token đặt lại mật khẩu ra đĩa; `.env` và `data/` nằm trong `.gitignore`.

## Cách làm việc trong repo (mẹo cho phiên sau)

- Mỗi PowerShell mới, tại thư mục gốc repo: `. .\scripts\env.ps1`. **Không hardcode đường dẫn máy** vào script/config/tài liệu; đường dẫn riêng của máy chỉ đặt trong `scripts/env.local.ps1` (không commit). Máy của chủ dự án dùng `WTL_TOOL_DIR=D:\Tool`.
- Lệnh chính: `pnpm check`, `pnpm build`, `pnpm e2e`. Máy chủ chạy bằng `preview_start` tên `api` và `web`.
- Tránh heredoc Bash có dấu nháy đơn và tránh python để sửa file; dùng công cụ Write/Edit hoặc script `node`.
- Khi sửa tính năng riêng tư (nhật ký tâm trạng, kết quả đánh giá): mặc định `shared=false`, chuyên gia chỉ thấy mục đã chia sẻ trong ca đang mở; quản trị không đọc ghi chú/nhật ký/bài tập (403 do guard vai trò).

## Nhật ký

### 2026-10-16 — Viết hướng dẫn tạo dịch vụ SMTP cho đồng nghiệp
- Thêm `docs/HUONG-DAN-SMTP.md`: đồng nghiệp tự tạo dịch vụ gửi email của mình (Brevo từng bước; Gmail/dịch vụ khác tóm tắt), cách ghép `SMTP_URL` (mã hóa `%XX`, `smtp://` cổng 587, `smtps://` cổng 465), điền `.env`, khởi động lại API, thử qua `/forgot-password` hoặc script kiểm tra, bảng lỗi thường gặp, lưu ý production. Có link từ README và `HUONG-DAN-CHAY-LOCAL.md` mục 6.
- Nội dung dựa trên cấu hình đã chạy thật ở mục Brevo bên dưới và mã `MailerService`/`env.ts`. Tên menu Brevo viết theo trí nhớ nên có thể đã đổi; hạn mức gói miễn phí và cách tạo App password của Gmail chưa tra lại trên trang chính thức. Chưa có đồng nghiệp làm thử theo hướng dẫn. Chưa commit.
- Phiên khác (fork "Lên plan") đang làm đợt giao diện công khai (ảnh, bố cục trang chủ, trang "Về chúng tôi"); mục nhật ký của đợt đó do phiên đó ghi.

### 2026-10-16 — Kết thúc công việc
- Chủ dự án chốt kết thúc công việc và **không cần dọn ổ C** (thư mục `C:\Users\Admin\AppData\Local\ms-playwright` được giữ nguyên, không phải của dự án này). Email Brevo đã dùng được. Còn lại cho các phiên sau nếu có việc mới: thẩm định lâm sàng/pháp lý, nhắc lịch hẹn qua email, ứng dụng di động, kiểm WebSocket qua nginx/Caddy thật, thử hướng dẫn chạy trên máy Windows sạch.

### 2026-10-16 — Brevo SMTP đã gửi thư thật thành công
- Chủ dự án tự tạo tài khoản Brevo, tạo SMTP key và điền `SMTP_URL`, `MAIL_FROM` vào `.env` (không ghi lại giá trị ở đâu).
- Hai lỗi đã gặp và cách sửa: (1) `525 5.7.1 Unauthorized IP address` do Brevo chặn IP lạ → vào Security > Authorized IPs tắt chặn hoặc thêm IP; (2) `MAIL_FROM` thiếu dấu `<` `>` quanh email → viết `"Tên <email>"`. Dấu `@` trong Login SMTP phải mã hóa thành `%40`.
- Kiểm chứng bằng script tạm: đăng nhập SMTP (`verify`) thành công và gửi 1 thư thử tới địa chỉ gửi, Brevo trả `250 2.0.0 OK: queued`. Sau đó chủ dự án tự thử trên web với email thật của mình: đăng ký, đăng nhập và "Quên mật khẩu" đều hoạt động (chủ dự án xác nhận bằng lời; mình không tự kiểm hộp thư).

### 2026-10-16 — Bỏ đường dẫn gắn cứng, viết lại hướng dẫn chạy
- Yêu cầu của chủ dự án: máy nào cũng chạy được; ghi rõ cần công cụ gì, chạy lệnh gì, ở đâu; không hardcode đường dẫn.
- `scripts/env.ps1` tự tìm gốc repo từ vị trí của chính nó; dùng công cụ trên `PATH`. Nếu có `WTL_TOOL_DIR` (đặt trong `scripts/env.local.ps1`, file bị `.gitignore`, mẫu `env.local.example.ps1`) thì gom cache/PostgreSQL portable/Playwright vào đó. `PGDATA` mặc định `<repo>\data\pgdata`, `PGPORT` mặc định 54329.
- `scripts/db.ps1`: không còn `D:\...`; tìm `pg_ctl` trên `PATH` và báo lỗi rõ khi thiếu; log/backups nằm cạnh thư mục dữ liệu; `reset` từ chối xóa nếu thư mục không có `PG_VERSION`.
- `.npmrc` bỏ đường dẫn `D:/Tool` (chuyển sang biến môi trường trong `env.ps1`); `.claude/launch.json` và `packages/e2e/playwright.config.ts` dùng đường dẫn tương đối/tính từ vị trí file; `wave1.spec.ts` gọi `psql` trên `PATH` bằng `DATABASE_URL`.
- Viết lại `docs/HUONG-DAN-CHAY-LOCAL.md` (công cụ cần cài + phiên bản, cách cài PostgreSQL, lệnh nào chạy ở đâu) và mục "Dựng lại từ đầu" trong README.
- Kiểm chứng: nạp `env.ps1` từ thư mục khác; `pnpm store path` vẫn là kho cũ; chế độ không có `env.local.ps1` cho `PGDATA=<repo>\data\pgdata`; `db.ps1 init/start/status/stop` trên cụm tạm (cổng 54399, thư mục tạm) chạy đúng. Chưa kiểm trên máy Windows sạch khác và chưa kiểm Linux/macOS.

### 2026-10-16 — Tạm dừng `/goal`
- Chủ dự án yêu cầu tạm dừng goal ở đây. Trạng thái: web hoàn chỉnh theo phạm vi hiện tại, không còn việc dở trong code. Phiên sau chỉ cần làm tiếp khi chủ dự án giao việc mới.
- Việc chờ chủ dự án: điền `SMTP_URL`/`MAIL_FROM` (Brevo) vào `.env` rồi thử "Quên mật khẩu"; quyết định xóa `C:\Users\Admin\AppData\Local\ms-playwright` (701 MB, của dự án khác).

### 2026-10-16 — Email, tài liệu, kiểm tra ổ C
- Thêm `apps/api/test/mailer-smtp.e2e-spec.ts`: dựng máy chủ SMTP giả (`smtp-server` + `mailparser`) và kiểm `MailerService` gửi đúng tiêu đề/nội dung tiếng Việt/người gửi/người nhận qua `SMTP_URL`. Tổng test API: 92.
- Chọn **Brevo** (SMTP miễn phí ~300 thư/ngày) làm dịch vụ email; hướng dẫn nằm trong `.env.example` và README mục 4 phần "Trước khi đưa lên thật". Chưa gửi thử thật vì cần chủ dự án tạo tài khoản và điền `SMTP_URL`, `MAIL_FROM` vào `.env`.
- Commit `0481036` đã push lên `phananh/build-web`.
- Thêm `docs/HUONG-DAN-CHAY-LOCAL.md` và file nhật ký này theo yêu cầu của chủ dự án.
- Kiểm môi trường: công cụ/cache dự án nằm trong `D:\Tool` (ms-playwright 718 MB, PostgreSQL 931 MB, pnpm 19 MB, cache 1 GB). Từ khi dự án bắt đầu (15/10/2026 01:10) không có cache/công cụ nào của dự án trên C:. Thư mục `C:\Users\Admin\AppData\Local\ms-playwright` (701 MB) có từ 14/8/2026 do một lần chạy `npx playwright` của dự án khác, không phải của dự án này; chưa xóa, chờ chủ dự án quyết định. Mức trống C: giảm 6,82 → 6,29 GB trong lúc làm, không xác định được nguyên nhân (không có dữ liệu cũ); các ghi mới trên C: là của ứng dụng Claude và chương trình khác.
- 12 test Playwright bị skip là chủ đích: 2 test quản trị chỉ chạy trên desktop (×2 màn hình) và `shots.spec.ts` chỉ chạy khi `SHOTS=1`.
- **Còn dở / cần chủ dự án:** tạo tài khoản Brevo và điền `.env`; quyết định xóa thư mục `ms-playwright` trên C:; thẩm định nội dung lâm sàng và pháp lý; kiểm WebSocket qua nginx/Caddy thật khi có hạ tầng; nhắc lịch hẹn qua email chưa làm; ứng dụng di động.

### 2026-10-15 — Đợt 1: tính năng khảo sát từ các web trị liệu
- Làm 8 tính năng: tìm chuyên gia có lọc/sắp xếp, tự đánh giá PHQ-9/GAD-7, nhật ký tâm trạng, bài tập giữa buổi, ghi chú buổi, đánh giá chuyên gia (có kiểm duyệt), thông báo trong ứng dụng, quên mật khẩu qua email. Chi tiết: `docs/wave1-spec.md`.
- Sửa các lỗi do cố vấn/kiểm thử tìm ra: số đường dây nóng dự phòng (115), chuông thông báo bị cắt trên mobile, ô "chia sẻ" không được nhớ sang mục mới (nguy cơ lộ dữ liệu riêng tư), rate limit chung cấu hình được qua `RATE_LIMIT_PER_MIN`.
- Kiểm chứng: `pnpm check` xanh, `pnpm build` ổn, Playwright 66 test chạy qua trên 3 cỡ màn hình (1280/768/375).
- Đã commit và push (`ca6730f` là commit trước phần email).
