/**
 * 토스 거래조회 진단 (1회성).
 *
 * 목적: 사장님이 BrandSettings 에 넣은 "토스페이먼츠 시크릿 키(sk_)" 로
 *       토스페이먼츠 거래조회 API(/v1/transactions) 를 오늘(KST) 기준으로 호출해,
 *       **토스 POS(토스플레이스 단말기) 결제가 이 키로 조회되는지** 눈으로 확인한다.
 *
 *   - 보이면  → 이 키만으로 서버 주기 동기화를 붙여 자동 반영 가능 (경로 A)
 *   - 안 보이면(앱 온라인 결제만/0건) → 토스플레이스 Open API 별도 신청 필요 (경로 B)
 *
 * 실행 (PowerShell):
 *   node scripts/toss-probe.mjs "live_sk_xxxxxxxx"
 *   또는  $env:TOSS_SECRET_KEY="live_sk_xxxx"; node scripts/toss-probe.mjs
 *
 * ※ 테스트 키(test_sk_)로 돌리면 실제 POS 매출은 없으므로 0건이 정상.
 *   실제 검증은 라이브 키 + 오늘 POS 결제가 1건 이상 있을 때 해야 한다.
 */

const secretKey = (process.argv[2] || process.env.TOSS_SECRET_KEY || "").trim();

if (!secretKey) {
  console.error("\n❌ 시크릿 키가 없습니다.\n   사용법: node scripts/toss-probe.mjs \"live_sk_xxxx\"\n");
  process.exit(1);
}

const isTest = secretKey.startsWith("test_");
const pad = (n) => String(n).padStart(2, "0");

// 서버 타임존과 무관하게 "오늘(KST)" 범위 계산 — UTC+9 로 보정 후 날짜 추출
const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
const y = kst.getUTCFullYear();
const m = pad(kst.getUTCMonth() + 1);
const d = pad(kst.getUTCDate());
const startDate = `${y}-${m}-${d}T00:00:00+09:00`;
const endDate = `${y}-${m}-${d}T23:59:59+09:00`;

const auth = "Basic " + Buffer.from(secretKey + ":").toString("base64");
const url =
  "https://api.tosspayments.com/v1/transactions" +
  `?startDate=${encodeURIComponent(startDate)}` +
  `&endDate=${encodeURIComponent(endDate)}` +
  `&limit=5000`;

console.log(`\n🔎 토스 거래조회 진단`);
console.log(`   키 종류 : ${isTest ? "테스트(test_sk_)" : "라이브(live_sk_)"}`);
console.log(`   조회기간 : ${startDate} ~ ${endDate} (오늘, KST)\n`);

try {
  const res = await fetch(url, { headers: { Authorization: auth } });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    console.error(`❌ 응답 파싱 실패 (HTTP ${res.status}):\n${text.slice(0, 500)}`);
    process.exit(1);
  }

  if (!res.ok) {
    console.error(`❌ 토스 API 오류 (HTTP ${res.status})`);
    console.error(`   code: ${data?.code ?? "-"}  message: ${data?.message ?? text.slice(0, 300)}`);
    if (res.status === 401) {
      console.error(`   → 키가 잘못됐거나(오타) test/live 가 섞였을 수 있습니다.`);
    }
    process.exit(1);
  }

  const txns = Array.isArray(data) ? data : [];
  if (txns.length === 0) {
    console.log(`📭 오늘 조회된 거래: 0건`);
    console.log(`\n해석:`);
    console.log(`  • 라이브 키인데 0건 + 오늘 POS로 결제한 게 있다면 → POS 결제는`);
    console.log(`    이 키(토스페이먼츠 PG)로 안 잡히는 것. 즉 경로 B(토스플레이스 별도 신청) 필요.`);
    console.log(`  • 테스트 키라면 0건은 정상. 라이브 키로 다시 확인하세요.`);
    process.exit(0);
  }

  // 결제수단·상점(mId)·상태별 집계
  const byMethod = {};
  const byMid = {};
  let sum = 0;
  for (const tx of txns) {
    const method = tx.method ?? "(없음)";
    byMethod[method] = (byMethod[method] ?? 0) + 1;
    if (tx.mId) byMid[tx.mId] = (byMid[tx.mId] ?? 0) + 1;
    if (typeof tx.amount === "number" && tx.status === "DONE") sum += tx.amount;
  }

  console.log(`📦 오늘 조회된 거래: ${txns.length}건  (DONE 합계 ₩${sum.toLocaleString("ko-KR")})`);
  console.log(`\n  결제수단별 :`, byMethod);
  console.log(`  상점(mId)별 :`, byMid);

  console.log(`\n  최근 거래 (최대 10건):`);
  for (const tx of txns.slice(0, 10)) {
    console.log(
      `   - ${tx.transactionAt ?? "?"}  ${String(tx.method ?? "?").padEnd(6)}  ` +
        `₩${Number(tx.amount ?? 0).toLocaleString("ko-KR").padStart(9)}  ${tx.status ?? "?"}  mId=${tx.mId ?? "?"}`
    );
  }

  console.log(`\n해석:`);
  console.log(`  • 오늘 POS 단말기로 결제한 그 금액/시간이 위 목록에 보이면 → 경로 A`);
  console.log(`    (이 키만으로 서버 주기 동기화 붙이면 자동 반영 가능).`);
  console.log(`  • 보이는 게 앱 온라인 결제뿐이고 POS 결제가 없으면 → 경로 B`);
  console.log(`    (토스플레이스 Open API 별도 신청 필요).`);
  console.log(`  • mId 가 여러 개면, POS용 mId 가 따로 잡히는지 함께 확인하세요.\n`);
} catch (e) {
  console.error(`❌ 호출 실패: ${e?.message ?? e}`);
  process.exit(1);
}
