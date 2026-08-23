#!/usr/bin/env node
/**
 * 결(Gyeol) DB 닥터 — 서버 가동 전 데이터베이스·인증 점검기
 *
 * 왜 필요한가:
 *   결의 로그인/회원가입은 Firebase Auth 가 아니라 **Firestore `users` 컬렉션**에
 *   의존한다(익명 토큰으로 규칙 게이트만 통과 + 앱 자체 ID 매칭).
 *   그래서 Auth 가 멀쩡해도 Firestore 가 막히면 증상은 "회원가입·로그인이 안 됨"
 *   하나로만 나타나고, 진짜 원인(결제 미설정·규칙 미배포·DB 미생성)이 안 보인다.
 *   이 스크립트는 앱이 실제로 밟는 순서 그대로 찔러서 어느 단계가 끊겼는지 짚어준다.
 *
 * 사용법:
 *   node scripts/db-doctor.mjs
 *   node scripts/db-doctor.mjs --project 다른프로젝트 --key AIza...
 *
 * 종료 코드: 0 = 정상, 1 = 문제 발견
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// ── 인자 파싱 ────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const arg = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};

// ── 설정 로드 (앱과 동일한 우선순위: env → firebase-applet-config.json) ────────
let fileConfig = {};
try {
  fileConfig = JSON.parse(readFileSync(resolve(ROOT, "firebase-applet-config.json"), "utf8"));
} catch {
  /* 파일이 없으면 env 만으로 진행 */
}

const projectId =
  arg("project") || process.env.VITE_FIREBASE_PROJECT_ID || fileConfig.projectId;
const apiKey = arg("key") || process.env.VITE_FIREBASE_API_KEY || fileConfig.apiKey;
const databaseId =
  arg("database") || process.env.VITE_FIREBASE_DATABASE_ID || fileConfig.firestoreDatabaseId || "(default)";

// firestore.rules 에 선언된 컬렉션 중 앱 부팅에 필수인 것들
const CRITICAL_COLLECTIONS = ["users", "appState"];

// ── 출력 헬퍼 ────────────────────────────────────────────────────────────────
const problems = [];
const ok = (m) => console.log(`  ✅ ${m}`);
const bad = (m, fix) => {
  console.log(`  ❌ ${m}`);
  problems.push({ msg: m, fix });
};
const warn = (m) => console.log(`  ⚠️  ${m}`);
const step = (n, title) => console.log(`\n[${n}] ${title}`);

const fetchJson = async (url, init) => {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(20000) });
  let body;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { status: res.status, body };
};

console.log("═".repeat(64));
console.log(" 결(Gyeol) DB 닥터 — 데이터베이스·인증 점검");
console.log("═".repeat(64));

// ── 1. 설정 ─────────────────────────────────────────────────────────────────
step(1, "클라이언트 설정");
if (!projectId) bad("projectId 를 찾을 수 없음", "firebase-applet-config.json 또는 VITE_FIREBASE_PROJECT_ID 설정");
else ok(`projectId = ${projectId}`);

if (!apiKey || apiKey === "YOUR_API_KEY" || apiKey === "undefined") {
  bad("apiKey 가 비어 있거나 placeholder", "VITE_FIREBASE_API_KEY 설정 — 이 값이 없으면 앱은 isFirebaseConfigured=false 로 전체 오프라인 모드가 된다");
} else {
  ok(`apiKey = ${apiKey.slice(0, 10)}…${apiKey.slice(-4)}`);
}
ok(`databaseId = ${databaseId}`);

if (!projectId || !apiKey) {
  console.log("\n설정이 없어 더 진행할 수 없습니다.");
  process.exit(1);
}

// ── 2. Firebase Auth (익명 로그인) ───────────────────────────────────────────
step(2, "Firebase Auth — 익명 로그인 (ensureAnonymousAuth 가 하는 일)");
let idToken = null;
{
  const { status, body } = await fetchJson(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ returnSecureToken: true }),
    }
  );
  if (status === 200 && body?.idToken) {
    idToken = body.idToken;
    ok(`익명 로그인 성공 (uid=${body.localId})`);
  } else {
    const reason = body?.error?.message ?? `HTTP ${status}`;
    if (reason.includes("ADMIN_ONLY_OPERATION") || reason.includes("OPERATION_NOT_ALLOWED")) {
      bad(
        `익명 로그인 차단됨 — ${reason}`,
        "Firebase 콘솔 → Authentication → Sign-in method → '익명' 사용 설정. " +
          "익명 로그인이 꺼져 있으면 firestore.rules 의 request.auth != null 게이트를 못 넘어 전 컬렉션 읽기/쓰기가 막힌다."
      );
    } else if (reason.includes("API_KEY")) {
      bad(`API 키 거부 — ${reason}`, "VITE_FIREBASE_API_KEY 값 확인, 그리고 키의 HTTP 리퍼러 제한에 배포 도메인 등록");
    } else {
      bad(`익명 로그인 실패 — ${reason}`, "Firebase 콘솔 → Authentication 설정 확인");
    }
  }
}

