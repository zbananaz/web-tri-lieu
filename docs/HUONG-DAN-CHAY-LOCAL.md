# Hướng dẫn chạy web trên máy (local)

Chạy được trên máy Windows bất kỳ. Không có đường dẫn nào gắn cứng theo một máy: mọi script tự tìm thư mục gốc repo, công cụ lấy từ `PATH` của máy bạn (hoặc từ một thư mục công cụ riêng nếu bạn muốn, xem mục 1.3).

> **Quy ước:** mọi lệnh dưới đây chạy trong **PowerShell**, tại **thư mục gốc của repo** (thư mục chứa `package.json`, `pnpm-workspace.yaml`), trừ khi có ghi khác. Ký hiệu `<repo>` là đường dẫn tới thư mục đó trên máy bạn.

## 1. Cần cài những công cụ nào

### 1.1 Bắt buộc

| Công cụ | Phiên bản | Dùng để | Cách cài |
|---|---|---|---|
| Windows + PowerShell | PowerShell 5.1 trở lên (có sẵn trên Windows 10/11) | chạy các script trong `scripts/` | có sẵn |
| Node.js | **22 trở lên** (đã chạy trên 24) | chạy API, web, build | <https://nodejs.org> (bản LTS) |
| pnpm | **10.34.7** (khai báo ở `packageManager` trong `package.json`) | quản lý gói của monorepo | `corepack enable` (đi kèm Node ≤ 24), hoặc `npm install -g pnpm@10.34.7` |
| PostgreSQL | **17** (cần `pg_ctl`, `initdb`, `createdb`, `psql`, `pg_isready`, `pg_dump`) | cơ sở dữ liệu | xem 1.2 |
| Git | bất kỳ | lấy mã nguồn | <https://git-scm.com> |

Kiểm tra sau khi cài (mở PowerShell mới):

```powershell
node -v          # v22.x trở lên
pnpm -v          # 10.34.7
pg_ctl --version # pg_ctl (PostgreSQL) 17.x
```

Nếu `pnpm install` báo lỗi biên dịch gói gốc (ví dụ `argon2`), cần thêm Visual Studio Build Tools (workload "Desktop development with C++"). Thông thường gói đã có bản dựng sẵn nên không cần.

### 1.2 Cài PostgreSQL 17 (chọn một cách)

Dự án tự tạo **một cụm PostgreSQL riêng** (cổng `54329`, chỉ lắng nghe `127.0.0.1`, dữ liệu trong `<repo>\data\pgdata`), nên không đụng tới PostgreSQL khác trên máy (cổng 5432) và không cần cài thành dịch vụ Windows. Chỉ cần có các chương trình của PostgreSQL 17 trên `PATH`:

- **Cách A, trình cài đặt**: tải bản 17 từ <https://www.postgresql.org/download/windows/>, cài, rồi thêm thư mục `bin` (ví dụ `C:\Program Files\PostgreSQL\17\bin`) vào `PATH` của Windows.
- **Cách B, bản portable (không cần quyền quản trị, không ghi registry)**: tải file zip "binaries" của PostgreSQL 17 từ <https://www.enterprisedb.com/download-postgresql-binaries>, giải nén vào một thư mục tùy ý, rồi thêm thư mục `bin` bên trong vào `PATH` (hoặc dùng mục 1.3).

Cần có extension `btree_gist` (nằm trong gói chuẩn của cả hai cách trên); script `db.ps1 init` tự bật nó.

### 1.3 (Tùy chọn) Gom cache và công cụ vào một thư mục riêng, ví dụ ổ D

Nếu muốn cache của pnpm/npm, PostgreSQL portable và trình duyệt Playwright nằm ngoài ổ hệ thống:

```powershell
Copy-Item .\scripts\env.local.example.ps1 .\scripts\env.local.ps1
# mở scripts\env.local.ps1 và sửa dòng:  $env:WTL_TOOL_DIR = 'D:\Tool'   (đổi thành thư mục bạn muốn)
```

