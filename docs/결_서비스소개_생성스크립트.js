const pptxgen = require("pptxgenjs");
const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE"; // 13.33 x 7.5
pres.author = "Gyeol";
pres.title = "결(Gyeol) 서비스 소개";

const C = {
  deep:  "0F1B33",
  navy:  "1E3A6E",
  navyL: "E6ECF7",
  amber: "D8952F",
  amberL:"FBF0DC",
  paper: "F4F6F9",
  white: "FFFFFF",
  ink:   "131C2E",
  mute:  "6B7688",
  muteD: "9AA6B8",
  line:  "DDE3EB",
};
const F = "맑은 고딕";
const sh = () => ({ type: "outer", color: "0F1B33", blur: 14, offset: 3, angle: 90, opacity: 0.12 });

function bg(slide, color) { slide.background = { color }; }

// dark-slide eyebrow + title
function darkHead(slide, eyebrow, title, opt = {}) {
  slide.addText(eyebrow, {
    x: 0.85, y: opt.ey || 0.7, w: 8, h: 0.3, isTextBox: true, margin: 0,
    fontFace: F, fontSize: 12, bold: true, color: C.amber, charSpacing: 3,
  });
  slide.addText(title, {
    x: 0.85, y: opt.ty || 1.05, w: opt.tw || 11.6, h: opt.th || 1.1, isTextBox: true, margin: 0,
    fontFace: F, fontSize: opt.fs || 38, bold: true, color: C.white, lineSpacing: opt.ls || 46,
  });
}
function lightHead(slide, eyebrow, title, opt = {}) {
  slide.addText(eyebrow, {
    x: 0.85, y: 0.62, w: 8, h: 0.3, isTextBox: true, margin: 0,
    fontFace: F, fontSize: 12, bold: true, color: C.amber, charSpacing: 3,
  });
  slide.addText(title, {
    x: 0.85, y: 0.97, w: opt.tw || 11.6, h: opt.th || 0.95, isTextBox: true, margin: 0,
    fontFace: F, fontSize: opt.fs || 34, bold: true, color: C.ink, lineSpacing: opt.ls || 42,
  });
  if (opt.sub) slide.addText(opt.sub, {
    x: 0.85, y: opt.suby || 1.78, w: opt.subw || 10.5, h: 0.35, isTextBox: true, margin: 0,
    fontFace: F, fontSize: 14, color: C.mute,
  });
}
function card(slide, x, y, w, h, fill) {
  slide.addShape(pres.ShapeType.roundRect, {
    x, y, w, h, rectRadius: 0.09, fill: { color: fill || C.white },
    line: { color: fill === C.white || !fill ? C.line : fill, width: 1 }, shadow: sh(),
  });
}
function dot(slide, x, y, d, fill, glyph, glyphColor, fs) {
  slide.addShape(pres.ShapeType.ellipse, { x, y, w: d, h: d, fill: { color: fill }, line: { color: fill, width: 1 } });
  slide.addText(glyph, {
    x, y, w: d, h: d, isTextBox: true, margin: 0, align: "center", valign: "middle",
    fontFace: F, fontSize: fs || 14, bold: true, color: glyphColor,
  });
}
function footer(slide, n) {
  slide.addText("결 · Gyeol", {
    x: 0.85, y: 6.95, w: 3, h: 0.28, isTextBox: true, margin: 0,
    fontFace: F, fontSize: 10, color: C.muteD,
  });
  slide.addText(String(n), {
    x: 11.9, y: 6.95, w: 0.6, h: 0.28, isTextBox: true, margin: 0, align: "right",
    fontFace: F, fontSize: 10, color: C.muteD,
  });
}

