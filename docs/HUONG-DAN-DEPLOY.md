# Hướng dẫn đưa web lên mạng: Vercel (web) + Render (API) + Neon (PostgreSQL)

Kiến trúc:

```text
Trình duyệt ──► Vercel (Next.js, apps/web) ──/api/* rewrite──► Render (NestJS, apps/api) ──► Neon (PostgreSQL)
                                                                        └─► Brevo (SMTP, gửi email)
```

Trình duyệt chỉ nói chuyện với Vercel. Mọi yêu cầu `/api/*` được Vercel chuyển tiếp tới API trên Render, nên cookie phiên nằm ở domain Vercel và không cần CORS. Giá trị `<...>` bên dưới là chỗ bạn thay bằng giá trị thật. **Không dán mật khẩu/khóa vào chat, commit hay ảnh chụp màn hình.**

Thứ tự làm: **(1) Neon** → **(2) Render** → **(3) tạo admin đầu tiên** → **(4) nối Vercel với API** → **(5) kiểm tra**.

> Web trên Vercel đã deploy (nhánh `main`, Root Directory `apps/web`). Phần này làm nốt API và nối hai bên.

## 1. Tạo database trên Neon

1. Vào <https://neon.tech>, đăng ký (có thể dùng GitHub), tạo **Project**. Chọn region gần Việt Nam (ví dụ Singapore) và PostgreSQL **17**.
2. Trong project, bấm **Connect** và copy **connection string** dạng `postgresql://<user>:<mật-khẩu>@<host>/<db>?sslmode=require`. Chuỗi này là `DATABASE_URL`. Giữ `?sslmode=require`.
3. Lưu `DATABASE_URL` vào trình quản lý mật khẩu. Bảng/dữ liệu sẽ được tạo tự động khi API khởi động (mục 2).

## 2. Tạo API trên Render

1. Vào <https://render.com>, đăng ký bằng GitHub, cho Render quyền đọc repo `zbananaz/web-tri-lieu`.
2. **New → Blueprint**, chọn repo. Render đọc [`render.yaml`](../render.yaml) ở thư mục gốc và tạo dịch vụ `web-tri-lieu-api` (gói Free, region Singapore).
3. Render hỏi các biến bí mật (đặt `sync: false`), điền:

   | Biến | Giá trị |
   |---|---|
   | `DATABASE_URL` | chuỗi từ Neon (mục 1) |
   | `WEB_ORIGIN` | `https://<tên-miền-vercel>` đúng như thanh địa chỉ, **không có dấu `/` cuối** |
   | `SMTP_URL`, `MAIL_FROM` | theo [HUONG-DAN-SMTP.md](HUONG-DAN-SMTP.md) (để trống thì không gửi được email quên mật khẩu) |

   Các biến còn lại đã có sẵn trong `render.yaml` (`NODE_ENV=production`, `API_HOST=0.0.0.0`, `UPLOAD_DIR`, `TRUST_PROXY_HOPS=2`...).
4. Bấm **Apply** và đợi build xong (vài phút). Khi khởi động, API tự chạy migration, rồi lên. Mở `https://<tên-api>.onrender.com/api/health`: thấy `{"status":"ok"}` là thành công. Ghi lại địa chỉ `https://<tên-api>.onrender.com`.

Nếu build lỗi, xem tab **Logs** của dịch vụ và bảng lỗi ở mục 6.

## 3. Tạo tài khoản quản trị đầu tiên

Lệnh `db:seed` **cố ý bị chặn ở production** (nó tạo tài khoản mẫu). Thay vào đó dùng lệnh `admin:create`, chạy **trên máy bạn** nhưng trỏ vào database Neon:

```powershell
# tại thư mục gốc repo, đã cài (pnpm install) và nạp môi trường
. .\scripts\env.ps1
$env:DATABASE_URL = '<chuỗi-Neon-của-bạn>'
pnpm --filter "@wtl/api" admin:create <email-của-bạn> "<Họ và tên>"
Remove-Item Env:DATABASE_URL
```

Lệnh tạo tài khoản quản trị, nạp danh mục lĩnh vực (không có dữ liệu mẫu nào khác) và in **mật khẩu tạm một lần**. Đăng nhập lần đầu bằng mật khẩu đó, web sẽ bắt đổi mật khẩu. Sau đó bạn tự vào trang quản trị để tạo câu hỏi sàng lọc, duyệt chuyên gia, đăng bài viết.

Lưu ý: nếu chưa có câu hỏi sàng lọc nào, khách chưa sàng lọc được. Tạo câu hỏi ở quản trị → Câu hỏi sàng lọc (nội dung lâm sàng cần chuyên gia thẩm định trước khi dùng thật).

Quên mật khẩu quản trị: `pnpm --filter "@wtl/api" admin:reset-password <email>` (cùng cách trỏ `DATABASE_URL` như trên).

## 4. Nối Vercel với API

Vào Vercel → project → **Settings → Environment Variables**, thêm hoặc sửa:

