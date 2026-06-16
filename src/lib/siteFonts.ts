/**
 * 가게 공개 사이트 글꼴 프리셋 (TODO 8-1).
 *
 * 레퍼런스(Caffiend)의 "우아한 세리프 브랜드명 + 깔끔한 한글 산세리프" 감성을 기본으로,
 * 업종·분위기별로 고른 큐레이션 페어링. 전부 Google Fonts(무료·한글 지원) 기반.
 *
 *  - display: 브랜드명·섹션 제목용 (개성 있는 글꼴)
 *  - body:    본문·메뉴·설명용 (가독성 좋은 글꼴)
 * google: css2 쿼리 문자열(이 프리셋이 쓰는 패밀리만 로드).
 */
export type SiteFont = {
  id: string;
  nameKey: string;
  google: string;
  display: string;
  body: string;
};

export const SITE_FONTS: SiteFont[] = [
  {
    // Caffiend 스타일 — 라틴 세리프 브랜드명 + 한글 명조/고딕
    id: "editorial",
    nameKey: "font.editorial",
    google: "Playfair+Display:wght@500;600;700&family=Nanum+Myeongjo:wght@700;800&family=Noto+Sans+KR:wght@400;500;700",
    display: `"Playfair Display","Nanum Myeongjo",serif`,
    body: `"Noto Sans KR",system-ui,sans-serif`,
  },
  {
    // 깔끔한 고딕 — 미니멀·모던
    id: "modern",
    nameKey: "font.modern",
    google: "Noto+Sans+KR:wght@400;500;700;900",
    display: `"Noto Sans KR",system-ui,sans-serif`,
    body: `"Noto Sans KR",system-ui,sans-serif`,
  },
  {
    // 한글 명조 — 고전·정갈
    id: "classic",
    nameKey: "font.classic",
    google: "Nanum+Myeongjo:wght@400;700;800&family=Noto+Serif+KR:wght@300;400;600",
    display: `"Nanum Myeongjo","Noto Serif KR",serif`,
    body: `"Noto Serif KR","Nanum Myeongjo",serif`,
  },
  {
    // 둥근 손글씨 느낌 — 친근·카페/베이커리
    id: "rounded",
    nameKey: "font.rounded",
    google: "Jua&family=Noto+Sans+KR:wght@400;500;700",
    display: `"Jua","Noto Sans KR",sans-serif`,
    body: `"Noto Sans KR",system-ui,sans-serif`,
  },
  {
    // 시크한 세리프 — 고급·감각
    id: "chic",
    nameKey: "font.chic",
    google: "Cormorant+Garamond:wght@500;600;700&family=Noto+Serif+KR:wght@300;400;600&family=Noto+Sans+KR:wght@400;500",
    display: `"Cormorant Garamond","Noto Serif KR",serif`,
    body: `"Noto Sans KR",system-ui,sans-serif`,
  },
  {
    // 임팩트 포스터 — 초고대비 콘덴스드 + 초굵은 한글 (분식·치킨·포차·이벤트)
    id: "impact",
    nameKey: "font.impact",
    google: "Anton&family=Black+Han+Sans&family=IBM+Plex+Sans+KR:wght@400;500;600&family=Noto+Sans+KR:wght@400;700",
    display: `"Anton","Black Han Sans","Noto Sans KR",sans-serif`,
    body: `"IBM Plex Sans KR","Noto Sans KR",system-ui,sans-serif`,
  },
  {
    // 빈티지 레트로 — 옛 간판 붓글씨 + 묵직한 세리프 (LP바·로스터리·위스키바)
    id: "retro",
    nameKey: "font.retro",
    google: "Gugi&family=Hahmlet:wght@400;500;700&family=Noto+Serif+KR:wght@400;600",
    display: `"Gugi","Noto Serif KR",serif`,
    body: `"Hahmlet","Noto Serif KR",serif`,
  },
  {
    // 따뜻한 손글씨 — 펜글씨 제목 + 또박또박 휴머니스트 산세 (작은 카페·공방)
    id: "handwritten",
    nameKey: "font.handwritten",
    google: "Nanum+Pen+Script&family=Gowun+Dodum&family=Noto+Sans+KR:wght@400;500",
    display: `"Nanum Pen Script","Gowun Dodum","Noto Sans KR",cursive`,
    body: `"Gowun Dodum","Noto Sans KR",system-ui,sans-serif`,
  },
  {
    // 파리 비스트로 — 올드스타일 세리프 + 우아한 한글 바탕 (카페·베이커리·브런치)
    id: "bistro",
    nameKey: "font.bistro",
    google: "EB+Garamond:wght@500;600;700&family=Gowun+Batang:wght@400;700&family=Noto+Serif+KR:wght@400;600",
    display: `"EB Garamond","Gowun Batang","Noto Serif KR",serif`,
    body: `"Gowun Batang","Noto Serif KR",serif`,
  },
  {
    // 모던 라운드 — 둥근 지오메트릭 영문 + 단단한 한글 디스플레이 (트렌디 디저트·뷰티)
    id: "friendly",
    nameKey: "font.friendly",
    google: "Montserrat:wght@500;600;700&family=Do+Hyeon&family=Noto+Sans+KR:wght@400;500;700",
    display: `"Montserrat","Do Hyeon","Noto Sans KR",sans-serif`,
    body: `"Noto Sans KR",system-ui,sans-serif`,
  },
];

export const getSiteFont = (id?: string): SiteFont =>
  SITE_FONTS.find((f) => f.id === id) ?? SITE_FONTS[0];

/** css2 link href — 한 프리셋(또는 여러 프리셋 미리보기)용 Google Fonts URL */
export const googleFontsHref = (queries: string[]): string =>
  `https://fonts.googleapis.com/css2?${queries.map((q) => `family=${q}`).join("&")}&display=swap`;
