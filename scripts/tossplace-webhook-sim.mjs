/**
 * 토스플레이스 웹훅 시뮬레이터 (로컬/테스트용).
 *
 * 실제 토스플레이스가 보내는 것과 같은 형식의 "서명된 결제 웹훅"을 우리 서버의
 * /api/tossplace/webhook 으로 POST 한다. 실제 토스 키 없이도 다음을 검증할 수 있다:
 *   · 서명검증(HMAC-SHA256) 로직이 맞는지
 *   · merchantId → storeId 매핑이 동작하는지 (merchant_map 에 매핑 필요)
 *   · orders 에 'paid' 주문이 생기고 대시보드/정산 매출에 잡히는지
 *
 * ※ 서버 응답이 200이어도 매출 반영까지 보려면, 서버가 Firebase Admin 으로 초기화돼 있고
 *   merchant_map/<merchantId> → { storeId } 매핑이 있어야 한다(브랜드설정에서 연동 저장 시 생성).
 *
 * 실행 (PowerShell):
 *   node scripts/tossplace-webhook-sim.mjs --secret "웹훅시크릿" --merchant "MID123" --amount 15000
 *   # 옵션: --url http://localhost:3000/api/tossplace/webhook  --type payment.completed.v1
 *   # secret 미지정 시 환경변수 TOSSPLACE_WEBHOOK_SECRET 사용
 */
import { createHmac } from 'node:crypto';

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}

const url = arg('url', 'http://localhost:3000/api/tossplace/webhook');
const secret = arg('secret', process.env.TOSSPLACE_WEBHOOK_SECRET || '');
const merchantId = arg('merchant', 'TEST_MID_0001');
const amount = Number(arg('amount', '15000'));
const type = arg('type', 'payment.completed.v1'); // TODO: 실제 결제완료 이벤트 type 으로 교체
const paymentId = arg('paymentId', `sim_${Date.now()}`);

// 실제 토스 페이로드를 모사 — 필드명은 추정(서버의 extractTossPlacePayment 와 짝). 실수신 후 확정.
const bodyObj = {
  id: `evt_${Date.now()}`,
  type,
  createdAt: new Date(Date.now()).toISOString(),
  merchantId,
  data: {
    paymentId,
    amount,
    method: '카드',
    approvedAt: new Date(Date.now()).toISOString(),
  },
};
const rawBody = JSON.stringify(bodyObj);
const timestamp = String(Date.now());

const headers = { 'content-type': 'application/json' };
if (secret) {
  // 서버 검증과 동일: HMAC-SHA256( `${timestamp}.${rawBody}` ), 'v1=' 프리픽스
  const sig = 'v1=' + createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
  headers['x-toss-timestamp'] = timestamp;
  headers['x-toss-signature'] = sig;
} else {
  console.warn('⚠️  secret 미지정 — 서명 헤더 없이 전송(서버가 secret 설정돼 있으면 401 정상).');
}

console.log(`\n→ POST ${url}`);
console.log(`  merchantId=${merchantId}  amount=₩${amount.toLocaleString('ko-KR')}  type=${type}`);
console.log(`  paymentId=${paymentId}`);

try {
  const res = await fetch(url, { method: 'POST', headers, body: rawBody });
  const text = await res.text();
  console.log(`\n← HTTP ${res.status}`);
  console.log(`  ${text.slice(0, 500)}`);
  if (res.ok) {
    console.log(`\n✅ 서버가 수신했습니다. 이제 사장님 대시보드 "오늘 매출"·정산에 ₩${amount.toLocaleString('ko-KR')} 이 잡히는지 확인하세요.`);
    console.log(`   (안 잡히면: Firebase Admin 설정 여부 + merchant_map/${merchantId} → storeId 매핑 여부 확인)`);
  } else if (res.status === 404) {
    console.log(`\nℹ️  merchant not mapped — 브랜드설정에서 그 매장 merchantId(${merchantId})로 "연동 저장"을 먼저 해야 매핑이 생깁니다.`);
  } else if (res.status === 401) {
    console.log(`\nℹ️  서명 불일치 — --secret 값이 서버(매장 저장값 또는 TOSSPLACE_WEBHOOK_SECRET)와 같은지 확인하세요.`);
  }
} catch (e) {
  console.error(`\n❌ 전송 실패: ${e?.message ?? e}`);
  console.error('   서버가 떠 있는지(npm run dev) 확인하세요.');
  process.exit(1);
}
