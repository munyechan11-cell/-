import { fetchWithTimeout } from '../lib/http.js';
import { sendPushToOwner } from '../lib/push.js';


// ============================================================
// AI 예약 두뇌 (TODO 6-1) — 전화 AI·외부 음성채널이 호출하는 서버 엔드포인트.
//   /availability : 영업시간·테이블·기존예약으로 빈자리 판단(읽기)
//   /create       : 검증 통과 시 예약 생성 + 테이블 reserved + 사장님 푸시(쓰기)
// 전화 연동 전에 두뇌만 독립 테스트 가능. 서버-서버 호출이므로 공유키(AI_RESERVATION_KEY)로 보호.
// ============================================================
export const RES_DURATION_MIN = 90; // 한 예약이 테이블을 점유하는 기본 시간(분)

export function hmToMin(hm: string): number {
  const [h, m] = String(hm || '').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}
export function minToHm(total: number): string {
  const t = ((total % 1440) + 1440) % 1440; // 0~1439 로 래핑
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}
// 영업시간 판단 — 클라이언트 businessHours.ts(단일 진실원) 규칙과 동일하게.
// 자정 넘는 영업(예: 18:00~02:00)·자정 넘는 휴게시간·마감 정각 배제(half-open [open,close))·open24h 우선 처리.
export function isStoreOpenAt(owner: any, date: string, time: string): boolean {
  if (owner?.temporarilyClosed) return false;
  const bh = owner?.businessHours;
  if (!bh) return true; // 미설정 = 항상 영업으로 간주
  if (bh.open24h) return true; // 24시간 영업은 closedDates 보다 우선 (client businessHours.ts:67 과 동일)
  if (Array.isArray(bh.closedDates) && bh.closedDates.includes(date)) return false;
  const day = new Date(`${date}T00:00:00`).getDay(); // 0=일
  const wk = bh.weekly?.[day];
  if (!wk || wk.closed) return false;
  const t = hmToMin(time);
  const openM = hmToMin(wk.open ?? '00:00');
  const closeM = hmToMin(wk.close ?? '23:59');
  // 마감 분은 닫힘으로(half-open). 자정 넘김(closeM<=openM)이면 [open,24:00)+[00:00,close).
  const inWindow = closeM <= openM ? t >= openM || t < closeM : t >= openM && t < closeM;
  if (!inWindow) return false;
  if (wk.breakStart && wk.breakEnd) {
    const bs = hmToMin(wk.breakStart);
    const be = hmToMin(wk.breakEnd);
    const inBreak = be <= bs ? t >= bs || t < be : t >= bs && t < be; // 자정 넘는 휴게도 처리
    if (inBreak) return false;
  }
  return true;
}
// 메모리상 빈 테이블 선택 — 요청 시간 ±durationMin 으로 점유 중이지 않은, 인원 충족 최소 테이블.
export function pickFreeTable(tables: any[], reservations: any[], time: string, partySize: number, durationMin: number) {
  const reqMin = hmToMin(time);
  const taken = new Set<number>(
    reservations
      .filter((r: any) => r.status === 'confirmed' && Math.abs(hmToMin(r.time) - reqMin) < durationMin)
      .map((r: any) => r.tableNumber)
  );
  return tables
    .filter((tb: any) => tb.type == null || tb.type === 'table' || tb.type === 'room')
    .filter((tb: any) => (tb.seats ?? 0) >= partySize && !taken.has(tb.number))
    .sort((a: any, b: any) => (a.seats ?? 0) - (b.seats ?? 0))[0] ?? null; // 가장 작은 적합 테이블 우선
}
// 한 매장·하루의 테이블·예약을 1회만 조회 (slots 처럼 여러 시간대 반복 검사 시 읽기 비용 절감)
export async function loadStoreDay(fs: any, storeId: string, date: string) {
  const [tablesSnap, resSnap] = await Promise.all([
    fs.collection('tables').where('storeId', '==', storeId).get(),
    fs.collection('reservations').where('storeId', '==', storeId).where('date', '==', date).get(),
  ]);
  return {
    tables: tablesSnap.docs.map((d: any) => d.data()),
    reservations: resSnap.docs.map((d: any) => d.data()),
  };
}
export async function findFreeTable(
  fs: any,
  storeId: string,
  date: string,
  time: string,
  partySize: number,
  durationMin: number = RES_DURATION_MIN
) {
  const { tables, reservations } = await loadStoreDay(fs, storeId, date);
  return pickFreeTable(tables, reservations, time, partySize, durationMin);
}
/** 매장의 AI 예약 설정 — 활성화 여부 + 점유시간(분). 비활성 매장은 예약 두뇌가 거부. */
export function aiReservationConfig(owner: any): { enabled: boolean; durationMin: number } {
  const c = owner?.storeConfig?.aiReservation ?? {};
  return {
    enabled: c.enabled === true,
    durationMin: Math.max(15, Math.min(360, Number(c.durationMin) || RES_DURATION_MIN)),
  };
}

