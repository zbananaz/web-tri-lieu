# Web trung tâm trị liệu tâm lý: spec thiết kế

Trạng thái: bản thiết kế do Claude tự quyết theo `/goal` của chủ dự án (khách chưa trả lời bảng câu hỏi). Mọi mục "Giả định" có thể đổi sau khi khách trả lời, mà không đổi kiến trúc.

## 1. Mục tiêu
Web responsive (điện thoại 375px, tablet 768px, desktop 1280px) cho trung tâm trị liệu: khách làm bài sàng lọc, quản trị viên duyệt rồi phân cho chuyên gia, khách đặt lịch và nhắn tin với chuyên gia, quản trị viên đăng bài viết. Web làm trước, app mobile làm sau nên toàn bộ nghiệp vụ nằm sau một API độc lập.

## 2. Giả định (chưa có câu trả lời của khách)
- Khách tạo tài khoản nhẹ (email + mật khẩu) vì chat và đặt lịch cần định danh.
- Chỉ tiếng Việt. Một vai trò quản trị duy nhất (chưa phân cấp lễ tân / quản lý).
- Không thanh toán online, không gọi video trên web: lịch hẹn có trường link họp (Meet/Zoom) do chuyên gia nhập.
- Thông báo: trong app (thông báo trên web) ở bản đầu; email/Zalo ZNS để sau.
- Gợi ý chuyên gia do hệ thống tính, quản trị viên bấm xác nhận (không tự phân).
- Số hotline khẩn cấp để ở cấu hình, mặc định chỉ có 115 và 111; trung tâm phải xác nhận danh sách thật.

## 3. Kiến trúc
Monorepo pnpm. `apps/api` (NestJS) · `apps/web` (Next.js) · `packages/shared` (zod schema, kiểu dùng chung).
- **Cùng origin:** Next rewrite `/api/*` sang NestJS, nên cookie là first-party. Socket.IO nối thẳng vào cổng API khi chạy local; production dùng reverse proxy cho `/api` và `/socket.io`.
- **Auth ở NestJS:** phiên token ngẫu nhiên lưu DB (chỉ lưu hash SHA-256), mật khẩu argon2id. Web gửi qua cookie httpOnly + SameSite=Lax. Mobile sau này gửi Bearer cùng token đó.
- **Next.js:** không dùng Server Actions. Middleware chỉ để chuyển hướng cho tiện, không phải ranh giới bảo mật. Mọi quyết định phân quyền nằm ở API.
- **DB:** PostgreSQL 17, Drizzle ORM. Chống trùng lịch bằng exclusion constraint trên `tstzrange` (cần `btree_gist`). Giờ lưu UTC, hiển thị Asia/Ho_Chi_Minh.
- **Chat:** Socket.IO một instance, tin nhắn lưu DB, phòng theo ca.

## 4. Phân quyền
| Hành động | Khách | Chuyên gia | Quản trị viên |
|---|---|---|---|
| Xem bài viết, hồ sơ công khai chuyên gia | ✔ | ✔ | ✔ |
| Gửi bài sàng lọc, xem ca của chính mình | ✔ | | |
| Xem ca được phân cho mình (sau khi phân) | | ✔ | |
| Xem SĐT/email khách | | chỉ khi ca đã phân cho mình | ✔ |
| Duyệt, từ chối, phân ca | | | ✔ |
| Từ chối ca được phân, cập nhật trạng thái điều trị | | ✔ (ca của mình) | ✔ |
| Đặt, hủy lịch | ✔ (ca của mình) | ✔ (xác nhận/hủy lịch của mình) | ✔ |
| Chat | chỉ với chuyên gia được phân | chỉ với khách của ca đó | xem được (có audit) |
| Quản lý bài viết, câu hỏi sàng lọc, người dùng | | | ✔ |
| Xem nhật ký audit | | | ✔ |

Quy tắc đối tượng (object-level): mọi truy vấn ca/lịch/tin nhắn đều lọc theo chủ sở hữu hoặc chuyên gia được phân ngay trong tầng truy vấn, không chỉ ở controller.

## 5. Máy trạng thái của ca
`submitted → approved → assigned → contacted → in_treatment → closed`
Nhánh: `submitted → rejected` (kèm lý do, khách nhìn thấy), `assigned → approved` (chuyên gia từ chối, quay lại hàng chờ), `* → closed` (admin).
Máy chủ kiểm tra từng bước chuyển theo vai trò; bước không hợp lệ trả 409.

## 6. Bảo mật
- Hash mật khẩu argon2id; phiên có hạn, thu hồi khi đăng xuất/đổi mật khẩu.
- Khóa tạm tài khoản sau nhiều lần sai (rate limit đăng nhập theo IP + email).
- Kiểm tra header `Origin` cho mọi request thay đổi dữ liệu (chống CSRF), helmet, CORS giới hạn.
- Làm sạch HTML bài viết ở máy chủ trước khi lưu; render có CSP.
- Câu trả lời sàng lọc báo nguy cơ: hiện ngay hotline, đánh dấu ca `urgent` cho admin.
- Nhật ký audit mọi lần đọc hồ sơ khách, mọi thay đổi trạng thái và phân ca.
- Không log mật khẩu, token, nội dung chat.
- Next.js ghim ≥ 16.3.3 (các CVE tháng 7/2026).

## 7. Danh sách "hoàn thành" kiểm chứng được
1. Lệnh `pnpm check` (typecheck + lint + test) xanh.
2. Có tài khoản seed cho 3 vai trò (ghi trong README, mật khẩu seed nằm trong `.env`).
3. Test API: mỗi quy tắc phân quyền có ít nhất một test trả 401/403/404 đúng.
4. Playwright e2e chạy ở 375, 768, 1280px cho luồng: đăng ký → sàng lọc → admin duyệt → phân ca → đặt lịch → chat → admin đăng bài → bài hiện ở trang công khai.
5. README giải thích cách dựng lại toàn bộ từ `D:\` (Postgres, API, web).
6. Dung lượng ổ C không tăng đáng kể do dự án (mọi cache ở `D:\Tool`).

## 8. Ngoài phạm vi bản đầu (YAGNI)
Thanh toán, video call trong web, Zalo/SMS, phân cấp admin, app mobile, đa ngôn ngữ, mã hóa đầu cuối cho chat.
