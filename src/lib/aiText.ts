/**
 * AI 텍스트 정화 유틸.
 *
 * 과거 마케팅/응대 생성기가 JSON({title,content,hashtags})으로 응답하던 시절의 데이터가
 * Firestore(ownerReply.text, marketingDrafts.content)에 그대로 저장돼 화면에 raw JSON 으로
 * 노출되는 사고를 방지한다. 평문이면 그대로 두고, JSON 으로 감싸졌으면 content 본문만 추출.
 *
 * 표시 직전(렌더)과 편집 진입 시 모두 적용해 과거 데이터까지 자동 정화한다.
 */
export function unwrapAiContent(text: string | null | undefined): string {
  if (!text) return "";
  let s = String(text).trim().replace(/```(?:json)?/gi, "").replace(/```/g, "").trim();
  if (s.startsWith("{") && /"content"\s*:/.test(s)) {
    // 1) 정상 JSON 이면 파싱해 content 사용
    try {
      const o = JSON.parse(s);
      if (o && typeof o.content === "string" && o.content.trim()) return finalize(o.content, o.hashtags);
    } catch {
      // 2) 본문 줄바꿈 등으로 파싱 실패해도 content 필드 값만 관대하게 추출
      const m = s.match(/"content"\s*:\s*"([\s\S]*?)"\s*[,}]/);
      if (m) return m[1].replace(/\\n/g, "\n").replace(/\\"/g, '"').replace(/\\t/g, " ").trim();
    }
  }
  return s;
}

function finalize(content: string, hashtags?: unknown): string {
  let c = String(content).trim();
  if (Array.isArray(hashtags) && hashtags.length && !/#/.test(c)) {
    const tags = hashtags
      .filter((t): t is string => typeof t === "string")
      .map((t) => (t.startsWith("#") ? t : `#${t.replace(/\s+/g, "")}`));
    if (tags.length) c += "\n\n" + tags.join(" ");
  }
  return c;
}
