import { useEffect, useMemo, useRef, useState } from "react";
import {
  Plus,
  Trash2,
  RotateCcw,
  Sofa,
  DoorOpen,
  Layers,
  LayoutGrid,
  Move,
  List,
  Maximize2,
  Save,
  Circle,
  Square,
  ImagePlus,
  Sparkles,
  X,
  Wand2,
  Pencil,
  Eraser,
  Undo2,
  Check,
} from "lucide-react";
import { OwnerShell } from "../../components/layout/OwnerShell";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { NumberField } from "../../components/ui/NumberField";
import { useStore } from "../../store/store";
import { cn } from "../../lib/cn";
import type { TableDoc, TableStatus } from "../../lib/types";
import { showToast } from "../../lib/toast";

// 도면 이미지 압축: 최대 폭 1280px, JPEG 0.8 — Firestore 1MB 제한 대응 + Vision API 토큰 절약
async function compressImageToDataUrl(file: File, maxWidth = 1280): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error("이미지를 읽을 수 없습니다."));
    im.src = dataUrl;
  });
  const ratio = Math.min(1, maxWidth / img.width);
  const w = Math.round(img.width * ratio);
  const h = Math.round(img.height * ratio);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 컨텍스트 실패");
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", 0.8);
}

const STATUS_FLOW: Record<TableStatus, { next: TableStatus; label: string; cls: string }> = {
  available: { next: "occupied", label: "비어있음", cls: "bg-[var(--color-ink-50)] text-[var(--color-ink-600)]" },
  occupied: { next: "paid", label: "사용 중", cls: "bg-[var(--color-mint-100)] text-[var(--color-mint-700)]" },
  paid: { next: "dirty", label: "결제 완료", cls: "bg-[var(--color-navy-100)] text-[var(--color-navy-700)]" },
  dirty: { next: "available", label: "정리 필요", cls: "bg-[#fff1e0] text-[var(--color-warn)]" },
};

type ViewMode = "list" | "layout";

