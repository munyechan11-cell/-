import { useMemo, useRef, useState } from "react";
import { Camera, Trash2, Image as ImageIcon, Check, Link2 } from "lucide-react";
import { OwnerShell } from "../../components/layout/OwnerShell";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { useStore } from "../../store/store";
import type { Photo } from "../../lib/types";
import { showToast } from "../../lib/toast";

// Firestore 문서 1MB 제한을 고려, base64 inflation 33% 감안하여 안전 한도 ~700KB
const MAX_BASE64_BYTES = 700_000;

async function resizeImage(file: File, maxDim = 1280): Promise<string> {
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

export default function OwnerPhotoVault() {
  const { currentUser, photos, addPhoto, updatePhoto, deletePhoto } = useStore();
  const storeId = currentUser?.id ?? "";
  const [tab, setTab] = useState<"menu" | "customer">("menu");
  const [pairFrom, setPairFrom] = useState<Photo | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(
    () =>
      photos
        .filter((p) => p.storeId === storeId && p.type === tab)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [photos, storeId, tab]
  );

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showToast("이미지 파일만 업로드할 수 있어요.", "error");
      return;
    }
    try {
      const data = await resizeImage(file);
      if (data.length > 950_000) {
        showToast("이미지가 너무 큽니다. 더 작은 사진을 사용해 주세요.", "error");
        return;
      }
      await addPhoto({ storeId, type: tab, imageData: data });
      showToast("사진을 추가했습니다.", "success");
    } catch {
      showToast("이미지 처리 실패", "error");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const togglePair = async (target: Photo) => {
    if (!pairFrom) {
      setPairFrom(target);
      showToast("짝지을 다른 타입의 사진을 선택하세요.", "info");
      return;
    }
    if (pairFrom.id === target.id || pairFrom.type === target.type) {
      showToast("다른 타입의 사진과 짝지어야 합니다.", "error");
      setPairFrom(null);
      return;
    }
    await Promise.all([
      updatePhoto(pairFrom.id, { pairedPhotoId: target.id }),
      updatePhoto(target.id, { pairedPhotoId: pairFrom.id }),
    ]);
    showToast("사진을 짝지었습니다.", "success");
    setPairFrom(null);
  };

  return (
    <OwnerShell
      title="사진 보관소"
      headerRight={
        <button
          onClick={() => fileRef.current?.click()}
          className="h-10 px-4 rounded-full bg-[var(--color-navy-700)] text-white inline-flex items-center gap-1.5 text-[13px] font-bold shadow-[var(--shadow-navy)]"
        >
          <Camera className="w-4 h-4" />
          사진 추가
        </button>
      }
    >
      <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={onPick} />

      <div>
        <div className="grid grid-cols-2 gap-1 p-1 bg-[var(--color-navy-50)] rounded-[14px] max-w-xs">
          {(["menu", "customer"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`h-10 rounded-[10px] text-[12px] font-bold ${
                tab === t ? "bg-white text-[var(--color-navy-800)]" : "text-[var(--color-ink-500)]"
              }`}
            >
              {t === "menu" ? "메뉴 사진" : "고객 인증샷"}
            </button>
          ))}
        </div>

        {pairFrom && (
          <Card padding="md" className="mt-3 bg-[var(--color-mint-100)] border-transparent">
            <p className="text-[12px] font-bold text-[var(--color-mint-700)]">
              짝지을 사진 선택 중 ({pairFrom.type === "menu" ? "고객" : "메뉴"} 사진 탭에서 선택)
            </p>
            <Button size="md" variant="ghost" className="mt-2" onClick={() => setPairFrom(null)}>취소</Button>
          </Card>
        )}

        {filtered.length === 0 ? (
          <Card padding="lg" className="text-center text-[14px] text-[var(--color-ink-500)] mt-4">
            <ImageIcon className="w-8 h-8 text-[var(--color-ink-300)] mx-auto mb-2" />
            아직 등록된 사진이 없습니다.
          </Card>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 mt-4 pb-8">
            {filtered.map((p) => (
              <div key={p.id} className="relative group rounded-2xl overflow-hidden bg-[var(--color-ink-50)] aspect-square">
                <img src={p.imageData} alt="" className="w-full h-full object-cover" />
                {p.pairedPhotoId && (
                  <span className="absolute top-2 left-2 bg-[var(--color-mint-500)] text-white text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                    <Link2 className="w-3 h-3" />
                    짝
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
                    className={`absolute top-2 right-2 text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${
                      p.snsConsent ? "bg-[var(--color-navy-700)] text-white" : "bg-white/80 text-[var(--color-ink-700)]"
                    }`}
                  >
                    <Check className="w-3 h-3" />
                    SNS
                  </button>
                )}
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent p-2 flex gap-1">
                  <button
                    onClick={() => togglePair(p)}
                    className="flex-1 h-7 rounded bg-white/90 text-[10px] font-bold text-[var(--color-navy-700)]"
                  >
                    {pairFrom?.id === p.id ? "선택됨" : "짝짓기"}
                  </button>
                  <button
                    onClick={() => {
                      if (confirm("사진을 삭제하시겠습니까?")) deletePhoto(p.id);
                    }}
                    className="w-7 h-7 rounded bg-white/90 inline-flex items-center justify-center text-[var(--color-danger)]"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </OwnerShell>
  );
}
