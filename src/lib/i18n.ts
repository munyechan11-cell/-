import { useSyncExternalStore } from "react";

// ============================================================
// 가벼운 자체 i18n — 외부 라이브러리 없이 localStorage 기반.
// 새 라벨은 dict 에 추가하고, 각 화면에서 t(key) 로 호출.
// 누락된 키는 한국어 fallback → key 그대로.
// ============================================================

export type Lang = "ko" | "en" | "vi" | "zh";
export const LANGS: { code: Lang; label: string; native: string }[] = [
  { code: "ko", label: "Korean", native: "한국어" },
  { code: "en", label: "English", native: "English" },
  { code: "vi", label: "Vietnamese", native: "Tiếng Việt" },
  { code: "zh", label: "Chinese", native: "中文" },
];

const STORAGE_KEY = "gyeol-lang";
const DEFAULT_LANG: Lang = "ko";

function getInitialLang(): Lang {
  if (typeof window === "undefined") return DEFAULT_LANG;
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY) as Lang | null;
    if (saved && LANGS.some((l) => l.code === saved)) return saved;
  } catch {
    // localStorage 차단 환경 — 기본값
  }
  return DEFAULT_LANG;
}

let currentLang: Lang = getInitialLang();
const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function setLanguage(lang: Lang) {
  if (currentLang === lang) return;
  currentLang = lang;
  try {
    window.localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // 저장 실패해도 메모리 상태는 유지
  }
  document.documentElement.lang = lang;
  listeners.forEach((cb) => cb());
}

export function getLanguage(): Lang {
  return currentLang;
}

// 동기화 — useSyncExternalStore 로 컴포넌트에서 안전하게 구독
export function useLanguage(): Lang {
  return useSyncExternalStore(
    subscribe,
    () => currentLang,
    () => DEFAULT_LANG
  );
}

// ============================================================
// 사전
// ============================================================
type Dict = Record<string, string>;