/* ---------- 1. 표지 ---------- */
{
  const s = pres.addSlide(); bg(s, C.deep);
  s.addShape(pres.ShapeType.ellipse, { x: 9.4, y: -1.5, w: 6.2, h: 6.2, fill: { color: C.navy }, line: { color: C.navy, width: 1 } });
  s.addShape(pres.ShapeType.ellipse, { x: 11.2, y: 4.3, w: 3.4, h: 3.4, fill: { color: "16274A" }, line: { color: "16274A", width: 1 } });

  s.addText("결", { x: 0.9, y: 1.15, w: 3, h: 1.9, isTextBox: true, margin: 0,
    fontFace: F, fontSize: 96, bold: true, color: C.white });
  s.addText("GYEOL", { x: 1.02, y: 3.02, w: 3, h: 0.35, isTextBox: true, margin: 0,
    fontFace: "Arial", fontSize: 13, bold: true, color: C.amber, charSpacing: 6 });

  s.addText("사장님이 하지 않아도\n매장이 굴러가게", { x: 4.9, y: 1.5, w: 7.4, h: 1.9, isTextBox: true, margin: 0,
    fontFace: F, fontSize: 40, bold: true, color: C.white, lineSpacing: 52 });
  s.addText("주문·결제·단골 관리·홍보를 하나로 잇는 1인 매장 운영 클라우드", {
    x: 4.9, y: 3.5, w: 7.4, h: 0.4, isTextBox: true, margin: 0,
    fontFace: F, fontSize: 15, color: "B9C4D6" });

  const chips = ["파일럿 매장 2곳 운영 중", "베타 사용료 0원", "설치·단말기 없음"];
  chips.forEach((t, i) => {
    const x = 4.9 + i * 2.55;
    s.addShape(pres.ShapeType.roundRect, { x, y: 4.35, w: 2.35, h: 0.5, rectRadius: 0.25,
      fill: { color: "16274A" }, line: { color: "2A3E67", width: 1 } });
    s.addText(t, { x, y: 4.35, w: 2.35, h: 0.5, isTextBox: true, margin: 0, align: "center", valign: "middle",
      fontFace: F, fontSize: 11, color: "CBD5E7" });
  });
  s.addText("서비스 소개서 · 2026", { x: 0.9, y: 6.85, w: 5, h: 0.3, isTextBox: true, margin: 0,
    fontFace: F, fontSize: 11, color: C.muteD });
  s.addNotes("결은 1인·소규모 매장의 주문·결제·단골 관리·홍보를 하나로 잇는 운영 클라우드입니다. 현재 파일럿 매장 2곳에서 실제 영업에 쓰이고 있습니다.");
}

/* ---------- 2. 문제 장면 ---------- */
{
  const s = pres.addSlide(); bg(s, C.paper);
  lightHead(s, "PROBLEM", "점심 피크 두 시간 동안,\n사장님 옆에서 본 것", { th: 1.5, ls: 44 });

  const items = [
    ["주문 하나에 POS 네 번", "손님이 부르면 그 네 번이 중간에서 끊깁니다."],
    ["울린 전화를 못 받는다", "그게 예약 문의였는지조차 매장은 모릅니다."],
    ["세 번째 온 손님", "그 기록은 사장님 기억 말고 어디에도 없습니다."],
    ["석 달 멈춘 인스타그램", "할 줄 몰라서, 그리고 그럴 시간이 없어서."],
  ];
  items.forEach((it, i) => {
    const x = 0.85 + (i % 2) * 5.95;
    const y = 2.75 + Math.floor(i / 2) * 1.85;
    card(s, x, y, 5.6, 1.55, C.white);
    dot(s, x + 0.35, y + 0.42, 0.38, C.amberL, "!", C.amber, 15);
    s.addText(it[0], { x: x + 0.92, y: y + 0.3, w: 4.5, h: 0.4, isTextBox: true, margin: 0,
      fontFace: F, fontSize: 17, bold: true, color: C.ink });
    s.addText(it[1], { x: x + 0.92, y: y + 0.78, w: 4.4, h: 0.55, isTextBox: true, margin: 0,
      fontFace: F, fontSize: 12.5, color: C.mute, lineSpacing: 18 });
  });
  footer(s, 2);
  s.addNotes("문제 제기: 기능이 없어서가 아니라, 사장님의 시간이 없어서 생기는 손실입니다.");
}

