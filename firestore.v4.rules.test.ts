import { readFileSync } from "node:fs";

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { deleteDoc, doc, getDoc, getDocs, query, setDoc, where, collection } from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

/**
 * v4 규칙(Custom Token 기반) 검증 — 아직 배포하지 않은 목표 규칙이다.
 *
 * 여기서 증명하려는 것: "Custom Token 으로 바꾸면 정말 막히는가".
 * firestore.rules.test.ts 의 "아직 못 막는 것" 5건이 여기서는 전부 막혀야 한다.
 *
 * 전제: 로그인 시 서버가 createCustomToken(user.id, {role, staffLevel,
 * employerStoreId, employerStatus}) 을 발급한다. 아래 컨텍스트가 그 토큰을 흉내낸다.
 */

const PROJECT_ID = "gyeol-test-v4";
const STORE_A = "storeA";
const STORE_B = "storeB";

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync("firestore.v4.rules", "utf8"),
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
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    // 계정
    await setDoc(doc(db, "users", STORE_A), { id: STORE_A, role: "owner", name: "A사장" });
    await setDoc(doc(db, "users", STORE_B), { id: STORE_B, role: "owner", name: "B사장" });
    await setDoc(doc(db, "users", "staffA"), {
      id: "staffA", role: "staff", staffLevel: 1,
      employerStoreId: STORE_A, employerStatus: "approved", extraPerms: [],
    });
    await setDoc(doc(db, "users", "customer1"), {
      id: "customer1", role: "customer", name: "김손님",
      phone: "01011112222", birthday: "1990-01-01",
    });
    // 매장 데이터
    for (const [coll, id, sid, extra] of [
      ["orders", "orderA", STORE_A, { customerId: "customer1", total: 30000 }],
      ["orders", "orderB", STORE_B, { customerId: "customer2", total: 50000 }],
      ["visits", "visitA", STORE_A, {}],
      ["visits", "visitB", STORE_B, {}],
      ["coupons", "couponA", STORE_A, { customerId: "customer1" }],
      ["coupons", "couponB", STORE_B, { customerId: "customer2" }],
      ["ingredients", "ingA", STORE_A, {}],
      ["ingredients", "ingB", STORE_B, {}],
      ["expenses", "expA", STORE_A, {}],
      ["expenses", "expB", STORE_B, {}],
      ["menus", "menuA", STORE_A, {}],
      ["menus", "menuB", STORE_B, {}],
      ["shifts", "shiftA", STORE_A, { userId: "staffA" }],
      ["shifts", "shiftB", STORE_B, {}],
      ["Communications", "comA", STORE_A, {}],
      ["reservations", "resA", STORE_A, {}],
      ["marketingDrafts", "mdA", STORE_A, {}],
      ["print_jobs", "jobA", STORE_A, {}],
      ["print_jobs", "jobB", STORE_B, {}],
    ] as Array<[string, string, string, Record<string, unknown>]>) {
      await setDoc(doc(db, coll, id), { id, storeId: sid, ...extra });
    }
    await setDoc(doc(db, "store_secrets", STORE_A), { tossSecretKey: "test_sk_DO_NOT_LEAK" });
    await setDoc(doc(db, "pairing_codes", "123456"), { storeId: STORE_A });
    await setDoc(doc(db, "merchant_map", "m1"), { storeId: STORE_A });
    await setDoc(doc(db, "appState", "settings"), { masterPassword: "IMC" });
  });
});

// --- 요청자 컨텍스트 (= 서버가 발급할 Custom Token 의 claims) ---
const anon = () => testEnv.unauthenticatedContext().firestore();
const owner = (storeId: string) =>
  testEnv.authenticatedContext(storeId, { role: "owner" }).firestore();
const staff = (uid: string, storeId: string, level = 1, status = "approved") =>
  testEnv.authenticatedContext(uid, {
    role: "staff", staffLevel: level, employerStoreId: storeId, employerStatus: status,
  }).firestore();
