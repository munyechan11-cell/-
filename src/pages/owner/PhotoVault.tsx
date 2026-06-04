import { useMemo, useRef, useState } from "react";
import { Camera, Trash2, Image as ImageIcon, Check, Link2, Star, MessageSquare } from "lucide-react";
import { OwnerShell } from "../../components/layout/OwnerShell";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { useStore } from "../../store/store";
import type { Photo } from "../../lib/types";
import { showToast } from "../../lib/toast";
import { useLanguage, t } from "../../lib/i18n";

// Firestore 문서 1MB 제한을 고려, base64 inflation 33% 감안하여 안전 한도 ~700KB
const MAX_BASE64_BYTES = 700_000;

export async function resizeImage(file: File, maxDim = 1280): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const tryEncode = (targetDim: number, quality: number): string => {
          const scale = Math.min(1, targetDim / Math.max(img.width, img.height));
          const w = Math.round(img.width * scale);
          const h = Math.round(img.height * scale);
          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d");
          if (!ctx) throw new Error("canvas");
          ctx.drawImage(img, 0, 0, w, h);
          return canvas.toDataURL("image/jpeg", quality);
        };

        try {
          // 점진적 다운스케일: 1280 → 1024 → 800 → 600 까지 크기 줄여가며 한도 맞춤
          const stages: [number, number][] = [
            [maxDim, 0.85],
            [1024, 0.82],
            [800, 0.78],
            [600, 0.72],
          ];
          let result = "";
          for (const [dim, q] of stages) {
            result = tryEncode(dim, q);
            if (result.length <= MAX_BASE64_BYTES) {
              return resolve(result);
            }
          }
          // 끝까지 줄였는데도 크면 그대로 반환 (Firestore에서 거부될 수 있음)
          resolve(result);
        } catch (e) {
          reject(e);
        }
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

type TabKey = "review" | "photo";
// 사진 보기 탭에서 어떤 type 의 사진을 새로 추가할지 — 기본은 메뉴
type PhotoAddType = "menu" | "customer";