const ko: Dict = {
  // 네비
  "nav.home": "홈",
  "nav.menu": "메뉴",
  "nav.coupons": "쿠폰",
  "nav.profile": "내 정보",

  // 설정 / 공통
  "settings.language": "언어 설정",
  "settings.language.desc": "원하는 언어를 선택하세요. 적용된 화면만 변경됩니다.",
  "common.cancel": "취소",
  "common.confirm": "확인",
  "common.close": "닫기",
  "common.save": "저장",
  "common.delete": "삭제",
  "common.loading": "로딩 중…",
  "common.store": "매장",

  // 홈
  "home.loginLoading": "로그인 정보를 불러오는 중…",
  "home.loginLoadingDesc": "화면이 멈춰 보이면 잠시 후 새로고침해 주세요.",
  "home.greeting": "{name}님",
  "home.nextTier": "{tier}까지 {n}회 더 방문",
  "home.topTier": "최고 등급에 도달하셨습니다.",
  "home.stat.visits": "방문",
  "home.stat.coupons": "보유 쿠폰",
  "home.stat.points": "포인트",
  "home.unit.visit": "회",
  "home.unit.coupon": "장",
  "home.tableInUse": "테이블 {n}번 이용 중",
  "home.viewBill": "계산서 보기",
  "home.leaveStore": "가게 퇴장",
  "home.currentOrders": "현재 주문 ({n}건)",
  "home.orderCancelled": "주문이 취소되었습니다.",
  "home.unpaidSum": "미결제 합계",
  "home.paying": "결제 요청 중",
  "home.payButton": "결제하기",
  "home.payDone": "결제 완료",
  "home.payRequestedNote": "💰 직원이 결제 처리 중입니다. 잠시만 기다려 주세요.",
  "home.allPaid": "모든 주문이 결제되었습니다. 좋은 시간 보내세요!",
  "home.recentVisits": "최근 방문",
  "home.firstVisit": "이 매장의 첫 방문이에요.",
  "home.firstVisitDesc": "주문하시면 방문 기록과 등급이 쌓입니다.",
  "home.leaveConfirm": "가게에서 나가시겠어요?\n미결제 주문이 있다면 매장에 안내해 주세요.",
  "home.leaveToast": "좋은 시간 보내셨길 바라요. 또 만나요!",
  "home.leaveFail": "퇴장 처리 실패: {msg}",
  "home.storeNotFound": "매장을 찾을 수 없어 홈으로 이동합니다.",
  "home.useTime": "이용 시간 {m}분 {s}초",

  // 영업 상태
  "store.closedTitle": "지금은 주문할 수 없어요",
  "store.closedFrom": " · {time} 부터 영업 시작",
  "store.closedDesc": "영업 중 다시 방문해 주세요. 매장 사장님께 직접 문의도 가능합니다.",

  // 메뉴
  "menu.empty": "등록된 메뉴가 없습니다.",
  "menu.orderToTable": "테이블 {n}에 주문",
  "menu.needTable": "테이블 이용 후 주문 가능",
  "menu.add": "담기",
  "menu.decrease": "수량 감소",
  "menu.increase": "수량 증가",
  "menu.orderFailReason": "주문할 수 없어요: {reason}",

  // 주문 상태
  "order.status.pending": "접수 대기",
  "order.status.accepted": "접수됨",
  "order.status.cooking": "조리 중",
  "order.status.served": "서빙 완료",
  "order.status.cancelled": "취소됨",

  // 결제 상태
  "pay.paid": "결제 완료",
  "pay.unpaid": "미결제",

  // 쿠폰
  "coupons.title": "보유 쿠폰",
  "coupons.empty": "보유한 쿠폰이 없습니다.",
  "coupons.pending": "승인 대기",
  "coupons.used": "사용 완료",
  "coupons.useAtTable": "테이블 {n}에서 사용",
  "coupons.needTable": "테이블 이용 중에만 사용 가능",
  "coupons.cancelRequest": "요청 취소",

  // 프로필
  "profile.joinType": "가입 방식",
  "profile.ageGroup": "연령대",
  "profile.languageTitle": "언어 / Language",
  "profile.languageDesc": "원하는 언어를 선택하세요.",
  "profile.logout": "로그아웃",
  "profile.deleteAccount": "계정 삭제",
  "profile.deleteConfirm": "정말 계정을 삭제하시겠습니까?\n방문·쿠폰 정보는 익명화되어 보관됩니다.",

  // 지난 방문
  "past.title": "{store}에서의 지난 방문",
  "past.summary": "총 {n}회 · {amount} 사용",
  "past.today": "오늘",
  "past.yesterday": "어제",
  "past.orderCount": "{orders}건 · {items}개 메뉴",
  "past.more": "이전 방문 {n}회 더 있음",
  "past.subtotal": "소계",

  // 계산서 / Bill
  "bill.title": "계산서",
  "bill.customer": "{name} 님",
  "bill.table": "테이블 {n}",
  "bill.empty": "주문 내역이 없습니다.",
  "bill.paid": "결제 완료",
  "bill.unpaid": "미결제",
  "bill.supply": "공급가액",
  "bill.vat": "부가세 (10%)",
  "bill.subtotal": "소계",
  "bill.unpaidBreakdown": "미결제 세부",
  "bill.total": "총 합계",
  "bill.totalSupply": "전체 공급가액 {amount}",
  "bill.totalVat": "전체 부가세 {amount}",
  "bill.print": "인쇄",
  "bill.pay": "결제하기",
  "bill.payAmount": "결제하기 ({amount})",
  "bill.payDisabled": "결제 완료",
  "bill.needTable": "테이블 이용 중일 때만 결제할 수 있어요.",
  "bill.close": "닫기",

  // 리뷰 모달
  "review.title": "오늘 식사는 어떠셨나요?",
  "review.desc": "리뷰는 선택입니다. 매장 개선과 다른 손님께 큰 도움이 됩니다.",
  "review.rating": "별점 (선택)",
  "review.ratingValue": "{n}점",
  "review.text": "한 줄 리뷰 (선택)",
  "review.textPlaceholder": "맛, 분위기, 서비스 등 자유롭게 남겨주세요.",
  "review.photo": "사진 (선택)",
  "review.photoOne": "한 장만 첨부할 수 있어요.",
  "review.photoPicked": "사진을 선택했어요.",
  "review.photoBusy": "이미지 처리 중…",
  "review.payAmount": "결제 요청 금액",
  "review.skip": "건너뛰고 결제",
  "review.submit": "리뷰 남기고 결제",
  "review.removePhoto": "사진 제거",
  "review.invalidImage": "이미지 파일만 선택할 수 있어요.",
  "review.imageFail": "이미지 처리에 실패했어요.",
};