export default function OwnerTables() {
  const {
    effectiveStoreId,
    tables,
    sections,
    addTable,
    deleteTable,
    updateTableStatus,
    updateTableLayout,
    initTables,
    addSection,
    deleteSection,
  } = useStore();
  const storeId = effectiveStoreId;
  const [view, setView] = useState<ViewMode>(() => {
    return (localStorage.getItem("gyeol:tables-view") as ViewMode) || "list";
  });
  const [selected, setSelected] = useState<TableDoc | null>(null);
  const [newSection, setNewSection] = useState("");

  // ===== 도면 배경 (기기 로컬 저장 — 매장별) =====
  const floorPlanKey = useMemo(() => (storeId ? `gyeol:floorplan:${storeId}` : ""), [storeId]);
  const floorPlanOpKey = useMemo(() => (storeId ? `gyeol:floorplan-op:${storeId}` : ""), [storeId]);
  const [floorPlan, setFloorPlan] = useState<string | null>(null);
  const [floorPlanOpacity, setFloorPlanOpacity] = useState(35);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiDraft, setAiDraft] = useState<Array<Partial<TableDoc> & { number: number; type: TableDoc["type"]; x: number; y: number }> | null>(
    null
  );

  useEffect(() => {
    if (!floorPlanKey) return;
    setFloorPlan(localStorage.getItem(floorPlanKey));
    const op = Number(localStorage.getItem(floorPlanOpKey));
    if (!Number.isNaN(op) && op > 0) setFloorPlanOpacity(op);
  }, [floorPlanKey, floorPlanOpKey]);

  const onUploadFloorPlan = async (file: File) => {
    try {
      const compressed = await compressImageToDataUrl(file, 1280);
      // 일부 브라우저에서 5MB 넘으면 localStorage 실패 → 한 번 더 압축
      let final = compressed;
      if (final.length > 4_500_000) {
        final = await compressImageToDataUrl(file, 900);
      }
      localStorage.setItem(floorPlanKey, final);
      setFloorPlan(final);
      showToast("도면이 캔버스 배경으로 설정됐어요.", "success");
    } catch (e: any) {
      showToast(`도면 업로드 실패: ${e?.message ?? ""}`, "error");
    }
  };

  const onRemoveFloorPlan = () => {
    localStorage.removeItem(floorPlanKey);
    setFloorPlan(null);
    setAiDraft(null);
    showToast("도면을 제거했습니다.", "info");
  };

  const onChangeOpacity = (v: number) => {
    setFloorPlanOpacity(v);
    localStorage.setItem(floorPlanOpKey, String(v));
  };

  const runAiDraft = async () => {
    if (!floorPlan) {
      showToast("먼저 도면을 업로드해 주세요.", "error");
      return;
    }
    setAiLoading(true);
    try {
      const res = await fetch("/api/ai/floor-plan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ image: floorPlan, canvasWidth: 1000, canvasHeight: 700 }),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as {
        tables: Array<{
          number: number;
          type?: TableDoc["type"];
          x: number;
          y: number;
          width?: number;
          height?: number;
          shape?: "square" | "circle";
          seats?: number;
        }>;
      };
      if (!data.tables?.length) throw new Error("도면에서 테이블을 찾지 못했어요.");
      // 좌표·치수 클램프 + 번호 재할당으로 모델이 망가진 데이터를 보내도 안전
      const CW = 1000;
      const CH = 700;
      const clamp = (v: number, min: number, max: number) =>
        Number.isFinite(v) ? Math.max(min, Math.min(max, Math.round(v))) : min;
      // type 유효성 화이트리스트
      const VALID_TYPES = new Set<TableDoc["type"]>(["table", "room", "door"]);
      const cleaned = data.tables
        .map((t) => {
          const type = VALID_TYPES.has(t.type as TableDoc["type"]) ? (t.type as TableDoc["type"]) : "table";
          const defaultW = type === "room" ? 150 : type === "door" ? 60 : 70;
          const defaultH = type === "room" ? 80 : type === "door" ? 60 : 70;
          const width = clamp(t.width ?? defaultW, 30, 300);
          const height = clamp(t.height ?? defaultH, 30, 300);
          return {
            type,
            x: clamp(t.x, 0, CW - width),
            y: clamp(t.y, 0, CH - height),
            width,
            height,
            shape: (t.shape === "circle" ? "circle" : "square") as "square" | "circle",
            seats: clamp(t.seats ?? 4, 1, 30),
          };
        })
        // 번호는 모델 출력 무시하고 1부터 재부여 (중복/누락 방지)
        .map((t, i) => ({ ...t, number: i + 1 }));
      setAiDraft(cleaned);
      showToast(`AI가 ${cleaned.length}개 자리를 제안했어요. 미리보기를 확인하세요.`, "success");
    } catch (e: any) {
      const msg = String(e?.message ?? "");
      if (msg.includes("AI_NOT_CONFIGURED")) {
        showToast("AI 서비스가 아직 설정되지 않았습니다. 관리자에게 문의해 주세요.", "error");
      } else {
        showToast(`AI 초안 생성 실패: ${msg || "잠시 후 다시 시도해 주세요."}`, "error");
      }
    } finally {
      setAiLoading(false);
    }
  };

  const applyAiDraft = async () => {
    if (!aiDraft || !storeId) return;
    const existing = tables.filter((t) => t.storeId === storeId);
    // 명시적 confirm — destructive 작업
    if (existing.length > 0) {
      const ok = window.confirm(
        `현재 테이블 ${existing.length}개를 삭제하고 AI가 제안한 ${aiDraft.length}개로 교체합니다.\n\n이 작업은 되돌릴 수 없습니다. 진행할까요?`
      );
      if (!ok) return;
    }
    setSelected(null); // 선택 해제 — 곧 삭제될 객체를 가리키지 않도록
    let deleteFails = 0;
    let createFails = 0;
    for (const t of existing) {
      try {
        await deleteTable(storeId, t.number);
      } catch (e) {
        deleteFails++;
        console.error("[applyAiDraft delete]", t.number, e);
      }
    }
    for (const d of aiDraft) {
      const doc: TableDoc = {
        id: `${storeId}_${d.number}`,
        number: d.number,
        storeId,
        type: d.type,
        x: d.x,
        y: d.y,
        width: d.width ?? 70,
        height: d.height ?? 70,
        seats: d.seats ?? 4,
        shape: d.shape ?? "square",
        status: "available",
      };
      try {
        await updateTableLayout(storeId, d.number, doc);
      } catch (e) {
        createFails++;
        console.error("[applyAiDraft create]", d.number, e);
      }
    }
    setAiDraft(null);
    if (deleteFails === 0 && createFails === 0) {
      showToast("AI 초안을 적용했어요. 드래그로 미세 조정하세요.", "success");
    } else {
      showToast(
        `일부 작업이 실패했습니다 (삭제 실패 ${deleteFails}, 생성 실패 ${createFails}). 네트워크를 확인하고 다시 시도해 주세요.`,
        "error"
      );
    }
  };

  useEffect(() => {
    localStorage.setItem("gyeol:tables-view", view);
  }, [view]);

  // 선택 동기화 (store 업데이트 반영)
  useEffect(() => {
    if (selected) {
      const fresh = tables.find((t) => t.id === selected.id);
      if (fresh) setSelected(fresh);
      else setSelected(null);
    }
  }, [tables, selected?.id]);

  const sorted = [...tables].sort((a, b) => a.number - b.number);

  return (
    <OwnerShell
      title="테이블 편집"
      headerRight={
        <div className="flex items-center gap-1.5">
          <div className="inline-flex p-1 bg-[var(--color-navy-50)] rounded-full">
            <button
              onClick={() => setView("list")}
              className={cn(
                "h-9 px-3.5 rounded-full text-[12px] font-bold inline-flex items-center gap-1.5 transition-all",
                view === "list" ? "bg-white text-[var(--color-navy-800)] shadow-[var(--shadow-press)]" : "text-[var(--color-ink-500)]"
              )}
            >
              <List className="w-3.5 h-3.5" />
              리스트
            </button>
            <button
              onClick={() => setView("layout")}
              className={cn(
                "h-9 px-3.5 rounded-full text-[12px] font-bold inline-flex items-center gap-1.5 transition-all",
                view === "layout" ? "bg-white text-[var(--color-navy-800)] shadow-[var(--shadow-press)]" : "text-[var(--color-ink-500)]"
              )}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              배치도
            </button>
          </div>
          <button
            onClick={() => {
              if (confirm("모든 테이블을 삭제하고 기본 15개로 다시 만들까요?")) {
                initTables(storeId);
              }
            }}
            className="h-10 px-3 rounded-full hover:bg-[var(--color-navy-50)] inline-flex items-center gap-1.5 text-[13px] font-bold text-[var(--color-navy-800)]"
            aria-label="초기화"
          >
            <RotateCcw className="w-4 h-4" />
            <span className="hidden sm:inline">초기화</span>
          </button>
        </div>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 lg:gap-6">
        <div className="lg:col-span-2">
          {/* Add buttons */}
          <div className="grid grid-cols-3 gap-2">
            <Button size="md" variant="ghost" onClick={() => addTable(storeId, "table")} leftIcon={<Plus className="w-4 h-4" />}>
              테이블
            </Button>
            <Button size="md" variant="ghost" onClick={() => addTable(storeId, "room")} leftIcon={<Sofa className="w-4 h-4" />}>
              룸
            </Button>
            <Button size="md" variant="ghost" onClick={() => addTable(storeId, "door")} leftIcon={<DoorOpen className="w-4 h-4" />}>
              출입구
            </Button>
          </div>

          {/* Sections */}
          <Card padding="md" className="mt-4">
            <div className="flex items-center gap-2 mb-3">
              <Layers className="w-4 h-4 text-[var(--color-navy-700)]" />
              <h3 className="text-[14px] font-bold text-[var(--color-navy-900)]">구역</h3>
            </div>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!newSection.trim()) return;
                addSection(storeId, newSection.trim());
                setNewSection("");
              }}
            >
              <Input
                placeholder="구역 이름 (예: 홀1)"
                value={newSection}
                onChange={(e) => setNewSection(e.target.value)}
              />
              <Button size="md" type="submit" disabled={!newSection.trim()}>
                추가
              </Button>
            </form>
            {sections.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {sections.map((s) => (
                  <span key={s.id} className="chip">
                    {s.name}
                    <button onClick={() => deleteSection(s.id)} className="ml-1 opacity-60 hover:opacity-100">
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </Card>

          {/* Main viewport */}
          {view === "list" ? (
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {sorted.length === 0 ? (
                <Card padding="lg" className="text-center body-md sm:col-span-2">
                  테이블이 없습니다. 위 버튼으로 추가하세요.
                </Card>
              ) : (
                sorted.map((t) => {
                  const st = STATUS_FLOW[t.status ?? "available"];
                  return (
                    <Card
                      key={t.id}
                      padding="md"
                      className={cn(
                        "flex items-center gap-3 transition-shadow cursor-pointer",
                        selected?.id === t.id && "ring-2 ring-[var(--color-navy-700)]"
                      )}
                      onClick={() => setSelected((s) => (s?.id === t.id ? null : t))}
                    >
                      <div className="w-10 h-10 rounded-xl bg-[var(--color-navy-50)] text-[var(--color-navy-800)] font-extrabold inline-flex items-center justify-center">
                        {t.number}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-bold text-[var(--color-navy-900)]">
                          {t.type === "room" ? "룸" : t.type === "door" ? "출입구" : "테이블"} {t.number}
                        </p>
                        {t.type !== "door" && <p className="body-sm">{t.seats}인</p>}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          updateTableStatus(storeId, t.number, st.next);
                        }}
                        className={`px-2.5 py-1 rounded-full text-[12px] font-bold ${st.cls}`}
                      >
                        {st.label}
                      </button>
                    </Card>
                  );
                })
              )}
            </div>
          ) : (
            <>
              <FloorPlanPanel
                hasImage={!!floorPlan}
                currentImage={floorPlan}
                opacity={floorPlanOpacity}
                onUpload={onUploadFloorPlan}
                onRemove={onRemoveFloorPlan}
                onOpacity={onChangeOpacity}
                onSketchSave={(dataUrl) => {
                  // 스케치 결과를 도면 슬롯에 저장 (한 번 더 압축해서 용량 관리)
                  try {
                    let final = dataUrl;
                    if (final.length > 4_500_000) {
                      // 큰 PNG는 캔버스로 재인코딩해 JPEG 0.85로 축약
                      const tmp = document.createElement("canvas");
                      const im = new Image();
                      im.onload = () => {
                        const ratio = Math.min(1, 1280 / im.width);
                        tmp.width = Math.round(im.width * ratio);
                        tmp.height = Math.round(im.height * ratio);
                        const ctx = tmp.getContext("2d");
                        if (ctx) {
                          ctx.fillStyle = "#ffffff";
                          ctx.fillRect(0, 0, tmp.width, tmp.height);
                          ctx.drawImage(im, 0, 0, tmp.width, tmp.height);
                          final = tmp.toDataURL("image/jpeg", 0.85);
                          localStorage.setItem(floorPlanKey, final);
                          setFloorPlan(final);
                        }
                      };
                      im.src = dataUrl;
                      return;
                    }
                    localStorage.setItem(floorPlanKey, final);
                    setFloorPlan(final);
                    showToast("스케치를 도면으로 저장했어요.", "success");
                  } catch (e: any) {
                    showToast(`저장 실패: ${e?.message ?? ""}`, "error");
                  }
                }}
                aiLoading={aiLoading}
                aiDraftCount={aiDraft?.length ?? 0}
                onRunAi={runAiDraft}
                onApplyAi={applyAiDraft}
                onDiscardAi={() => setAiDraft(null)}
              />
              <LayoutCanvas
                tables={sorted}
                selectedId={selected?.id ?? null}
                onSelect={(t) => setSelected((s) => (s?.id === t.id ? null : t))}
                onMove={(t, x, y) => updateTableLayout(storeId, t.number, { x, y })}
                backgroundDataUrl={floorPlan}
                backgroundOpacity={floorPlanOpacity}
                aiDraft={aiDraft}
              />
            </>
          )}
        </div>

        {/* Right rail: selected detail */}
        <div>
          {selected ? (
            <Card padding="lg" className="lg:sticky lg:top-[88px]">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-[12px] font-bold text-[var(--color-ink-500)] uppercase tracking-wide">
                    {selected.type === "room" ? "룸" : selected.type === "door" ? "출입구" : "테이블"}
                  </p>
                  <p className="text-[22px] font-extrabold text-[var(--color-navy-900)] tracking-tight">
                    {selected.number}번
                  </p>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${STATUS_FLOW[selected.status ?? "available"].cls}`}>
                  {STATUS_FLOW[selected.status ?? "available"].label}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[12px] text-[var(--color-ink-500)] mb-1.5 font-semibold">좌석 수</p>
                  <NumberField
                    value={selected.seats}
                    min={1}
                    max={99}
                    onCommit={(v) => updateTableLayout(storeId, selected.number, { seats: v })}
                  />
                </div>
                <div>
                  <p className="text-[12px] text-[var(--color-ink-500)] mb-1.5 font-semibold">구역</p>
                  <select
                    value={selected.sectionId ?? ""}
                    onChange={(e) =>
                      updateTableLayout(storeId, selected.number, {
                        sectionId: e.target.value || null,
                      } as any)
                    }
                    className="input-field"
                  >
                    <option value="">없음</option>
                    {sections.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Shape / size (배치도 모드에서 더 유용) */}
              <div className="mt-4">
                <p className="text-[12px] text-[var(--color-ink-500)] mb-1.5 font-semibold">형태</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => updateTableLayout(storeId, selected.number, { shape: "square" })}
                    className={cn(
                      "h-11 rounded-[12px] text-[13px] font-bold inline-flex items-center justify-center gap-2 border",
                      (selected.shape ?? "square") === "square"
                        ? "bg-[var(--color-navy-700)] text-white border-transparent"
                        : "bg-white text-[var(--color-ink-700)] border-[var(--color-line)]"
                    )}
                  >
                    <Square className="w-4 h-4" /> 사각
                  </button>
                  <button
                    onClick={() => updateTableLayout(storeId, selected.number, { shape: "circle" })}
                    className={cn(
                      "h-11 rounded-[12px] text-[13px] font-bold inline-flex items-center justify-center gap-2 border",
                      selected.shape === "circle"
                        ? "bg-[var(--color-navy-700)] text-white border-transparent"
                        : "bg-white text-[var(--color-ink-700)] border-[var(--color-line)]"
                    )}
                  >
                    <Circle className="w-4 h-4" /> 원형
                  </button>
                </div>
              </div>

              <div className="mt-4">
                <p className="text-[12px] text-[var(--color-ink-500)] mb-1.5 font-semibold flex items-center gap-1">
                  <Maximize2 className="w-3 h-3" /> 크기
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <NumberField
                    value={selected.width ?? 70}
                    min={40}
                    max={400}
                    onCommit={(v) => updateTableLayout(storeId, selected.number, { width: v })}
                  />
                  <NumberField
                    value={selected.height ?? 70}
                    min={40}
                    max={400}
                    onCommit={(v) => updateTableLayout(storeId, selected.number, { height: v })}
                  />
                </div>
              </div>

              <Button
                block
                variant="outline"
                className="mt-5 text-[var(--color-danger)] border-[var(--color-danger)]/30"
                leftIcon={<Trash2 className="w-4 h-4" />}
                onClick={() => {
                  if (confirm(`테이블 ${selected.number}번을 삭제하시겠습니까?`)) {
                    deleteTable(storeId, selected.number);
                    setSelected(null);
                  }
                }}
              >
                삭제
              </Button>
            </Card>
          ) : (
            <Card padding="lg" className="text-center body-md hidden lg:block lg:sticky lg:top-[88px]">
              {view === "layout" ? (
                <>
                  <Move className="w-8 h-8 text-[var(--color-ink-300)] mx-auto mb-2" />
                  드래그로 테이블을 옮기고,
                  <br />
                  탭하면 상세 설정이 표시됩니다.
                </>
              ) : (
                <>테이블을 선택하면 상세 설정이 표시됩니다.</>
              )}
            </Card>
          )}
        </div>
      </div>
    </OwnerShell>
  );
}

// ============================================================
// 도면 업로드 + AI 초안 패널
// ============================================================
function FloorPlanPanel({
  hasImage,
  currentImage,
  opacity,
  onUpload,
  onRemove,
  onOpacity,
  onSketchSave,
  aiLoading,
  aiDraftCount,
  onRunAi,
  onApplyAi,
  onDiscardAi,
}: {
  hasImage: boolean;
  currentImage: string | null;
  opacity: number;
  onUpload: (f: File) => void;
  onRemove: () => void;
  onOpacity: (v: number) => void;
  onSketchSave: (dataUrl: string) => void;
  aiLoading: boolean;
  aiDraftCount: number;
  onRunAi: () => void;
  onApplyAi: () => void;
  onDiscardAi: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [sketchOpen, setSketchOpen] = useState(false);
  return (
    <Card padding="md" className="mt-4">
      <div className="flex items-center gap-2 mb-3">
        <ImagePlus className="w-4 h-4 text-[var(--color-navy-700)]" />
        <h3 className="text-[14px] font-bold text-[var(--color-navy-900)]">도면 배경 · AI 초안</h3>
        <span className="ml-auto text-[10.5px] text-[var(--color-ink-400)] font-medium">
          이 기기에 저장됩니다
        </span>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onUpload(f);
          e.target.value = "";
        }}
      />

      {!hasImage ? (
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => fileRef.current?.click()}
            className="h-28 rounded-[12px] border-2 border-dashed border-[var(--color-line)] hover:border-[var(--color-navy-700)] hover:bg-[var(--color-navy-50)] flex flex-col items-center justify-center gap-1 text-[var(--color-ink-500)] hover:text-[var(--color-navy-700)] transition-colors"
          >
            <ImagePlus className="w-5 h-5" />
            <span className="text-[13px] font-bold">도면 업로드</span>
            <span className="text-[11px] font-medium opacity-70">JPG · PNG</span>
          </button>
          <button
            onClick={() => setSketchOpen(true)}
            className="h-28 rounded-[12px] border-2 border-dashed border-[var(--color-mint-300)] hover:border-[var(--color-mint-500)] bg-[var(--color-mint-50)]/40 hover:bg-[var(--color-mint-50)] flex flex-col items-center justify-center gap-1 text-[var(--color-mint-700)] transition-colors"
          >
            <Pencil className="w-5 h-5" />
            <span className="text-[13px] font-bold">직접 그리기</span>
            <span className="text-[11px] font-medium opacity-70">손가락·마우스로 스케치</span>
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => fileRef.current?.click()}
              className="h-9 px-3 rounded-full bg-[var(--color-navy-50)] text-[12px] font-bold text-[var(--color-navy-800)] inline-flex items-center gap-1"
            >
              <ImagePlus className="w-3.5 h-3.5" /> 다시 업로드
            </button>
            <button
              onClick={() => setSketchOpen(true)}
              className="h-9 px-3 rounded-full bg-[var(--color-mint-50)] text-[12px] font-bold text-[var(--color-mint-700)] inline-flex items-center gap-1"
            >
              <Pencil className="w-3.5 h-3.5" /> 그림판 편집
            </button>
            <button
              onClick={onRemove}
              className="h-9 px-3 rounded-full hover:bg-[#fef2f2] text-[12px] font-bold text-[var(--color-danger)] inline-flex items-center gap-1"
            >
              <X className="w-3.5 h-3.5" /> 제거
            </button>
            <div className="ml-auto flex items-center gap-2 min-w-[140px]">
              <span className="text-[11px] font-bold text-[var(--color-ink-600)] whitespace-nowrap">투명도 {opacity}%</span>
              <input
                type="range"
                min={10}
                max={90}
                value={opacity}
                onChange={(e) => onOpacity(Number(e.target.value))}
                className="flex-1"
              />
            </div>
          </div>

          {aiDraftCount > 0 ? (
            <div className="rounded-[12px] border-[1.5px] border-[var(--color-mint-300)] bg-[var(--color-mint-50)] p-3 flex flex-col sm:flex-row sm:items-center gap-2.5">
              <div className="flex-1">
                <p className="text-[13px] font-extrabold text-[var(--color-navy-900)] inline-flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[var(--color-mint-700)]" />
                  AI 초안 — 자리 {aiDraftCount}개 제안
                </p>
                <p className="text-[11.5px] text-[var(--color-ink-600)] mt-0.5">
                  적용하면 <b className="text-[var(--color-danger)]">기존 테이블이 모두 교체</b>됩니다.
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="md" variant="ghost" onClick={onDiscardAi}>취소</Button>
                <Button size="md" onClick={onApplyAi} leftIcon={<Wand2 className="w-4 h-4" />}>
                  적용
                </Button>
              </div>
            </div>
          ) : (
            <Button
              block
              variant="outline"
              loading={aiLoading}
              onClick={onRunAi}
              leftIcon={<Sparkles className="w-4 h-4" />}
            >
              AI로 테이블 배치 초안 만들기
            </Button>
          )}
        </div>
      )}

      {sketchOpen && (
        <SketchPad
          initialDataUrl={currentImage}
          onClose={() => setSketchOpen(false)}
          onSave={(dataUrl) => {
            onSketchSave(dataUrl);
            setSketchOpen(false);
          }}
        />
      )}
    </Card>
  );
}

// ============================================================
// 내장 그림판 — 펜·지우개·되돌리기 · 결과는 PNG dataURL
// ============================================================
function SketchPad({
  initialDataUrl,
  onClose,
  onSave,
}: {
  initialDataUrl?: string | null;
  onClose: () => void;
  onSave: (dataUrl: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [tool, setTool] = useState<"pen" | "eraser">("pen");
  const [size, setSize] = useState(4);
  const [color, setColor] = useState("#0B1220");
  const drawingRef = useRef(false);
  const lastRef = useRef<{ x: number; y: number } | null>(null);
  // 되돌리기용 스냅샷 스택 (최근 20개)
  const historyRef = useRef<ImageData[]>([]);

  // 캔버스 초기화 (배경 흰색 + 기존 이미지 깔기)
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = wrap.getBoundingClientRect();
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, rect.width, rect.height);
    if (initialDataUrl) {
      const img = new Image();
      img.onload = () => {
        // contain 방식으로 캔버스 안에 맞춰 그림
        const r = Math.min(rect.width / img.width, rect.height / img.height);
        const w = img.width * r;
        const h = img.height * r;
        ctx.drawImage(img, (rect.width - w) / 2, (rect.height - h) / 2, w, h);
        pushHistory();
      };
      img.src = initialDataUrl;
    } else {
      pushHistory();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pushHistory = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const snap = ctx.getImageData(0, 0, canvas.width, canvas.height);
    historyRef.current.push(snap);
    if (historyRef.current.length > 20) historyRef.current.shift();
  };

  const undo = () => {
    if (historyRef.current.length <= 1) return;
    historyRef.current.pop();
    const last = historyRef.current[historyRef.current.length - 1];
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !last) return;
    ctx.putImageData(last, 0, 0);
  };

  const clearAll = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    pushHistory();
  };

  const pos = (e: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onDown = (e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as Element).setPointerCapture(e.pointerId);
    drawingRef.current = true;
    lastRef.current = pos(e);
  };

  const onMove = (e: React.PointerEvent) => {
    if (!drawingRef.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx || !lastRef.current) return;
    const cur = pos(e);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = size * (tool === "eraser" ? 4 : 1);
    ctx.strokeStyle = tool === "eraser" ? "#ffffff" : color;
    ctx.beginPath();
    ctx.moveTo(lastRef.current.x, lastRef.current.y);
    ctx.lineTo(cur.x, cur.y);
    ctx.stroke();
    lastRef.current = cur;
  };

  const onUp = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    lastRef.current = null;
    pushHistory();
  };

  const save = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // 디바이스 픽셀 비율을 반영한 실제 픽셀로 저장
    onSave(canvas.toDataURL("image/png"));
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-3xl bg-white rounded-[18px] overflow-hidden shadow-[var(--shadow-lifted)] flex flex-col" style={{ maxHeight: "90vh" }}>
        <div className="flex items-center gap-2 px-4 h-12 border-b border-[var(--color-line)]">
          <Pencil className="w-4 h-4 text-[var(--color-navy-700)]" />
          <h3 className="text-[14px] font-extrabold text-[var(--color-navy-900)]">도면 그리기</h3>
          <button onClick={onClose} className="ml-auto h-8 w-8 rounded-full hover:bg-[var(--color-ink-50)] inline-flex items-center justify-center">
            <X className="w-4 h-4 text-[var(--color-ink-600)]" />
          </button>
        </div>

        <div className="px-3 py-2 flex items-center gap-2 flex-wrap border-b border-[var(--color-line-soft)] bg-[var(--color-navy-50)]/40">
          <button
            onClick={() => setTool("pen")}
            className={cn(
              "h-9 px-3 rounded-full text-[12px] font-bold inline-flex items-center gap-1",
              tool === "pen" ? "bg-[var(--color-navy-700)] text-white" : "bg-white text-[var(--color-navy-800)]"
            )}
          >
            <Pencil className="w-3.5 h-3.5" /> 펜
          </button>
          <button
            onClick={() => setTool("eraser")}
            className={cn(
              "h-9 px-3 rounded-full text-[12px] font-bold inline-flex items-center gap-1",
              tool === "eraser" ? "bg-[var(--color-navy-700)] text-white" : "bg-white text-[var(--color-navy-800)]"
            )}
          >
            <Eraser className="w-3.5 h-3.5" /> 지우개
          </button>
          <div className="flex items-center gap-1.5 ml-1">
            <span className="text-[11px] font-bold text-[var(--color-ink-600)]">굵기</span>
            <input type="range" min={1} max={20} value={size} onChange={(e) => setSize(Number(e.target.value))} className="w-24" />
            <span className="text-[11px] font-bold text-[var(--color-ink-700)] w-5 text-center">{size}</span>
          </div>
          {tool === "pen" && (
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-9 w-9 rounded-full border-[1.5px] border-[var(--color-line)] bg-white cursor-pointer"
              title="펜 색상"
            />
          )}
          <button
            onClick={undo}
            className="h-9 px-3 rounded-full bg-white text-[12px] font-bold text-[var(--color-navy-800)] inline-flex items-center gap-1"
          >
            <Undo2 className="w-3.5 h-3.5" /> 되돌리기
          </button>
          <button
            onClick={clearAll}
            className="h-9 px-3 rounded-full bg-white text-[12px] font-bold text-[var(--color-danger)] inline-flex items-center gap-1"
          >
            <X className="w-3.5 h-3.5" /> 전체 지움
          </button>
        </div>

        <div
          ref={wrapRef}
          className="relative bg-white flex-1 overflow-hidden"
          style={{ minHeight: 360 }}
        >
          <canvas
            ref={canvasRef}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            className="block touch-none cursor-crosshair"
          />
        </div>

        <div className="px-4 py-3 border-t border-[var(--color-line)] flex items-center gap-2 justify-end">
          <Button variant="ghost" onClick={onClose}>닫기</Button>
          <Button onClick={save} leftIcon={<Check className="w-4 h-4" />}>
            도면으로 사용
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Layout Canvas (드래그로 매장 배치도)
// ============================================================
interface CanvasProps {
  tables: TableDoc[];
  selectedId: string | null;
  onSelect: (t: TableDoc) => void;
  onMove: (t: TableDoc, x: number, y: number) => void;
  backgroundDataUrl?: string | null;
  backgroundOpacity?: number;
  aiDraft?: Array<Partial<TableDoc> & { number: number; type: TableDoc["type"]; x: number; y: number }> | null;
}

function LayoutCanvas({ tables, selectedId, onSelect, onMove, backgroundDataUrl, backgroundOpacity = 35, aiDraft }: CanvasProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  // 드래그 중 임시 위치 (Firestore 저장 전 화면 즉시 반영)
  const [drag, setDrag] = useState<{ id: string; x: number; y: number } | null>(null);

  // 최대 좌표로 캔버스 크기 계산 (최소 800x600)
  const maxX = tables.reduce((m, t) => Math.max(m, (t.x ?? 0) + (t.width ?? 70)), 0);
  const maxY = tables.reduce((m, t) => Math.max(m, (t.y ?? 0) + (t.height ?? 70)), 0);
  const canvasW = Math.max(800, maxX + 100);
  const canvasH = Math.max(600, maxY + 100);

  const startDrag = (e: React.PointerEvent, table: TableDoc) => {
    e.preventDefault();
    e.stopPropagation();
    onSelect(table);

    const startClientX = e.clientX;
    const startClientY = e.clientY;
    const origX = table.x ?? 40;
    const origY = table.y ?? 40;
    let lastX = origX;
    let lastY = origY;
    let moved = false;

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startClientX;
      const dy = ev.clientY - startClientY;
      if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
      lastX = Math.max(0, origX + dx);
      lastY = Math.max(0, origY + dy);
      setDrag({ id: table.id, x: lastX, y: lastY });
    };

    const onUp = () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onUp);
      setDrag(null);
      // 5px 이상 움직였을 때만 저장 (탭과 구분)
      if (moved) {
        onMoveFinal(table, lastX, lastY);
      }
    };

    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onUp);
  };

  const onMoveFinal = (t: TableDoc, x: number, y: number) => {
    onMove(t, Math.round(x), Math.round(y));
  };

  return (
    <div className="mt-4">
      <Card padding="none" className="overflow-hidden">
        <div className="px-4 py-2.5 bg-[var(--color-navy-50)] border-b border-[var(--color-line)] flex items-center gap-2 text-[12px] font-semibold text-[var(--color-ink-700)]">
          <Move className="w-3.5 h-3.5" />
          드래그해서 배치하기 · 탭으로 선택 · 우측에서 크기·형태 변경
        </div>
        <div
          ref={wrapRef}
          className="relative overflow-auto bg-white"
          style={{ height: "min(70vh, 640px)" }}
        >
          <div
            className="relative bg-[repeating-linear-gradient(0deg,transparent,transparent_39px,#eef2f8_39px,#eef2f8_40px),repeating-linear-gradient(90deg,transparent,transparent_39px,#eef2f8_39px,#eef2f8_40px)]"
            style={{ width: canvasW, height: canvasH }}
          >
            {backgroundDataUrl && (
              <img
                src={backgroundDataUrl}
                alt="도면 배경"
                draggable={false}
                className="absolute inset-0 w-full h-full object-contain pointer-events-none select-none"
                style={{ opacity: backgroundOpacity / 100 }}
              />
            )}
            {aiDraft?.map((d) => {
              const w = d.width ?? 70;
              const h = d.height ?? 70;
              const shapeCls = d.shape === "circle" ? "rounded-full" : "rounded-[14px]";
              return (
                <div
                  key={`ai-${d.number}`}
                  className={cn(
                    "absolute border-[2px] border-dashed border-[var(--color-mint-700)] bg-[var(--color-mint-100)]/60 text-[var(--color-mint-700)] flex flex-col items-center justify-center pointer-events-none",
                    shapeCls
                  )}
                  style={{ left: d.x, top: d.y, width: w, height: h }}
                >
                  <p className="text-[16px] font-extrabold leading-none">{d.number}</p>
                  <p className="text-[10px] font-bold opacity-80 mt-0.5">AI 제안</p>
                </div>
              );
            })}
            {tables.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center text-[14px] text-[var(--color-ink-500)] font-medium">
                테이블이 없습니다. 위에서 추가하세요.
              </div>
            )}
            {tables.map((t) => {
              const isDragging = drag?.id === t.id;
              const x = isDragging ? drag!.x : t.x ?? 40;
              const y = isDragging ? drag!.y : t.y ?? 40;
              const w = t.width ?? (t.type === "room" ? 150 : 70);
              const h = t.height ?? (t.type === "room" ? 80 : 70);
              const isSelected = selectedId === t.id;

              const colorCls =
                t.type === "door"
                  ? "bg-[#fff1e0] text-[var(--color-warn)] border-[var(--color-warn)]/30"
                  : t.type === "room"
                  ? "bg-[var(--color-mint-100)] text-[var(--color-mint-700)] border-[var(--color-mint-300)]"
                  : t.status === "occupied"
                  ? "bg-[var(--color-mint-100)] text-[var(--color-mint-700)] border-[var(--color-mint-300)]"
                  : t.status === "dirty"
                  ? "bg-[#fff1e0] text-[var(--color-warn)] border-[var(--color-warn)]/30"
                  : "bg-white text-[var(--color-navy-800)] border-[var(--color-line)]";

              const shapeCls = t.shape === "circle" ? "rounded-full" : "rounded-[14px]";

              return (
                <div
                  key={t.id}
                  onPointerDown={(e) => startDrag(e, t)}
                  className={cn(
                    "absolute border-2 flex flex-col items-center justify-center select-none touch-none transition-shadow",
                    colorCls,
                    shapeCls,
                    isSelected && "ring-4 ring-[var(--color-navy-700)]/30 shadow-[var(--shadow-lifted)]",
                    isDragging ? "cursor-grabbing shadow-[var(--shadow-lifted)]" : "cursor-grab hover:shadow-[var(--shadow-lifted)]"
                  )}
                  style={{
                    left: x,
                    top: y,
                    width: w,
                    height: h,
                  }}
                  title={`${t.type === "room" ? "룸" : t.type === "door" ? "출입구" : "테이블"} ${t.number}`}
                >
                  <p className="text-[18px] font-extrabold leading-none">
                    {t.type === "door" ? "출입" : t.number}
                  </p>
                  {t.type !== "door" && (
                    <p className="text-[11px] font-semibold opacity-80 mt-0.5">{t.seats}인</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </Card>
      <p className="mt-2 px-1 text-[12px] text-[var(--color-ink-600)] font-medium flex items-center gap-1">
        <Save className="w-3 h-3" /> 위치 변경은 손을 떼는 즉시 자동 저장됩니다.
      </p>
    </div>
  );
}