/* ---------- 3. 원인 ---------- */
{
  const s = pres.addSlide(); bg(s, C.paper);
  lightHead(s, "WHY", "도구는 이미 많습니다. 따로 놀 뿐입니다.", { sub: "각각 계약하고, 각각 청구되고, 데이터는 각 회사 안에 남습니다.", th: 0.6, suby: 1.68 });

  const tools = [["POS", "계산만"], ["키오스크", "주문만"], ["예약 앱", "예약만"], ["마케팅 대행", "홍보만"]];
  tools.forEach((t, i) => {
    const x = 0.85 + i * 3.0;
    card(s, x, 2.5, 2.75, 1.5, C.white);
    s.addText(t[0], { x: x + 0.3, y: 2.78, w: 2.2, h: 0.4, isTextBox: true, margin: 0,
      fontFace: F, fontSize: 18, bold: true, color: C.navy });
    s.addText(t[1], { x: x + 0.3, y: 3.24, w: 2.2, h: 0.35, isTextBox: true, margin: 0,
      fontFace: F, fontSize: 13, color: C.mute });
  });

  s.addText("이 넷을 이어 붙이는 일은 사장님이 사람 손으로 합니다", {
    x: 0.85, y: 4.45, w: 11.6, h: 0.45, isTextBox: true, margin: 0, align: "center",
    fontFace: F, fontSize: 15, color: C.mute });

  card(s, 0.85, 5.15, 11.6, 1.25, C.navy);
  s.addText("손님이 몇 번 왔는지는 POS가, 예약은 예약 앱이, 리뷰는 플랫폼이 압니다.\n그걸 이어서 “이 손님에게 지금 쿠폰을 보내자”까지 판단하는 일이 사장님 몫으로 남습니다.", {
    x: 1.3, y: 5.35, w: 10.7, h: 0.9, isTextBox: true, margin: 0,
    fontFace: F, fontSize: 14.5, color: C.white, lineSpacing: 24 });
  footer(s, 3);
  s.addNotes("경쟁 도구를 부정하는 게 아니라, 연결이 없다는 점이 문제라는 프레이밍입니다.");
}

/* ---------- 4. 해결: 하나의 흐름 ---------- */
{
  const s = pres.addSlide(); bg(s, C.deep);
  darkHead(s, "SOLUTION", "끊기지 않는 하나의 흐름", { th: 0.7 });
  s.addText("손님이 QR을 찍는 순간부터 홍보 게시물이 올라가기까지, 한 시스템 안에서 이어집니다.", {
    x: 0.85, y: 1.85, w: 11, h: 0.35, isTextBox: true, margin: 0,
    fontFace: F, fontSize: 14, color: "B9C4D6" });

  const steps = ["QR 스캔", "주문", "결제", "영수증", "단골 기록", "쿠폰", "홍보"];
  steps.forEach((t, i) => {
    const x = 0.85 + i * 1.68;
    s.addShape(pres.ShapeType.roundRect, { x, y: 2.75, w: 1.45, h: 1.0, rectRadius: 0.1,
      fill: { color: i === 0 ? C.amber : "16274A" }, line: { color: i === 0 ? C.amber : "2A3E67", width: 1 } });
    s.addText(t, { x, y: 2.75, w: 1.45, h: 1.0, isTextBox: true, margin: 0, align: "center", valign: "middle",
      fontFace: F, fontSize: 13, bold: true, color: i === 0 ? "22160A" : C.white });
    if (i < steps.length - 1) s.addText("›", { x: x + 1.45, y: 2.75, w: 0.23, h: 1.0, isTextBox: true, margin: 0,
      align: "center", valign: "middle", fontFace: "Arial", fontSize: 18, color: C.muteD });
  });

  const loops = [
    ["리뷰를 쓰면 쿠폰이 자동 발급", "매장이 정한 금액으로 그 자리에서"],
    ["그 쿠폰은 다음 계산서에서 차감", "사장님이 계산할 게 없습니다"],
    ["그 리뷰는 홍보 소재가 됩니다", "답글 초안과 게시물로 다시 쓰임"],
  ];
  loops.forEach((l, i) => {
    const x = 0.85 + i * 3.95;
    card(s, x, 4.35, 3.7, 1.75, "16274A");
    dot(s, x + 0.35, 4.68, 0.36, C.amber, String(i + 1), "22160A", 13);
    s.addText(l[0], { x: x + 0.35, y: 5.2, w: 3.0, h: 0.4, isTextBox: true, margin: 0,
      fontFace: F, fontSize: 14, bold: true, color: C.white });
    s.addText(l[1], { x: x + 0.35, y: 5.63, w: 3.05, h: 0.35, isTextBox: true, margin: 0,
      fontFace: F, fontSize: 11.5, color: "9FADC4" });
  });
  footer(s, 4);
  s.addNotes("핵심 메시지: 이 루프는 주문·고객·리뷰·발행을 한 시스템이 모두 가질 때만 가능합니다.");
}