const en: Dict = {
  "nav.home": "Home",
  "nav.menu": "Menu",
  "nav.coupons": "Coupons",
  "nav.profile": "Profile",

  "settings.language": "Language",
  "settings.language.desc": "Pick your language. Only translated screens will change.",
  "common.cancel": "Cancel",
  "common.confirm": "OK",
  "common.close": "Close",
  "common.save": "Save",
  "common.delete": "Delete",
  "common.loading": "Loading…",
  "common.store": "Store",

  "home.loginLoading": "Loading your account…",
  "home.loginLoadingDesc": "If this screen seems stuck, please refresh.",
  "home.greeting": "Hello, {name}",
  "home.nextTier": "{n} more visits to reach {tier}",
  "home.topTier": "You've reached the top tier.",
  "home.stat.visits": "Visits",
  "home.stat.coupons": "Coupons",
  "home.stat.points": "Points",
  "home.unit.visit": "",
  "home.unit.coupon": "",
  "home.tableInUse": "Table {n} — in use",
  "home.viewBill": "View check",
  "home.leaveStore": "Leave store",
  "home.currentOrders": "Current orders ({n})",
  "home.orderCancelled": "Order was cancelled.",
  "home.unpaidSum": "Unpaid total",
  "home.paying": "Payment requested",
  "home.payButton": "Pay",
  "home.payDone": "Paid",
  "home.payRequestedNote": "💰 Staff is processing your payment. Please hold on.",
  "home.allPaid": "All paid. Enjoy your time!",
  "home.recentVisits": "Recent visits",
  "home.firstVisit": "Your first visit here.",
  "home.firstVisitDesc": "Order to start building visits and tier.",
  "home.leaveConfirm": "Leave the store?\nIf you have unpaid orders, please tell the staff first.",
  "home.leaveToast": "Hope you had a great time. See you again!",
  "home.leaveFail": "Failed to leave: {msg}",
  "home.storeNotFound": "Store not found — returning home.",
  "home.useTime": "Seated for {m}m {s}s",

  "store.closedTitle": "Ordering is not available right now",
  "store.closedFrom": " · opens at {time}",
  "store.closedDesc": "Please come back during business hours, or contact the owner directly.",

  "menu.empty": "No menu items yet.",
  "menu.orderToTable": "Order to table {n}",
  "menu.needTable": "Seat at a table first to order",
  "menu.add": "Add",
  "menu.decrease": "Decrease",
  "menu.increase": "Increase",
  "menu.orderFailReason": "Can't order: {reason}",

  "order.status.pending": "Pending",
  "order.status.accepted": "Accepted",
  "order.status.cooking": "Cooking",
  "order.status.served": "Served",
  "order.status.cancelled": "Cancelled",

  "pay.paid": "Paid",
  "pay.unpaid": "Unpaid",

  "coupons.title": "Your coupons",
  "coupons.empty": "No coupons yet.",
  "coupons.pending": "Awaiting approval",
  "coupons.used": "Used",
  "coupons.useAtTable": "Use at table {n}",
  "coupons.needTable": "Available only while seated at a table",
  "coupons.cancelRequest": "Cancel request",

  "profile.joinType": "Sign-up",
  "profile.ageGroup": "Age group",
  "profile.languageTitle": "Language",
  "profile.languageDesc": "Pick your language.",
  "profile.logout": "Log out",
  "profile.deleteAccount": "Delete account",
  "profile.deleteConfirm": "Really delete your account?\nVisit / coupon history will be kept anonymized.",

  "past.title": "Past visits at {store}",
  "past.summary": "{n} visits · {amount} spent",
  "past.today": "Today",
  "past.yesterday": "Yesterday",
  "past.orderCount": "{orders} orders · {items} items",
  "past.more": "{n} more past visits",
  "past.subtotal": "Subtotal",

  "bill.title": "Check",
  "bill.customer": "{name}",
  "bill.table": "Table {n}",
  "bill.empty": "No orders yet.",
  "bill.paid": "Paid",
  "bill.unpaid": "Unpaid",
  "bill.supply": "Subtotal (net)",
  "bill.vat": "VAT (10%)",
  "bill.subtotal": "Order total",
  "bill.unpaidBreakdown": "Unpaid breakdown",
  "bill.total": "Grand total",
  "bill.totalSupply": "Net total {amount}",
  "bill.totalVat": "VAT total {amount}",
  "bill.print": "Print",
  "bill.pay": "Pay",
  "bill.payAmount": "Pay ({amount})",
  "bill.payDisabled": "Paid",
  "bill.needTable": "You can only pay while seated at a table.",
  "bill.close": "Close",

  "review.title": "How was your meal?",
  "review.desc": "Reviews are optional but help us and other guests a lot.",
  "review.rating": "Rating (optional)",
  "review.ratingValue": "{n} / 5",
  "review.text": "Quick review (optional)",
  "review.textPlaceholder": "Tell us about taste, vibe, service — anything.",
  "review.photo": "Photo (optional)",
  "review.photoOne": "You can attach one photo.",
  "review.photoPicked": "Photo selected.",
  "review.photoBusy": "Processing image…",
  "review.payAmount": "Amount to pay",
  "review.skip": "Skip & pay",
  "review.submit": "Review & pay",
  "review.removePhoto": "Remove photo",
  "review.invalidImage": "Only image files are allowed.",
  "review.imageFail": "Failed to process the image.",
};