export default function OwnerPhotoVault() {
  const { effectiveStoreId, photos, addPhoto, updatePhoto, deletePhoto } = useStore();
  const storeId = effectiveStoreId;
  const lang = useLanguage();
  const [tab, setTab] = useState<TabKey>("review");
  const [addType, setAddType] = useState<PhotoAddType>("menu");
  const [pairFrom, setPairFrom] = useState<Photo | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // 리뷰 탭: type==="review" 인 항목 (글/별점만 있어도 표시)
  const reviews = useMemo(
    () =>
      photos
        .filter((p) => p.storeId === storeId && p.type === "review")
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [photos, storeId]
  );
  // 사진 탭: imageData 가 있는 모든 항목 (menu/customer/review 통합)
  const allPhotos = useMemo(
    () =>
      photos
        .filter((p) => p.storeId === storeId && !!p.imageData)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [photos, storeId]
  );

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showToast(t("ophv.toast.invalidImage", lang), "error");
      return;
    }
    try {
      const data = await resizeImage(file);
      if (data.length > 950_000) {
        showToast(t("ophv.toast.tooBig", lang), "error");
        return;
      }
      await addPhoto({ storeId, type: addType, imageData: data });
      showToast(t("ophv.toast.added", lang), "success");
    } catch {
      showToast(t("ophv.toast.procFail", lang), "error");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const togglePair = async (target: Photo) => {
    if (!pairFrom) {
      setPairFrom(target);
      showToast(t("ophv.toast.pickPair", lang), "info");
      return;
    }
    if (pairFrom.id === target.id || pairFrom.type === target.type) {
      showToast(t("ophv.toast.diffType", lang), "error");
      setPairFrom(null);
      return;
    }
    await Promise.all([
      updatePhoto(pairFrom.id, { pairedPhotoId: target.id }),
      updatePhoto(target.id, { pairedPhotoId: pairFrom.id }),
    ]);
    showToast(t("ophv.toast.paired", lang), "success");
    setPairFrom(null);
  };

  // 리뷰 통계 — 별점 평균 / 개수
  const reviewStats = useMemo(() => {
    const rated = reviews.filter((r) => typeof r.rating === "number" && r.rating! > 0);
    const avg =
      rated.length > 0
        ? rated.reduce((s, r) => s + (r.rating ?? 0), 0) / rated.length
        : 0;
    return { count: reviews.length, ratedCount: rated.length, avg };
  }, [reviews]);

  return (
    <OwnerShell
      title={t("ophv.title", lang)}
      headerRight={
        tab === "photo" ? (
          <button
            onClick={() => fileRef.current?.click()}
            className="h-10 px-4 rounded-full bg-[var(--color-navy-700)] text-white inline-flex items-center gap-1.5 text-[13px] font-bold shadow-[var(--shadow-navy)]"
          >
            <Camera className="w-4 h-4" />
            {t("ophv.addPhoto", lang)}
          </button>
        ) : null
      }
    >
      <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={onPick} />

      <div>
        {/* 메인 탭: 리뷰 보기 / 사진 보기 */}
        <div className="grid grid-cols-2 gap-1 p-1 bg-[var(--color-navy-50)] rounded-[14px] max-w-xs">
          {(["review", "photo"] as const).map((tabKey) => (
            <button
              key={tabKey}
              onClick={() => setTab(tabKey)}
              className={`h-10 rounded-[10px] text-[12px] font-bold ${
                tab === tabKey ? "bg-white text-[var(--color-navy-800)]" : "text-[var(--color-ink-500)]"
              }`}
            >
              {tabKey === "review" ? t("ophv.tab.review", lang) : t("ophv.tab.photo", lang)}
            </button>
          ))}
        </div>

        {/* ===== 리뷰 보기 ===== */}
        {tab === "review" && (
          <>
            {/* 별점 요약 */}
            {reviews.length > 0 && (
              <Card padding="md" className="mt-3 flex items-center gap-4">
                <div className="flex items-center gap-1">
                  <Star className="w-5 h-5 fill-[#f59e0b] text-[#f59e0b]" />
                  <span className="text-[20px] font-extrabold text-[var(--color-navy-900)] tabular-nums">
                    {reviewStats.avg > 0 ? reviewStats.avg.toFixed(1) : "—"}
                  </span>
                </div>
                <div className="text-[12px] text-[var(--color-ink-500)] font-semibold">
                  {t("ophv.review.summary", lang, { count: reviewStats.count, rated: reviewStats.ratedCount })}
                </div>
              </Card>
            )}

            {reviews.length === 0 ? (
              <Card padding="lg" className="text-center text-[14px] text-[var(--color-ink-500)] mt-4">
                <MessageSquare className="w-8 h-8 text-[var(--color-ink-300)] mx-auto mb-2" />
                {t("ophv.review.empty", lang)}
                <p className="text-[12px] text-[var(--color-ink-400)] mt-1 font-medium">
                  {t("ophv.review.emptyDesc", lang)}
                </p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4 pb-8">
                {reviews.map((r) => {
                  const locale = lang === "ko" ? "ko-KR" : lang === "zh" ? "zh-CN" : lang === "vi" ? "vi-VN" : "en-US";
                  return (
                  <Card key={r.id} padding="md" className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      {typeof r.rating === "number" && r.rating > 0 ? (
                        <div className="flex items-center gap-0.5">
                          {[1, 2, 3, 4, 5].map((n) => (
                            <Star
                              key={n}
                              className={`w-4 h-4 ${
                                n <= (r.rating ?? 0)
                                  ? "fill-[#f59e0b] text-[#f59e0b]"
                                  : "text-[var(--color-ink-200)]"
                              }`}
                            />
                          ))}
                          <span className="ml-1 text-[12px] font-bold text-[var(--color-navy-700)] tabular-nums">
                            {t("ophv.review.rating", lang, { n: r.rating ?? 0 })}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[11px] font-bold text-[var(--color-ink-400)]">
                          {t("ophv.review.noRating", lang)}
                        </span>
                      )}
                      <span className="ml-auto text-[11px] text-[var(--color-ink-400)] font-semibold tabular-nums">
                        {new Date(r.createdAt).toLocaleDateString(locale, {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                      <button
                        onClick={() => {
                          if (confirm(t("ophv.review.deleteConfirm", lang))) deletePhoto(r.id);
                        }}
                        className="w-7 h-7 rounded-full hover:bg-[var(--color-danger)]/10 inline-flex items-center justify-center text-[var(--color-danger)]"
                        aria-label={t("ophv.review.deleteAria", lang)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {r.imageData && (
                      <img
                        src={r.imageData}
                        alt=""
                        className="w-full max-h-60 object-cover rounded-xl bg-[var(--color-ink-50)]"
                      />
                    )}
                    {r.reviewText && (
                      <p className="text-[13.5px] text-[var(--color-navy-900)] break-keep leading-relaxed">
                        {r.reviewText}
                      </p>
                    )}
                    <p className="text-[11px] text-[var(--color-ink-500)] font-semibold">
                      {r.customerName ?? t("ophv.review.anonymous", lang)}
                      {r.tableNumber ? t("ophv.review.tableSuffix", lang, { n: r.tableNumber }) : ""}
                    </p>
                  </Card>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ===== 사진 보기 ===== */}
        {tab === "photo" && (
          <>
            {/* 사진 추가 시 분류 선택 */}
            <div className="flex items-center gap-2 mt-3">
              <span className="text-[12px] font-bold text-[var(--color-ink-500)]">{t("ophv.addType.label", lang)}</span>
              {(["menu", "customer"] as const).map((typ) => (
                <button
                  key={typ}
                  onClick={() => setAddType(typ)}
                  className={`h-8 px-3 rounded-full text-[12px] font-bold border ${
                    addType === typ
                      ? "bg-[var(--color-navy-700)] text-white border-transparent"
                      : "bg-white text-[var(--color-ink-600)] border-[var(--color-line)]"
                  }`}
                >
                  {typ === "menu" ? t("ophv.addType.menu", lang) : t("ophv.addType.customer", lang)}
                </button>
              ))}
            </div>

            {pairFrom && (
              <Card padding="md" className="mt-3 bg-[var(--color-mint-100)] border-transparent">
                <p className="text-[12px] font-bold text-[var(--color-mint-700)]">
                  {pairFrom.type === "menu" ? t("ophv.pairHint.customer", lang) : t("ophv.pairHint.menu", lang)}
                </p>
                <Button size="md" variant="ghost" className="mt-2" onClick={() => setPairFrom(null)}>{t("ophv.pairCancel", lang)}</Button>
              </Card>
            )}

            {allPhotos.length === 0 ? (
              <Card padding="lg" className="text-center text-[14px] text-[var(--color-ink-500)] mt-4">
                <ImageIcon className="w-8 h-8 text-[var(--color-ink-300)] mx-auto mb-2" />
                {t("ophv.photo.empty", lang)}
              </Card>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 mt-4 pb-8">
                {allPhotos.map((p) => (
                  <div key={p.id} className="relative group rounded-2xl overflow-hidden bg-[var(--color-ink-50)] aspect-square">
                    <img src={p.imageData} alt="" className="w-full h-full object-cover" />
                    {p.type === "review" && (
                      <span className="absolute top-2 left-2 bg-[#f59e0b] text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                        {t("ophv.photo.reviewBadge", lang)}
                      </span>
                    )}
                    {p.pairedPhotoId && (
                      <span className="absolute top-2 left-2 bg-[var(--color-mint-500)] text-white text-[11px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                        <Link2 className="w-3 h-3" />
                        {t("ophv.photo.pairBadge", lang)}
                      </span>
                    )}
                    {p.type === "menu" && (
                      <button
                        onClick={() =>
                          updatePhoto(p.id, {
                            snsConsent: !p.snsConsent,
                            // null로 명시해야 Firestore에서 필드가 실제로 비워짐 (undefined는 merge 시 변경 없음)
                            consentedAt: !p.snsConsent ? new Date().toISOString() : (null as any),
                          })
                        }
                        className={`absolute top-2 right-2 text-[11px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${
                          p.snsConsent ? "bg-[var(--color-navy-700)] text-white" : "bg-white/80 text-[var(--color-ink-700)]"
                        }`}
                      >
                        <Check className="w-3 h-3" />
                        SNS
                      </button>
                    )}
                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent p-2 flex gap-1">
                      {p.type !== "review" && (
                        <button
                          onClick={() => togglePair(p)}
                          className="flex-1 h-8 rounded bg-white/90 text-[11px] font-bold text-[var(--color-navy-700)]"
                        >
                          {pairFrom?.id === p.id ? t("ophv.photo.pickedBtn", lang) : t("ophv.photo.pairBtn", lang)}
                        </button>
                      )}
                      <button
                        onClick={() => {
                          if (confirm(t("ophv.photo.deleteConfirm", lang))) deletePhoto(p.id);
                        }}
                        className="w-7 h-7 rounded bg-white/90 inline-flex items-center justify-center text-[var(--color-danger)] ml-auto"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </OwnerShell>
  );
}
