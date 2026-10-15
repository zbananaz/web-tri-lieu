/**
 * Tạo Google Form "Bảng câu hỏi làm rõ yêu cầu: web app trung tâm trị liệu tâm lý"
 * từ file cau-hoi-gui-khach.docx.
 *
 * Cách chạy:
 *   1. Mở https://script.google.com → "Dự án mới".
 *   2. Xóa code mẫu, dán toàn bộ file này vào, bấm Lưu.
 *   3. Chọn hàm taoForm → bấm "Chạy" → cấp quyền cho tài khoản Google của bạn.
 *   4. Mở "Nhật ký thực thi" để lấy link sửa form và link gửi khách.
 */

// Số ngày làm việc sẽ gửi lại tài liệu phạm vi + báo giá (hiện trong lời cảm ơn cuối form).
const SO_NGAY_BAO_GIA = '5';

// type: 'para' = đoạn văn, 'text' = trả lời ngắn, 'check' = chọn nhiều, 'radio' = chọn một
// req: bắt buộc (các câu ★ trong file gốc); other: thêm lựa chọn "Khác: …"
const SECTIONS = [
  {
    title: 'A. Thông tin chung và mục tiêu',
    items: [
      { type: 'para', req: true, title: 'Tên trung tâm, địa chỉ, website/fanpage hiện có (nếu có).' },
      { type: 'para', req: true, title: 'Người liên hệ chính và người có quyền duyệt cuối (duyệt thiết kế, nghiệm thu, thanh toán). Có phải cùng một người không?' },
      {
        type: 'check', req: true, other: true,
        title: 'Mục tiêu chính của web là gì? (chọn nhiều)',
        choices: [
          'Nhận yêu cầu tư vấn từ khách mới',
          'Quản lý ca/khách nội bộ thay cho Excel, Zalo',
          'Giới thiệu trung tâm, xây dựng thương hiệu',
          'Bán gói trị liệu, thu tiền online',
        ],
      },
      { type: 'para', title: 'Hiện tại trung tâm nhận và phân khách như thế nào (Zalo, điện thoại, Google Form, Excel…)? Khó khăn lớn nhất là gì?' },
      { type: 'para', title: 'Sau 6 tháng chạy web, thế nào thì anh/chị coi là thành công? (ví dụ: số yêu cầu/tháng, giảm thời gian phân ca…)' },
    ],
  },
  {
    title: 'B. Người dùng và vai trò',
    items: [
      { type: 'text', req: true, title: 'Hiện có bao nhiêu chuyên gia? Dự kiến sau 1 năm?' },
      { type: 'para', req: true, title: 'Có bao nhiêu người làm quản trị viên? Họ có cần phân cấp không (ví dụ: lễ tân chỉ xem, quản lý mới được phân ca)?' },
      { type: 'text', title: 'Ước lượng số khách gửi yêu cầu mỗi tháng?' },
      {
        type: 'radio', req: true,
        title: 'Khách có cần tạo tài khoản không, hay chỉ cần điền form và nhận liên lạc lại?',
        choices: [
          'Không cần tài khoản (giống seansly.co)',
          'Có tài khoản để xem trạng thái, lịch sử',
          'Tùy em đề xuất',
        ],
      },
      { type: 'para', title: 'Khách hàng có người dưới 18 tuổi không? Nếu có, phụ huynh có cần điền/đồng ý thay không?' },
      { type: 'para', title: 'Chuyên gia có làm việc tại trung tâm, hay có cả chuyên gia cộng tác ở nơi khác?' },
    ],
  },
  {
    title: 'C. Bước sàng lọc',
    items: [
      { type: 'para', req: true, title: 'Danh sách các lĩnh vực/chuyên môn cần phân loại (ví dụ: lo âu, trầm cảm, hôn nhân, trẻ em, sang chấn, nghiện…).' },
      {
        type: 'para', req: true,
        title: 'Trung tâm đã có sẵn bộ câu hỏi sàng lọc chưa? Nếu có, nhờ gửi file. Nếu chưa, ai trong trung tâm sẽ soạn nội dung chuyên môn?',
        help: 'File vui lòng gửi qua Zalo hoặc email.',
      },
      { type: 'para', title: 'Có dùng thang đo chuẩn (PHQ-9, GAD-7, DASS-21…) và cần tự tính điểm không?' },
      {
        type: 'check', other: true,
        title: 'Ngoài lĩnh vực, cần hỏi thêm gì để ghép chuyên gia? (chọn nhiều)',
        choices: [
          'Hình thức: online / trực tiếp',
          'Giới tính chuyên gia mong muốn',
          'Khung giờ rảnh',
          'Ngân sách/mức phí',
          'Ngôn ngữ',
        ],
      },
      { type: 'para', req: true, title: 'Nếu câu trả lời cho thấy dấu hiệu nguy hiểm (ý định tự hại…), trung tâm muốn web xử lý thế nào? (hiện số đường dây nóng ngay, báo khẩn cho quản trị viên, gọi lại trong X giờ…)' },
      { type: 'para', title: 'Sau khi điền xong, khách nên thấy thông báo gì và bao lâu thì được liên hệ?' },
    ],
  },
  {
    title: 'D. Quản trị viên duyệt và phân công chuyên gia',
    items: [
      { type: 'para', req: true, title: 'Quản trị viên dựa vào đâu để duyệt hoặc từ chối một yêu cầu? Khi từ chối thì khách nhận được gì?' },
      { type: 'para', req: true, title: 'Phân công do quản trị viên chọn tay, hay muốn web gợi ý chuyên gia phù hợp rồi quản trị viên bấm xác nhận?' },
      { type: 'para', title: 'Chuyên gia có được từ chối ca được phân không? Nếu từ chối thì sao?' },
      { type: 'para', title: 'Một khách có thể được phân cho nhiều chuyên gia (ví dụ: chuyển ca) không?' },
      { type: 'para', req: true, title: 'Sau khi phân công, các trạng thái của một ca là gì? (ví dụ: chờ duyệt → đã duyệt → đã phân → đã liên hệ → đang trị liệu → kết thúc)' },
      { type: 'para', title: 'Chuyên gia có cần ghi chú buổi trị liệu trên web không? Ai được xem các ghi chú đó (chỉ chuyên gia, hay cả quản trị viên)?' },
      { type: 'para', title: 'Ai được xem số điện thoại/email của khách, và từ lúc nào?' },
    ],
  },
  {
    title: 'E. Lịch hẹn, thanh toán, liên lạc',
    items: [
      { type: 'para', req: true, title: 'Có cần đặt lịch trên web không, hay chuyên gia tự gọi hẹn với khách?' },
      { type: 'para', req: true, title: 'Có cần thu tiền online không? Nếu có: cổng nào (VNPay, MoMo, chuyển khoản QR…), thu theo buổi hay theo gói?' },
      { type: 'para', title: 'Có cần gọi video ngay trên web, hay dùng Zoom/Google Meet/Zalo bên ngoài?' },
      {
        type: 'check', other: true,
        title: 'Thông báo cho khách và chuyên gia qua kênh nào? (chọn nhiều)',
        choices: ['Email', 'SMS', 'Zalo OA'],
      },
      {
        type: 'radio',
        title: 'Trung tâm đã có Zalo OA chưa?',
        choices: ['Đã có', 'Chưa có', 'Chưa biết'],
      },
      { type: 'para', title: 'Có cần nhắn tin giữa khách và chuyên gia trên web không?' },
    ],
  },
  {
    title: 'F. Nội dung và giao diện',
    items: [
      { type: 'para', req: true, title: 'Trung tâm đã có logo, màu thương hiệu, bộ nhận diện chưa?' },
      { type: 'para', title: 'Trong 2 web mẫu (finder.taro.com.vn, seansly.co/vi), anh/chị thích điểm gì, không thích điểm gì? Có web nào khác muốn tham khảo?' },
      { type: 'para', title: 'Các trang nội dung cần có: giới thiệu, đội ngũ chuyên gia, dịch vụ và bảng giá, blog/bài viết, câu hỏi thường gặp, liên hệ… Ai sẽ cung cấp chữ và ảnh?' },
      { type: 'para', title: 'Hồ sơ chuyên gia cần hiện những gì (ảnh, bằng cấp, chứng chỉ hành nghề, kinh nghiệm, phí)?' },
      {
        type: 'radio', other: true,
        title: 'Chỉ tiếng Việt, hay cần thêm tiếng Anh?',
        choices: ['Chỉ tiếng Việt', 'Tiếng Việt và tiếng Anh'],
      },
    ],
  },
  {
    title: 'G. Bảo mật, pháp lý, dữ liệu',
    items: [
      { type: 'para', req: true, title: 'Trung tâm là pháp nhân gì (công ty, hộ kinh doanh, cơ sở khám chữa bệnh có giấy phép)? Có bộ phận/luật sư lo phần pháp lý không?' },
      { type: 'para', req: true, title: 'Trung tâm đã có chính sách quyền riêng tư và mẫu đồng ý xử lý dữ liệu chưa? Nếu chưa, ai sẽ soạn/duyệt nội dung (em có thể gửi bản mẫu để luật sư bên anh/chị chỉnh)?' },
      { type: 'para', title: 'Hồ sơ khách cần lưu bao lâu? Khi khách yêu cầu xóa thì xử lý thế nào?' },
      { type: 'para', title: 'Có dữ liệu cũ (Excel, Google Sheet…) cần chuyển lên web không? Khoảng bao nhiêu khách?' },
      { type: 'text', title: 'Ai sẽ được em cấp quyền quản trị cao nhất sau bàn giao?' },
    ],
  },
  {
    title: 'H. Hosting và tên miền',
    items: [
      { type: 'para', req: true, title: 'Đã có tên miền chưa? Nếu có, đang đăng ký ở đâu và đứng tên ai?' },
      { type: 'para', title: 'Có ưu tiên nhà cung cấp hosting nào (Viettel, FPT, VNPT…) hay để em đề xuất?' },
      { type: 'para', req: true, title: 'Trung tâm có đồng ý tự đứng tên và thanh toán hosting hằng tháng/năm không? Ngân sách hosting dự kiến mỗi tháng?' },
      {
        type: 'radio',
        title: 'Có cần xuất hóa đơn VAT cho hợp đồng làm web và hosting không?',
        choices: ['Có', 'Không', 'Chưa biết'],
      },
    ],
  },
  {
    title: 'I. Ngân sách và tiến độ',
    items: [
      {
        type: 'radio', req: true,
        title: 'Ngân sách dự kiến cho phần làm web (chọn một):',
        choices: [
          'Dưới 30 triệu',
          '30–50 triệu',
          '50–80 triệu',
          'Trên 80 triệu',
          'Chưa xác định, chờ báo giá',
        ],
      },
      { type: 'para', req: true, title: 'Có mốc ngày nào bắt buộc phải chạy web không (khai trương, sự kiện…)? Vì sao?' },
      {
        type: 'radio', other: true,
        title: 'Anh/chị muốn làm một lần đủ tính năng, hay làm bản cơ bản trước rồi bổ sung dần?',
        choices: ['Làm một lần đủ tính năng', 'Làm bản cơ bản trước, bổ sung dần', 'Tùy em đề xuất'],
      },
      {
        type: 'radio',
        title: 'Sau khi bàn giao, có cần em bảo trì hằng tháng không?',
        choices: ['Có', 'Không', 'Chưa biết'],
      },
    ],
  },
  {
    title: 'K. Cách làm việc',
    items: [
      {
        type: 'check', req: true, other: true,
        title: 'Kênh liên lạc chính anh/chị muốn dùng?',
        choices: ['Zalo', 'Email', 'Google Meet', 'Điện thoại'],
      },
      { type: 'para', req: true, title: 'Khung giờ anh/chị thường rảnh để họp ngắn (ghi rõ múi giờ)?' },
      {
        type: 'radio', other: true,
        title: 'Thời gian phản hồi mong muốn khi có câu hỏi?',
        choices: ['Trong ngày', 'Trong 2 ngày'],
      },
    ],
  },
];

