import { readFileSync } from "node:fs";

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

/**
 * Firestore 보안 규칙 — 실제 에뮬레이터에 요청을 던져 검증한다.
 *
 * 규칙은 "읽어 보면 맞아 보이는데 실제로는 안 막는" 일이 흔하다. 특히 이 저장소는
 * 인증 모델이 특이해서(앱 자체 ID + Firebase 익명 토큰) 규칙이 요청자를 식별하지
 * 못한다. 그 한계가 실제로 어디까지인지를 코드로 고정해 둔다.
 *
 * 두 묶음으로 나눠 둔 이유:
 *   · "지금 막는 것"  — 회귀 방지. 이게 깨지면 보안이 후퇴한 것이다.
 *   · "아직 못 막는 것" — Custom Token 전환(Phase 3)의 체크리스트.
 *     전환이 끝나면 이 묶음의 기대값이 뒤집혀야 한다.
 */

const PROJECT_ID = "gyeol-test";

/** 매장 A 사장님 · 매장 B 사장님 · 지나가던 익명 사용자 */
const STORE_A = "storeA";
const STORE_B = "storeB";

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync("firestore.rules", "utf8"),
      host: "127.0.0.1",
      port: 8080,
    },
  });
});

afterAll(async () => {
  await testEnv?.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  // 규칙을 우회해 시드 — 남의 매장 문서가 실제로 존재하는 상태에서 접근을 시험한다.
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "users", "customerOfA"), {
      id: "customerOfA", role: "customer", storeId: STORE_A,
      name: "김손님", phone: "01011112222", birthday: "1990-01-01",
    });
    await setDoc(doc(db, "orders", "orderOfA"), { id: "orderOfA", storeId: STORE_A, total: 30000 });
    await setDoc(doc(db, "store_secrets", STORE_A), { tossSecretKey: "test_sk_DO_NOT_LEAK" });
    await setDoc(doc(db, "pairing_codes", "123456"), { storeId: STORE_A });
    await setDoc(doc(db, "merchant_map", "merchant-1"), { storeId: STORE_A });
    await setDoc(doc(db, "print_jobs", "jobOfA"), { id: "jobOfA", storeId: STORE_A, payload: "..." });
    await setDoc(doc(db, "print_jobs", "jobOfB"), { id: "jobOfB", storeId: STORE_B, payload: "..." });
  });
});

/** 로그인하지 않은(= 토큰 없는) 클라이언트 */
const anon = () => testEnv.unauthenticatedContext().firestore();
/** 익명 로그인만 한 클라이언트 — 앱이 부팅 때 항상 만드는 상태이자, 누구나 만들 수 있는 상태 */
const signedIn = (uid = "anon-uid-1") => testEnv.authenticatedContext(uid).firestore();
/** 영수증 브릿지 에이전트 — Custom Token (uid = storeId, role = print-bridge) */
const agent = (storeId: string) =>
  testEnv.authenticatedContext(storeId, { role: "print-bridge" }).firestore();

