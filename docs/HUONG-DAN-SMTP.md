# Hướng dẫn tạo dịch vụ gửi email (SMTP) của riêng bạn

Dành cho đồng nghiệp muốn web gửi được email thật (hiện dùng cho **Quên mật khẩu**) bằng tài khoản email dịch vụ **của chính mình**. Làm xong bạn có hai giá trị để điền vào `.env`: `SMTP_URL` và `MAIL_FROM`.

> **Không bao giờ** commit `.env`, dán `SMTP_URL` hay khóa SMTP vào chat, issue, ảnh chụp màn hình hay log. Khóa lộ thì xóa khóa đó ở trang dịch vụ và tạo khóa mới.

## 0. Cần biết trước

- Web gửi thư bằng thư viện `nodemailer`. Chỉ cần đặt `SMTP_URL`; không có thì thư được ghi ra file trong `data/outbox/*.json` (chỉ chạy dev/test). **Production mà thiếu `SMTP_URL` thì không gửi thư nào**, quên mật khẩu sẽ không hoạt động.
- Hai biến cần điền (xem `.env.example`):

| Biến | Ý nghĩa | Ví dụ (giả) |
|---|---|---|
| `SMTP_URL` | địa chỉ máy chủ SMTP kèm tài khoản | `smtp://dang-nhap:khoa@smtp-relay.brevo.com:587` |
| `MAIL_FROM` | tên + địa chỉ người gửi, **phải có dấu `<` `>`** | `"Tri Lieu <ban@example.com>"` |

- Dịch vụ nào cũng cho bạn 4 thông tin: **máy chủ** (host), **cổng** (port), **tên đăng nhập**, **mật khẩu/khóa SMTP**. Ghép lại thành `SMTP_URL` theo mục 3.
- Địa chỉ trong `MAIL_FROM` gần như luôn phải được dịch vụ **xác minh** trước, nếu không thư bị từ chối hoặc vào spam.

## 1. Chọn dịch vụ

Chọn một. Bảng chỉ mang tính tham khảo; hạn mức và điều kiện có thể đổi, hãy xem trang chính thức của dịch vụ trước khi dùng.

| Dịch vụ | Phù hợp khi | Lưu ý |
|---|---|---|
| **Brevo** (khuyên dùng để thử) | muốn miễn phí, chưa có tên miền riêng | gói miễn phí khoảng 300 thư/ngày; hướng dẫn chi tiết ở mục 2 |
| Gmail | chỉ để thử cá nhân với vài thư | cần bật xác minh 2 bước rồi tạo "Mật khẩu ứng dụng" (App password), không dùng mật khẩu Gmail thật; hạn mức gửi thấp, không nên cho production |
| Dịch vụ khác (Resend, Mailgun, SendGrid, Amazon SES, SMTP của công ty...) | có tên miền riêng, cần gửi nhiều/ổn định | thường phải xác minh tên miền (thêm bản ghi DNS SPF/DKIM); lấy host/cổng/tài khoản ở trang SMTP của dịch vụ |

## 2. Tạo tài khoản và khóa SMTP trên Brevo

Làm trong trình duyệt, bằng email của bạn. Tên menu dưới đây theo giao diện Brevo lúc viết; nếu giao diện đã đổi, tìm theo từ khóa "SMTP", "Senders", "Authorized IPs".

1. Vào <https://www.brevo.com>, đăng ký tài khoản miễn phí và xác nhận email.
2. Đăng nhập, vào **SMTP & API** (menu góc phải trên, bấm tên tài khoản) rồi tab **SMTP**.
3. Ghi lại:
   - **SMTP Server**: `smtp-relay.brevo.com`
   - **Port**: `587`
   - **Login**: dạng `xxxxxx@smtp-brevo.com` (**không phải** email đăng nhập Brevo của bạn)
