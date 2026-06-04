import { signInWithPopup, signInWithRedirect, signOut, getRedirectResult } from "firebase/auth";
import { auth, googleProvider } from "./firebase";

// iOS Safari·인앱 브라우저는 third-party 쿠키 차단으로 팝업 OAuth가 자주 실패
// → 자동 감지 후 redirect 방식으로 fallback
function shouldUseRedirect(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  // 인앱 브라우저(카톡·네이버·라인·인스타·페북)에서만 강제 redirect — iOS Safari는 일단 팝업 시도
  return /KAKAOTALK|NAVER|Line|Instagram|FBAN|FBAV/i.test(ua);
}

export interface SocialResult {
  provider: "google" | "kakao";
  id: string;
  name?: string;
  email?: string;
  avatarUrl?: string;
}

export async function signInWithGoogle(): Promise<SocialResult> {
  if (!auth) throw new Error("Firebase Auth가 설정되지 않았습니다.");
  // 인앱 브라우저 감지 시 미리 redirect로 — 팝업이 차단되거나 화면 밖에서 열려 사용자가 인지 못 하는 사고 방지
  if (shouldUseRedirect()) {
    sessionStorage.setItem("gyeol:pending-google-redirect", "1");
    await signInWithRedirect(auth, googleProvider);
    throw new Error("REDIRECT_IN_PROGRESS");
  }
  try {
    const res = await signInWithPopup(auth, googleProvider);
    const u = res.user;
    return {
      provider: "google",
      id: u.uid,
      name: u.displayName ?? undefined,
      email: u.email ?? undefined,
      avatarUrl: u.photoURL ?? undefined,
    };
  } catch (e: any) {
    const code = String(e?.code ?? "");
    // 팝업 차단 시 친화 메시지
    if (code === "auth/popup-blocked") {
      throw new Error("팝업이 차단됐어요. 브라우저 주소창의 팝업 차단 아이콘을 풀고 다시 시도해 주세요.");
    }
    if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
      throw new Error("Google 로그인이 취소되었습니다.");
    }
    if (code === "auth/network-request-failed") {
      throw new Error("네트워크가 불안정해요. 잠시 후 다시 시도해 주세요.");
    }
    throw e;
  }
}

// 앱 부팅 시점에 호출해 리다이렉트 결과 회수 — null이면 처리할 게 없음
export async function consumeGoogleRedirect(): Promise<SocialResult | null> {
  if (!auth) return null;
  const flag = sessionStorage.getItem("gyeol:pending-google-redirect");
  if (!flag) return null;
  sessionStorage.removeItem("gyeol:pending-google-redirect");
  try {
    const res = await getRedirectResult(auth);
    if (!res?.user) return null;
    const u = res.user;
    return {
      provider: "google",
      id: u.uid,
      name: u.displayName ?? undefined,
      email: u.email ?? undefined,
      avatarUrl: u.photoURL ?? undefined,
    };
  } catch {
    return null;
  }
}

const KAKAO_JS_KEY = "c80827032123a3e018388749472f759d";

async function ensureKakaoReady(): Promise<any> {
  // SDK 로딩 대기 — 약한 와이파이/3G 대응 위해 6초까지
  const deadline = Date.now() + 6000;
  while (!(window as any).Kakao && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 100));
  }
  const Kakao = (window as any).Kakao;
  if (!Kakao) {
    throw new Error("카카오 로그인을 불러오지 못했어요. 네트워크가 약한 경우 전화번호로 가입을 시도해 주세요.");
  }
  // index.html 인라인 초기화가 SDK 보다 먼저 실행돼 누락된 경우 복구
  if (!Kakao.isInitialized()) {
    try {
      Kakao.init(KAKAO_JS_KEY);
    } catch (e: any) {
      throw new Error(`카카오 로그인 초기화 실패: ${e?.message ?? "알 수 없는 오류"}. 전화번호 가입을 시도해 주세요.`);
    }
  }
  return Kakao;
}

// Kakao JS SDK가 버전에 따라 콜백/Promise 양쪽을 쓰는 문제 해결용 어댑터.
// success/fail 콜백과 반환 Promise 중 먼저 settle 되는 쪽을 잡고, 타임아웃 안전망까지 건다.
function callKakaoApi<T>(
  fn: (opts: any) => any,
  opts: Record<string, any>,
  timeoutMs: number,
  timeoutMsg: string
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const done = (v: T) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(v);
    };
    const err = (e: any) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(e instanceof Error ? e : new Error(e?.error_description ?? e?.msg ?? String(e?.message ?? e ?? "unknown")));
    };
    const timer = setTimeout(() => err(new Error(timeoutMsg)), timeoutMs);
    try {
      const ret = fn({ ...opts, success: done, fail: err });
      // 신버전 SDK: Promise 반환
      if (ret && typeof ret.then === "function") {
        ret.then(done, err);
      }
    } catch (e) {
      err(e);
    }
  });
}

export async function signInWithKakao(): Promise<SocialResult> {
  const Kakao = await ensureKakaoReady();
  if (!Kakao.Auth?.login || !Kakao.API?.request) {
    throw new Error("Kakao SDK가 손상되었어요. 페이지를 새로고침해 주세요.");
  }

  await callKakaoApi<void>(
    Kakao.Auth.login.bind(Kakao.Auth),
    {
      // 이메일·프로필 동의 화면이 일관되게 뜨도록 scope 명시
      scope: "profile_nickname,profile_image,account_email",
      // 모바일에서 카카오톡 앱으로 빠져 콜백을 못 받는 케이스 차단
      throughTalk: false,
    },
    60000,
    "카카오 인증 응답이 없어요. 팝업 차단 여부를 확인해 주세요."
  );

  const userInfo = await callKakaoApi<any>(
    Kakao.API.request.bind(Kakao.API),
    { url: "/v2/user/me" },
    10000,
    "카카오 사용자 정보 조회 시간이 초과됐어요."
  );

  const account = userInfo.kakao_account ?? {};
  const profile = account.profile ?? {};
  return {
    provider: "kakao",
    id: String(userInfo.id),
    name: profile.nickname,
    email: account.email,
    avatarUrl: profile.thumbnail_image_url,
  };
}

export async function signOutAll() {
  if (auth) {
    try {
      await signOut(auth);
    } catch {}
  }
  const Kakao = (window as any).Kakao;
  if (Kakao?.Auth?.getAccessToken?.() && Kakao.Auth.logout) {
    try {
      await new Promise((r) => Kakao.Auth.logout(r));
    } catch {}
  }
}

export function calculateAgeGroup(birthYear: number): string {
  const now = new Date().getFullYear();
  const age = now - birthYear;
  if (age < 20) return "10대";
  if (age < 30) return "20대";
  if (age < 40) return "30대";
  if (age < 50) return "40대";
  if (age < 60) return "50대";
  return "60대 이상";
}
