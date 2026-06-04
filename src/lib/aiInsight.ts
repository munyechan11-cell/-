/**
 * AI 매장 인사이트 — 클라이언트 측 데이터 요약 + API 호출.
 *
 * 사장님이 통계 페이지에서 미리 정의된 질문 탭을 누르면:
 *  1. 매장 데이터를 토큰 효율적으로 요약
 *  2. /api/ai/insight 호출
 *  3. AI 답변을 친근한 한국어로 받음
 */
import { api } from "./api";
import type { Order, User, Visit } from "./types";

export type InsightKey =
  | "monthly_sales"
  | "top_customers"
  | "top_menus"
  | "churned_customers"
  | "busy_hours"
  | "weekday_pattern"
  | "improvement";

export interface InsightQuestion {
  key: InsightKey;
  emoji: string;
  title: string;          // 탭 라벨
  question: string;       // AI 에게 보낼 질문 문장
  shortHint: string;      // 답변 로딩 전 짧은 설명
}

export const QUESTIONS: InsightQuestion[] = [
  {
    key: "monthly_sales",
    emoji: "📈",
    title: "이번 달 매출",
    question: "이번 달 매출이 어때? 지난 달과 비교해 어떤 추세야?",
    shortHint: "매출 추세·전월 비교·예상",
  },
  {
    key: "top_customers",
    emoji: "⭐",
    title: "단골 손님",
    question: "가장 단골인 손님은 누구야? 어떻게 더 챙기면 좋을까?",
    shortHint: "방문 횟수 TOP + 관리 팁",
  },
  {
    key: "top_menus",
    emoji: "🍽",
    title: "인기 메뉴",
    question: "가장 잘 팔리는 메뉴는 뭐야? 매출에 얼마나 기여해?",
    shortHint: "판매 수 TOP + 매출 비중",
  },
  {
    key: "churned_customers",
    emoji: "💔",
    title: "이탈 위험 손님",
    question: "오랫동안 안 오는 손님은 누구야? 다시 모시려면 어떻게 해?",
    shortHint: "이탈 위험 손님 + 재방문 전략",
  },
  {
    key: "busy_hours",
    emoji: "🕒",
    title: "바쁜 시간",
    question: "하루 중 가장 바쁜 시간대는 언제야? 직원 배치를 어떻게 하면 좋을까?",
    shortHint: "시간대별 분포 + 인력 배치",
  },
  {
    key: "weekday_pattern",
    emoji: "📅",
    title: "요일별 패턴",
    question: "어느 요일이 잘 되고 어느 요일이 한산해? 어떤 패턴이 보여?",
    shortHint: "요일별 매출·트래픽",
  },
  {
    key: "improvement",
    emoji: "💡",
    title: "개선 아이디어",
    question: "전체 데이터를 보고 우리 매장이 무엇을 개선하면 매출이 늘까?",
    shortHint: "종합 인사이트 + 액션 제안",
  },
];

/** 매장 데이터를 토큰 효율적으로 요약 — AI 에 보낼 context */
export interface InsightContext {
  storeName?: string;
  period?: string;
  revenue?: number;
  orderCount?: number;
  customerCount?: number;
  topMenus?: Array<{ name: string; count: number; revenue: number }>;
  topCustomers?: Array<{ name?: string; visits: number; lastVisit?: string; totalSpent?: number }>;
  churnedCustomers?: Array<{ name?: string; lastVisit?: string; visits?: number }>;
  hourlyDistribution?: Record<string, number>;
  weekdayDistribution?: Record<string, number>;
  prevPeriodRevenue?: number;
}

interface BuildInput {
  storeId: string;
  storeName?: string;
  orders: Order[];
  visits: Visit[];
  users: User[];
}

/**
 * 매장 데이터에서 AI 분석용 요약 생성.
 * 토큰 절약을 위해 최근 60일 + TOP N 만 포함.
 */