4. Bấm **Generate a new SMTP key**, đặt tên (ví dụ `web-tri-lieu`) rồi **copy khóa ngay**, chỉ hiện một lần. Lưu tạm vào trình quản lý mật khẩu.
5. Xác minh địa chỉ gửi: vào **Senders, Domains & Dedicated IPs** → **Senders** → **Add a sender**, nhập tên và email của bạn, mở hộp thư bấm liên kết xác nhận. Địa chỉ này chính là địa chỉ dùng trong `MAIL_FROM`.
6. **Tắt chặn theo IP**: vào **Security** → **Authorized IPs**, tắt chặn (deactivate blocking) hoặc thêm IP mạng hiện tại của bạn. Nếu bỏ qua bước này, gửi sẽ lỗi `525 5.7.1 Unauthorized IP address`.

## 3. Ghép `SMTP_URL` và `MAIL_FROM`

Mẫu:

```text
SMTP_URL=smtp://<LOGIN>:<KHOA>@<HOST>:<PORT>
MAIL_FROM="Tri Lieu <email-da-xac-minh@example.com>"
```

Quy tắc ghép:

- **Mã hóa ký tự đặc biệt** thành `%XX` trong `<LOGIN>` và `<KHOA>`. Quan trọng nhất: dấu `@` trong login thành `%40`.
  Ví dụ login `abc123@smtp-brevo.com` → `abc123%40smtp-brevo.com`.
- Các ký tự thường gặp: `@`→`%40`, `:`→`%3A`, `/`→`%2F`, `#`→`%23`, `?`→`%3F`, `%`→`%25`, khoảng trắng→`%20`.
- Cổng **587** dùng `smtp://` (nâng cấp mã hóa STARTTLS tự động). Cổng **465** dùng `smtps://`.
- Không để khoảng trắng hay xuống dòng trong giá trị. `MAIL_FROM` đặt trong dấu nháy kép như ví dụ.

Ví dụ hoàn chỉnh (toàn giá trị giả):

```text
SMTP_URL=smtp://abc123%40smtp-brevo.com:xsmtpsib-KHOA-GIA@smtp-relay.brevo.com:587
MAIL_FROM="Tri Lieu <ban@example.com>"
```

## 4. Điền vào `.env` và chạy lại API

1. Mở file `.env` ở thư mục gốc repo (tạo từ `.env.example` nếu chưa có: `Copy-Item .env.example .env`).
2. Bỏ dấu `#` ở đầu hai dòng `SMTP_URL=` và `MAIL_FROM=` rồi điền giá trị của bạn. Lưu file.
3. **Khởi động lại API** (đang chạy thì tắt rồi chạy lại; API chỉ đọc `.env` lúc khởi động):

```powershell
. .\scripts\env.ps1
pnpm --filter "@wtl/api" start:prod
```

## 5. Kiểm tra gửi thử

**Cách nhanh nhất, qua giao diện web:**

1. Mở <http://localhost:3000/forgot-password>, nhập email của một tài khoản có thật (đăng ký bằng email bạn đọc được).
2. Kiểm tra hộp thư, kể cả thư rác. Thư tiêu đề **"Đặt lại mật khẩu"** có liên kết đặt lại là thành công.
3. Nếu không thấy thư, xem log cửa sổ API (nó **không** in `SMTP_URL`) và mục 6.

**Kiểm tra SMTP riêng, không qua web** (khi cần tách lỗi): tại thư mục gốc repo, dùng `nodemailer` có sẵn trong `apps/api`. Lưu đoạn sau thành file tạm **ngoài repo** (ví dụ `smtp-check.mjs` trong thư mục tạm), đổi `REPO` thành đường dẫn repo trên máy bạn rồi chạy `node smtp-check.mjs`:

