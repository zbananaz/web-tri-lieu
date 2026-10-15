# Hướng dẫn chạy web trên máy (local)

Dành cho Windows. Mọi công cụ và cache nằm trong `D:\Tool`, không sửa PATH/registry hệ thống, không dùng Docker hay Windows service.

## 0. Cần có sẵn

- `D:\Tool` chứa Node/pnpm, PostgreSQL portable (`D:\Tool\PostgreSQL`) và trình duyệt Playwright (`D:\Tool\ms-playwright`). Nếu mất, xem README mục "Dựng lại từ đầu".
- File `D:\Project\WebTriLieu\.env` (không commit; mẫu ở `.env.example`). Có sẵn `POSTGRES_PASSWORD`, `DATABASE_URL`, `SEED_PASSWORD`.

## 1. Mỗi lần mở cửa sổ PowerShell mới

```powershell
. D:\Project\WebTriLieu\scripts\env.ps1
cd D:\Project\WebTriLieu
```

Bước này đặt cache và PATH về `D:\Tool` cho riêng cửa sổ đó. Quên bước này thì `pnpm`, `psql` sẽ không tìm thấy hoặc ghi cache lên ổ C.

## 2. Bật cơ sở dữ liệu

```powershell
.\scripts\db.ps1 start      # PostgreSQL 17, 127.0.0.1:54329
.\scripts\db.ps1 status     # kiểm tra đang chạy
```

Tắt khi xong: `.\scripts\db.ps1 stop`.

## 3. Chạy web

### Cách A: bản build (giống thật, nhanh)

```powershell
pnpm build
pnpm --filter "@wtl/api" start:prod     # cửa sổ 1: API cổng 4000
pnpm --filter "@wtl/web" start          # cửa sổ 2: web cổng 3000 (nhớ chạy bước 1 ở cửa sổ này)
```

### Cách B: chế độ phát triển (tự nạp lại khi sửa code)

```powershell
pnpm dev:api                            # cửa sổ 1
pnpm dev:web                            # cửa sổ 2
```

Mở trình duyệt: <http://localhost:3000>.

### Cách C: từ Claude Code

Dùng `preview_start` với tên `api` rồi `web` (cấu hình ở `.claude/launch.json`).

## 4. Đăng nhập thử

Mật khẩu của các tài khoản dưới đây là giá trị `SEED_PASSWORD` trong `.env`.

| Vai trò | Email |
|---|---|
| Quản trị | `admin@webtrilieu.local` |
| Chuyên gia | `bsminh@webtrilieu.local`, `tlhoa@webtrilieu.local` |
| Khách | `khach@webtrilieu.local` |

Dữ liệu mẫu chưa có? Chạy một lần: `pnpm db:migrate` rồi `pnpm db:seed`.

## 5. Luồng nên thử

1. Khách: `/screening` làm sàng lọc → chờ duyệt.
2. Quản trị (`/admin`): duyệt hồ sơ và phân cho chuyên gia; đăng bài viết; duyệt đánh giá.
3. Chuyên gia (`/expert`): nhận ca, nhắn tin, đặt lịch, giao bài tập, ghi chú buổi.
4. Khách: đặt lịch, nhắn tin, nhật ký tâm trạng (`/me/mood`), tự đánh giá (`/tu-danh-gia`), đánh giá chuyên gia sau buổi hoàn thành.
5. Công khai: `/experts` (lọc, sắp xếp), `/articles`.

## 6. Thử tính năng quên mật khẩu (chưa cần email thật)

Khi `.env` **không** có `SMTP_URL`, thư được ghi ra file JSON trong `D:\Project\WebTriLieu\data\outbox\`. Vào `/forgot-password`, nhập email, rồi mở file mới nhất trong thư mục đó để lấy liên kết đặt lại. Production không có SMTP thì không gửi và không ghi ra đĩa.

Để gửi email thật: xem phần Email trong `.env.example` (Brevo, miễn phí) và README mục 4 phần "Trước khi đưa lên thật".

## 7. Chạy kiểm tra

```powershell
pnpm check     # build shared + typecheck + lint + 7 unit + 92 API e2e (dùng DB webtrilieu_test)
pnpm e2e       # Playwright trên 3 cỡ màn hình; cần DB đã seed
```

`pnpm e2e` chạy trên DB dev thật và tự dọn dữ liệu thử cuối lần chạy. Chi tiết ở README mục "Kiểm tra".

## 8. Sự cố thường gặp

| Triệu chứng | Cách xử lý |
|---|---|
| `pnpm` / `psql` không nhận lệnh | Chưa chạy bước 1 trong cửa sổ này. |
| API báo không kết nối được DB | `.\scripts\db.ps1 start`, rồi `status`. Kiểm tra `DATABASE_URL` trong `.env` dùng cổng 54329. |
| Cổng 3000 hoặc 4000 đang bị chiếm | Tắt tiến trình cũ: `Get-NetTCPConnection -LocalPort 3000,4000 -State Listen` rồi `Stop-Process -Id <PID>`. |
| Đăng nhập báo quá nhiều lần thử | Rate limit đăng nhập mặc định 20 lần/phút/IP; đợi 1 phút. |
| Quên mật khẩu quản trị | `pnpm --filter "@wtl/api" admin:reset-password <email>` |
| Cần sao lưu DB | `.\scripts\db.ps1 backup` (ra `D:\Tool\PostgreSQL\backups`, giữ 14 bản) |
| Muốn xóa sạch DB làm lại | `.\scripts\db.ps1 reset` rồi `pnpm db:migrate` và `pnpm db:seed` (mất toàn bộ dữ liệu dev). |