export function buildContext(input: BuildInput): InsightContext {
  const now = Date.now();
  const day = 86_400_000;
  const cutoff60 = now - 60 * day;
  const cutoff30 = now - 30 * day;
  const cutoff60to30 = now - 60 * day;

  const myOrders = input.orders.filter(
    (o) => o.storeId === input.storeId && o.status !== "cancelled"
  );
  const myVisits = input.visits.filter((v) => v.storeId === input.storeId);

  // 최근 30일
  const recentOrders = myOrders.filter((o) => new Date(o.createdAt).getTime() >= cutoff30);
  const recentVisits = myVisits.filter((v) => new Date(v.date).getTime() >= cutoff30);
  const revenue = recentOrders.reduce((s, o) => s + o.totalAmount, 0);

  // 전월 (60일 전 ~ 30일 전)
  const prevOrders = myOrders.filter((o) => {
    const t = new Date(o.createdAt).getTime();
    return t >= cutoff60to30 && t < cutoff30;
  });
  const prevPeriodRevenue = prevOrders.reduce((s, o) => s + o.totalAmount, 0);

  // 메뉴 TOP 5
  const menuMap: Record<string, { name: string; count: number; revenue: number }> = {};
  recentOrders.forEach((o) => {
    o.items.forEach((it) => {
      menuMap[it.menuId] ??= { name: it.name, count: 0, revenue: 0 };
      menuMap[it.menuId].count += it.quantity;
      menuMap[it.menuId].revenue += it.quantity * it.price;
    });
  });
  const topMenus = Object.values(menuMap)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // 손님별 방문·소비 통계
  const customerStats: Record<string, { visits: number; lastVisit: string; totalSpent: number }> = {};
  myVisits.forEach((v) => {
    customerStats[v.customerId] ??= { visits: 0, lastVisit: v.date, totalSpent: 0 };
    customerStats[v.customerId].visits += 1;
    if (v.date > customerStats[v.customerId].lastVisit) {
      customerStats[v.customerId].lastVisit = v.date;
    }
  });
  myOrders.forEach((o) => {
    if (customerStats[o.customerId]) {
      customerStats[o.customerId].totalSpent += o.totalAmount;
    }
  });

  // 단골 TOP 5 (방문 횟수 기준)
  const topCustomers = Object.entries(customerStats)
    .map(([cid, s]) => {
      const user = input.users.find((u) => u.id === cid);
      return {
        name: user?.name,
        visits: s.visits,
        lastVisit: s.lastVisit.slice(0, 10),
        totalSpent: s.totalSpent,
      };
    })
    .sort((a, b) => b.visits - a.visits)
    .slice(0, 5);

  // 이탈 위험 손님 — 과거에 자주 왔지만 30일 이상 안 옴 (TOP 5)
  const churnedCustomers = Object.entries(customerStats)
    .filter(([_, s]) => {
      const lastTs = new Date(s.lastVisit).getTime();
      return s.visits >= 3 && now - lastTs > 30 * day;
    })
    .map(([cid, s]) => {
      const user = input.users.find((u) => u.id === cid);
      return {
        name: user?.name,
        lastVisit: s.lastVisit.slice(0, 10),
        visits: s.visits,
      };
    })
    .sort((a, b) => new Date(a.lastVisit ?? 0).getTime() - new Date(b.lastVisit ?? 0).getTime())
    .slice(0, 5);

  // 시간대별 분포 (00~23시)
  const hourly: Record<string, number> = {};
  recentVisits.forEach((v) => {
    const h = new Date(v.date).getHours();
    const label = `${h}시`;
    hourly[label] = (hourly[label] ?? 0) + 1;
  });

  // 요일별 분포
  const dayLabels = ["일", "월", "화", "수", "목", "금", "토"];
  const weekday: Record<string, number> = {};
  recentVisits.forEach((v) => {
    const d = dayLabels[new Date(v.date).getDay()];
    weekday[d] = (weekday[d] ?? 0) + 1;
  });

  return {
    storeName: input.storeName,
    period: "최근 30일",
    revenue,
    orderCount: recentOrders.length,
    customerCount: new Set(recentVisits.map((v) => v.customerId)).size,
    topMenus,
    topCustomers,
    churnedCustomers,
    hourlyDistribution: hourly,
    weekdayDistribution: weekday,
    prevPeriodRevenue,
  };
}

export async function askInsight(input: {
  storeId: string;
  question: string;
  context: InsightContext;
}): Promise<string> {
  const res = await fetch(api("/api/ai/insight"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(t || `HTTP ${res.status}`);
  }
  const data = (await res.json()) as { answer?: string; error?: string };
  if (data.error) throw new Error(data.error);
  return data.answer || "답변을 생성하지 못했어요.";
}