const customer = (uid: string) =>
  testEnv.authenticatedContext(uid, { role: "customer" }).firestore();
const agent = (storeId: string) =>
  testEnv.authenticatedContext(storeId, { role: "print-bridge" }).firestore();
/** 익명 로그인만 한 사람 — claims 가 아예 없다. v3.1 에서 전권을 가졌던 바로 그 상태. */
const anonAuthed = () => testEnv.authenticatedContext("stranger").firestore();

const STORE_COLLECTIONS = [
  ["visits", "visitA", "visitB"],
  ["ingredients", "ingA", "ingB"],
  ["expenses", "expA", "expB"],
  ["shifts", "shiftA", "shiftB"],
] as const;

// ============================================================
describe("v4 · 익명 로그인만으로는 아무것도 못 한다", () => {
  it("[회귀] v3.1 취약점 — 남의 매장 손님 개인정보 읽기", async () => {
    await assertFails(getDoc(doc(anonAuthed(), "users", "customer1")));
  });

  it("[회귀] v3.1 취약점 — 남의 매장 주문 수정", async () => {
    await assertFails(
      setDoc(doc(anonAuthed(), "orders", "orderA"), { storeId: STORE_A, total: 0 })
    );
  });

  it("[회귀] v3.1 취약점 — 남의 매장에 쿠폰 발급", async () => {
    await assertFails(
      setDoc(doc(anonAuthed(), "coupons", "freeMoney"), {
        storeId: STORE_A, customerId: "customer1", discount: 100000,
      })
    );
  });

  it("[회귀] v3.1 취약점 — 매장 데이터 전반 읽기", async () => {
    for (const [coll, docA] of STORE_COLLECTIONS) {
      await assertFails(getDoc(doc(anonAuthed(), coll, docA)));
    }
  });

  it("비로그인은 여전히 전부 차단", async () => {
    await assertFails(getDoc(doc(anon(), "users", "customer1")));
    await assertFails(getDoc(doc(anon(), "orders", "orderA")));
  });
});

// ============================================================
describe("v4 · 매장 간 격리", () => {
  it("[회귀] v3.1 취약점 — A사장이 B매장 주문을 수정할 수 없다", async () => {
    await assertFails(
      setDoc(doc(owner(STORE_A), "orders", "orderB"), { storeId: STORE_B, total: 1 })
    );
  });

  it("사장은 자기 매장 데이터를 자유롭게 읽고 쓴다", async () => {
    for (const [coll, docA] of STORE_COLLECTIONS) {
      await assertSucceeds(getDoc(doc(owner(STORE_A), coll, docA)));
      await assertSucceeds(setDoc(doc(owner(STORE_A), coll, docA), { id: docA, storeId: STORE_A }));
    }
  });

  it("사장은 남의 매장 데이터를 읽지 못한다", async () => {
    for (const [coll, , docB] of STORE_COLLECTIONS) {
      await assertFails(getDoc(doc(owner(STORE_A), coll, docB)));
    }
  });

  it("[보안] 남의 매장 이름표를 달고 문서를 만들 수 없다", async () => {
    await assertFails(
      setDoc(doc(owner(STORE_A), "expenses", "planted"), { storeId: STORE_B, amount: 1 })
    );
  });

  it("[보안] 자기 매장 문서를 남의 매장으로 이전할 수 없다 — 데이터 빼돌리기 차단", async () => {
    await assertFails(
      setDoc(doc(owner(STORE_A), "expenses", "expA"), { id: "expA", storeId: STORE_B })
    );
  });

  it("[보안] 남의 매장 문서를 삭제할 수 없다", async () => {
    await assertFails(deleteDoc(doc(owner(STORE_A), "expenses", "expB")));
    await assertSucceeds(deleteDoc(doc(owner(STORE_A), "expenses", "expA")));
  });

  it("매장 데이터 쿼리는 자기 매장으로 좁힌 것만 통과한다", async () => {
    const db = owner(STORE_A);
    await assertSucceeds(
      getDocs(query(collection(db, "visits"), where("storeId", "==", STORE_A)))
    );
    // 필터 없는 전체 조회는 남의 매장까지 포함하므로 규칙이 거부한다.
    await assertFails(getDocs(collection(db, "visits")));
    await assertFails(
      getDocs(query(collection(db, "visits"), where("storeId", "==", STORE_B)))
    );
  });
});