/* ---------- 5. 손님 경험 ---------- */
{
  const s = pres.addSlide(); bg(s, C.paper);
  lightHead(s, "FOR CUSTOMERS", "손님은 QR만 찍으면 됩니다", { sub: "앱 설치도, 직원을 부르는 일도 없습니다.", th: 0.6, suby: 1.68 });

  const cols = [
    ["QR 스캔하고 주문", ["찍은 테이블로 바로 입장", "옵션·수량까지 직접 선택", "품절 메뉴는 아예 보이지 않음"]],
    ["앉은 자리에서 결제", ["결제 요청 한 번이면 끝", "항목별 세금까지 표시", "영수증은 매장에서 자동 출력"]],
    ["리뷰 쓰면 쿠폰", ["별점·사진·글을 함께", "쿠폰이 즉시 지급", "다음 방문 계산서에서 바로 차감"]],
  ];
  cols.forEach((c, i) => {
    const x = 0.85 + i * 3.95;
    card(s, x, 2.35, 3.7, 3.8, C.white);
    dot(s, x + 0.35, 2.7, 0.44, C.navy, String(i + 1), C.white, 15);
    s.addText(c[0], { x: x + 0.35, y: 3.32, w: 3.1, h: 0.45, isTextBox: true, margin: 0,
      fontFace: F, fontSize: 17, bold: true, color: C.ink });
    s.addText(c[1].map((t, j) => ({ text: t, options: { bullet: true, breakLine: j < c[1].length - 1 } })), {
      x: x + 0.35, y: 3.9, w: 3.05, h: 2.0, isTextBox: true, margin: 0,
      fontFace: F, fontSize: 12.5, color: C.mute, lineSpacing: 19, paraSpaceAfter: 8 });
  });
  footer(s, 5);
}

/* ---------- 6. 사장님 화면 ---------- */
{
  const s = pres.addSlide(); bg(s, C.paper);
  lightHead(s, "FOR OWNERS", "사장님이 누르는 버튼은 두 번입니다", { sub: "일반 POS의 4단계를 접수·서빙 두 번으로 줄였습니다.", th: 0.6, suby: 1.68 });

  const feats = [
    ["주문·결제", "새 주문은 폰으로 알림, 결제 승인하면 영수증 자동 출력"],
    ["테이블 8단계", "예약·착석·식사·결제·정리까지 한 화면에서"],
    ["단골 관리", "방문 이력과 등급이 자동으로 쌓이고 쿠폰까지"],
    ["매출·통계", "일·주·월 매출, 결제수단별, 엑셀 내보내기"],
    ["재고·원가", "업종별 기본 재료 자동 채움, 3가지 입력 모드"],
    ["직원·예약", "권한 등급제, 예약 시 테이블 자동 배정"],
  ];
  feats.forEach((f, i) => {
    const x = 0.85 + (i % 3) * 3.95;
    const y = 2.4 + Math.floor(i / 3) * 1.95;
    card(s, x, y, 3.7, 1.65, C.white);
    s.addText(f[0], { x: x + 0.35, y: y + 0.28, w: 3.0, h: 0.4, isTextBox: true, margin: 0,
      fontFace: F, fontSize: 16, bold: true, color: C.navy });
    s.addText(f[1], { x: x + 0.35, y: y + 0.75, w: 3.05, h: 0.75, isTextBox: true, margin: 0,
      fontFace: F, fontSize: 12, color: C.mute, lineSpacing: 18 });
  });
  footer(s, 6);
}

