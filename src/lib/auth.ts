import { signInWithPopup, signOut } from "firebase/auth";
import { auth, googleProvider } from "./firebase";

export interface SocialResult {
  provider: "google" | "kakao";
  id: string;
  name?: string;
  email?: string;
  avatarUrl?: string;
}

export async function signInWithGoogle(): Promise<SocialResult> {
  if (!auth) throw new Error("Firebase Auth가 설정되지 않았습니다.");
  const res = await signInWithPopup(auth, googleProvider);
  const u = res.user;
  return {
    provider: "google",
    id: u.uid,
    name: u.displayName ?? undefined,
    email: u.email ?? undefined,
    avatarUrl: u.photoURL ?? undefined,
  };
}

export async function signInWithKakao(): Promise<SocialResult> {
  const Kakao = (window as any).Kakao;
  if (!Kakao) throw new Error("Kakao SDK가 로드되지 않았습니다.");
  if (!Kakao.isInitialized()) throw new Error("Kakao SDK가 초기화되지 않았습니다.");

  await new Promise<void>((resolve, reject) => {
    Kakao.Auth.login({
      success: () => resolve(),
      fail: (err: any) => reject(err),
    });
  });

  const userInfo = await new Promise<any>((resolve, reject) => {
    Kakao.API.request({
      url: "/v2/user/me",
      success: (r: any) => resolve(r),
      fail: (e: any) => reject(e),
    });
  });

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
  if (Kakao?.Auth?.getAccessToken?.()) {
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