function taoForm() {
  const form = FormApp.create('Bảng câu hỏi làm rõ yêu cầu: web app trung tâm trị liệu tâm lý');
  form
    .setDescription(
      'Kính gửi Quý trung tâm,\n\n' +
      'Để báo giá chính xác và tránh phát sinh về sau, nhờ anh/chị trả lời các câu hỏi dưới đây. ' +
      'Câu nào chưa chắc, anh/chị cứ ghi “chưa biết” hoặc “tùy em đề xuất”. ' +
      'Ảnh chụp, file mẫu (nếu có) anh/chị gửi kèm qua Zalo hoặc email. ' +
      'Thời gian điền khoảng 20–30 phút.\n\n' +
      'Các câu có dấu * là bắt buộc. Sau khi gửi, anh/chị vẫn có thể quay lại sửa câu trả lời.'
    )
    .setProgressBar(true)
    .setAllowResponseEdits(true)
    .setConfirmationMessage(
      'Cảm ơn anh/chị! Sau khi nhận câu trả lời, em sẽ gửi lại tài liệu phạm vi và báo giá trong vòng ' +
      SO_NGAY_BAO_GIA + ' ngày làm việc để anh/chị xem và góp ý.'
    );

  SECTIONS.forEach((section, i) => {
    // Phần A nằm ngay trang đầu; các phần sau mỗi phần một trang.
    if (i === 0) {
      form.addSectionHeaderItem().setTitle(section.title);
    } else {
      form.addPageBreakItem().setTitle(section.title);
    }
    section.items.forEach(q => addQuestion(form, q));
  });

  Logger.log('Link sửa form: ' + form.getEditUrl());
  Logger.log('Link gửi khách: ' + form.getPublishedUrl());
}

function addQuestion(form, q) {
  let item;
  switch (q.type) {
    case 'para':
      item = form.addParagraphTextItem();
      break;
    case 'text':
      item = form.addTextItem();
      break;
    case 'check':
      item = form.addCheckboxItem().setChoiceValues(q.choices);
      if (q.other) item.showOtherOption(true);
      break;
    case 'radio':
      item = form.addMultipleChoiceItem().setChoiceValues(q.choices);
      if (q.other) item.showOtherOption(true);
      break;
    default:
      throw new Error('Loại câu hỏi không hợp lệ: ' + q.type);
  }
  item.setTitle(q.title).setRequired(!!q.req);
  if (q.help) item.setHelpText(q.help);
}