| Biến | Giá trị |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | `https://<tên-miền-vercel>` |
| `API_INTERNAL_URL` | `https://<tên-api>.onrender.com` (không có `/` cuối, **không** thêm `/api`) |
| `NEXT_PUBLIC_REALTIME_URL` | **để trống / không thêm** (xem lý do bên dưới) |

Rồi vào **Deployments → bản mới nhất → ⋯ → Redeploy** (biến này được đọc lúc build nên bắt buộc redeploy).

Vì sao để trống `NEXT_PUBLIC_REALTIME_URL`: cookie phiên nằm ở domain Vercel nên socket nối thẳng sang domain Render sẽ không có cookie và bị từ chối. Để trống thì chat tự dùng cơ chế dự phòng: tải lại tin nhắn mỗi 8 giây (chat vẫn hoạt động, chỉ không "tức thời"). Muốn chat tức thời cần thêm domain riêng dùng chung cho cả web và API, chưa làm.

## 5. Kiểm tra sau khi deploy

1. Mở trang Vercel: trang chủ, **Chuyên gia**, **Bài viết** (có thể trống nếu chưa có dữ liệu) không báo lỗi.
2. Đăng nhập bằng tài khoản quản trị vừa tạo, đổi mật khẩu tạm.
3. Đăng ký thử một tài khoản khách mới, thử **Quên mật khẩu** (cần SMTP).
4. Thử gửi một tin nhắn trong ca đang mở (hai trình duyệt khác nhau), thấy tin sau tối đa ~8 giây.

Lần đầu truy cập sau một lúc không có người dùng, API Free "ngủ" và mất khoảng nửa phút để thức dậy; đây là giới hạn của gói Free.

## 6. Lỗi thường gặp

| Triệu chứng | Nguyên nhân và cách xử lý |
|---|---|
| Build Render lỗi `nest: not found` hoặc `tsx: not found` | Dev dependencies bị bỏ qua. Bảo đảm lệnh build có `--prod=false` (đã có trong `render.yaml`). |
| Render báo "No open ports detected" | API chưa nghe `0.0.0.0` hoặc sai cổng. Kiểm tra biến `API_HOST=0.0.0.0` và **không** đặt `API_PORT` (Render tự cấp `PORT`). |
| Log báo lỗi kết nối DB / `SSL` | `DATABASE_URL` sai hoặc thiếu `?sslmode=require`; kiểm tra project Neon không bị tạm dừng. |
| Đăng nhập báo "Nguồn yêu cầu không hợp lệ" (403) | `WEB_ORIGIN` trên Render khác địa chỉ web thật (thừa `/` cuối, sai `http/https`, sai tên miền). Sửa rồi để Render chạy lại. |
| Trang trên Vercel không có dữ liệu, đăng nhập lỗi 502/404 | `API_INTERNAL_URL` sai hoặc chưa Redeploy sau khi thêm. |
| Rate limit chặn nhầm nhiều người cùng lúc | `TRUST_PROXY_HOPS` sai số lớp proxy nên mọi người bị tính chung một IP. Thử `1` hoặc `3`, xem nhật ký truy cập của quản trị để so IP. |
| Ảnh bài viết đã tải lên biến mất | Gói Free không có ổ đĩa bền vững, xem mục 7. |
| Email không gửi | Thiếu `SMTP_URL`/`MAIL_FROM` trên Render, xem [HUONG-DAN-SMTP.md](HUONG-DAN-SMTP.md). Production không có SMTP thì cố ý không gửi. |

## 7. Giới hạn hiện tại cần biết

- **Ảnh tải lên (ảnh bìa bài viết...) lưu trong `UPLOAD_DIR=/tmp/uploads` trên Render Free và sẽ mất** khi API khởi động lại hoặc deploy lại. Bài viết vẫn còn, chỉ ảnh bìa tải lên bị mất. Cách khắc phục: dùng ảnh đã có sẵn trong web, hoặc nâng lên gói có ổ đĩa bền vững (Render Disk, mount vào đường dẫn rồi đặt `UPLOAD_DIR` trỏ tới), hoặc đổi sang lưu trữ đối tượng (cần sửa code).
- **API Free ngủ sau một thời gian không có yêu cầu** nên phản hồi đầu tiên chậm. Neon Free cũng tự tạm dừng khi rảnh và thức lại sau vài giây.
- **`TRUST_PROXY_HOPS=2` là suy luận**, chưa kiểm trên hạ tầng thật: Vercel và proxy Render mỗi bên một lớp. Nếu IP ghi nhật ký/tính rate limit không đúng, chỉnh số này.
- **Chat realtime qua WebSocket** chưa dùng được qua Vercel (chat chạy bằng tải lại định kỳ).
- **Chưa kiểm toàn bộ luồng trên hạ tầng thật.** Mọi bước ở đây dựa trên cấu hình và kiểm thử cục bộ (API build, `admin:create` trên DB tạm, API nghe `0.0.0.0`), nên bước 5 là lần thử thật đầu tiên.

Xem thêm: [HUONG-DAN-SMTP.md](HUONG-DAN-SMTP.md), [HUONG-DAN-CHAY-LOCAL.md](HUONG-DAN-CHAY-LOCAL.md), `.env.example`.