`env.local.ps1` bị `.gitignore`, chỉ có tác dụng trên máy bạn. Khi `WTL_TOOL_DIR` được đặt, `scripts\env.ps1` sẽ:

- đưa cache npm/pnpm/corepack/tạm vào `<WTL_TOOL_DIR>\cache\...`;
- đặt trình duyệt Playwright ở `<WTL_TOOL_DIR>\ms-playwright`;
- thêm vào `PATH` (nếu thư mục tồn tại): `<WTL_TOOL_DIR>\PostgreSQL\pgsql\bin` và `<WTL_TOOL_DIR>\pnpm\node_modules\.bin`;
- đặt dữ liệu DB ở `<WTL_TOOL_DIR>\PostgreSQL\data`.

Không đặt biến này thì mọi thứ dùng công cụ sẵn trên `PATH`. Không có gì ghi vào registry hay `PATH` hệ thống.

## 2. Lấy mã và cấu hình

```powershell
git clone git@github.com:zbananaz/web-tri-lieu.git
cd web-tri-lieu
git checkout phananh/build-web
Copy-Item .env.example .env
```

Mở `.env` và sửa (file này không được commit):

| Biến | Việc cần làm |
|---|---|
| `POSTGRES_PASSWORD` | đặt một mật khẩu tự chọn cho DB |
| `DATABASE_URL`, `TEST_DATABASE_URL` | thay `change-me` bằng đúng mật khẩu trên (giữ cổng `54329`; nếu mật khẩu có ký tự đặc biệt phải mã hóa `%XX`) |
| `SEED_PASSWORD` | mật khẩu chung cho các tài khoản mẫu, **từ 10 ký tự trở lên** |
| `SMTP_URL`, `MAIL_FROM` | để trống khi chạy thử (xem mục 6) |

## 3. Cài đặt lần đầu (chạy một lần)

Mỗi cửa sổ PowerShell mới phải nạp môi trường trước (bước này an toàn, chỉ có tác dụng trong cửa sổ đó):

```powershell
. .\scripts\env.ps1      # có dấu chấm + khoảng trắng ở đầu; script tự cd về thư mục gốc repo
```

Rồi:

```powershell
.\scripts\db.ps1 init            # tạo cụm PostgreSQL riêng + 2 database (webtrilieu, webtrilieu_test), tự bật btree_gist, và khởi động
pnpm install                     # cài gói
pnpm --filter "@wtl/shared" build
pnpm db:migrate                  # tạo bảng
pnpm db:seed                     # tài khoản + dữ liệu mẫu (mật khẩu = SEED_PASSWORD)
pnpm build                       # build API và web
```

Muốn chạy test trình duyệt (mục 7) thì cài thêm trình duyệt một lần: `pnpm --filter "@wtl/e2e" exec playwright install chromium`.

## 4. Chạy hằng ngày

```powershell
. .\scripts\env.ps1
.\scripts\db.ps1 start           # bật DB (bỏ qua nếu đã chạy: "Dang chay roi")
```

Rồi chạy API và web trong **hai cửa sổ PowerShell riêng** (cả hai đều nạp `env.ps1` trước):

```powershell
# cửa sổ 1: API, cổng 4000
pnpm --filter "@wtl/api" start:prod

# cửa sổ 2: web, cổng 3000
pnpm --filter "@wtl/web" start
```

Mở <http://localhost:3000>. Đang sửa code thì thay hai lệnh trên bằng `pnpm dev:api` và `pnpm dev:web` (tự nạp lại). Sau khi sửa code mà dùng `start:prod`/`start` thì phải `pnpm build` lại.

Tắt DB khi xong: `.\scripts\db.ps1 stop`.

Từ Claude Code: `preview_start` với tên `api` rồi `web` (cấu hình trong `.claude/launch.json`).

## 5. Đăng nhập thử

Mật khẩu của mọi tài khoản dưới đây là giá trị `SEED_PASSWORD` trong `.env`.

