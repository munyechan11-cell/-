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
import { api } from "../../lib/api";
import { useLanguage, t, type Lang } from "../../lib/i18n";

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
    im.onerror = () => reject(new Error(t("otables.floorplan.readFail")));
    im.src = dataUrl;
  });
  const ratio = Math.min(1, maxWidth / img.width);
  const w = Math.round(img.width * ratio);
  const h = Math.round(img.height * ratio);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error(t("otables.floorplan.canvasFail"));
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", 0.8);
}

// 8단계 흐름 — 다음 상태 순환 (테이블 편집 페이지의 카드에서 빠른 토글용)
// 라벨은 tableFlow STATUS_LABEL 키와 매핑되도록 labelKey 만 보관
const STATUS_FLOW: Record<TableStatus, { next: TableStatus; labelKey: string; cls: string }> = {
  available: { next: "setup",    labelKey: "tflow.available", cls: "bg-white border border-[var(--color-line)] text-[var(--color-ink-600)]" },
  reserved:  { next: "setup",    labelKey: "tflow.reserved",  cls: "bg-[#f1ecff] text-[#6d4cdf]" },
  setup:     { next: "occupied", labelKey: "tflow.setup",     cls: "bg-[#fff8e6] text-[#b07b00]" },
  occupied:  { next: "dining",   labelKey: "tflow.occupied",  cls: "bg-[var(--color-mint-50)] text-[var(--color-mint-700)]" },
  dining:    { next: "paid",     labelKey: "tflow.dining",    cls: "bg-[var(--color-mint-100)] text-[var(--color-mint-700)]" },
  paid:      { next: "cleaning", labelKey: "tflow.paid",      cls: "bg-[var(--color-navy-100)] text-[var(--color-navy-700)]" },
  cleaning:  { next: "available",labelKey: "tflow.cleaning",  cls: "bg-[#fff1e0] text-[var(--color-warn)]" },
  dirty:     { next: "available",labelKey: "tflow.cleaning",  cls: "bg-[#fff1e0] text-[var(--color-warn)]" },
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
  const lang = useLanguage();
  const [view, setView] = useState<ViewMode>(() => {
    try {
      const raw = localStorage.getItem("gyeol:tables-view");
      return raw === "list" || raw === "layout" ? raw : "list";
    } catch {
      return "list";
    }
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
  // AI가 인식한 구조물 (벽·문·룸 경계·카운터) — 테이블이 아니므로 Firestore에 저장 안 함, 캔버스에 시각적으로만 표시
  type AiStructure = {
    kind: "wall" | "door" | "room" | "counter";
    x: number; y: number; width: number; height: number;
    label?: string;
  };
  const [aiStructures, setAiStructures] = useState<AiStructure[] | null>(null);
  // AI 분석 시점의 캔버스 크기 (도면 종횡비 기반) — LayoutCanvas가 이걸 우선 사용
  const [aiCanvasSize, setAiCanvasSize] = useState<{ w: number; h: number } | null>(null);

  // 컴포넌트 마운트 상태 추적 — 비동기 이미지 측정 도중 언마운트 시 setState 경고 방지
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // 도면 dataURL을 받아 자연 크기 측정 후 aiCanvasSize 자동 설정 (캔버스-도면 정합 유지)
  const measureAndSetCanvas = async (dataUrl: string) => {
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const im = new Image();
        im.onload = () => resolve(im);
        im.onerror = () => reject(new Error(t("otables.floorplan.measureFail", lang)));
        im.src = dataUrl;
      });
      if (!mountedRef.current) return;
      const MAX = 1200;
      const scale = Math.min(1, MAX / Math.max(img.width, img.height));
      setAiCanvasSize({ w: Math.round(img.width * scale), h: Math.round(img.height * scale) });
    } catch {
      if (mountedRef.current) setAiCanvasSize(null);
    }
  };

  useEffect(() => {
    if (!floorPlanKey) return;
    const stored = localStorage.getItem(floorPlanKey);
    setFloorPlan(stored);
    const op = Number(localStorage.getItem(floorPlanOpKey));
    if (!Number.isNaN(op) && op > 0) setFloorPlanOpacity(op);
    // 저장된 도면이 있으면 새로고침 후에도 캔버스 종횡비를 도면에 맞춰 유지
    if (stored) measureAndSetCanvas(stored);
    else setAiCanvasSize(null);
  }, [floorPlanKey, floorPlanOpKey]);

  // localStorage 쿼터 안전 저장 — 5MB 초과 시 친화 메시지
  const safeStoreFloorPlan = (dataUrl: string): boolean => {
    try {
      localStorage.setItem(floorPlanKey, dataUrl);
      return true;
    } catch (e: any) {
      const msg = String(e?.message ?? "");
      if (e?.name === "QuotaExceededError" || msg.includes("quota")) {
        showToast(t("otables.floorplan.quota", lang), "error");
      } else {
        showToast(t("otables.floorplan.saveFail", lang, { msg }), "error");
      }
      return false;
    }
  };

  const onUploadFloorPlan = async (file: File) => {
    try {
      const compressed = await compressImageToDataUrl(file, 1280);
      // 일부 브라우저에서 5MB 넘으면 localStorage 실패 → 한 번 더 압축
      let final = compressed;
      if (final.length > 4_500_000) {
        final = await compressImageToDataUrl(file, 900);
      }
      if (!safeStoreFloorPlan(final)) return;
      setFloorPlan(final);
      // 새 도면 = 좌표계 재설정
      setAiDraft(null);
      setAiStructures(null);
      await measureAndSetCanvas(final);
      showToast(t("otables.floorplan.uploaded", lang), "success");
    } catch (e: any) {
      showToast(t("otables.floorplan.uploadFail", lang, { msg: e?.message ?? "" }), "error");
    }
  };

  const onRemoveFloorPlan = () => {
    try {
      localStorage.removeItem(floorPlanKey);
      localStorage.removeItem(floorPlanOpKey);
    } catch { /* 시크릿모드 등 — 무시 */ }
    setFloorPlan(null);
    setFloorPlanOpacity(35);
    setAiDraft(null);
    setAiStructures(null);
    setAiCanvasSize(null);
    showToast(t("otables.floorplan.removeDone", lang), "info");
  };

  const onChangeOpacity = (v: number) => {
    setFloorPlanOpacity(v);
    try {
      localStorage.setItem(floorPlanOpKey, String(v));
    } catch {
      /* 쿼터/시크릿모드 — 메모리 상 값만 유지 */
    }
  };

  const runAiDraft = async () => {
    if (!floorPlan) {
      showToast(t("otables.ai.uploadFirst", lang), "error");
      return;
    }
    // 분석 시작 시점의 매장 ID를 캡처 — 분석 중 매장 변경 시 결과 무시
    const requestStoreId = storeId;
    setAiLoading(true);
    // 60초 타임아웃 — Gemini 응답이 느릴 때 사용자가 영원히 기다리지 않도록
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60_000);
    try {
      // 1) 도면 이미지의 자연 크기를 측정 → 이미지 종횡비 그대로 캔버스 좌표계 구성
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const im = new Image();
        im.onload = () => resolve(im);
        im.onerror = () => reject(new Error(t("otables.ai.cannotRead", lang)));
        im.src = floorPlan;
      });
      // 캔버스 최대 변을 1200px로 스케일 (긴 변 기준)
      const MAX = 1200;
      const scale = Math.min(1, MAX / Math.max(img.width, img.height));
      const CW = Math.round(img.width * scale);
      const CH = Math.round(img.height * scale);

      const res = await fetch(api("/api/ai/floor-plan"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ image: floorPlan, canvasWidth: CW, canvasHeight: CH }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as {
        tables: Array<{
          number?: number;
          x: number; y: number;
          width?: number; height?: number;
          shape?: "square" | "circle";
          seats?: number;
        }>;
        structures?: Array<{
          kind?: "wall" | "door" | "room" | "counter";
          x: number; y: number;
          width: number; height: number;
          label?: string;
        }>;
      };

      // 2) 정규화 좌표 (0~1) → 실제 픽셀로 변환
      const clamp = (v: number, min: number, max: number) =>
        Number.isFinite(v) ? Math.max(min, Math.min(max, Math.round(v))) : min;
      // AI가 정규화 대신 픽셀로 반환할 가능성도 있어 자동 감지
      const looksNormalized = (arr: { x: number; y: number; width?: number; height?: number }[]) => {
        if (!arr.length) return true;
        return arr.every((t) => (t.x ?? 0) <= 1.5 && (t.y ?? 0) <= 1.5 && (t.width ?? 0) <= 1.5 && (t.height ?? 0) <= 1.5);
      };
      const all = [...(data.tables ?? []), ...(data.structures ?? [])];
      const normalized = looksNormalized(all);
      const toPx = (v: number, isX: boolean) =>
        normalized ? Math.round(v * (isX ? CW : CH)) : Math.round(v);

      // 3) 테이블 정제 — 좌석만 추출, 번호 1부터 재부여
      const cleanedTables = (data.tables ?? [])
        .map((t) => {
          const w = clamp(toPx(t.width ?? 0.06, true) || 70, 30, 300);
          const h = clamp(toPx(t.height ?? 0.06, false) || 70, 30, 300);
          return {
            type: "table" as TableDoc["type"], // AI 응답은 자리만 받음. room/door는 structures로 분리
            x: clamp(toPx(t.x, true), 0, CW - w),
            y: clamp(toPx(t.y, false), 0, CH - h),
            width: w,
            height: h,
            shape: (t.shape === "circle" ? "circle" : "square") as "square" | "circle",
            seats: clamp(t.seats ?? 4, 1, 30),
          };
        })
        .map((t, i) => ({ ...t, number: i + 1 }));

      // 4) 구조물 정제 — 벽/문/룸/카운터 (Firestore 저장 X, 시각 안내용)
      const VALID_KINDS = new Set(["wall", "door", "room", "counter"]);
      const cleanedStructures = (data.structures ?? [])
        .filter((s) => VALID_KINDS.has(s.kind ?? "wall"))
        .map((s) => ({
          kind: (s.kind ?? "wall") as AiStructure["kind"],
          x: clamp(toPx(s.x, true), 0, CW),
          y: clamp(toPx(s.y, false), 0, CH),
          width: clamp(toPx(s.width, true) || 20, 4, CW),
          height: clamp(toPx(s.height, false) || 20, 4, CH),
          label: s.label?.slice(0, 20),
        }));

      if (cleanedTables.length === 0 && cleanedStructures.length === 0) {
        throw new Error(t("otables.ai.empty", lang));
      }

      // 분석 중 매장이 바뀌었다면 결과 폐기 — 다른 매장에 적용되지 않도록
      if (requestStoreId !== storeId) {
        showToast(t("otables.ai.storeChanged", lang), "info");
        return;
      }

      setAiCanvasSize({ w: CW, h: CH });
      setAiDraft(cleanedTables);
      setAiStructures(cleanedStructures.length ? cleanedStructures : null);
      const structSuffix = cleanedStructures.length ? t("otables.ai.structSuffix", lang, { n: cleanedStructures.length }) : "";
      const msg = t("otables.ai.recognized", lang, { tables: cleanedTables.length, structures: structSuffix });
      showToast(msg, "success");
    } catch (e: any) {
      const msg = String(e?.message ?? "");
      if (msg.includes("AI_NOT_CONFIGURED")) {
        showToast(t("otables.ai.notConfigured", lang), "error");
      } else if (msg.includes("429") || msg.includes("분당") || msg.includes("10초")) {
        showToast(t("otables.ai.rateLimit", lang), "error");
      } else if (msg.toLowerCase().includes("abort") || msg.toLowerCase().includes("timeout")) {
        showToast(t("otables.ai.timeout", lang), "error");
      } else {
        showToast(t("otables.ai.failed", lang, { msg: msg || "" }), "error");
      }
    } finally {
      clearTimeout(timeoutId);
      setAiLoading(false);
    }
  };

  const applyAiDraft = async () => {
    if (!aiDraft || !storeId) return;
    // 적용 시점의 매장 ID 캡처 — 비동기 작업 중 매장 변경 방어
    const activeStoreId = storeId;
    const existing = tables.filter((t) => t.storeId === activeStoreId);
    // 명시적 confirm — destructive 작업
    if (existing.length > 0) {
      const ok = window.confirm(
        t("otables.ai.applyConfirm", lang, { existing: existing.length, next: aiDraft.length })
      );
      if (!ok) return;
    }
    setSelected(null); // 선택 해제 — 곧 삭제될 객체를 가리키지 않도록
    let deleteFails = 0;
    let createFails = 0;
    for (const tbl of existing) {
      try {
        await deleteTable(activeStoreId, tbl.number);
      } catch (e) {
        deleteFails++;
        console.error("[applyAiDraft delete]", tbl.number, e);
      }
    }
    for (const d of aiDraft) {
      const doc: TableDoc = {
        id: `${activeStoreId}_${d.number}`,
        number: d.number,
        storeId: activeStoreId,
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
        await updateTableLayout(activeStoreId, d.number, doc);
      } catch (e) {
        createFails++;
        console.error("[applyAiDraft create]", d.number, e);
      }
    }
    setAiDraft(null);
    setAiStructures(null);
    // aiCanvasSize는 의도적으로 유지 — 도면 종횡비 매칭이 깨지지 않도록
    // (사용자가 도면을 제거하거나 새로 업로드할 때만 reset)
    if (deleteFails === 0 && createFails === 0) {
      showToast(t("otables.ai.applyOk", lang), "success");
    } else {
      showToast(
        t("otables.ai.applyPartial", lang, { del: deleteFails, create: createFails }),
        "error"
      );
    }
  };

  const discardAiDraft = () => {
    setAiDraft(null);
    setAiStructures(null);
    setAiCanvasSize(null);
  };

  useEffect(() => {
    try {
      localStorage.setItem("gyeol:tables-view", view);
    } catch {
      /* 쿼터 초과·시크릿모드 등 — 다음 진입 시 기본값 사용 */
    }
  }, [view]);

  // 선택 동기화 (store 업데이트 반영)
  useEffect(() => {
    if (selected) {
      const fresh = tables.find((t) => t.id === selected.id);
      if (fresh) setSelected(fresh);
      else setSelected(null);
    }
  }, [tables, selected?.id]);

  // 모바일: 테이블 선택 시 상세 카드로 자동 스크롤 (데스크탑 sticky는 그대로)
  const detailRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!selected) return;
    if (typeof window === "undefined") return;
    if (window.innerWidth >= 1024) return; // lg 이상은 sticky라 스크롤 불필요
    // 다음 paint 후 스크롤 — DOM이 새 카드 렌더 끝낸 다음
    const id = setTimeout(() => {
      detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
    return () => clearTimeout(id);
  }, [selected?.id]);

  const sorted = [...tables].sort((a, b) => a.number - b.number);

  return (
    <OwnerShell
      title={t("otables.title", lang)}
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
              {t("otables.view.list", lang)}
            </button>
            <button
              onClick={() => setView("layout")}
              className={cn(
                "h-9 px-3.5 rounded-full text-[12px] font-bold inline-flex items-center gap-1.5 transition-all",
                view === "layout" ? "bg-white text-[var(--color-navy-800)] shadow-[var(--shadow-press)]" : "text-[var(--color-ink-500)]"
              )}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              {t("otables.view.layout", lang)}
            </button>
          </div>
          <button
            onClick={() => {
              if (confirm(t("otables.resetConfirm", lang))) {
                initTables(storeId);
              }
            }}
            className="h-10 px-3 rounded-full hover:bg-[var(--color-navy-50)] inline-flex items-center gap-1.5 text-[13px] font-bold text-[var(--color-navy-800)]"
            aria-label={t("otables.reset", lang)}
          >
            <RotateCcw className="w-4 h-4" />
            <span className="hidden sm:inline">{t("otables.reset", lang)}</span>
          </button>
        </div>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-5 lg:gap-6">
        <div className="lg:col-span-2 xl:col-span-3">
          {/* Add buttons */}
          <div className="grid grid-cols-3 gap-2">
            <Button size="md" variant="ghost" onClick={() => addTable(storeId, "table")} leftIcon={<Plus className="w-4 h-4" />}>
              {t("otables.addTable", lang)}
            </Button>
            <Button size="md" variant="ghost" onClick={() => addTable(storeId, "room")} leftIcon={<Sofa className="w-4 h-4" />}>
              {t("otables.addRoom", lang)}
            </Button>
            <Button size="md" variant="ghost" onClick={() => addTable(storeId, "door")} leftIcon={<DoorOpen className="w-4 h-4" />}>
              {t("otables.addDoor", lang)}
            </Button>
          </div>

          {/* Sections */}
          <Card padding="md" className="mt-4">
            <div className="flex items-center gap-2 mb-3">
              <Layers className="w-4 h-4 text-[var(--color-navy-700)]" />
              <h3 className="text-[14px] font-bold text-[var(--color-navy-900)]">{t("otables.sections", lang)}</h3>
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
                placeholder={t("otables.sectionPh", lang)}
                value={newSection}
                onChange={(e) => setNewSection(e.target.value)}
              />
              <Button size="md" type="submit" disabled={!newSection.trim()}>
                {t("otables.sectionAdd", lang)}
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
                  {t("otables.empty", lang)}
                </Card>
              ) : (
                sorted.map((tbl) => {
                  const st = STATUS_FLOW[tbl.status ?? "available"];
                  return (
                    <Card
                      key={tbl.id}
                      padding="md"
                      className={cn(
                        "flex items-center gap-3 transition-shadow cursor-pointer",
                        selected?.id === tbl.id && "ring-2 ring-[var(--color-navy-700)]"
                      )}
                      onClick={() => setSelected((s) => (s?.id === tbl.id ? null : tbl))}
                    >
                      <div className="w-10 h-10 rounded-xl bg-[var(--color-navy-50)] text-[var(--color-navy-800)] font-extrabold inline-flex items-center justify-center">
                        {tbl.number}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-bold text-[var(--color-navy-900)]">
                          {tbl.type === "room"
                            ? t("otables.type.room", lang)
                            : tbl.type === "door"
                            ? t("otables.type.door", lang)
                            : t("otables.type.table", lang)} {tbl.number}
                        </p>
                        {tbl.type !== "door" && <p className="body-sm">{t("otables.seats", lang, { n: tbl.seats })}</p>}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          updateTableStatus(storeId, tbl.number, st.next);
                        }}
                        className={`px-2.5 py-1 rounded-full text-[12px] font-bold ${st.cls}`}
                      >
                        {t(st.labelKey, lang)}
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
                  const persist = async (finalData: string) => {
                    if (!safeStoreFloorPlan(finalData)) return;
                    setFloorPlan(finalData);
                    setAiDraft(null);
                    setAiStructures(null);
                    await measureAndSetCanvas(finalData);
                    showToast(t("otables.sketch.saved", lang), "success");
                  };

                  if (dataUrl.length <= 4_500_000) {
                    persist(dataUrl);
                    return;
                  }
                  // 큰 PNG는 캔버스로 재인코딩해 JPEG 0.85로 축약
                  const tmp = document.createElement("canvas");
                  const im = new Image();
                  im.onload = () => {
                    const ratio = Math.min(1, 1280 / im.width);
                    tmp.width = Math.round(im.width * ratio);
                    tmp.height = Math.round(im.height * ratio);
                    const ctx = tmp.getContext("2d");
                    if (!ctx) { showToast(t("otables.floorplan.imageProcFail", lang), "error"); return; }
                    ctx.fillStyle = "#ffffff";
                    ctx.fillRect(0, 0, tmp.width, tmp.height);
                    ctx.drawImage(im, 0, 0, tmp.width, tmp.height);
                    const reduced = tmp.toDataURL("image/jpeg", 0.85);
                    persist(reduced);
                  };
                  im.onerror = () => showToast(t("otables.floorplan.imageProcFail", lang), "error");
                  im.src = dataUrl;
                }}
                aiLoading={aiLoading}
                aiDraftCount={aiDraft?.length ?? 0}
                onRunAi={runAiDraft}
                onApplyAi={applyAiDraft}
                onDiscardAi={discardAiDraft}
              />
              <LayoutCanvas
                tables={sorted}
                selectedId={selected?.id ?? null}
                onSelect={(t) => setSelected((s) => (s?.id === t.id ? null : t))}
                onMove={(t, x, y) => updateTableLayout(storeId, t.number, { x, y })}
                backgroundDataUrl={floorPlan}
                backgroundOpacity={floorPlanOpacity}
                aiDraft={aiDraft}
                aiStructures={aiStructures}
                canvasOverride={aiCanvasSize}
              />
            </>
          )}
        </div>

        {/* Right rail: selected detail */}
        <div ref={detailRef} className="scroll-mt-[80px]">
          {selected ? (
            <Card padding="lg" className="lg:sticky lg:top-[88px]">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-[12px] font-bold text-[var(--color-ink-500)] uppercase tracking-wide">
                    {selected.type === "room"
                      ? t("otables.type.room", lang)
                      : selected.type === "door"
                      ? t("otables.type.door", lang)
                      : t("otables.type.table", lang)}
                  </p>
                  <p className="text-[22px] font-extrabold text-[var(--color-navy-900)] tracking-tight">
                    {t("otables.numSuffix", lang, { n: selected.number })}
                  </p>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${STATUS_FLOW[selected.status ?? "available"].cls}`}>
                  {t(STATUS_FLOW[selected.status ?? "available"].labelKey, lang)}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[12px] text-[var(--color-ink-500)] mb-1.5 font-semibold">{t("otables.field.seats", lang)}</p>
                  <NumberField
                    value={selected.seats}
                    min={1}
                    max={99}
                    onCommit={(v) => updateTableLayout(storeId, selected.number, { seats: v })}
                  />
                </div>
                <div>
                  <p className="text-[12px] text-[var(--color-ink-500)] mb-1.5 font-semibold">{t("otables.field.section", lang)}</p>
                  <select
                    value={selected.sectionId ?? ""}
                    onChange={(e) =>
                      updateTableLayout(storeId, selected.number, {
                        sectionId: e.target.value || null,
                      } as any)
                    }
                    className="input-field"
                  >
                    <option value="">{t("otables.field.sectionNone", lang)}</option>
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
                <p className="text-[12px] text-[var(--color-ink-500)] mb-1.5 font-semibold">{t("otables.field.shape", lang)}</p>
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
                    <Square className="w-4 h-4" /> {t("otables.shape.square", lang)}
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
                    <Circle className="w-4 h-4" /> {t("otables.shape.circle", lang)}
                  </button>
                </div>
              </div>

              <div className="mt-4">
                <p className="text-[12px] text-[var(--color-ink-500)] mb-1.5 font-semibold flex items-center gap-1">
                  <Maximize2 className="w-3 h-3" /> {t("otables.field.size", lang)}
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
                  if (confirm(t("otables.deleteConfirm", lang, { n: selected.number }))) {
                    deleteTable(storeId, selected.number);
                    setSelected(null);
                  }
                }}
              >
                {t("otables.delete", lang)}
              </Button>
            </Card>
          ) : (
            <Card padding="lg" className="text-center body-md hidden lg:block lg:sticky lg:top-[88px]">
              {view === "layout" ? (
                <>
                  <Move className="w-8 h-8 text-[var(--color-ink-300)] mx-auto mb-2" />
                  {t("otables.hintTouch", lang)}
                </>
              ) : (
                <>{t("otables.hintMouse", lang)}</>
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
  const lang = useLanguage();
  const fileRef = useRef<HTMLInputElement>(null);
  const [sketchOpen, setSketchOpen] = useState(false);
  return (
    <Card padding="md" className="mt-4">
      <div className="flex items-center gap-2 mb-3">
        <ImagePlus className="w-4 h-4 text-[var(--color-navy-700)]" />
        <h3 className="text-[14px] font-bold text-[var(--color-navy-900)]">{t("otables.floorplan.title", lang)}</h3>
        <span className="ml-auto text-[10.5px] text-[var(--color-ink-400)] font-medium">
          {t("otables.floorplan.localOnly", lang)}
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
            <span className="text-[13px] font-bold">{t("otables.floorplan.upload", lang)}</span>
            <span className="text-[11px] font-medium opacity-70">JPG · PNG</span>
          </button>
          <button
            onClick={() => setSketchOpen(true)}
            className="h-28 rounded-[12px] border-2 border-dashed border-[var(--color-mint-300)] hover:border-[var(--color-mint-500)] bg-[var(--color-mint-50)]/40 hover:bg-[var(--color-mint-50)] flex flex-col items-center justify-center gap-1 text-[var(--color-mint-700)] transition-colors"
          >
            <Pencil className="w-5 h-5" />
            <span className="text-[13px] font-bold">{t("otables.floorplan.draw", lang)}</span>
            <span className="text-[11px] font-medium opacity-70">{t("otables.floorplan.drawDesc", lang)}</span>
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => fileRef.current?.click()}
              className="h-9 px-2.5 sm:px-3 rounded-full bg-[var(--color-navy-50)] text-[12px] font-bold text-[var(--color-navy-800)] inline-flex items-center gap-1"
              aria-label={t("otables.floorplan.reupload", lang)}
            >
              <ImagePlus className="w-3.5 h-3.5" /> <span className="hidden sm:inline">{t("otables.floorplan.reupload", lang)}</span>
            </button>
            <button
              onClick={() => setSketchOpen(true)}
              className="h-9 px-2.5 sm:px-3 rounded-full bg-[var(--color-mint-50)] text-[12px] font-bold text-[var(--color-mint-700)] inline-flex items-center gap-1"
              aria-label={t("otables.floorplan.editSketch", lang)}
            >
              <Pencil className="w-3.5 h-3.5" /> <span className="hidden sm:inline">{t("otables.floorplan.editSketch", lang)}</span>
            </button>
            <button
              onClick={onRemove}
              className="h-9 px-2.5 sm:px-3 rounded-full hover:bg-[#fef2f2] text-[12px] font-bold text-[var(--color-danger)] inline-flex items-center gap-1"
              aria-label={t("otables.floorplan.remove", lang)}
            >
              <X className="w-3.5 h-3.5" /> <span className="hidden sm:inline">{t("otables.floorplan.remove", lang)}</span>
            </button>
            <div className="ml-auto flex items-center gap-1.5 w-full sm:w-auto sm:min-w-[140px] mt-1.5 sm:mt-0">
              <span className="text-[11px] font-bold text-[var(--color-ink-600)] whitespace-nowrap">{t("otables.floorplan.opacity", lang, { pct: opacity })}</span>
              <input
                type="range"
                min={10}
                max={90}
                value={opacity}
                onChange={(e) => onOpacity(Number(e.target.value))}
                className="flex-1"
                aria-label={t("otables.floorplan.opacityAria", lang)}
              />
            </div>
          </div>

          {aiDraftCount > 0 ? (
            <div className="rounded-[12px] border-[1.5px] border-[var(--color-mint-300)] bg-[var(--color-mint-50)] p-3 flex flex-col sm:flex-row sm:items-center gap-2.5">
              <div className="flex-1">
                <p className="text-[13px] font-extrabold text-[var(--color-navy-900)] inline-flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[var(--color-mint-700)]" />
                  {t("otables.ai.draftTitle", lang, { n: aiDraftCount })}
                </p>
                <p
                  className="text-[11.5px] text-[var(--color-ink-600)] mt-0.5"
                  dangerouslySetInnerHTML={{ __html: t("otables.ai.draftWarn", lang).replace(/<b>/g, '<b class="text-[var(--color-danger)]">') }}
                />
              </div>
              <div className="flex gap-2">
                <Button size="md" variant="ghost" onClick={onDiscardAi}>{t("otables.ai.cancel", lang)}</Button>
                <Button size="md" onClick={onApplyAi} leftIcon={<Wand2 className="w-4 h-4" />}>
                  {t("otables.ai.apply", lang)}
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
              {t("otables.ai.generate", lang)}
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
  const lang = useLanguage();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const [tool, setTool] = useState<"pen" | "eraser">("pen");
  const [size, setSize] = useState(4);
  const [color, setColor] = useState("#0B1220");
  const [dirty, setDirty] = useState(false);
  // 초기 이미지 로드 race 방지: 이미지가 다 그려지기 전까지 입력 차단
  const [ready, setReady] = useState(!initialDataUrl);
  // 강제 리렌더 (canUndo/canRedo 표시 갱신용)
  const [, force] = useState(0);
  const drawingRef = useRef(false);
  const lastRef = useRef<{ x: number; y: number } | null>(null);
  // 되돌리기/다시실행 dataURL 스택 — ImageData 대비 메모리 70-90% 절감, 모바일 OOM 방지
  const historyRef = useRef<string[]>([]);
  const redoRef = useRef<string[]>([]);

  // 캔버스 초기화 + 회전·리사이즈 시 그림 보존 재설정
  useEffect(() => {
    let mounted = true;
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const setupCanvas = (preserveData?: string) => {
      // 데스크탑은 Retina 선명도 확보 위해 DPR 3까지, 모바일은 메모리 보호로 2 상한
      const isDesktop = window.innerWidth >= 1024;
      const dpr = Math.min(window.devicePixelRatio || 1, isDesktop ? 3 : 2);
      const rect = wrap.getBoundingClientRect();
      if (rect.width < 10 || rect.height < 10) return; // 모달 진입 중
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, rect.width, rect.height);
      if (preserveData) {
        setReady(false);
        const img = new Image();
        img.onload = () => {
          if (!mounted) return;
          ctx.drawImage(img, 0, 0, rect.width, rect.height);
          setReady(true);
        };
        img.onerror = () => mounted && setReady(true);
        img.src = preserveData;
      } else if (initialDataUrl) {
        setReady(false);
        const img = new Image();
        img.onload = () => {
          if (!mounted) return;
          const r = Math.min(rect.width / img.width, rect.height / img.height);
          const w = img.width * r;
          const h = img.height * r;
          ctx.drawImage(img, (rect.width - w) / 2, (rect.height - h) / 2, w, h);
          historyRef.current = [];
          pushHistory();
          setReady(true);
        };
        img.onerror = () => mounted && setReady(true);
        img.src = initialDataUrl;
      } else {
        historyRef.current = [];
        pushHistory();
        setReady(true);
      }
    };

    setupCanvas();

    // 화면 회전 / 창 크기 변경 시 현재 그림을 보존하고 캔버스 재설정
    let resizeTimer: ReturnType<typeof setTimeout> | undefined;
    const onResize = () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        try {
          const snapshot = canvas.toDataURL("image/png");
          setupCanvas(snapshot);
        } catch {
          setupCanvas();
        }
      }, 150);
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);

    return () => {
      mounted = false;
      if (resizeTimer) clearTimeout(resizeTimer);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialDataUrl]);

  const pushHistory = (clearRedo = true) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      const snap = canvas.toDataURL("image/png");
      historyRef.current.push(snap);
      if (historyRef.current.length > 12) historyRef.current.shift();
      // 새 그리기 발생 → redo 스택은 무효
      if (clearRedo) redoRef.current = [];
      force((n) => n + 1);
    } catch {
      /* CORS 등 직렬화 실패 시 무시 */
    }
  };

  // 마지막 restore 호출만 화면에 반영 — undo/redo 빠르게 누를 때 이전 이미지 onload 가 늦게 도착해
  // 사용자가 본 상태와 캔버스가 어긋나는 race 방지.
  const restoreTokenRef = useRef(0);
  const restoreFromDataUrl = (dataUrl: string) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const token = ++restoreTokenRef.current;
    const img = new Image();
    img.onload = () => {
      if (token !== restoreTokenRef.current) return; // 더 새 호출이 있으면 폐기
      if (!canvasRef.current) return; // 언마운트 방어
      const rect = canvas.getBoundingClientRect();
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
      ctx.drawImage(img, 0, 0, rect.width, rect.height);
    };
    img.onerror = () => {
      // 손상된 dataURL — 무한 대기 방지, 사용자에게 별도 알림은 불필요(히스토리 내부값이므로)
      if (token !== restoreTokenRef.current) return;
      console.warn("[SketchPad] restoreFromDataUrl: 이미지 로드 실패");
    };
    img.src = dataUrl;
  };

  const undo = () => {
    if (historyRef.current.length <= 1) return;
    const current = historyRef.current.pop();
    if (current) redoRef.current.push(current);
    const last = historyRef.current[historyRef.current.length - 1];
    if (!last) return;
    restoreFromDataUrl(last);
    force((n) => n + 1);
  };

  const redo = () => {
    if (redoRef.current.length === 0) return;
    const next = redoRef.current.pop();
    if (!next) return;
    historyRef.current.push(next);
    if (historyRef.current.length > 12) historyRef.current.shift();
    restoreFromDataUrl(next);
    setDirty(true);
    force((n) => n + 1);
  };

  const clearAll = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    if (dirty && !window.confirm(t("otables.sketch.clearConfirm", lang))) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    pushHistory();
    setDirty(false);
  };

  const pos = (e: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onDown = (e: React.PointerEvent) => {
    if (!ready) return; // 초기 이미지 로드 전 입력 무시
    e.preventDefault();
    try { (e.target as Element).setPointerCapture(e.pointerId); } catch { /* 미지원 브라우저 */ }
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
    setDirty(true);
    pushHistory();
  };

  const save = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    onSave(canvas.toDataURL("image/png"));
  };

  const handleClose = () => {
    if (dirty && !window.confirm(t("otables.sketch.unsavedConfirm", lang))) return;
    onClose();
  };

  // 키보드 단축키 (데스크탑) — ESC: 닫기, Ctrl/Cmd+Z: 실행취소, Ctrl/Cmd+Y or Shift+Z: 다시실행, Delete/Backspace: 지움, B: 펜, E: 지우개
  // 핸들러 최신 참조를 ref로 보관 — 매 dirty 변경마다 listener 재등록하지 않으면서도 stale closure 방지
  const handlersRef = useRef({ handleClose, undo, redo, clearAll });
  handlersRef.current = { handleClose, undo, redo, clearAll };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // input·textarea·color picker 안에선 무시
      const targ = e.target as HTMLElement | null;
      if (targ && (targ.tagName === "INPUT" || targ.tagName === "TEXTAREA" || targ.isContentEditable)) return;
      const meta = e.ctrlKey || e.metaKey;
      const h = handlersRef.current;
      if (e.key === "Escape") { e.preventDefault(); h.handleClose(); return; }
      if (meta && (e.key === "z" || e.key === "Z")) {
        e.preventDefault();
        if (e.shiftKey) h.redo();
        else h.undo();
        return;
      }
      if (meta && (e.key === "y" || e.key === "Y")) { e.preventDefault(); h.redo(); return; }
      if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); h.clearAll(); return; }
      if (e.key === "b" || e.key === "B") { e.preventDefault(); setTool("pen"); return; }
      if (e.key === "e" || e.key === "E") { e.preventDefault(); setTool("eraser"); return; }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // 모달 열릴 때 포커스를 안으로 이동 (Tab 트랩의 약식 구현) + 배경 스크롤 잠금
  useEffect(() => {
    const focusTimer = setTimeout(() => {
      modalRef.current?.focus();
    }, 50);
    // 배경 스크롤 잠금 — 캔버스 그리기 중 페이지가 같이 스크롤되는 사고 방지
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      clearTimeout(focusTimer);
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  const canUndo = historyRef.current.length > 1;
  const canRedo = redoRef.current.length > 0;
  const isMac = typeof navigator !== "undefined" && /Mac/i.test(navigator.platform);
  const modKey = isMac ? "⌘" : "Ctrl";

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-stretch sm:items-center justify-center sm:p-4"
      style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div
        ref={modalRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={t("otables.sketch.aria", lang)}
        className="w-full sm:max-w-3xl lg:max-w-5xl bg-white sm:rounded-[18px] overflow-hidden shadow-[var(--shadow-lifted)] flex flex-col outline-none"
        style={{ maxHeight: "100vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-4 h-12 border-b border-[var(--color-line)] shrink-0">
          <Pencil className="w-4 h-4 text-[var(--color-navy-700)]" />
          <h3 className="text-[14px] font-extrabold text-[var(--color-navy-900)]">{t("otables.sketch.title", lang)}</h3>
          {dirty && <span className="text-[10px] font-bold text-[var(--color-mint-700)] bg-[var(--color-mint-50)] px-2 py-0.5 rounded-full">{t("otables.sketch.editing", lang)}</span>}
          <span className="ml-auto text-[10.5px] text-[var(--color-ink-400)] font-medium hidden lg:inline">
            {t("otables.sketch.shortcuts", lang, { mod: modKey })}
          </span>
          <button onClick={handleClose} className="lg:ml-3 h-9 w-9 rounded-full hover:bg-[var(--color-ink-50)] inline-flex items-center justify-center" aria-label={t("otables.sketch.close", lang)}>
            <X className="w-5 h-5 text-[var(--color-ink-600)]" />
          </button>
        </div>

        <div className="px-2 py-2 flex items-center gap-1.5 flex-wrap border-b border-[var(--color-line-soft)] bg-[var(--color-navy-50)]/40 shrink-0">
          <button
            onClick={() => setTool("pen")}
            className={cn(
              "h-9 px-3 rounded-full text-[12px] font-bold inline-flex items-center gap-1",
              tool === "pen" ? "bg-[var(--color-navy-700)] text-white" : "bg-white text-[var(--color-navy-800)]"
            )}
          >
            <Pencil className="w-3.5 h-3.5" /> <span className="hidden xs:inline">{t("otables.sketch.pen", lang)}</span>
          </button>
          <button
            onClick={() => setTool("eraser")}
            className={cn(
              "h-9 px-3 rounded-full text-[12px] font-bold inline-flex items-center gap-1",
              tool === "eraser" ? "bg-[var(--color-navy-700)] text-white" : "bg-white text-[var(--color-navy-800)]"
            )}
          >
            <Eraser className="w-3.5 h-3.5" /> <span className="hidden xs:inline">{t("otables.sketch.eraser", lang)}</span>
          </button>
          <div className="flex items-center gap-1.5">
            <input type="range" min={1} max={20} value={size} onChange={(e) => setSize(Number(e.target.value))} className="w-16 sm:w-24" aria-label={t("otables.sketch.thickness", lang)} />
            <span className="text-[11px] font-bold text-[var(--color-ink-700)] w-5 text-center">{size}</span>
          </div>
          {tool === "pen" && (
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-9 w-9 rounded-full border-[1.5px] border-[var(--color-line)] bg-white cursor-pointer shrink-0"
              aria-label={t("otables.sketch.color", lang)}
            />
          )}
          <button
            onClick={undo}
            disabled={!canUndo}
            className="h-9 px-2.5 rounded-full bg-white text-[12px] font-bold text-[var(--color-navy-800)] inline-flex items-center gap-1 disabled:opacity-40"
            aria-label={t("otables.sketch.undo", lang, { mod: modKey })}
            title={t("otables.sketch.undo", lang, { mod: modKey })}
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={redo}
            disabled={!canRedo}
            className="h-9 px-2.5 rounded-full bg-white text-[12px] font-bold text-[var(--color-navy-800)] inline-flex items-center gap-1 disabled:opacity-40"
            aria-label={t("otables.sketch.redo", lang, { mod: modKey })}
            title={t("otables.sketch.redo", lang, { mod: modKey })}
          >
            <Undo2 className="w-3.5 h-3.5 scale-x-[-1]" />
          </button>
          <button
            onClick={clearAll}
            className="h-9 px-2.5 rounded-full bg-white text-[12px] font-bold text-[var(--color-danger)] inline-flex items-center gap-1"
            aria-label={t("otables.sketch.clear", lang)}
            title={t("otables.sketch.clear", lang)}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div
          ref={wrapRef}
          className="relative bg-white flex-1 overflow-hidden min-h-[200px] sm:min-h-[360px]"
        >
          <canvas
            ref={canvasRef}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            className="block cursor-crosshair"
            style={{ touchAction: "none" }}
          />
        </div>

        <div className="px-4 py-3 border-t border-[var(--color-line)] flex items-center gap-2 justify-end shrink-0">
          <Button variant="ghost" onClick={handleClose}>{t("otables.sketch.cancel", lang)}</Button>
          <Button onClick={save} leftIcon={<Check className="w-4 h-4" />}>
            {t("otables.sketch.useAsPlan", lang)}
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
  aiStructures?: Array<{ kind: "wall" | "door" | "room" | "counter"; x: number; y: number; width: number; height: number; label?: string }> | null;
  /** AI 분석 시점에 정한 캔버스 크기 (도면 종횡비 기반). 있으면 기존 maxX/Y 계산보다 우선. */
  canvasOverride?: { w: number; h: number } | null;
}

function LayoutCanvas({
  tables, selectedId, onSelect, onMove,
  backgroundDataUrl, backgroundOpacity = 35,
  aiDraft, aiStructures, canvasOverride,
}: CanvasProps) {
  const lang = useLanguage();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ id: string; x: number; y: number } | null>(null);
  // 모바일·소화면용 줌 (0.5x ~ 2x)
  const [zoom, setZoom] = useState(1);

  // 캔버스 크기: AI 오버라이드 > 테이블 최대 좌표 > 최소 800x600
  const maxX = tables.reduce((m, tbl) => Math.max(m, (tbl.x ?? 0) + (tbl.width ?? 70)), 0);
  const maxY = tables.reduce((m, tbl) => Math.max(m, (tbl.y ?? 0) + (tbl.height ?? 70)), 0);
  const canvasW = canvasOverride?.w ?? Math.max(800, maxX + 100);
  const canvasH = canvasOverride?.h ?? Math.max(600, maxY + 100);

  // 전체 보기 — wrap 크기에 맞춰 자동 줌
  const fitToScreen = () => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    if (rect.width < 10 || rect.height < 10) return; // 레이아웃 미정 가드
    const sx = (rect.width - 16) / canvasW;
    const sy = (rect.height - 16) / canvasH;
    setZoom(Math.max(0.3, Math.min(2, Math.min(sx, sy))));
  };

  // AI 분석 결과로 canvasOverride가 바뀌면 모바일에서 자동으로 전체 보기
  useEffect(() => {
    if (!canvasOverride) return;
    // wrap 레이아웃이 안정된 후 fit
    const id = setTimeout(fitToScreen, 80);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasOverride?.w, canvasOverride?.h]);

  // 키보드 단축키 (데스크탑): +/- 줌, 0=전체보기
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const targ = e.target as HTMLElement | null;
      if (targ && (targ.tagName === "INPUT" || targ.tagName === "TEXTAREA" || targ.isContentEditable)) return;
      // 모달/그림판이 열려있을 때 충돌 방지 — 스케치팟에서도 같은 키를 다루므로 fixed inset 모달이 위에 있으면 스킵
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      if (e.key === "+" || e.key === "=") { e.preventDefault(); setZoom((z) => Math.min(2, +(z + 0.1).toFixed(2))); }
      else if (e.key === "-" || e.key === "_") { e.preventDefault(); setZoom((z) => Math.max(0.3, +(z - 0.1).toFixed(2))); }
      else if (e.key === "0") { e.preventDefault(); fitToScreen(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasW, canvasH]);

  // 마우스 휠 + Ctrl/Cmd 로 줌 (데스크탑)
  // React onWheel 은 passive listener 라 preventDefault 가 무시되어 페이지 전체가 같이 스크롤·확대됨.
  // native addEventListener 로 passive:false 등록해야 wheel 기본 동작을 막을 수 있다.
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const handler = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setZoom((z) => Math.max(0.3, Math.min(2, +(z + delta).toFixed(2))));
    };
    wrap.addEventListener("wheel", handler, { passive: false });
    return () => wrap.removeEventListener("wheel", handler);
  }, []);

  const structureStyleByKind: Record<string, string> = {
    wall: "bg-[var(--color-ink-700)]",
    door: "bg-transparent border-2 border-dashed border-[var(--color-warn)]",
    room: "bg-[var(--color-navy-50)]/40 border-[1.5px] border-dashed border-[var(--color-navy-300)]",
    counter: "bg-[var(--color-mint-50)]/60 border-[1.5px] border-[var(--color-mint-300)]",
  };
  const structureLabelByKind: Record<string, string> = {
    wall: t("otables.ai.struct.wall", lang),
    door: t("otables.ai.struct.door", lang),
    room: t("otables.ai.struct.room", lang),
    counter: t("otables.ai.struct.counter", lang),
  };

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
      // 줌 상태 보정: 화면 픽셀 이동량을 캔버스 좌표 이동량으로 환산
      const dx = (ev.clientX - startClientX) / Math.max(0.01, zoom);
      const dy = (ev.clientY - startClientY) / Math.max(0.01, zoom);
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

  const onMoveFinal = (tbl: TableDoc, x: number, y: number) => {
    onMove(tbl, Math.round(x), Math.round(y));
  };

  return (
    <div className="mt-4">
      <Card padding="none" className="overflow-hidden">
        <div className="px-3 py-2 bg-[var(--color-navy-50)] border-b border-[var(--color-line)] flex items-center gap-1.5 text-[11px] sm:text-[12px] font-semibold text-[var(--color-ink-700)] flex-wrap">
          <Move className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden sm:inline">{t("otables.canvas.hint", lang)}</span>
          <span className="sm:hidden">{t("otables.canvas.hintShort", lang)}</span>
          {/* 줌 컨트롤 — 모바일 작은 화면에서 한눈 보기 */}
          <div className="ml-auto inline-flex items-center gap-0.5">
            <button
              onClick={() => setZoom((z) => Math.max(0.3, +(z - 0.1).toFixed(2)))}
              className="h-7 w-7 rounded-md hover:bg-white text-[14px] font-bold text-[var(--color-navy-800)] flex items-center justify-center"
              aria-label={t("otables.canvas.zoomOut", lang)}
            >−</button>
            <span className="text-[11px] font-bold text-[var(--color-navy-800)] w-9 text-center">{Math.round(zoom * 100)}%</span>
            <button
              onClick={() => setZoom((z) => Math.min(2, +(z + 0.1).toFixed(2)))}
              className="h-7 w-7 rounded-md hover:bg-white text-[14px] font-bold text-[var(--color-navy-800)] flex items-center justify-center"
              aria-label={t("otables.canvas.zoomIn", lang)}
            >+</button>
            <button
              onClick={fitToScreen}
              className="h-7 px-2 rounded-md hover:bg-white text-[10.5px] font-bold text-[var(--color-navy-800)]"
              aria-label={t("otables.canvas.fit", lang)}
            >{t("otables.canvas.fitShort", lang)}</button>
            <button
              onClick={() => setZoom(1)}
              className="h-7 px-2 rounded-md hover:bg-white text-[10.5px] font-bold text-[var(--color-navy-800)] hidden sm:block"
              aria-label="100%"
            >1:1</button>
          </div>
        </div>
        <div
          ref={wrapRef}
          className="relative overflow-auto bg-white h-[min(70vh,640px)] landscape:h-[min(85vh,640px)] lg:h-[min(78vh,820px)]"
        >
          {/* 줌 시 스크롤바가 정확히 작동하도록 외부 wrapper가 시각 크기를 잡고, overflow:hidden으로 내부 layout box를 클립 */}
          <div style={{ width: canvasW * zoom, height: canvasH * zoom, overflow: "hidden", position: "relative" }}>
          <div
            className="relative origin-top-left bg-[repeating-linear-gradient(0deg,transparent,transparent_39px,#eef2f8_39px,#eef2f8_40px),repeating-linear-gradient(90deg,transparent,transparent_39px,#eef2f8_39px,#eef2f8_40px)]"
            style={{ width: canvasW, height: canvasH, transform: `scale(${zoom})`, transformOrigin: "top left" }}
          >
            {backgroundDataUrl && (
              <img
                src={backgroundDataUrl}
                alt={t("otables.bgAlt", lang)}
                draggable={false}
                // AI 캔버스 오버라이드 모드(도면 종횡비와 일치): stretch fill로 AI 좌표와 도면 위치 정확 매칭
                // 그렇지 않은 일반 모드: contain으로 비율 유지
                className={cn(
                  "absolute inset-0 w-full h-full pointer-events-none select-none",
                  canvasOverride ? "object-fill" : "object-contain"
                )}
                style={{ opacity: backgroundOpacity / 100 }}
              />
            )}
            {/* AI가 인식한 구조물 — 벽/문/룸/카운터, 시각 안내용 (Firestore에 저장되지 않음) */}
            {aiStructures?.map((s, i) => (
              <div
                key={`struct-${i}`}
                className={cn(
                  "absolute pointer-events-none flex items-center justify-center",
                  structureStyleByKind[s.kind] ?? "bg-[var(--color-ink-200)]/40"
                )}
                style={{ left: s.x, top: s.y, width: s.width, height: s.height }}
                title={s.label || structureLabelByKind[s.kind]}
              >
                {(s.kind === "room" || s.kind === "counter") && (
                  <span className="text-[10px] font-bold text-[var(--color-ink-700)] px-1 bg-white/70 rounded">
                    {s.label || structureLabelByKind[s.kind]}
                  </span>
                )}
              </div>
            ))}
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
                  <p className="text-[10px] font-bold opacity-80 mt-0.5">{t("otables.ai.suggestion", lang)}</p>
                </div>
              );
            })}
            {tables.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center text-[14px] text-[var(--color-ink-500)] font-medium">
                {t("otables.canvas.empty", lang)}
              </div>
            )}
            {tables.map((tbl) => {
              const isDragging = drag?.id === tbl.id;
              const x = isDragging ? drag!.x : tbl.x ?? 40;
              const y = isDragging ? drag!.y : tbl.y ?? 40;
              const w = tbl.width ?? (tbl.type === "room" ? 150 : 70);
              const h = tbl.height ?? (tbl.type === "room" ? 80 : 70);
              const isSelected = selectedId === tbl.id;

              const colorCls =
                tbl.type === "door"
                  ? "bg-[#fff1e0] text-[var(--color-warn)] border-[var(--color-warn)]/30"
                  : tbl.type === "room"
                  ? "bg-[var(--color-mint-100)] text-[var(--color-mint-700)] border-[var(--color-mint-300)]"
                  : tbl.status === "occupied"
                  ? "bg-[var(--color-mint-100)] text-[var(--color-mint-700)] border-[var(--color-mint-300)]"
                  : tbl.status === "dirty"
                  ? "bg-[#fff1e0] text-[var(--color-warn)] border-[var(--color-warn)]/30"
                  : "bg-white text-[var(--color-navy-800)] border-[var(--color-line)]";

              const shapeCls = tbl.shape === "circle" ? "rounded-full" : "rounded-[14px]";
              const typeLabel = tbl.type === "room" ? t("otables.type.room", lang) : tbl.type === "door" ? t("otables.type.door", lang) : t("otables.type.table", lang);

              return (
                <div
                  key={tbl.id}
                  onPointerDown={(e) => startDrag(e, tbl)}
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
                  title={`${typeLabel} ${tbl.number}`}
                >
                  <p className="text-[18px] font-extrabold leading-none">
                    {tbl.type === "door" ? t("otables.type.doorShort", lang) : tbl.number}
                  </p>
                  {tbl.type !== "door" && (
                    <p className="text-[11px] font-semibold opacity-80 mt-0.5">{t("otables.seats", lang, { n: tbl.seats })}</p>
                  )}
                </div>
              );
            })}
          </div>
          </div>
        </div>
      </Card>
      <p className="mt-2 px-1 text-[12px] text-[var(--color-ink-600)] font-medium flex items-center gap-1">
        <Save className="w-3 h-3" /> {t("otables.canvas.autosave", lang)}
      </p>
    </div>
  );
}