// ============================================================
describe("지금 막는 것 — 깨지면 보안 후퇴", () => {
  it("비로그인은 매장 데이터를 읽지 못한다", async () => {
    await assertFails(getDoc(doc(anon(), "users", "customerOfA")));
    await assertFails(getDoc(doc(anon(), "orders", "orderOfA")));
  });

  it("비로그인은 매장 데이터를 쓰지 못한다", async () => {
    await assertFails(setDoc(doc(anon(), "orders", "injected"), { storeId: STORE_A }));
  });

  it("[보안] 토스 시크릿 키는 로그인해도 읽을 수 없다 — 서버 전용", async () => {
    await assertFails(getDoc(doc(anon(), "store_secrets", STORE_A)));
    await assertFails(getDoc(doc(signedIn(), "store_secrets", STORE_A)));
    await assertFails(setDoc(doc(signedIn(), "store_secrets", STORE_A), { tossSecretKey: "x" }));
  });

  it("[보안] 프린터 페어링 코드는 로그인해도 읽을 수 없다", async () => {
    await assertFails(getDoc(doc(signedIn(), "pairing_codes", "123456")));
    await assertFails(setDoc(doc(signedIn(), "pairing_codes", "999999"), { storeId: STORE_B }));
  });

  it("[보안] 토스플레이스 merchant 역매핑은 로그인해도 읽을 수 없다", async () => {
    await assertFails(getDoc(doc(signedIn(), "merchant_map", "merchant-1")));
  });

  it("규칙에 없는 컬렉션은 기본 거부된다", async () => {
    await assertFails(getDoc(doc(signedIn(), "somethingNew", "x")));
    await assertFails(setDoc(doc(signedIn(), "somethingNew", "x"), { a: 1 }));
  });

  it("[보안] 프린트 에이전트는 남의 매장 인쇄 작업을 읽지 못한다", async () => {
    await assertSucceeds(getDoc(doc(agent(STORE_A), "print_jobs", "jobOfA")));
    await assertFails(getDoc(doc(agent(STORE_A), "print_jobs", "jobOfB")));
  });

  it("[보안] 프린트 에이전트는 남의 매장 이름으로 작업을 만들 수 없다", async () => {
    await assertSucceeds(
      setDoc(doc(agent(STORE_A), "print_jobs", "newJobA"), { storeId: STORE_A, payload: "..." })
    );
    await assertFails(
      setDoc(doc(agent(STORE_A), "print_jobs", "newJobB"), { storeId: STORE_B, payload: "..." })
    );
  });
});

// ============================================================
describe("아직 못 막는 것 — Custom Token 전환(Phase 3) 체크리스트", () => {
  /**
   * ⚠️ 아래 테스트들은 "통과하면 안 되는 일이 통과한다"를 고정한 것이다.
   *
   * 원인: 규칙이 요청자를 식별하지 못한다. 결의 user.id 는 generateId() 로 만든
   * 자체 ID 라 Firebase 익명 토큰의 uid 와 아무 관계가 없고, 규칙에는
   * `request.auth != null` 게이트밖에 걸 수 없다.
   *
   * 그런데 익명 로그인은 **웹 API 키만 있으면 누구나** 할 수 있다. API 키는
   * 클라이언트 번들에 들어 있으므로 사실상 공개값이다. 즉 지금은
   * "인터넷의 아무나"가 아래 일을 할 수 있다.
   *
   * 전환이 끝나면 이 describe 의 assertFails/assertSucceeds 가 뒤집혀야 한다.
   */

  it("[취약] 익명 로그인만 하면 남의 매장 손님 개인정보를 읽을 수 있다", async () => {
    const snap = await assertSucceeds(getDoc(doc(signedIn("아무나"), "users", "customerOfA")));
    // 이름·전화번호·생일이 그대로 나온다.
    expect(snap.data()).toMatchObject({ phone: "01011112222", birthday: "1990-01-01" });
  });

  it("[취약] 익명 로그인만 하면 남의 매장 주문을 고칠 수 있다", async () => {
    await assertSucceeds(
      setDoc(doc(signedIn("아무나"), "orders", "orderOfA"), { storeId: STORE_A, total: 0 })
    );
  });

  it("[취약] 익명 로그인만 하면 남의 매장에 쿠폰을 발급할 수 있다", async () => {
    await assertSucceeds(
      setDoc(doc(signedIn("아무나"), "coupons", "freeMoney"), {
        storeId: STORE_A, customerId: "customerOfA", discount: 100000,
      })
    );
  });

  it("[취약] 익명 로그인만 하면 직원 등급을 스스로 올릴 수 있다", async () => {
    await assertSucceeds(
      setDoc(doc(signedIn("아무나"), "users", "customerOfA"), {
        id: "customerOfA", role: "staff", staffLevel: 5, employerStoreId: STORE_A,
      })
    );
  });

  it("[취약] 매장 A 사장님이 매장 B 데이터를 만질 수 있다 — 매장 간 격리 없음", async () => {
    await assertSucceeds(
      setDoc(doc(signedIn(STORE_A), "orders", "orderOfB"), { storeId: STORE_B, total: 1 })
    );
  });
});