// ============================================================
describe("v4 · 직원", () => {
  it("승인된 직원은 소속 매장 데이터를 다룬다", async () => {
    await assertSucceeds(getDoc(doc(staff("staffA", STORE_A), "orders", "orderA")));
    await assertSucceeds(
      setDoc(doc(staff("staffA", STORE_A), "orders", "orderA"), { storeId: STORE_A, total: 1 })
    );
  });

  it("[보안] 미승인(pending) 직원은 매장 데이터에 접근하지 못한다", async () => {
    const pending = staff("staffA", STORE_A, 1, "pending");
    await assertFails(getDoc(doc(pending, "orders", "orderA")));
    await assertFails(getDoc(doc(pending, "visits", "visitA")));
  });

  it("[보안] 직원은 다른 매장 데이터에 접근하지 못한다", async () => {
    await assertFails(getDoc(doc(staff("staffA", STORE_A), "orders", "orderB")));
  });

  it("[보안] 직원은 자기 등급을 스스로 올릴 수 없다", async () => {
    await assertFails(
      setDoc(doc(staff("staffA", STORE_A), "users", "staffA"), {
        id: "staffA", role: "staff", staffLevel: 4,
        employerStoreId: STORE_A, employerStatus: "approved", extraPerms: [],
      })
    );
  });

  it("[보안] 직원은 스스로를 사장으로 승격할 수 없다", async () => {
    await assertFails(
      setDoc(doc(staff("staffA", STORE_A), "users", "staffA"), {
        id: "staffA", role: "owner", staffLevel: 1,
        employerStoreId: STORE_A, employerStatus: "approved", extraPerms: [],
      })
    );
  });

  it("[보안] 직원은 추가권한(extraPerms)을 스스로 붙일 수 없다", async () => {
    await assertFails(
      setDoc(doc(staff("staffA", STORE_A), "users", "staffA"), {
        id: "staffA", role: "staff", staffLevel: 1,
        employerStoreId: STORE_A, employerStatus: "approved",
        extraPerms: ["/biz/owner/settlement"],
      })
    );
  });

  it("직원이 이름 같은 프로필 필드는 스스로 고칠 수 있다", async () => {
    await assertSucceeds(
      setDoc(doc(staff("staffA", STORE_A), "users", "staffA"), {
        id: "staffA", role: "staff", staffLevel: 1,
        employerStoreId: STORE_A, employerStatus: "approved", extraPerms: [],
        name: "새이름",
      })
    );
  });

  it("사장은 직원 등급을 올릴 수 있다", async () => {
    await assertSucceeds(
      setDoc(doc(owner(STORE_A), "users", "staffA"), {
        id: "staffA", role: "staff", staffLevel: 4,
        employerStoreId: STORE_A, employerStatus: "approved", extraPerms: [],
      })
    );
  });
});