/* ---------- 7. AI가 대신한다 ---------- */
{
  const s = pres.addSlide(); bg(s, C.deep);
  darkHead(s, "AUTOMATION", "보조가 아니라, 대신 실행합니다", { th: 0.7 });
  s.addText("사장님이 하는 일은 승인 한 번입니다.", {
    x: 0.85, y: 1.85, w: 10, h: 0.35, isTextBox: true, margin: 0,
    fontFace: F, fontSize: 14, color: "B9C4D6" });

  const ai = [
    ["부재중 전화를 받습니다", "영업시간과 빈자리를 확인하고 예약까지 잡습니다. 만석이면 대안 시간을 제안합니다."],
    ["홍보 글을 올립니다", "매장 톤·타깃·금지어를 반영한 초안을 만들어 인스타그램과 구글 비즈니스에 동시 발행합니다."],
    ["세금을 짚어 줍니다", "매출과 지출을 기준으로 절세 포인트를 정리해 줍니다."],
    ["지원사업을 찾아 줍니다", "업종과 지역에 맞는 소상공인 지원제도를 추천하고 신청처를 연결합니다."],
  ];
  ai.forEach((a, i) => {
    const x = 0.85 + (i % 2) * 5.95;
    const y = 2.6 + Math.floor(i / 2) * 2.05;
    card(s, x, y, 5.6, 1.75, "16274A");
    s.addText(a[0], { x: x + 0.45, y: y + 0.28, w: 4.8, h: 0.4, isTextBox: true, margin: 0,
      fontFace: F, fontSize: 17, bold: true, color: C.amber });
    s.addText(a[1], { x: x + 0.45, y: y + 0.75, w: 4.75, h: 0.85, isTextBox: true, margin: 0,
      fontFace: F, fontSize: 12.5, color: "C3CEE0", lineSpacing: 19 });
  });
  footer(s, 7);
  s.addNotes("AI 전화 예약은 대화·판단 로직이 완성되어 있고, 음성 채널 연결이 남아 있습니다.");
}

/* ---------- 8. 도입 ---------- */
{
  const s = pres.addSlide(); bg(s, C.paper);
  lightHead(s, "ONBOARDING", "도입은 30분이면 끝납니다", { sub: "전용 단말기도, 설치 기사 방문도, 약정도 없습니다.", th: 0.6, suby: 1.68 });

  const steps = [
    ["도면 사진 한 장", "AI가 매장 자리 배치를 그대로 화면으로 만듭니다."],
    ["메뉴판 사진 한 장", "메뉴와 가격이 한 번에 등록됩니다."],
    ["QR 인쇄해서 붙이기", "템플릿 3종과 라벨지·명함 용지를 지원합니다."],
  ];
  steps.forEach((st, i) => {
    const x = 0.85 + i * 3.95;
    card(s, x, 2.4, 3.7, 2.2, C.white);
    s.addText(String(i + 1).padStart(2, "0"), { x: x + 0.35, y: 2.62, w: 1.2, h: 0.6, isTextBox: true, margin: 0,
      fontFace: "Arial", fontSize: 30, bold: true, color: C.amber });
    s.addText(st[0], { x: x + 0.35, y: 3.28, w: 3.05, h: 0.4, isTextBox: true, margin: 0,
      fontFace: F, fontSize: 16, bold: true, color: C.ink });
    s.addText(st[1], { x: x + 0.35, y: 3.75, w: 3.05, h: 0.65, isTextBox: true, margin: 0,
      fontFace: F, fontSize: 12, color: C.mute, lineSpacing: 18 });
  });

  card(s, 0.85, 4.9, 11.6, 1.5, C.navyL);
  s.addText("30분", { x: 1.25, y: 5.15, w: 2.0, h: 0.9, isTextBox: true, margin: 0, valign: "middle",
    fontFace: F, fontSize: 44, bold: true, color: C.navy });
  s.addText("방문 한 번에 메뉴 등록부터 QR 부착까지 끝냅니다. 사장님은 그날 저녁부터 바로 주문을 받습니다.", {
    x: 3.3, y: 5.15, w: 8.8, h: 0.9, isTextBox: true, margin: 0, valign: "middle",
    fontFace: F, fontSize: 14, color: C.ink, lineSpacing: 22 });
  footer(s, 8);
}