// ── 3. Firestore 접근 ────────────────────────────────────────────────────────
step(3, "Firestore — 컬렉션 읽기 (users 리스너가 하는 일)");
const encodedDb = encodeURIComponent(databaseId);
let firestoreReachable = true;

for (const coll of CRITICAL_COLLECTIONS) {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${encodedDb}/documents/${coll}?pageSize=1`;
  const { status, body } = await fetchJson(url, {
    headers: idToken ? { Authorization: `Bearer ${idToken}` } : {},
  });
  const msg = body?.error?.message ?? "";

  if (status === 200) {
    const n = body?.documents?.length ?? 0;
    ok(`${coll} 읽기 성공 (문서 ${n === 0 ? "0개 — 비어 있음" : n + "개+"})`);
    if (coll === "users" && n === 0) {
      warn("users 가 비어 있음 — DB 는 살아있지만 계정이 하나도 없다. 로그인은 당연히 실패하고, 회원가입부터 해야 한다.");
    }
    continue;
  }

  firestoreReachable = false;

  if (msg.includes("requires billing")) {
    bad(
      `${coll} 접근 거부 — 프로젝트 '${projectId}' 에 결제(billing) 가 설정되어 있지 않아 Firestore API 자체가 차단됨`,
      `https://console.cloud.google.com/billing/enable?project=${projectId} 에서 결제 계정 연결(Blaze 요금제). ` +
        "※ 이건 보안 규칙 문제가 아니다 — 인증 토큰 없이 호출해도 같은 403 이 나오는, 프로젝트 레벨 차단이다. " +
        "복구 전까지 회원가입·로그인·모든 매장 데이터가 100% 동작하지 않는다."
    );
  } else if (status === 403 && msg.includes("Missing or insufficient permissions")) {
    bad(
      `${coll} 접근 거부 — 보안 규칙에서 막힘`,
      "firebase deploy --only firestore:rules 로 firestore.rules 배포. " +
        "콘솔에 옛 규칙(allow if false)이 남아 있을 가능성."
    );
  } else if (status === 404 && msg.includes("does not exist")) {
    bad(
      `Firestore 데이터베이스 '${databaseId}' 가 존재하지 않음`,
      "Firebase 콘솔 → Firestore Database → 데이터베이스 만들기 (Native 모드)."
    );
  } else if (status === 401) {
    bad(`${coll} 인증 실패 — 토큰이 거부됨`, "2단계(익명 로그인) 결과를 먼저 확인");
  } else {
    bad(`${coll} 접근 실패 — HTTP ${status}: ${msg || "(본문 없음)"}`, "위 메시지를 그대로 확인");
  }
  break; // 같은 원인일 테니 한 번만 보고
}

// ── 4. 서버(Admin SDK) 자격증명 ──────────────────────────────────────────────
step(4, "서버 Admin SDK 자격증명 (server.ts)");
{
  const missing = ["FIREBASE_PROJECT_ID", "FIREBASE_CLIENT_EMAIL", "FIREBASE_PRIVATE_KEY"].filter(
    (k) => !process.env[k]
  );
  if (missing.length === 3) {
    warn("Admin SDK 환경변수가 하나도 없음 — 로컬 셸에서 돌렸다면 정상(배포 환경에만 있을 수 있음). 배포 서버라면 문제.");
  } else if (missing.length > 0) {
    bad(`Admin SDK 환경변수 일부 누락: ${missing.join(", ")}`, "Render 대시보드(gyeol-api) 환경변수에 3개 모두 등록");
  } else {
    ok("FIREBASE_PROJECT_ID / CLIENT_EMAIL / PRIVATE_KEY 모두 존재");
    if (process.env.FIREBASE_PROJECT_ID !== projectId) {
      bad(
        `서버(${process.env.FIREBASE_PROJECT_ID})와 클라이언트(${projectId}) 의 projectId 불일치`,
        "두 값을 같은 프로젝트로 맞출 것 — 다르면 서버가 쓴 데이터를 앱이 절대 못 읽는다"
      );
    }
  }
}

// ── 결과 ────────────────────────────────────────────────────────────────────
console.log("\n" + "═".repeat(64));
if (problems.length === 0) {
  console.log(" 진단 결과: 이상 없음 — 회원가입·로그인 경로의 DB 의존성은 정상입니다.");
  console.log("═".repeat(64));
  process.exit(0);
}

console.log(` 진단 결과: 문제 ${problems.length}건`);
console.log("═".repeat(64));
problems.forEach((p, i) => {
  console.log(`\n${i + 1}. ${p.msg}`);
  console.log(`   → 조치: ${p.fix}`);
});

if (!firestoreReachable) {
  console.log(
    "\n※ Firestore 가 막힌 상태에서는 회원가입·로그인이 '계정이 없습니다' 처럼 보이지만," +
      "\n   실제로는 users 컬렉션을 아예 못 읽는 것입니다. 위 조치가 끝나야 복구됩니다."
  );
}
console.log("");
process.exit(1);