| Vai trò | Email |
|---|---|
| Quản trị | `admin@webtrilieu.local` |
| Chuyên gia | `bsminh@webtrilieu.local`, `tlhoa@webtrilieu.local` |
| Khách | `khach@webtrilieu.local` |

Luồng nên thử:

1. Khách: `/screening` làm sàng lọc, chờ duyệt.
2. Quản trị (`/admin`): duyệt hồ sơ và phân cho chuyên gia; đăng bài viết; duyệt đánh giá.
3. Chuyên gia (`/expert`): nhận ca, nhắn tin, đặt lịch, giao bài tập, ghi chú buổi.
4. Khách (`/me`): đặt lịch, nhắn tin, nhật ký tâm trạng (`/me/mood`), tự đánh giá (`/tu-danh-gia`), đánh giá chuyên gia sau buổi hoàn thành.
5. Công khai: `/experts` (lọc, sắp xếp), `/articles`.

## 6. Thử "Quên mật khẩu" khi chưa có email thật

Khi `.env` **không** có `SMTP_URL`, thư được ghi ra file JSON trong `<repo>\data\outbox\`. Vào `/forgot-password`, nhập email, rồi mở file mới nhất trong thư mục đó để lấy liên kết đặt lại. Production mà không có SMTP thì không gửi và không ghi ra đĩa.

Để gửi email thật: xem phần Email trong `.env.example` (Brevo, miễn phí) và README mục "Trước khi đưa lên thật".

## 7. Chạy kiểm tra

```powershell
pnpm check     # build shared + typecheck + lint + 7 unit + 92 API e2e (dùng DB webtrilieu_test, cần DB đang chạy)
pnpm e2e       # Playwright trên 3 cỡ màn hình; cần DB đã seed và `psql` trên PATH (nạp env.ps1)
```

`pnpm e2e` chạy trên DB dev thật và tự dọn dữ liệu thử cuối lần chạy. Chi tiết ở README mục "Kiểm tra".

## 8. Sự cố thường gặp

| Triệu chứng | Cách xử lý |
|---|---|
| `Khong tim thay 'pg_ctl' tren PATH` | Chưa cài PostgreSQL 17 hoặc chưa thêm `bin` vào `PATH`; xem mục 1.2 / 1.3. Mở PowerShell mới sau khi sửa `PATH`. |
| `pnpm` hoặc `psql` không nhận lệnh | Chưa nạp `. .\scripts\env.ps1` trong cửa sổ này, hoặc chưa cài pnpm (mục 1.1). |
| API báo không kết nối được DB | `.\scripts\db.ps1 start` rồi `.\scripts\db.ps1 status`. Kiểm tra `DATABASE_URL` dùng đúng cổng `54329` và đúng mật khẩu. |
| Cổng 3000 hoặc 4000 đang bị chiếm | `Get-NetTCPConnection -LocalPort 3000,4000 -State Listen`, rồi `Stop-Process -Id <PID>`. |
| Đăng nhập báo quá nhiều lần thử | Rate limit đăng nhập mặc định 20 lần/phút/IP; đợi 1 phút. |
| Quên mật khẩu quản trị | `pnpm --filter "@wtl/api" admin:reset-password <email>` |
| Sao lưu DB | `.\scripts\db.ps1 backup` (ra thư mục `backups` cạnh thư mục dữ liệu DB, giữ 14 bản mới nhất) |
| Muốn xóa sạch DB làm lại | `.\scripts\db.ps1 reset`, rồi `pnpm db:migrate` và `pnpm db:seed` (mất toàn bộ dữ liệu dev). |
| Đổi nơi lưu dữ liệu DB hoặc cổng | Đặt `$env:PGDATA` / `$env:PGPORT` (hoặc trong `scripts\env.local.ps1`); cổng phải khớp `DATABASE_URL`. |

Lưu ý: các script `.ps1` dùng WMI để khởi động PostgreSQL nên **chỉ kiểm chứng trên Windows**. Trên Linux/macOS, `db.ps1 start` có nhánh dùng `pg_ctl` trực tiếp nhưng chưa được kiểm.
