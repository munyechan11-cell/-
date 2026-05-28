import { useState } from "react";
import { Plus, Trash2, RotateCcw, Sofa, DoorOpen, Layers } from "lucide-react";
import { OwnerShell } from "../../components/layout/OwnerShell";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { useStore } from "../../store/store";
import { cn } from "../../lib/cn";
import type { TableDoc, TableStatus } from "../../lib/types";

const STATUS_FLOW: Record<TableStatus, { next: TableStatus; label: string; cls: string }> = {
  available: { next: "occupied", label: "비어있음", cls: "bg-[var(--color-ink-50)] text-[var(--color-ink-500)]" },
  occupied: { next: "paid", label: "사용 중", cls: "bg-[var(--color-mint-100)] text-[var(--color-mint-700)]" },
  paid: { next: "dirty", label: "결제 완료", cls: "bg-[var(--color-navy-50)] text-[var(--color-navy-700)]" },
  dirty: { next: "available", label: "정리 필요", cls: "bg-[#fff1e0] text-[#b45309]" },
};

export default function OwnerTables() {
  const {
    currentUser,
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
  const storeId = currentUser?.id ?? "";
  const [selected, setSelected] = useState<TableDoc | null>(null);
  const [newSection, setNewSection] = useState("");

  const sorted = [...tables].sort((a, b) => a.number - b.number);

  return (
    <OwnerShell
      title="테이블 편집"
      headerRight={
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
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 lg:gap-6">
        <div className="lg:col-span-2">
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
          <div className="flex gap-2">
            <Input
              placeholder="구역 이름 (예: 홀1)"
              value={newSection}
              onChange={(e) => setNewSection(e.target.value)}
            />
            <Button
              size="md"
              disabled={!newSection.trim()}
              onClick={() => {
                addSection(storeId, newSection.trim());
                setNewSection("");
              }}
            >
              추가
            </Button>
          </div>
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

        {/* Table list */}
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
                    "flex items-center gap-3 transition-shadow",
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
                    <p className="text-[12px] text-[var(--color-ink-500)]">{t.seats}인</p>
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

        </div>
        {/* Selected detail */}
        <div>
        {selected && (
          <Card padding="lg" className="lg:sticky lg:top-[88px]">
            <p className="text-[14px] font-bold text-[var(--color-navy-900)] mb-3">
              테이블 {selected.number} 설정
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[12px] text-[var(--color-ink-500)] mb-1.5">좌석 수</p>
                <Input
                  type="number"
                  value={selected.seats}
                  onChange={(e) =>
                    updateTableLayout(storeId, selected.number, { seats: Number(e.target.value) || 1 })
                  }
                />
              </div>
              <div>
                <p className="text-[12px] text-[var(--color-ink-500)] mb-1.5">구역</p>
                <select
                  value={selected.sectionId ?? ""}
                  onChange={(e) =>
                    updateTableLayout(storeId, selected.number, {
                      sectionId: e.target.value || undefined,
                    })
                  }
                  className="input-field h-13"
                  style={{ paddingTop: 14, paddingBottom: 14 }}
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
            <Button
              block
              variant="outline"
              className="mt-4 text-[var(--color-danger)] border-[var(--color-danger)]/30"
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
        )}
        {!selected && (
          <Card padding="lg" className="text-center body-md hidden lg:block lg:sticky lg:top-[88px]">
            테이블을 선택하면 상세 설정이 표시됩니다.
          </Card>
        )}
        </div>
      </div>
    </OwnerShell>
  );
}