/* ---------- 9. 비교 ---------- */
{
  const s = pres.addSlide(); bg(s, C.paper);
  lightHead(s, "COMPARISON", "기존 도구와 무엇이 다른가", { th: 0.6 });

  const rows = [
    [{ text: "", options: {} }, { text: "기존 POS · 키오스크 · 예약 앱", options: {} }, { text: "결", options: {} }],
    ["도입", "단말기 구입, 설치 기사 방문, 약정 계약", "웹 주소만 열면 시작, 있는 기기로 운영"],
    ["범위", "계산·주문·예약·홍보가 각각 다른 계약", "하나의 시스템에서 끊기지 않고 이어짐"],
    ["맞춤", "어느 업종에나 같은 화면", "업종에 따라 재료·조리 단계·화면이 바뀜"],
    ["비용", "단말기 값 + 월 사용료 + 대행비", "코어 무료, 자동화만 월 1~4만 원대"],
    ["데이터", "각 회사 안에 흩어져 남음", "주문·고객·예약이 매장에 함께 쌓임"],
  ];
  const tableRows = rows.map((r, ri) => {
    if (ri === 0) return [
      { text: "", options: { fill: C.navy } },
      { text: "기존 POS · 키오스크 · 예약 앱", options: { fill: C.navy, color: "C3CEE0", bold: true, fontSize: 13 } },
      { text: "결", options: { fill: C.navy, color: C.amber, bold: true, fontSize: 15 } },
    ];
    return [
      { text: r[0], options: { bold: true, color: C.ink, fontSize: 13.5, fill: C.white } },
      { text: r[1], options: { color: C.mute, fontSize: 13, fill: C.white } },
      { text: r[2], options: { color: C.ink, fontSize: 13, fill: "FAFBFD", bold: true } },
    ];
  });
  s.addTable(tableRows, {
    x: 0.85, y: 2.15, w: 11.6, colW: [1.7, 4.85, 5.05],
    rowH: [0.5, 0.68, 0.68, 0.68, 0.68, 0.68],
    border: { type: "solid", color: C.line, pt: 1 },
    fontFace: F, valign: "middle", margin: [6, 12, 6, 12], autoPage: false,
  });
  s.addText("월 비용은 업계 일반 관행 기준의 설명이며, 매장별 계약 조건에 따라 다릅니다.", {
    x: 0.85, y: 6.35, w: 11, h: 0.3, isTextBox: true, margin: 0,
    fontFace: F, fontSize: 10.5, color: C.muteD });
  footer(s, 9);
}

/* ---------- 10. 신뢰 ---------- */
{
  const s = pres.addSlide(); bg(s, C.paper);
  lightHead(s, "RELIABILITY", "자동화는 한 번의 사고로 신뢰를 잃습니다", { sub: "그래서 결은 AI에게 판단을 맡기지 않습니다.", th: 0.6, suby: 1.68 });

  const stats = [
    ["1건", "동시 예약 2건이 들어와도\n1석에는 1건만 확정됩니다", "확정은 AI가 아니라 서버 트랜잭션이 결정"],
    ["0건", "사람 승인 없이 나가는\n홍보 게시물은 없습니다", "모든 초안은 승인 큐를 거치고 전 이력이 기록됨"],
    ["10 / 10", "자정 넘김 영업·만석·인원 초과 등\n경계 상황 검증을 통과했습니다", "실제 서버와 데이터베이스로 확인"],
  ];
  stats.forEach((st, i) => {
    const x = 0.85 + i * 3.95;
    card(s, x, 2.4, 3.7, 3.55, C.white);
    s.addText(st[0], { x: x + 0.35, y: 2.65, w: 3.0, h: 0.85, isTextBox: true, margin: 0,
      fontFace: F, fontSize: 42, bold: true, color: C.navy });
    s.addText(st[1], { x: x + 0.35, y: 3.62, w: 3.05, h: 1.0, isTextBox: true, margin: 0,
      fontFace: F, fontSize: 13.5, bold: true, color: C.ink, lineSpacing: 21 });
    s.addText(st[2], { x: x + 0.35, y: 4.75, w: 3.05, h: 0.9, isTextBox: true, margin: 0,
      fontFace: F, fontSize: 11.5, color: C.mute, lineSpacing: 18 });
  });
  footer(s, 10);
}