// ============================================================
describe("v4 · 손님", () => {
  it("손님은 자기 주문만 읽는다", async () => {
    await assertSucceeds(getDoc(doc(customer("customer1"), "orders", "orderA")));
    await assertFails(getDoc(doc(customer("customer1"), "orders", "orderB")));
  });

  it("손님은 자기 쿠폰만 읽는다", async () => {
    await assertSucceeds(getDoc(doc(customer("customer1"), "coupons", "couponA")));
    await assertFails(getDoc(doc(customer("customer1"), "coupons", "couponB")));
  });

  it("손님은 매장 메뉴·테이블을 볼 수 있다 — QR 로 막 들어온 상태", async () => {
    await assertSucceeds(getDoc(doc(customer("customer1"), "menus", "menuA")));
    await assertSucceeds(getDoc(doc(customer("customer1"), "tables", "tableX")));
  });

  it("[보안] 손님은 메뉴 가격을 고칠 수 없다", async () => {
    await assertFails(
      setDoc(doc(customer("customer1"), "menus", "menuA"), { id: "menuA", storeId: STORE_A, price: 0 })
    );
  });

  it("[보안] 손님은 매장 매출·재고·정산을 볼 수 없다", async () => {
    const db = customer("customer1");
    await assertFails(getDoc(doc(db, "visits", "visitA")));
    await assertFails(getDoc(doc(db, "ingredients", "ingA")));
    await assertFails(getDoc(doc(db, "expenses", "expA")));
  });

  it("[보안] 손님은 남의 계정 정보를 읽을 수 없다", async () => {
    await assertSucceeds(getDoc(doc(customer("customer1"), "users", "customer1")));
    await assertFails(getDoc(doc(customer("customer1"), "users", STORE_A)));
  });

  it("[보안] 손님은 스스로를 사장으로 승격할 수 없다", async () => {
    await assertFails(
      setDoc(doc(customer("customer1"), "users", "customer1"), {
        id: "customer1", role: "owner", name: "김손님",
      })
    );
  });

  it("손님은 자기 이름·메모를 고칠 수 있다", async () => {
    await assertSucceeds(
      setDoc(doc(customer("customer1"), "users", "customer1"), {
        id: "customer1", role: "customer", name: "새이름", phone: "01011112222",
      })
    );
  });
});

// ============================================================
describe("v4 · 서버 전용·에이전트 (v3.1 에서 지키던 것 유지)", () => {
  it("[보안] 토스 시크릿·페어링 코드·merchant 역매핑은 누구도 못 읽는다", async () => {
    for (const db of [anonAuthed(), customer("customer1"), staff("staffA", STORE_A), owner(STORE_A)]) {
      await assertFails(getDoc(doc(db, "store_secrets", STORE_A)));
      await assertFails(getDoc(doc(db, "pairing_codes", "123456")));
      await assertFails(getDoc(doc(db, "merchant_map", "m1")));
    }
  });

  it("[보안] 프린트 에이전트는 자기 매장 인쇄 작업만 다룬다", async () => {
    await assertSucceeds(getDoc(doc(agent(STORE_A), "print_jobs", "jobA")));
    await assertFails(getDoc(doc(agent(STORE_A), "print_jobs", "jobB")));
    await assertSucceeds(
      setDoc(doc(agent(STORE_A), "print_jobs", "newA"), { storeId: STORE_A })
    );
    await assertFails(
      setDoc(doc(agent(STORE_A), "print_jobs", "newB"), { storeId: STORE_B })
    );
  });

  it("사장은 자기 매장 인쇄 작업을 만들 수 있다", async () => {
    await assertSucceeds(
      setDoc(doc(owner(STORE_A), "print_jobs", "fromOwner"), { storeId: STORE_A })
    );
    await assertFails(
      setDoc(doc(owner(STORE_A), "print_jobs", "toOther"), { storeId: STORE_B })
    );
  });

  it("규칙에 없는 컬렉션은 기본 거부", async () => {
    await assertFails(getDoc(doc(owner(STORE_A), "somethingNew", "x")));
    await assertFails(setDoc(doc(owner(STORE_A), "somethingNew", "x"), { a: 1 }));
  });

  it("appState 는 읽기만 열려 있고 쓰기는 사장만", async () => {
    await assertSucceeds(getDoc(doc(customer("customer1"), "appState", "settings")));
    await assertFails(
      setDoc(doc(customer("customer1"), "appState", "settings"), { masterPassword: "hacked" })
    );
    await assertSucceeds(
      setDoc(doc(owner(STORE_A), "appState", "settings"), { masterPassword: "new" })
    );
  });
});