// 다중 제공자 LLM 텍스트 생성 — Gemini→Anthropic→OpenAI 폴백(insight/floor-plan 과 동일 패턴).
// 설정된 키가 하나도 없으면 null 반환(호출부가 503 처리). 대화 이해·문구 생성 전용(예약 확정은 서버가 결정).
export async function callLLMText(systemPrompt: string, userMsg: string, maxTokens = 600): Promise<string | null> {
  const geminiKey = process.env.GEMINI_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!geminiKey && !anthropicKey && !openaiKey) return null; // 키 0개 = 미설정 → 호출부 503
  // 각 제공자를 try/catch 로 감싸 런타임 장애 시 다음 제공자로 폴백. 전부 실패하면 마지막 에러를 throw(호출부 502).
  let lastErr: any;
  if (geminiKey) {
    try {
      const r = await fetchWithTimeout(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`,
        { method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': geminiKey }, body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: 'user', parts: [{ text: userMsg }] }],
          // thinking 끔 — 2.5-flash 는 기본 thinking 이 출력 토큰을 먹어 본문이 잘리고 느려짐. 텍스트 생성엔 불필요.
          generationConfig: { temperature: 0.3, maxOutputTokens: maxTokens, thinkingConfig: { thinkingBudget: 0 } },
        }) }, 20000);
      if (!r.ok) throw new Error(`Gemini ${r.status}`);
      const d: any = await r.json();
      return d?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';
    } catch (e: any) { lastErr = e; console.warn('[callLLMText] gemini fail', e?.message); }
  }
  if (anthropicKey) {
    try {
      const r = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: maxTokens, system: systemPrompt, messages: [{ role: 'user', content: userMsg }] }),
      }, 20000);
      if (!r.ok) throw new Error(`Anthropic ${r.status}`);
      const d: any = await r.json();
      return d?.content?.[0]?.text?.trim() ?? '';
    } catch (e: any) { lastErr = e; console.warn('[callLLMText] anthropic fail', e?.message); }
  }
  if (openaiKey) {
    try {
      const r = await fetchWithTimeout('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${openaiKey}` },
        body: JSON.stringify({ model: 'gpt-4o-mini', temperature: 0.3, max_tokens: maxTokens, messages: [
          { role: 'system', content: systemPrompt }, { role: 'user', content: userMsg },
        ] }),
      }, 20000);
      if (!r.ok) throw new Error(`OpenAI ${r.status}`);
      const d: any = await r.json();
      return d?.choices?.[0]?.message?.content?.trim() ?? '';
    } catch (e: any) { lastErr = e; console.warn('[callLLMText] openai fail', e?.message); }
  }
  throw lastErr ?? new Error('All LLM providers failed');
}

export interface BookInput { date: string; time: string; partySize: number; customerName: string; customerPhone: string; memo?: string; }
export type BookResult =
  | { status: 'closed' }
  | { status: 'duplicate'; existing: { date: string; time: string; partySize: number; tableNumber: number } }
  | { status: 'too_large'; maxSeats: number }
  | { status: 'full' }
  | { status: 'ok'; reservation: any };
