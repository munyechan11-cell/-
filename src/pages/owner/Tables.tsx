import { useEffect, useRef, useState } from "react";
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
} from "lucide-react";
import { OwnerShell } from "../../components/layout/OwnerShell";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { NumberField } from "../../components/ui/NumberField";
import { useStore } from "../../store/store";
import { cn } from "../../lib/cn";
import type { TableDoc, TableStatus } from "../../lib/types";

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
                        className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${st.cls}`}
                      >
                        {st.label}
                      </button>
                    </Card>
                  );
                })
              )}
            </div>
          ) : (
            <LayoutCanvas
              tables={sorted}
              selectedId={selected?.id ?? null}
              onSelect={(t) => setSelected((s) => (s?.id === t.id ? null : t))}
              onMove={(t, x, y) => updateTableLayout(storeId, t.number, { x, y })}
            />
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
// Layout Canvas (드래그로 매장 배치도)
// ============================================================
interface CanvasProps {
  tables: TableDoc[];
  selectedId: string | null;
  onSelect: (t: TableDoc) => void;
  onMove: (t: TableDoc, x: number, y: number) => void;
}

function LayoutCanvas({ tables, selectedId, onSelect, onMove }: CanvasProps) {
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
          className="relative overflow-auto bg-[repeating-linear-gradient(0deg,transparent,transparent_39px,#eef2f8_39px,#eef2f8_40px),repeating-linear-gradient(90deg,transparent,transparent_39px,#eef2f8_39px,#eef2f8_40px)] bg-white"
          style={{ height: "min(70vh, 640px)" }}
        >
          <div className="relative" style={{ width: canvasW, height: canvasH }}>
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
                    <p className="text-[10px] font-semibold opacity-70 mt-0.5">{t.seats}인</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </Card>
      <p className="mt-2 px-1 text-[11px] text-[var(--color-ink-500)] font-medium flex items-center gap-1">
        <Save className="w-3 h-3" /> 위치 변경은 손을 떼는 즉시 자동 저장됩니다.
      </p>
    </div>
  );
}
