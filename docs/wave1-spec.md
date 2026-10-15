# Đợt 1: tính năng bổ sung (từ khảo sát Taro, Seansly, Hello Bacsi, BetterHelp, Talkspace, Lyra, Alma, Psychology Today)

Mọi tính năng dùng lại kiến trúc hiện có (NestJS + Drizzle + zod ở `packages/shared`, Next.js). Phân quyền kiểm ở máy chủ, đối tượng không thuộc người gọi trả 404.

## 1. Tìm chuyên gia nâng cao
`GET /api/experts?q=&specialty=&mode=&language=&maxFee=&sort=` (công khai). `sort`: `name` (mặc định), `soonest` (lịch trống sớm nhất), `rating`. Mỗi chuyên gia có thêm `rating {avg,count}|null` và `nextSlot` (ISO|null, tính từ lịch rảnh trừ lịch đã đặt, dùng chung `computeSlots`). Lọc/sắp xếp ở máy chủ; tham số sai → 400.

## 2. Tự đánh giá PHQ-9 / GAD-7
Câu hỏi, cách tính điểm, mức độ nằm ở `packages/shared` (một nguồn duy nhất). Trang `/tu-danh-gia` chạy hoàn toàn ở trình duyệt, không gửi gì lên máy chủ. Khách đã đăng nhập có thể bấm "Lưu kết quả" → `POST /api/assessments` (máy chủ tự tính lại điểm từ câu trả lời, không tin điểm do client gửi). Câu 9 của PHQ-9 > 0 hoặc điểm nặng → hiện hotline và gợi ý làm sàng lọc. Có ghi rõ "không phải chẩn đoán". Nội dung tiếng Việt cần chuyên gia lâm sàng thẩm định.
- `GET /api/assessments/mine`, `PATCH /api/assessments/:id` (`shared`), `DELETE /api/assessments/:id`.
- Chỉ khách xem được kết quả của mình; chuyên gia chỉ xem kết quả đã chia sẻ của khách thuộc ca đang phụ trách.

## 3. Nhật ký tâm trạng
Khách: `POST/GET/DELETE /api/mood`, mỗi lần ghi gồm mức 1–5, ghi chú ≤500 ký tự, cờ `shared` (mặc định false). Chuyên gia: `GET /api/cases/:id/client-tracking` trả các mục đã chia sẻ + kết quả tự đánh giá đã chia sẻ của khách trong ca mình phụ trách (ca ở trạng thái đang trị liệu). Quản trị viên không đọc nhật ký.

## 4. Bài tập giữa các buổi
Chuyên gia phụ trách ca tạo bài (`POST /api/cases/:id/homework`: tiêu đề, hướng dẫn, hạn); khách xem và nộp (`PATCH /api/homework/:id/submit` với nội dung ≤4000); chuyên gia xem phản hồi. `GET /api/cases/:id/homework` cho khách và chuyên gia của ca đó. Quản trị viên không đọc phản hồi.

## 5. Ghi chú buổi (riêng tư)
Chỉ chuyên gia tạo ghi chú, chỉ chính tác giả đọc/sửa/xóa (`/api/cases/:id/notes`, `/api/notes/:id`). Khách và quản trị viên không thấy; ghi chú thuộc ca khác trả 404.

## 6. Đánh giá chuyên gia
Khách đánh giá một lịch hẹn đã hoàn thành (`POST /api/appointments/:id/review`, mỗi lịch một đánh giá, 1–5 sao + nhận xét ≤1000). Mặc định `pending`; quản trị viên duyệt hiển thị/ẩn (`/api/admin/reviews`). Chỉ đánh giá đã duyệt xuất hiện công khai (`GET /api/experts/:id/reviews`) và vào điểm trung bình. Không lộ tên khách (chỉ tên rút gọn).

## 7. Thông báo trong app
Bảng `notifications` (loại, tiêu đề, đường dẫn, đã đọc). Sinh ra khi: ca được duyệt/từ chối/phân; lịch hẹn được đặt/xác nhận/hủy; có bài tập mới/được nộp; đánh giá được duyệt. `GET /api/notifications`, `POST /api/notifications/read` (một hoặc tất cả). Chuông trên thanh đầu trang, hỏi lại 30 giây một lần. Chỉ người nhận đọc được.

## 8. Quên mật khẩu qua email
`POST /api/auth/forgot-password` luôn trả 204 (không lộ email có tồn tại), giới hạn theo IP và theo email, không gửi cho tài khoản bị khóa. Token ngẫu nhiên 256 bit, DB chỉ lưu SHA-256, dùng một lần, hết hạn sau 45 phút, hủy khi đổi mật khẩu. Liên kết dựng từ `WEB_ORIGIN`, không từ header Host. `POST /api/auth/reset-password` đặt mật khẩu mới, hủy mọi phiên, xóa khóa đăng nhập và cờ mật khẩu tạm, ghi audit (không ghi token). Trang đặt lại không tải tài nguyên bên thứ ba và đặt `Referrer-Policy: no-referrer`.
Gửi thư qua SMTP (biến môi trường `SMTP_URL`, `MAIL_FROM`); chưa cấu hình thì ghi thư ra `data/outbox/*.json` (dev/test; e2e đọc liên kết từ đây). Nhà cung cấp email thật do chủ dự án chọn sau.

## Ngoài phạm vi đợt này
Thanh toán online, video call tích hợp, nhắc lịch (cần bộ lập lịch), đơn đăng ký chuyên gia, chatbot AI lâm sàng.

## Cập nhật sau rà soát (thay thế các đoạn mâu thuẫn ở trên)

- **Phạm vi chia sẻ**: chuyên gia chỉ xem mục khách đã chia sẻ khi ca ở trạng thái `assigned/contacted/in_treatment` (`CHAT_OPEN_STATUSES`); ca đã đóng thì không. Quản trị viên không đọc được ghi chú, nhật ký, bài tập, kết quả tự đánh giá (API trả 403/404).
- **Đánh giá công khai** không có tên khách (chỉ `id, rating, comment, createdAt`); trang quản trị mới thấy tên để duyệt.
- **Giờ trống gần nhất** (`nextSlot`): tính trong 14 ngày bằng hai truy vấn dùng chung cho cả danh sách (không N+1), cùng hàm `computeSlots` và `MIN_LEAD_MINUTES` với luồng đặt lịch.
- **Lọc theo chi phí** (`maxFee`) loại chuyên gia chưa công bố chi phí.
- **Quên mật khẩu**: giới hạn 3 yêu cầu/giờ/tài khoản tính bằng DB (không phụ thuộc IP); thư ghi ra `data/outbox` chỉ ở dev/test, production không bao giờ ghi token ra đĩa.
- **Giới hạn tốc độ chung** cấu hình bằng `RATE_LIMIT_PER_MIN` (mặc định 120/phút/IP).
- **Giao diện**: mặc định mọi mục nhật ký là riêng tư, ô "chia sẻ" tự bỏ chọn sau mỗi lần lưu (đã có test chặn lỗi "dính" lựa chọn sang mục sau).
- Nội dung PHQ-9/GAD-7 tiếng Việt là bản nháp, cần chuyên gia lâm sàng thẩm định trước khi dùng thật.
