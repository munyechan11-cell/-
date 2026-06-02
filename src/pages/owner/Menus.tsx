import { useMemo, useState } from "react";
import { Plus, Trash2, ToggleLeft, ToggleRight, Pencil } from "lucide-react";
import { OwnerShell } from "../../components/layout/OwnerShell";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { useStore } from "../../store/store";
import type { Menu } from "../../lib/types";
import { showToast } from "../../lib/toast";
import { useEscapeClose } from "../../lib/useEscapeClose";

interface Draft {
  id?: string;
  name: string;
  price: string;
  category: string;
  description: string;
  posProductCode: string;
  isAvailable: boolean;
}

const emptyDraft: Draft = {
  name: "",
  price: "",
  category: "메인",
  description: "",
  posProductCode: "",
  isAvailable: true,
};

export default function OwnerMenus() {
  const { effectiveStoreId, menus, addMenuItem, updateMenuItem, deleteMenuItem } = useStore();
  const storeId = effectiveStoreId;
  const myMenus = useMemo(
    () => menus.filter((m) => m.storeId === storeId).sort((a, b) => a.category.localeCompare(b.category)),
    [menus, storeId]
  );
  const grouped = useMemo(() => {
    const map: Record<string, Menu[]> = {};
    for (const m of myMenus) (map[m.category] ??= []).push(m);
    return map;
  }, [myMenus]);

  const [draft, setDraft] = useState<Draft | null>(null);
  useEscapeClose(!!draft, () => setDraft(null));

  const save = async () => {
    if (!draft) return;
    if (!draft.name.trim() || !draft.price) {
      showToast("이름과 가격은 필수입니다.", "error");
      return;
    }
    const price = Number(draft.price);
    if (!Number.isFinite(price) || price < 0) {
      showToast("가격을 다시 확인해 주세요.", "error");
      return;
    }
    // 새 메뉴는 storeId 가 반드시 있어야 함 — 빈 매장 ID 로 잘못된 곳에 저장되는 사고 차단
    if (!draft.id && !storeId) {
      showToast("매장 정보가 없어요. 다시 로그인해 주세요.", "error");
      return;
    }
    const data = {
      name: draft.name.trim(),
      price,
      category: draft.category.trim() || "기타",
      description: draft.description.trim(),
      posProductCode: draft.posProductCode.trim() || undefined,
      isAvailable: draft.isAvailable,
    };
    try {
      if (draft.id) {
        await updateMenuItem(draft.id, data);
        showToast("메뉴를 수정했습니다.", "success");
      } else {
        await addMenuItem(storeId, data);
        showToast("새 메뉴를 추가했어요.", "success");
      }
      setDraft(null);
    } catch (e: any) {
      showToast(`저장 실패: ${e?.message ?? "잠시 후 다시 시도해 주세요."}`, "error");
    }
  };

  return (
    <OwnerShell
      title="메뉴 관리"
      headerRight={
        <button
          onClick={() => setDraft({ ...emptyDraft })}
          className="h-10 px-4 rounded-full bg-[var(--color-navy-700)] text-white inline-flex items-center gap-1.5 text-[13px] font-bold shadow-[var(--shadow-navy)]"
        >
          <Plus className="w-4 h-4" />
          새 메뉴
        </button>
      }
    >
      <div>
        {myMenus.length === 0 && !draft && (
          <Card padding="lg" className="text-center body-md">
            아직 등록된 메뉴가 없습니다. 우측 상단의 “새 메뉴”로 추가해 주세요.
          </Card>
        )}

        {Object.entries(grouped).map(([cat, items]) => (
          <div key={cat} className="mt-2">
            <h3 className="label-xs px-1 mb-2 mt-3">
              {cat}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {items.map((m) => (
                <Card key={m.id} padding="md" className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-bold text-[var(--color-navy-900)] break-keep">{m.name}</p>
                    <p className="text-[13px] text-[var(--color-ink-600)] line-clamp-2 break-keep">
                      <span className="font-semibold text-[var(--color-navy-700)]">₩ {m.price.toLocaleString()}</span>
                      {m.description ? ` · ${m.description}` : ""}
                    </p>
                  </div>
                  <button
                    onClick={() => updateMenuItem(m.id, { isAvailable: !m.isAvailable })}
                    className="p-1 text-[var(--color-navy-700)]"
                    aria-label="판매 토글"
                  >
                    {m.isAvailable === false ? (
                      <ToggleLeft className="w-6 h-6 text-[var(--color-ink-300)]" />
                    ) : (
                      <ToggleRight className="w-6 h-6" />
                    )}
                  </button>
                  <button
                    onClick={() =>
                      setDraft({
                        id: m.id,
                        name: m.name,
                        price: String(m.price),
                        category: m.category,
                        description: m.description ?? "",
                        posProductCode: m.posProductCode ?? "",
                        isAvailable: m.isAvailable !== false,
                      })
                    }
                    className="w-9 h-9 rounded-full hover:bg-[var(--color-navy-50)] inline-flex items-center justify-center text-[var(--color-navy-700)]"
                    aria-label="편집"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Drawer-ish editor */}
      {draft && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end" onClick={() => setDraft(null)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[480px] mx-auto bg-white rounded-t-[28px] p-6 pb-[max(env(safe-area-inset-bottom),24px)] max-h-[88vh] overflow-y-auto"
          >
            <div className="w-12 h-1.5 rounded-full bg-[var(--color-ink-100)] mx-auto mb-5" />
            <h2 className="text-[18px] font-extrabold text-[var(--color-navy-900)] mb-4">
              {draft.id ? "메뉴 수정" : "새 메뉴"}
            </h2>
            <div className="space-y-4">
              <Input
                label="이름"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="가격"
                  inputMode="numeric"
                  value={draft.price}
                  onChange={(e) => setDraft({ ...draft, price: e.target.value.replace(/\D/g, "") })}
                />
                <Input
                  label="카테고리"
                  value={draft.category}
                  onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                />
              </div>
              <Input
                label="설명 (선택)"
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              />
              <Input
                label="POS 상품코드 (선택)"
                value={draft.posProductCode}
                onChange={(e) => setDraft({ ...draft, posProductCode: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3 mt-6">
              {draft.id && (
                <Button
                  variant="outline"
                  className="text-[var(--color-danger)] border-[var(--color-danger)]/30"
                  leftIcon={<Trash2 className="w-4 h-4" />}
                  onClick={async () => {
                    if (confirm("메뉴를 삭제하시겠습니까?")) {
                      await deleteMenuItem(draft.id!);
                      setDraft(null);
                    }
                  }}
                >
                  삭제
                </Button>
              )}
              <Button onClick={save} className={draft.id ? "" : "col-span-2"}>
                저장
              </Button>
            </div>
          </div>
        </div>
      )}
    </OwnerShell>
  );
}