const vi: Dict = {
  "nav.home": "Trang chủ",
  "nav.menu": "Thực đơn",
  "nav.coupons": "Phiếu giảm",
  "nav.profile": "Hồ sơ",

  "settings.language": "Ngôn ngữ",
  "settings.language.desc": "Chọn ngôn ngữ. Chỉ những màn hình đã dịch sẽ thay đổi.",
  "common.cancel": "Huỷ",
  "common.confirm": "OK",
  "common.close": "Đóng",
  "common.save": "Lưu",
  "common.delete": "Xoá",
  "common.loading": "Đang tải…",
  "common.store": "Cửa hàng",

  "home.loginLoading": "Đang tải tài khoản…",
  "home.loginLoadingDesc": "Nếu màn hình bị treo, vui lòng làm mới lại.",
  "home.greeting": "Xin chào, {name}",
  "home.nextTier": "Còn {n} lần ghé nữa để lên {tier}",
  "home.topTier": "Bạn đã đạt hạng cao nhất.",
  "home.stat.visits": "Lượt ghé",
  "home.stat.coupons": "Phiếu",
  "home.stat.points": "Điểm",
  "home.unit.visit": "",
  "home.unit.coupon": "",
  "home.tableInUse": "Đang dùng bàn {n}",
  "home.viewBill": "Xem hoá đơn",
  "home.leaveStore": "Rời cửa hàng",
  "home.currentOrders": "Đơn hiện tại ({n})",
  "home.orderCancelled": "Đơn đã bị huỷ.",
  "home.unpaidSum": "Tổng chưa thanh toán",
  "home.paying": "Đang yêu cầu thanh toán",
  "home.payButton": "Thanh toán",
  "home.payDone": "Đã thanh toán",
  "home.payRequestedNote": "💰 Nhân viên đang xử lý thanh toán. Vui lòng chờ.",
  "home.allPaid": "Đã thanh toán hết. Chúc bạn ngon miệng!",
  "home.recentVisits": "Lần ghé gần đây",
  "home.firstVisit": "Lần đầu bạn ghé cửa hàng này.",
  "home.firstVisitDesc": "Đặt món để bắt đầu tích luỹ lượt ghé và hạng.",
  "home.leaveConfirm": "Rời cửa hàng?\nNếu còn đơn chưa thanh toán, hãy báo nhân viên trước.",
  "home.leaveToast": "Mong bạn có khoảng thời gian vui vẻ. Hẹn gặp lại!",
  "home.leaveFail": "Rời thất bại: {msg}",
  "home.storeNotFound": "Không tìm thấy cửa hàng — quay về trang chủ.",
  "home.useTime": "Đã ngồi {m} phút {s} giây",

  "store.closedTitle": "Hiện không thể đặt món",
  "store.closedFrom": " · mở cửa lúc {time}",
  "store.closedDesc": "Vui lòng quay lại trong giờ mở cửa, hoặc liên hệ chủ quán.",

  "menu.empty": "Chưa có món nào.",
  "menu.orderToTable": "Đặt cho bàn {n}",
  "menu.needTable": "Phải nhận bàn trước khi đặt",
  "menu.add": "Thêm",
  "menu.decrease": "Giảm số lượng",
  "menu.increase": "Tăng số lượng",
  "menu.orderFailReason": "Không thể đặt: {reason}",

  "order.status.pending": "Chờ nhận",
  "order.status.accepted": "Đã nhận",
  "order.status.cooking": "Đang nấu",
  "order.status.served": "Đã phục vụ",
  "order.status.cancelled": "Đã huỷ",

  "pay.paid": "Đã thanh toán",
  "pay.unpaid": "Chưa thanh toán",

  "coupons.title": "Phiếu của bạn",
  "coupons.empty": "Bạn chưa có phiếu nào.",
  "coupons.pending": "Đang chờ duyệt",
  "coupons.used": "Đã dùng",
  "coupons.useAtTable": "Dùng tại bàn {n}",
  "coupons.needTable": "Chỉ dùng được khi đang ngồi bàn",
  "coupons.cancelRequest": "Huỷ yêu cầu",

  "profile.joinType": "Kiểu đăng ký",
  "profile.ageGroup": "Nhóm tuổi",
  "profile.languageTitle": "Ngôn ngữ",
  "profile.languageDesc": "Chọn ngôn ngữ.",
  "profile.logout": "Đăng xuất",
  "profile.deleteAccount": "Xoá tài khoản",
  "profile.deleteConfirm": "Bạn chắc chắn muốn xoá tài khoản?\nLịch sử ghé / phiếu sẽ được ẩn danh.",

  "past.title": "Các lần ghé trước tại {store}",
  "past.summary": "{n} lượt · đã chi {amount}",
  "past.today": "Hôm nay",
  "past.yesterday": "Hôm qua",
  "past.orderCount": "{orders} đơn · {items} món",
  "past.more": "Còn {n} lần ghé khác",
  "past.subtotal": "Tạm tính",

  "bill.title": "Hoá đơn",
  "bill.customer": "{name}",
  "bill.table": "Bàn {n}",
  "bill.empty": "Chưa có đơn nào.",
  "bill.paid": "Đã thanh toán",
  "bill.unpaid": "Chưa thanh toán",
  "bill.supply": "Tiền hàng (chưa VAT)",
  "bill.vat": "VAT (10%)",
  "bill.subtotal": "Tổng đơn",
  "bill.unpaidBreakdown": "Chi tiết chưa thanh toán",
  "bill.total": "Tổng cộng",
  "bill.totalSupply": "Tổng tiền hàng {amount}",
  "bill.totalVat": "Tổng VAT {amount}",
  "bill.print": "In",
  "bill.pay": "Thanh toán",
  "bill.payAmount": "Thanh toán ({amount})",
  "bill.payDisabled": "Đã thanh toán",
  "bill.needTable": "Chỉ thanh toán được khi đang ngồi bàn.",
  "bill.close": "Đóng",

  "review.title": "Bữa ăn hôm nay thế nào?",
  "review.desc": "Đánh giá là tuỳ chọn nhưng giúp ích rất nhiều cho quán và khách khác.",
  "review.rating": "Đánh giá (tuỳ chọn)",
  "review.ratingValue": "{n} / 5",
  "review.text": "Nhận xét nhanh (tuỳ chọn)",
  "review.textPlaceholder": "Hương vị, không khí, phục vụ — gì cũng được.",
  "review.photo": "Ảnh (tuỳ chọn)",
  "review.photoOne": "Bạn có thể đính kèm một ảnh.",
  "review.photoPicked": "Đã chọn ảnh.",
  "review.photoBusy": "Đang xử lý ảnh…",
  "review.payAmount": "Số tiền cần trả",
  "review.skip": "Bỏ qua & thanh toán",
  "review.submit": "Đánh giá & thanh toán",
  "review.removePhoto": "Bỏ ảnh",
  "review.invalidImage": "Chỉ chấp nhận tệp ảnh.",
  "review.imageFail": "Xử lý ảnh thất bại.",
};