// 결정론적 예약 처리 — 영업시간·중복·빈자리를 서버가 판단하고 생성한다.
// LLM 이 "예약됐다"를 임의로 말하지 못하게, 실제 booking 은 항상 이 함수가 단일 진실로 수행.
// 읽기(테이블·당일예약) + 판정 + 쓰기(예약·테이블상태)를 한 트랜잭션으로 묶어, 동시 통화가
// 같은 테이블을 동시에 예약하는 더블북을 막는다(충돌 시 Firestore 가 자동 재시도 → 재판정).
export async function tryBookReservation(fs: any, owner: any, storeId: string, input: BookInput, durationMin: number): Promise<BookResult> {
  if (!isStoreOpenAt(owner, input.date, input.time)) return { status: 'closed' };
  const normPhone = String(input.customerPhone).replace(/[^\d+]/g, '').slice(0, 20);
  const reqMin = hmToMin(input.time);
  const id = `res_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const result: BookResult = await fs.runTransaction(async (tx: any) => {
    // 트랜잭션 내 읽기는 쓰기보다 먼저. 충돌(읽은 문서가 커밋 전 변경)이면 콜백 전체가 재실행된다.
    const tablesQ = fs.collection('tables').where('storeId', '==', storeId);
    const resQ = fs.collection('reservations').where('storeId', '==', storeId).where('date', '==', input.date);
    const [tablesSnap, resSnap] = await Promise.all([tx.get(tablesQ), tx.get(resQ)]);
    const tables = tablesSnap.docs.map((d: any) => d.data());
    const reservations = resSnap.docs.map((d: any) => d.data());

    // 중복: 같은 번호 + 시간 겹침(±durationMin)만. 같은 날 다른 시간대(점심/저녁)는 허용.
    const dup = reservations.find((r: any) => r.status === 'confirmed'
      && String(r.customerPhone || '').replace(/[^\d+]/g, '') === normPhone
      && Math.abs(hmToMin(r.time) - reqMin) < durationMin);
    if (dup) return { status: 'duplicate', existing: { date: dup.date, time: dup.time, partySize: dup.partySize, tableNumber: dup.tableNumber } } as BookResult;

    // 인원이 매장 최대 수용을 넘으면 '만석'과 구분(어떤 시간/날짜로도 불가).
    const maxSeats = tables
      .filter((tb: any) => tb.type == null || tb.type === 'table' || tb.type === 'room')
      .reduce((mx: number, tb: any) => Math.max(mx, tb.seats ?? 0), 0);
    if (input.partySize > maxSeats) return { status: 'too_large', maxSeats } as BookResult;

    const table = pickFreeTable(tables, reservations, input.time, input.partySize, durationMin);
    if (!table) return { status: 'full' } as BookResult;

    const reservation = {
      id, storeId, date: input.date, time: input.time,
      tableNumber: table.number,
      partySize: input.partySize,
      customerName: String(input.customerName).slice(0, 40),
      customerPhone: normPhone,
      memo: input.memo ? String(input.memo).slice(0, 200) : 'AI 전화 예약',
      status: 'confirmed',
      createdAt: new Date().toISOString(),
    };
    tx.set(fs.collection('reservations').doc(id), reservation);
    // 테이블 reserved 전이 (점유 중이면 보호 — 읽어둔 table.status 로 판단, 같은 tx 라 원자적)
    const cur = (table as any).status;
    if (!cur || cur === 'available' || cur === 'setup' || cur === 'reserved') {
      tx.set(fs.collection('tables').doc(`${storeId}_${table.number}`), { status: 'reserved' }, { merge: true });
    }
    return { status: 'ok', reservation } as BookResult;
  });

  // 푸시는 트랜잭션 밖(부수효과 — 재시도/커밋과 분리). 예약 성공 시에만.
  if (result.status === 'ok') {
    try {
      await sendPushToOwner({
        storeId, kind: 'ai-reservation', title: 'AI 전화 예약 접수',
        body: `${input.date} ${input.time} · ${input.partySize}명 · ${result.reservation.customerName} (${result.reservation.tableNumber}번 테이블)`,
        focusUrl: '/biz/owner/reservations', tag: `ai-res-${id}`,
      });
    } catch (e: any) {
      console.warn('[tryBookReservation] push fail', e?.message);
    }
  }
  return result;
}
