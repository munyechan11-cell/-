import { useState } from "react";
import {
  HelpCircle,
  ChevronDown,
  Printer,
  Bell,
  Clock,
  QrCode,
  UtensilsCrossed,
  LayoutGrid,
  Calendar,
  Users,
  Briefcase,
  CreditCard,
  Receipt,
  AlertCircle,
  Sparkles,
  Phone,
} from "lucide-react";
import { OwnerShell } from "../../components/layout/OwnerShell";
import { Card } from "../../components/ui/Card";
import { cn } from "../../lib/cn";
import { useLanguage, t } from "../../lib/i18n";

interface GuideSection {
  id: string;
  icon: typeof HelpCircle;
  title: string;
  summary: string;
  steps: { num: number; text: string; note?: string }[];
  tips?: string[];
}

const GUIDE: GuideSection[] = [
  {
    id: "menu",
    icon: UtensilsCrossed,
    title: "메뉴 등록하기",
    summary: "처음 매장에 오시는 손님이 보게 될 메뉴를 등록합니다.",
    steps: [
      { num: 1, text: "좌측 메뉴에서 '메뉴 관리' 클릭" },
      { num: 2, text: "우측 상단 '+ 새 메뉴' 버튼 클릭" },
      { num: 3, text: "이름·가격·분류 입력 (예: 김치찌개 / 8000 / 식사류)" },
      { num: 4, text: "저장 클릭" },
    ],
    tips: [
      "재료 떨어지면 메뉴 옆 토글 OFF → 손님 화면에서 안 보임",
      "메뉴 우측 연필 아이콘으로 수정, 휴지통 아이콘으로 삭제",
    ],
  },
  {
    id: "tables",
    icon: LayoutGrid,
    title: "테이블 배치하기",
    summary: "도면 사진으로 자동 배치하거나 직접 그릴 수 있어요.",
    steps: [
      { num: 1, text: "좌측 '테이블 편집' 클릭" },
      { num: 2, text: "도면 사진이 있으면 '도면 업로드' → 'AI 초안 자동 생성'", note: "30초 안에 자동 배치" },
      { num: 3, text: "또는 '+ 테이블 추가' 후 마우스로 끌어 위치 조정" },
      { num: 4, text: "테이블 클릭 → 인원·모양(사각/원형) 변경" },
    ],
    tips: ["룸(별실)은 '+ 테이블 추가' → '룸' 선택"],
  },
  {
    id: "qr",
    icon: QrCode,
    title: "QR 인쇄 후 테이블에 붙이기",
    summary: "손님이 핸드폰 카메라로 찍으면 메뉴가 바로 나옵니다.",
    steps: [
      { num: 1, text: "좌측 'QR 인쇄' 클릭" },
      { num: 2, text: "템플릿 선택: 디럭스(추천) / 미니멀 / 와이드" },
      { num: 3, text: "종이 선택: A4 / 스티커 라벨 / 명함 종이" },
      { num: 4, text: "우측 상단 '인쇄' 버튼" },
      { num: 5, text: "잘라서 각 테이블에 부착 (코팅 권장)" },
    ],
    tips: ["디럭스 템플릿이 사용 방법을 자동으로 같이 인쇄해줘서 추천"],
  },
  {
    id: "bridge",
    icon: Printer,
    title: "영수증 자동 인쇄 프로그램",
    summary: "매장 PC에 설치하면 결제 시 영수증이 자동으로 나옵니다.",
    steps: [
      { num: 1, text: "브랜드 설정 → 영수증 자동 인쇄 → '결 인쇄 브릿지 프로그램 다운로드'" },
      { num: 2, text: ".exe 파일 더블클릭 → 설치 (Windows 보호 경고 시 '추가 정보 → 실행')" },
      { num: 3, text: "설치 후 우측 하단 트레이에 🟢 결 아이콘 생김" },
      { num: 4, text: "브랜드 설정에서 '페어링 코드 발급' 클릭 → 6자리 숫자 표시" },
      { num: 5, text: "트레이 결 아이콘 우클릭 → '매장 연결' → 코드 입력" },
      { num: 6, text: "프린터 선택 → 제조사 선택 → '테스트 인쇄'" },
    ],
    tips: [
      "POS 연동된 매장은 안 깔아도 됨 (POS에서 자동 인쇄)",
      "한 번 깔면 자동 업데이트, 평생 사용",
    ],
  },
  {
    id: "push",
    icon: Bell,
    title: "폰으로 알림 받기",
    summary: "매장 화면을 안 봐도 폰으로 새 주문·결제 요청을 받습니다.",
    steps: [
      { num: 1, text: "브랜드 설정 → 푸시 알림 → '이 기기로 알림 받기' 클릭" },
      { num: 2, text: "브라우저 권한 팝업 → '허용'" },
      { num: 3, text: "'이 기기 알림 켜짐' 메시지 확인" },
      { num: 4, text: "여러 기기(폰·태블릿·PC) 각각 등록 가능" },
    ],
    tips: [
      "iPhone은 결 웹앱을 홈 화면에 추가한 뒤에만 작동 (iOS 16.4+)",
      "권한 거부 시: 주소창 왼쪽 🔒 → 알림 → 허용",
    ],
  },
  {
    id: "hours",
    icon: Clock,
    title: "영업 시간 설정",
    summary: "영업 외 시간 손님 주문이 자동으로 차단됩니다.",
    steps: [
      { num: 1, text: "브랜드 설정 → 영업 시간" },
      { num: 2, text: "요일별 영업 시간 입력 (예: 09:00 ~ 22:00)" },
      { num: 3, text: "(선택) 휴게시간 추가: 15:00 ~ 17:00" },
      { num: 4, text: "(선택) 특정 날짜 휴무 추가: 명절·임시휴무" },
      { num: 5, text: "'영업 시간 저장' 클릭" },
    ],
    tips: [
      "긴급 임시 마감: 매장 상단의 🟢 영업 중 칩 클릭 → 즉시 🔴 마감",
      "24시간 영업 매장은 '24시간 영업' 토글 ON",
    ],
  },
  {
    id: "order",
    icon: Receipt,
    title: "주문 받기·처리",
    summary: "사장님이 누르는 버튼은 단 2번이에요.",
    steps: [
      { num: 1, text: "손님이 QR로 메뉴 주문 → 🔔 사장님 폰 알림" },
      { num: 2, text: "좌측 '주문·쿠폰' 클릭" },
      { num: 3, text: "새 주문 카드(네이비 강조)의 '접수 완료' 1번 클릭 → 자동으로 '조리 중'" },
      { num: 4, text: "조리 끝나면 '서빙 완료' 1번 클릭 → 끝!" },
    ],
    tips: ["기존 POS는 4단계, 결은 2단계로 단순화"],
  },
  {
    id: "payment",
    icon: CreditCard,
    title: "결제 처리",
    summary: "손님 결제 요청 → 승인 → 영수증 자동 출력 → 테이블 비우기",
    steps: [
      { num: 1, text: "손님이 '결제하기' 누름 → 💳 사장님 폰 알림" },
      { num: 2, text: "주문 페이지 상단 '💰 결제 요청' 카드(노란색) 확인" },
      { num: 3, text: "'결제 승인 + 영수증 출력' 클릭 → 총 영수증 1장 자동 출력" },
      { num: 4, text: "사장님이 현금·카드로 결제 받음" },
      { num: 5, text: "테이블 클릭 → '계산 완료 → 테이블 비우기' 클릭" },
    ],
    tips: [
      "한 테이블 모든 주문이 합산된 영수증 1장만 출력",
      "중간 영수증 미리보기는 테이블 모달 → '중간 영수증'",
    ],
  },
  {
    id: "reservation",
    icon: Calendar,
    title: "예약 받기",
    summary: "단골 손님은 검색으로, 처음 손님은 게스트로 등록합니다.",
    steps: [
      { num: 1, text: "좌측 '예약' 클릭 → '+ 새 예약'" },
      { num: 2, text: "이름·전화번호로 단골 검색", note: "검색 결과 클릭 → 자동 채움" },
      { num: 3, text: "처음 손님이면 '+ 게스트로 추가' → 이름·전화 입력" },
      { num: 4, text: "날짜·시간·테이블·인원 입력" },
      { num: 5, text: "저장 → 해당 테이블 자동 '예약됨' 표시" },
    ],
    tips: [
      "예약 카드 하단 4가지 상태: 예약 확정 / 방문 완료 / 노쇼 / 취소",
      "취소·노쇼 처리하면 테이블 자동 비어있음 복귀",
    ],
  },
  {
    id: "staff",
    icon: Briefcase,
    title: "직원 등록·관리",
    summary: "직원이 가입 요청 → 사장님이 승인하면 끝.",
    steps: [
      { num: 1, text: "직원이 결 웹앱 → '직원으로 시작' → 가입 후 우리 매장 검색 → 가입 요청" },
      { num: 2, text: "사장님 폰에 '👤 새 직원 가입 요청' 알림" },
      { num: 3, text: "좌측 '직원 관리' → 가입 요청 카드 → '승인'" },
      { num: 4, text: "직책 변경 가능: 홀 / 주방 / 매니저 등" },
    ],
    tips: [
      "직원은 주문 처리·결제 승인만 가능 (매장 설정 변경 불가)",
      "직원 출퇴근 기록은 직원 관리 페이지에서 확인",
    ],
  },
  {
    id: "customers",
    icon: Users,
    title: "단골 손님·쿠폰 관리",
    summary: "방문 횟수가 자동으로 쌓이고 등급·쿠폰을 줄 수 있어요.",
    steps: [
      { num: 1, text: "좌측 '고객 관리' 클릭" },
      { num: 2, text: "필터: 전체 / VIP / 유망 신규 / 이탈 위험 / 장기 휴면" },
      { num: 3, text: "손님 카드 클릭 → 상세 정보·메모·쿠폰 발급" },
      { num: 4, text: "엑셀 내려받기는 우측 상단 '엑셀' 버튼" },
    ],
    tips: [
      "여러 명에게 쿠폰 한 번에: 카드 우클릭(또는 길게 눌러) 선택 모드 → 하단 '쿠폰' 버튼",
      "이탈 위험·장기 휴면 손님에게 쿠폰 발급으로 재방문 유도",
    ],
  },
  {
    id: "stats",
    icon: Sparkles,
    title: "매출·통계 보기",
    summary: "오늘 매출, 시간대별·메뉴별 분포를 한눈에.",
    steps: [
      { num: 1, text: "좌측 '통계' 클릭" },
      { num: 2, text: "상단에서 기간 선택: 오늘 / 이번주 / 이번달 / 전체" },
      { num: 3, text: "매출·주문 수·시간대·메뉴별·등급별·연령대 그래프 확인" },
    ],
    tips: [
      "🟢 mint = 매출 상승, 🟠 주황 = 매출 하락",
      "메뉴별 판매 순위로 인기 메뉴 파악",
    ],
  },
  {
    id: "troubleshoot",
    icon: AlertCircle,
    title: "문제가 생겼을 때",
    summary: "흔히 발생하는 문제와 즉시 해결법",
    steps: [
      { num: 1, text: "화면이 안 떠요 → Ctrl+Shift+R 또는 새로고침" },
      { num: 2, text: "주문 안 보여요 → 브랜드 설정 → 푸시 알림 켜져 있는지 확인" },
      { num: 3, text: "영수증 안 나와요 → 트레이의 결 아이콘이 🟢 인지 확인" },
      { num: 4, text: "푸시 안 와요 → 주소창 🔒 → 알림 → 허용" },
      { num: 5, text: "결 인쇄 브릿지 안 보임 → 시작 메뉴에서 '결 인쇄 브릿지' 검색·실행" },
    ],
    tips: ["그래도 안 되면 사장님 매장 담당 매니저에게 화면 캡쳐와 함께 연락"],
  },
];