const zh: Dict = {
  "nav.home": "首页",
  "nav.menu": "菜单",
  "nav.coupons": "优惠券",
  "nav.profile": "我的",

  "settings.language": "语言",
  "settings.language.desc": "选择您的语言。仅已翻译的页面会改变。",
  "common.cancel": "取消",
  "common.confirm": "确定",
  "common.close": "关闭",
  "common.save": "保存",
  "common.delete": "删除",
  "common.loading": "加载中…",
  "common.store": "门店",

  "home.loginLoading": "正在加载账户信息…",
  "home.loginLoadingDesc": "如果画面卡住,请刷新。",
  "home.greeting": "您好,{name}",
  "home.nextTier": "再来 {n} 次即可升到 {tier}",
  "home.topTier": "您已达到最高等级。",
  "home.stat.visits": "到访",
  "home.stat.coupons": "优惠券",
  "home.stat.points": "积分",
  "home.unit.visit": "次",
  "home.unit.coupon": "张",
  "home.tableInUse": "正在使用 {n} 号桌",
  "home.viewBill": "查看账单",
  "home.leaveStore": "离开门店",
  "home.currentOrders": "当前订单 ({n})",
  "home.orderCancelled": "订单已取消。",
  "home.unpaidSum": "未付合计",
  "home.paying": "付款请求中",
  "home.payButton": "付款",
  "home.payDone": "已付款",
  "home.payRequestedNote": "💰 员工正在处理付款,请稍候。",
  "home.allPaid": "已全部付款。祝您愉快!",
  "home.recentVisits": "最近到访",
  "home.firstVisit": "您首次到访本店。",
  "home.firstVisitDesc": "下单后开始累计到访和等级。",
  "home.leaveConfirm": "确定离开门店?\n若有未付订单,请先告知店员。",
  "home.leaveToast": "希望您度过愉快时光,再见!",
  "home.leaveFail": "离开失败:{msg}",
  "home.storeNotFound": "未找到该门店 — 返回首页。",
  "home.useTime": "已就座 {m} 分 {s} 秒",

  "store.closedTitle": "目前无法下单",
  "store.closedFrom": " · {time} 开始营业",
  "store.closedDesc": "请在营业时间内再来,或直接联系店主。",

  "menu.empty": "暂无菜单。",
  "menu.orderToTable": "下单到 {n} 号桌",
  "menu.needTable": "需先就座才能下单",
  "menu.add": "加入",
  "menu.decrease": "减少数量",
  "menu.increase": "增加数量",
  "menu.orderFailReason": "无法下单:{reason}",

  "order.status.pending": "待接单",
  "order.status.accepted": "已接单",
  "order.status.cooking": "制作中",
  "order.status.served": "已上菜",
  "order.status.cancelled": "已取消",

  "pay.paid": "已付款",
  "pay.unpaid": "未付款",

  "coupons.title": "我的优惠券",
  "coupons.empty": "暂无优惠券。",
  "coupons.pending": "等待审核",
  "coupons.used": "已使用",
  "coupons.useAtTable": "在 {n} 号桌使用",
  "coupons.needTable": "需在座时方可使用",
  "coupons.cancelRequest": "取消请求",

  "profile.joinType": "注册方式",
  "profile.ageGroup": "年龄段",
  "profile.languageTitle": "语言",
  "profile.languageDesc": "选择您的语言。",
  "profile.logout": "退出登录",
  "profile.deleteAccount": "删除账户",
  "profile.deleteConfirm": "确定删除账户?\n到访 / 优惠券记录将匿名保留。",

  "past.title": "在 {store} 的过往到访",
  "past.summary": "{n} 次 · 共消费 {amount}",
  "past.today": "今天",
  "past.yesterday": "昨天",
  "past.orderCount": "{orders} 单 · {items} 道菜",
  "past.more": "还有 {n} 次过往到访",
  "past.subtotal": "小计",

  "bill.title": "账单",
  "bill.customer": "{name}",
  "bill.table": "{n} 号桌",
  "bill.empty": "暂无订单。",
  "bill.paid": "已付款",
  "bill.unpaid": "未付款",
  "bill.supply": "金额(税前)",
  "bill.vat": "增值税 (10%)",
  "bill.subtotal": "订单小计",
  "bill.unpaidBreakdown": "未付明细",
  "bill.total": "总计",
  "bill.totalSupply": "金额合计 {amount}",
  "bill.totalVat": "增值税合计 {amount}",
  "bill.print": "打印",
  "bill.pay": "付款",
  "bill.payAmount": "付款 ({amount})",
  "bill.payDisabled": "已付款",
  "bill.needTable": "就座后方可付款。",
  "bill.close": "关闭",

  "review.title": "今天用餐感受如何?",
  "review.desc": "评价为选填,但对门店和其他客人非常有帮助。",
  "review.rating": "评分(选填)",
  "review.ratingValue": "{n} / 5",
  "review.text": "简短评价(选填)",
  "review.textPlaceholder": "口味、氛围、服务 — 都欢迎留言。",
  "review.photo": "照片(选填)",
  "review.photoOne": "可上传一张照片。",
  "review.photoPicked": "已选择照片。",
  "review.photoBusy": "处理图片中…",
  "review.payAmount": "应付金额",
  "review.skip": "跳过并付款",
  "review.submit": "评价并付款",
  "review.removePhoto": "移除照片",
  "review.invalidImage": "仅支持图片文件。",
  "review.imageFail": "图片处理失败。",
};

const DICT: Record<Lang, Dict> = { ko, en, vi, zh };

export function t(
  key: string,
  lang: Lang = currentLang,
  vars?: Record<string, string | number>
): string {
  const raw = DICT[lang]?.[key] ?? DICT.ko[key] ?? key;
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (_, k) =>
    vars[k] !== undefined ? String(vars[k]) : `{${k}}`
  );
}

// 통화 포매팅 — 한국어는 '₩ 1,000', 그 외는 '₩1,000' (KRW 단위 그대로)
export function fmtKRW(n: number, lang: Lang = currentLang): string {
  const locale = lang === "ko" ? "ko-KR" : lang === "zh" ? "zh-CN" : lang === "vi" ? "vi-VN" : "en-US";
  return lang === "ko" ? `₩ ${n.toLocaleString(locale)}` : `₩${n.toLocaleString(locale)}`;
}

// 초기 lang 속성 — html 태그에 반영
if (typeof document !== "undefined") {
  document.documentElement.lang = currentLang;
}