```js
import { createRequire } from 'node:module';
const REPO = 'ĐƯỜNG-DẪN-TỚI-REPO'; // đổi cho đúng máy bạn
const require = createRequire(`${REPO}/apps/api/package.json`);
process.loadEnvFile(`${REPO}/.env`);
const nodemailer = require('nodemailer');

const url = process.env.SMTP_URL, from = process.env.MAIL_FROM;
if (!url || !from) { console.log('Thieu SMTP_URL hoac MAIL_FROM'); process.exit(1); }
const to = (from.match(/<([^>]+)>/)?.[1] ?? from).trim();
const t = nodemailer.createTransport(url);
try {
  await t.verify();
  console.log('Dang nhap SMTP OK');
  const info = await t.sendMail({ from, to, subject: 'Thu thu', text: 'SMTP hoat dong.' });
  console.log('Gui OK:', info.response);
} catch (e) {
  console.log('LOI:', e.code, String(e.message).replace(/\/\/[^@\s]*@/g, '//***@'));
  process.exit(2);
}
```

Script này chỉ in kết quả, không in khóa, và gửi thư thử tới chính `MAIL_FROM`.

## 6. Lỗi thường gặp

| Triệu chứng | Nguyên nhân và cách xử lý |
|---|---|
| `525 5.7.1 Unauthorized IP address` (Brevo) | Brevo chặn IP máy bạn. **Security → Authorized IPs**: tắt chặn hoặc thêm IP hiện tại. |
| `EAUTH`, `Invalid login`, `535` | Sai login/khóa. Kiểm tra login đã đổi `@` thành `%40`, khóa còn hiệu lực, không dính khoảng trắng; tạo khóa mới nếu nghi sai. |
| `Invalid URL` hoặc script báo URL không hợp lệ | Còn ký tự đặc biệt chưa mã hóa, hoặc có khoảng trắng/xuống dòng trong `SMTP_URL`. |
| Báo lỗi người gửi / `Sender not valid` | `MAIL_FROM` chưa xác minh ở dịch vụ, hoặc thiếu dạng `Tên <email>`. |
| `ECONNREFUSED`, `ETIMEDOUT` | Sai host/cổng, hoặc mạng (công ty, trường) chặn cổng 587/465. Thử mạng khác hoặc cổng 465 với `smtps://`. |
| Gửi báo thành công nhưng không thấy thư | Xem thư rác; đợi vài phút; xem lịch sử gửi trên trang dịch vụ (Brevo: **Transactional → Logs**). Gmail/Outlook có thể đưa thư từ địa chỉ chưa xác thực tên miền vào spam. |
| Lệnh/web chạy mà API vẫn ghi file ra `data/outbox` | API chưa nạp `SMTP_URL`: kiểm tra đã bỏ `#`, đã lưu `.env` ở thư mục gốc repo, đã **khởi động lại API**. |
| Production, nhưng không có thư nào gửi đi | Thiếu `SMTP_URL`: production cố ý không gửi và không ghi thư ra đĩa. Log API có dòng báo chưa cấu hình. |

## 7. Khi chuyển sang chạy thật (production)

- Dùng **tên miền riêng** và xác minh tên miền với dịch vụ (thêm bản ghi SPF/DKIM theo hướng dẫn của họ) để thư không vào spam; sau đó `MAIL_FROM` có thể dùng địa chỉ trên tên miền đó (ví dụ `no-reply@ten-mien-cua-ban`).
- Đặt `SMTP_URL`/`MAIL_FROM` bằng biến môi trường hoặc bí mật (secret) của nơi triển khai, **không** đưa vào mã nguồn.
- Chú ý hạn mức gửi của gói bạn dùng; web có giới hạn số lần gọi theo IP, nhưng hạn mức thư của dịch vụ là của bạn.
- Nếu khóa từng bị lộ: xóa khóa cũ trên trang dịch vụ, tạo khóa mới, cập nhật `.env`, khởi động lại API.

Xem thêm: [HUONG-DAN-CHAY-LOCAL.md](HUONG-DAN-CHAY-LOCAL.md) (chạy web trên máy), `.env.example` (các biến cấu hình).
