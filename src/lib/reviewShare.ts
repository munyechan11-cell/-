// ============================================================
// 리뷰 SNS 공유 헬퍼 (마케팅 비서 업그레이드)
//
// 흐름: 손님이 리뷰 작성 → AI가 '포장'(공유용 1인칭 캡션) → 버튼 한 번에
//       자기 구글/인스타에 올림 → 공유 1건 적재(store.recordReviewShare).
//
// ⚠️ 플랫폼 정책상 '사람 손 없는 완전 무인 업로드'는 구글·인스타 모두 불가:
//   · 구글 리뷰는 작성 API 자체가 없음 → 매장 리뷰 작성창을 열어줌(writereview).
//   · 인스타 개인 계정은 API 게시 불가 → Web Share(이미지+캡션) 또는 앱 열기.
//   따라서 '캡션 자동 작성 + 한 번에 작성창 열기 + 공유 추적'이 실제 가능한 최선이다.
// ============================================================
import { api } from "./api";
import { t, type Lang } from "./i18n";

export interface ReviewForShare {
  storeName: string;
  rating?: number;
  title?: string;
  text?: string;
  /** review.tag.* 태그 id 목록 */
  tags?: string[];
  recommend?: boolean;
  /** 사장님이 설정한 기본 해시태그 (쉼표/띄어쓰기 구분) */
  hashtags?: string;
  lang: Lang;
}

// 별점 → 별 이모지 (예: 4 → ★★★★☆)
const stars = (n?: number): string =>
  n && n > 0 ? "★".repeat(Math.min(5, n)) + "☆".repeat(Math.max(0, 5 - n)) : "";

// 해시태그 정규화: "맛집, 카페 #포항" + ["가게명"] → "#맛집 #카페 #포항 #가게명"
export function normalizeHashtags(raw?: string, extra: string[] = []): string {
  const parts = [...(raw ?? "").split(/[\s,]+/), ...extra]
    .map((s) => s.trim().replace(/^#+/, "").replace(/\s+/g, ""))
    .filter(Boolean);
  const uniq = Array.from(new Set(parts));
  return uniq.map((p) => `#${p}`).join(" ");
}

/**
 * 로컬 스마트 '포장' — 백엔드 없이 즉시 동작하는 1인칭 공유 캡션 생성.
 * 서버 LLM(polishReviewCaption)이 실패하면 이걸로 폴백한다.
 */
export function composeReviewCaption(r: ReviewForShare): string {
  const lines: string[] = [];
  const head = [r.storeName, stars(r.rating)].filter(Boolean).join(" ");
  if (head) lines.push(head);
  if (r.title?.trim()) lines.push(r.title.trim());
  if (r.text?.trim()) lines.push(r.text.trim());

  const tagLabels = (r.tags ?? [])
    .map((id) => t(`review.tag.${id}`, r.lang))
    .filter((s) => s && !s.startsWith("review.tag."));
  if (r.recommend) tagLabels.unshift(t("share.recommendBadge", r.lang));
  if (tagLabels.length) {
    lines.push(tagLabels.map((x) => `#${x.replace(/\s+/g, "")}`).join(" "));
  }

  const tail = normalizeHashtags(r.hashtags, [r.storeName]);
  if (tail) lines.push(tail);
  return lines.join("\n");
}

/**
 * 서버 LLM '포장' best-effort → 실패(엔드포인트 부재·오류·오프라인) 시 로컬 폴백.
 * 별도 repo(gyeol)의 POST /api/marketing/polish-review 가 배포되면 자동으로 업그레이드된다.
 * 응답: { caption: string }
 */
export async function polishReviewCaption(
  r: ReviewForShare,
  storeId: string,
  signal?: AbortSignal
): Promise<{ caption: string; ai: boolean }> {
  const local = composeReviewCaption(r);
  try {
    const res = await fetch(api("/api/marketing/polish-review"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        storeId,
        storeName: r.storeName,
        rating: r.rating,
        reviewTitle: r.title,
        reviewText: r.text,
        tags: r.tags,
        recommend: r.recommend,
        hashtags: r.hashtags,
        lang: r.lang,
      }),
      signal,
    });
    if (res.ok) {
      const d = (await res.json().catch(() => ({}))) as { caption?: string };
      if (d.caption?.trim()) return { caption: d.caption.trim(), ai: true };
    }
  } catch {
    // 네트워크 끊김 / 엔드포인트 미배포 / 사용자 취소 — 로컬 폴백
  }
  return { caption: local, ai: false };
}

/** 클립보드 복사 (구형 브라우저 execCommand 폴백 포함). */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // 권한 거부 등 — execCommand 폴백 시도
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

/** 구글 리뷰 작성창 열기 — placeId 있으면 정확, 없으면 매장명 지도 검색으로 폴백. */
export function openGoogleReview(placeId: string | undefined, storeName: string): void {
  const url = placeId?.trim()
    ? `https://search.google.com/local/writereview?placeid=${encodeURIComponent(placeId.trim())}`
    : `https://www.google.com/maps/search/${encodeURIComponent(storeName)}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

/**
 * 인스타 공유 — 모바일이면 Web Share(이미지+캡션)로 공유 시트, 데스크톱이면 instagram.com 열기.
 * 반환: "shared"=네이티브 공유 시트 사용(취소 포함), "opened"=인스타 웹/앱 열기 폴백.
 */
export async function shareToInstagram(
  caption: string,
  imageDataUrl?: string
): Promise<"shared" | "opened"> {
  const nav = navigator as Navigator & {
    canShare?: (data?: ShareData) => boolean;
    share?: (data?: ShareData) => Promise<void>;
  };
  if (typeof nav.share === "function") {
    try {
      if (imageDataUrl && typeof nav.canShare === "function") {
        const blob = await (await fetch(imageDataUrl)).blob();
        const file = new File([blob], "review.jpg", { type: blob.type || "image/jpeg" });
        if (nav.canShare({ files: [file] })) {
          await nav.share({ files: [file], text: caption });
          return "shared";
        }
      }
      await nav.share({ text: caption });
      return "shared";
    } catch (e) {
      // 사용자가 시트를 닫음(AbortError) → 중복 오픈 방지를 위해 폴백하지 않음
      if ((e as DOMException)?.name === "AbortError") return "shared";
      // 그 외 오류 → 인스타 열기 폴백
    }
  }
  window.open("https://www.instagram.com/", "_blank", "noopener,noreferrer");
  return "opened";
}