/* ---------- 11. 요금 ---------- */
{
  const s = pres.addSlide(); bg(s, C.paper);
  lightHead(s, "PRICING", "매장 운영에 꼭 필요한 것은 무료입니다", { sub: "돈은 사장님이 직접 하기 어려운 자동화에만 받습니다.", th: 0.6, suby: 1.68 });

  card(s, 0.85, 2.4, 5.6, 3.4, C.navy);
  s.addText("무료", { x: 1.3, y: 2.7, w: 3, h: 0.8, isTextBox: true, margin: 0,
    fontFace: F, fontSize: 40, bold: true, color: C.white });
  s.addText("매장 운영 코어", { x: 1.3, y: 3.55, w: 4.5, h: 0.4, isTextBox: true, margin: 0,
    fontFace: F, fontSize: 16, bold: true, color: C.amber });
  s.addText([
    { text: "QR 주문 · 결제 · 영수증", options: { bullet: true, breakLine: true } },
    { text: "테이블 · 예약 · 직원 관리", options: { bullet: true, breakLine: true } },
    { text: "고객 이력 · 등급 · 쿠폰", options: { bullet: true, breakLine: true } },
    { text: "매출 · 통계 · 재고", options: { bullet: true } },
  ], { x: 1.3, y: 4.05, w: 4.7, h: 1.5, isTextBox: true, margin: 0,
    fontFace: F, fontSize: 13, color: "D5DEEC", lineSpacing: 20, paraSpaceAfter: 6 });

  const paid = [
    ["발행 채널", "1개 무료 · 3개 월 10,000원", "인스타그램, 구글 비즈니스 프로필"],
    ["자동 홍보", "프로 월 25,000원 · 맥스 월 40,000원", "AI 초안 생성부터 승인 발행까지"],
    ["AI 전화 예약", "통화량 구간제", "놓친 전화 한 통이 요금을 넘깁니다"],
  ];
  paid.forEach((p, i) => {
    const y = 2.4 + i * 1.17;
    card(s, 6.85, y, 5.6, 1.02, C.white);
    s.addText(p[0], { x: 7.2, y: y + 0.12, w: 2.2, h: 0.35, isTextBox: true, margin: 0,
      fontFace: F, fontSize: 14.5, bold: true, color: C.ink });
    s.addText(p[1], { x: 7.2, y: y + 0.48, w: 5.0, h: 0.3, isTextBox: true, margin: 0,
      fontFace: F, fontSize: 12.5, bold: true, color: C.navy });
    s.addText(p[2], { x: 7.2, y: y + 0.74, w: 5.0, h: 0.25, isTextBox: true, margin: 0,
      fontFace: F, fontSize: 10.5, color: C.mute });
  });
  card(s, 6.85, 5.91, 5.6, 0.62, C.amberL);
  s.addText("베타 기간에는 위 유료 기능까지 전부 0원입니다", {
    x: 6.85, y: 5.91, w: 5.6, h: 0.62, isTextBox: true, margin: 0, align: "center", valign: "middle",
    fontFace: F, fontSize: 13, bold: true, color: "8A5A11" });
  footer(s, 11);
}

/* ---------- 12. 마무리 ---------- */
{
  const s = pres.addSlide(); bg(s, C.deep);
  s.addShape(pres.ShapeType.ellipse, { x: -2.2, y: 3.6, w: 6.4, h: 6.4, fill: { color: "16274A" }, line: { color: "16274A", width: 1 } });

  s.addText("결", { x: 0.9, y: 0.85, w: 2.5, h: 1.5, isTextBox: true, margin: 0,
    fontFace: F, fontSize: 76, bold: true, color: C.white });
  s.addText("파일럿 매장 2곳에서\n실제 영업에 쓰이고 있습니다.\n다음은 스무 곳입니다.", {
    x: 4.6, y: 1.2, w: 7.8, h: 2.2, isTextBox: true, margin: 0,
    fontFace: F, fontSize: 32, bold: true, color: C.white, lineSpacing: 46 });

  const facts = [["파일럿 매장", "2곳"], ["지원 언어", "4개 국어"], ["사용료", "베타 0원"]];
  facts.forEach((f, i) => {
    const x = 4.6 + i * 2.65;
    s.addText(f[0], { x, y: 3.95, w: 2.4, h: 0.3, isTextBox: true, margin: 0,
      fontFace: F, fontSize: 11, color: C.muteD });
    s.addText(f[1], { x, y: 4.25, w: 2.4, h: 0.5, isTextBox: true, margin: 0,
      fontFace: F, fontSize: 24, bold: true, color: C.amber });
  });

  card(s, 4.6, 5.25, 7.85, 1.1, "16274A");
  s.addText("도입 문의", { x: 5.0, y: 5.45, w: 2.0, h: 0.3, isTextBox: true, margin: 0,
    fontFace: F, fontSize: 11, color: C.amber });
  s.addText("[ 연락처 · 이메일 · 웹 주소를 입력하세요 ]", {
    x: 5.0, y: 5.75, w: 7.0, h: 0.4, isTextBox: true, margin: 0,
    fontFace: F, fontSize: 16, bold: true, color: C.white });
  s.addNotes("마무리: 연락처를 채워서 사용하세요.");
}

pres.writeFile({ fileName: "/tmp/claude-0/-home-user-gyeol/fc762981-a299-59ec-aab6-9eb891f71a12/scratchpad/결_서비스소개.pptx" })
  .then(f => console.log("wrote", f));