export default function OwnerHelp() {
  const [openId, setOpenId] = useState<string | null>("menu");
  const lang = useLanguage();

  return (
    <OwnerShell title={t("ohelp.title", lang)}>
      <div className="max-w-2xl mx-auto pb-12">
        {/* 인트로 */}
        <Card padding="lg" className="mb-5 bg-[var(--color-navy-50)] border-[var(--color-navy-200)]">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[var(--color-navy-700)] text-white inline-flex items-center justify-center shrink-0">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-[18px] font-extrabold text-[var(--color-navy-900)]">결 운영 가이드</h1>
              <p className="text-[13px] text-[var(--color-navy-700)] mt-1 leading-relaxed">
                결을 처음 쓰시는 사장님을 위한 안내문이에요. <br />
                궁금한 항목을 펼쳐서 차근차근 따라하시면 됩니다.
              </p>
              {lang !== "ko" && (
                <p className="text-[11.5px] text-[var(--color-navy-600)] mt-2 font-semibold italic">
                  {t("ohelp.langNote", lang)}
                </p>
              )}
            </div>
          </div>
        </Card>

        {/* 각 섹션 — 아코디언 */}
        <div className="space-y-2.5">
          {GUIDE.map((sec) => {
            const open = openId === sec.id;
            const Icon = sec.icon;
            return (
              <Card key={sec.id} padding="none" className="overflow-hidden">
                <button
                  onClick={() => setOpenId(open ? null : sec.id)}
                  className="w-full px-4 py-3.5 flex items-center gap-3 text-left hover:bg-[var(--color-navy-50)]/50 transition-colors"
                  aria-expanded={open}
                >
                  <div className={cn(
                    "w-10 h-10 rounded-xl inline-flex items-center justify-center shrink-0 transition-colors",
                    open ? "bg-[var(--color-navy-700)] text-white" : "bg-[var(--color-navy-50)] text-[var(--color-navy-700)]"
                  )}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14.5px] font-extrabold text-[var(--color-navy-900)]">
                      {sec.title}
                    </p>
                    <p className="text-[12px] text-[var(--color-ink-500)] font-medium truncate">
                      {sec.summary}
                    </p>
                  </div>
                  <ChevronDown
                    className={cn(
                      "w-5 h-5 text-[var(--color-ink-500)] transition-transform shrink-0",
                      open && "rotate-180"
                    )}
                  />
                </button>

                {open && (
                  <div className="px-4 pb-4 border-t border-[var(--color-line)] bg-[var(--color-bg)]">
                    {/* 단계 목록 */}
                    <ol className="space-y-2.5 mt-4">
                      {sec.steps.map((step) => (
                        <li key={step.num} className="flex items-start gap-3">
                          <span className="w-7 h-7 rounded-full bg-[var(--color-navy-700)] text-white inline-flex items-center justify-center font-extrabold text-[12px] shrink-0">
                            {step.num}
                          </span>
                          <div className="flex-1 min-w-0 pt-0.5">
                            <p className="text-[14px] font-semibold text-[var(--color-navy-900)] leading-relaxed">
                              {step.text}
                            </p>
                            {step.note && (
                              <p className="text-[11.5px] text-[var(--color-mint-700)] font-bold mt-0.5">
                                💡 {step.note}
                              </p>
                            )}
                          </div>
                        </li>
                      ))}
                    </ol>

                    {/* 팁 */}
                    {sec.tips && sec.tips.length > 0 && (
                      <div className="mt-4 p-3 rounded-[12px] bg-[var(--color-mint-50)] border border-[var(--color-mint-200)]">
                        <p className="text-[11.5px] font-extrabold text-[var(--color-mint-700)] uppercase tracking-wider mb-1.5">
                          💡 알아두면 좋아요
                        </p>
                        <ul className="space-y-1">
                          {sec.tips.map((tip, i) => (
                            <li key={i} className="text-[12.5px] text-[var(--color-mint-700)] font-medium leading-relaxed flex items-start gap-1.5">
                              <span className="text-[var(--color-mint-500)] shrink-0">·</span>
                              <span>{tip}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>

        {/* 마지막 안내 */}
        <Card padding="lg" className="mt-6 bg-[var(--color-mint-50)] border-[var(--color-mint-200)]">
          <div className="flex items-start gap-3">
            <Phone className="w-5 h-5 text-[var(--color-mint-700)] mt-0.5 shrink-0" />
            <div>
              <p className="text-[13.5px] font-extrabold text-[var(--color-mint-700)]">
                해결되지 않는 문제가 있나요?
              </p>
              <p className="text-[12px] text-[var(--color-mint-700)] mt-1 leading-relaxed">
                현재 화면을 캡쳐해서 매장 담당자에게 보내주세요.<br />
                <strong>언제 발생했는지 / 무슨 작업 중이었는지</strong> 같이 알려주시면 빠르게 도와드려요.
              </p>
            </div>
          </div>
        </Card>

        {/* 푸터 */}
        <p className="text-center text-[11px] text-[var(--color-ink-400)] mt-8 font-medium">
          결(Gyeol) · 사장님 운영 가이드 v1.0 · 2026.06
        </p>
      </div>
    </OwnerShell>
  );
}
