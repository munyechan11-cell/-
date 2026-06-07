/**
 * 재고·원가 관리 — 사장님 페이지.
 *
 * 3개 탭:
 *  1) 원재료 목록 — 등록/수정/삭제, 입고, 부족 알림
 *  2) 메뉴 레시피 — 메뉴별로 어떤 원재료 N단위 들어가는지 매핑
 *  3) 원가 리포트 — 최근 판매된 메뉴를 기반으로 자동 집계된 누적 원가
 *
 * 자동 차감: store.placeOrder 내부에서 menus.recipe × orderItem.quantity
 * 만큼 ingredient.stock 감소. 본 페이지는 시각화만 담당.
 */
import { useMemo, useState } from "react";
import {
  Plus,
  Edit2,
  Trash2,
  Package,
  Boxes,
  TrendingUp,
  AlertTriangle,
  X,
  PackagePlus,
} from "lucide-react";
import { OwnerShell } from "../../components/layout/OwnerShell";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { EmptyState } from "../../components/ui/EmptyState";
import { increment } from "firebase/firestore";
import { useStore } from "../../store/store";
import { showToast } from "../../lib/toast";
import { useLanguage, t, fmtKRW } from "../../lib/i18n";
import { useModalChrome } from "../../lib/useModalChrome";
import type { Ingredient, Menu } from "../../lib/types";

type Tab = "list" | "recipe" | "cost";

export default function OwnerInventory() {
  const {
    effectiveStoreId,
    ingredients,
    menus,
    orders,
    addIngredient,
    updateIngredient,
    deleteIngredient,
    updateMenuItem,
  } = useStore();
  const storeId = effectiveStoreId;
  const lang = useLanguage();
  const [tab, setTab] = useState<Tab>("list");
  const [editing, setEditing] = useState<Partial<Ingredient> | null>(null);
  const [restockTarget, setRestockTarget] = useState<Ingredient | null>(null);
  const [restockAmount, setRestockAmount] = useState("");
  const [recipeMenu, setRecipeMenu] = useState<Menu | null>(null);

  // 매장 원재료 (활성)
  const myIngredients = useMemo(
    () =>
      ingredients
        .filter((i) => i.storeId === storeId)
        // 소진율(현재고÷부족기준) 낮은=급한 순으로 정렬, 동률은 이름순 (ERP 차용: 급한 재고 위로)
        .sort((a, b) => {
          const ra = a.lowThreshold != null && a.lowThreshold > 0 ? a.stock / a.lowThreshold : Infinity;
          const rb = b.lowThreshold != null && b.lowThreshold > 0 ? b.stock / b.lowThreshold : Infinity;
          if (ra !== rb) return ra - rb;
          return a.name.localeCompare(b.name);
        }),
    [ingredients, storeId]
  );
  const myMenus = useMemo(
    () => menus.filter((m) => m.storeId === storeId).sort((a, b) => a.name.localeCompare(b.name)),
    [menus, storeId]
  );

  // 원가 집계 — 최근 7일 동안 served+paid 주문의 menu.recipe 합산
  const costSummary = useMemo(() => {
    const ingMap = new Map<string, Ingredient>();
    myIngredients.forEach((i) => ingMap.set(i.id, i));
    const menuMap = new Map<string, Menu>();
    myMenus.forEach((m) => menuMap.set(m.id, m));
    const now = Date.now();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const weekAgo = now - 7 * 86_400_000;

    let costToday = 0;
    let costWeek = 0;
    const byMenu = new Map<string, { name: string; cost: number; revenue: number }>();

    for (const o of orders) {
      if (o.storeId !== storeId) continue;
      const created = new Date(o.createdAt).getTime();
      if (created < weekAgo) continue;
      // 결제 완료된 주문만 — 취소건 제외
      if (o.paymentStatus !== "paid") continue;
      for (const it of o.items) {
        const menu = menuMap.get(it.menuId);
        if (!menu?.recipe) continue;
        let perServingCost = 0;
        for (const r of menu.recipe) {
          const ing = ingMap.get(r.ingredientId);
          if (!ing) continue;
          perServingCost += ing.unitCost * r.quantity;
        }
        const totalCost = perServingCost * it.quantity;
        const totalRevenue = it.price * it.quantity;
        costWeek += totalCost;
        if (created >= todayStart.getTime()) costToday += totalCost;
        const entry = byMenu.get(it.menuId) ?? { name: it.name, cost: 0, revenue: 0 };
        entry.cost += totalCost;
        entry.revenue += totalRevenue;
        byMenu.set(it.menuId, entry);
      }
    }
    return {
      costToday,
      costWeek,
      byMenu: Array.from(byMenu.values()).sort((a, b) => b.cost - a.cost),
    };
  }, [orders, myIngredients, myMenus, storeId]);

  const [saveBusy, setSaveBusy] = useState(false);
  const saveIngredient = async () => {
    if (!editing || saveBusy) return;
    if (!editing.name?.trim() || !editing.unit?.trim()) return;
    setSaveBusy(true);
    try {
      if (editing.id) {
        await updateIngredient(editing.id, {
          name: editing.name.trim(),
          unit: editing.unit.trim(),
          stock: Number(editing.stock) || 0,
          unitCost: Number(editing.unitCost) || 0,
          lowThreshold: editing.lowThreshold ? Number(editing.lowThreshold) : undefined,
          memo: editing.memo,
        });
        showToast(t("inv.updated", lang), "success");
      } else {
        await addIngredient(storeId, {
          name: editing.name.trim(),
          unit: editing.unit.trim(),
          stock: Number(editing.stock) || 0,
          unitCost: Number(editing.unitCost) || 0,
          lowThreshold: editing.lowThreshold ? Number(editing.lowThreshold) : undefined,
          memo: editing.memo,
        });
        showToast(t("inv.added", lang), "success");
      }
      setEditing(null);
    } finally {
      setSaveBusy(false);
    }
  };

  const removeIngredient = async (ing: Ingredient) => {
    if (!confirm(t("inv.deleteConfirm", lang, { name: ing.name }))) return;
    // 메뉴 레시피에서도 제거 — 정합성 유지.
    // 부분 실패 방지: 메뉴 업데이트가 모두 성공해야 deleteIngredient 진행.
    // (writeBatch 가 가장 안전하지만 cross-collection + 클라이언트 SDK 한계로
    //  여기서는 메뉴 업데이트 → 성공 시 ingredient 삭제 순서로 처리.)
    const affected = myMenus.filter((m) => m.recipe?.some((r) => r.ingredientId === ing.id));
    try {
      await Promise.all(
        affected.map((m) =>
          updateMenuItem(m.id, {
            recipe: m.recipe!.filter((r) => r.ingredientId !== ing.id),
          })
        )
      );
      await deleteIngredient(ing.id);
      showToast(t("inv.deleted", lang), "info");
    } catch (e: any) {
      // 부분 실패 — 사용자에게 알려 재시도 유도
      showToast(t("ores.err.saveFail", lang, { msg: e?.message ?? "" }), "error");
    }
  };

  const [restockBusy, setRestockBusy] = useState(false);
  const confirmRestock = async () => {
    if (!restockTarget || restockBusy) return;
    const add = Number(restockAmount);
    if (!add || add <= 0) return;
    setRestockBusy(true);
    try {
      // increment() — 다른 직원·자동 차감과 동시에 일어나도 합산 보장
      await updateIngredient(restockTarget.id, {
        stock: increment(add) as any,
      });
      showToast(t("inv.btn.restockOk", lang, { n: add, unit: restockTarget.unit }), "success");
      setRestockTarget(null);
      setRestockAmount("");
    } finally {
      setRestockBusy(false);
    }
  };

  return (
    <OwnerShell
      title={t("inv.title", lang)}
      headerRight={
        tab === "list" ? (
          <button
            onClick={() => setEditing({ name: "", unit: "", stock: 0, unitCost: 0 })}
            className="h-10 px-4 rounded-full bg-[var(--color-navy-700)] text-white inline-flex items-center gap-1.5 text-[13px] font-bold shadow-[var(--shadow-navy)]"
          >
            <Plus className="w-4 h-4" />
            {t("inv.add", lang)}
          </button>
        ) : null
      }
    >
      <div className="max-w-[900px] mx-auto pb-12">
        <p className="text-[13px] text-[var(--color-ink-600)] mb-4 leading-relaxed">
          {t("inv.subtitle", lang)}
        </p>

        {/* 탭 */}
        <div className="grid grid-cols-3 gap-1 p-1 bg-[var(--color-navy-50)] rounded-[14px] mb-4">
          {(["list", "recipe", "cost"] as const).map((tk) => (
            <button
              key={tk}
              onClick={() => setTab(tk)}
              className={`h-10 rounded-[10px] text-[12.5px] font-bold inline-flex items-center justify-center gap-1.5 ${
                tab === tk ? "bg-white text-[var(--color-navy-800)]" : "text-[var(--color-ink-500)]"
              }`}
            >
              {tk === "list" ? <Boxes className="w-3.5 h-3.5" /> : tk === "recipe" ? <Package className="w-3.5 h-3.5" /> : <TrendingUp className="w-3.5 h-3.5" />}
              {tk === "list" ? t("inv.tab.list", lang) : tk === "recipe" ? t("inv.tab.recipe", lang) : t("inv.tab.cost", lang)}
            </button>
          ))}
        </div>

        {/* ===== 1) 원재료 목록 ===== */}
        {tab === "list" && (
          <>
            {myIngredients.length === 0 ? (
              <EmptyState
                icon={<Boxes className="w-7 h-7" />}
                title={t("inv.empty", lang)}
                description={t("inv.empty.desc", lang)}
                action={
                  <Button onClick={() => setEditing({ name: "", unit: "", stock: 0, unitCost: 0 })}>
                    {t("inv.add", lang)}
                  </Button>
                }
              />
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                {myIngredients.map((ing) => {
                  const soldout = ing.stock <= 0;
                  const low = !soldout && ing.lowThreshold != null && ing.stock <= ing.lowThreshold;
                  return (
                    <Card key={ing.id} padding="md" className={soldout || low ? "border-[1.5px] border-[#ffd1cc] bg-[#fff8f7]" : ""}>
                      <div className="flex items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="text-[14.5px] font-extrabold text-[var(--color-navy-900)]">
                              {ing.name}
                            </p>
                            {soldout ? (
                              <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-white bg-[var(--color-danger)] px-1.5 py-0.5 rounded-full">
                                <AlertTriangle className="w-3 h-3" />
                                {t("inv.soldout", lang)}
                              </span>
                            ) : low ? (
                              <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-[var(--color-danger)] bg-[#fff1f0] px-1.5 py-0.5 rounded-full">
                                <AlertTriangle className="w-3 h-3" />
                                {t("inv.low", lang)}
                              </span>
                            ) : null}
                          </div>
                          <p className="text-[12.5px] text-[var(--color-navy-700)] font-bold mt-0.5 tabular-nums">
                            {t("inv.stockUnit", lang, { n: Math.max(0, ing.stock), unit: ing.unit })}
                            <span className="text-[var(--color-ink-500)] font-medium ml-2">
                              · {fmtKRW(ing.unitCost)}
                              {t("inv.unitCostSuffix", lang, { unit: ing.unit })}
                            </span>
                          </p>
                          {ing.lowThreshold != null && ing.stock <= ing.lowThreshold && (
                            <p className="text-[11.5px] font-bold text-[var(--color-danger)] mt-0.5">
                              🛒 {t("inv.reorder", lang, { n: Math.max(1, ing.lowThreshold * 2 - ing.stock), unit: ing.unit })}
                            </p>
                          )}
                          {ing.memo && (
                            <p className="text-[11.5px] text-[var(--color-ink-500)] mt-0.5 truncate">
                              {ing.memo}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => setRestockTarget(ing)}
                          className="h-8 px-2.5 rounded-full bg-[var(--color-mint-100)] text-[var(--color-mint-700)] text-[11.5px] font-extrabold inline-flex items-center gap-1 shrink-0"
                          aria-label={t("inv.btn.restock", lang)}
                        >
                          <PackagePlus className="w-3.5 h-3.5" />
                          <span className="hidden min-[400px]:inline">{t("inv.btn.restock", lang)}</span>
                        </button>
                        <button
                          onClick={() => setEditing(ing)}
                          className="w-8 h-8 rounded-full hover:bg-[var(--color-navy-50)] inline-flex items-center justify-center"
                        >
                          <Edit2 className="w-3.5 h-3.5 text-[var(--color-navy-700)]" />
                        </button>
                        <button
                          onClick={() => removeIngredient(ing)}
                          className="w-8 h-8 rounded-full hover:bg-[var(--color-danger)]/10 inline-flex items-center justify-center text-[var(--color-danger)]"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ===== 2) 메뉴 레시피 ===== */}
        {tab === "recipe" && (
          <RecipeTab
            menus={myMenus}
            ingredients={myIngredients}
            onSelect={setRecipeMenu}
          />
        )}

        {/* ===== 3) 원가 리포트 ===== */}
        {tab === "cost" && (
          <CostTab summary={costSummary} />
        )}
      </div>

      {/* 원재료 추가/편집 모달 */}
      {editing && (
        <EditModal
          editing={editing}
          onChange={setEditing}
          onSave={saveIngredient}
          onClose={() => setEditing(null)}
        />
      )}

      {/* 입고 모달 */}
      {restockTarget && (
        <RestockModal
          ingredient={restockTarget}
          amount={restockAmount}
          setAmount={setRestockAmount}
          onConfirm={confirmRestock}
          onClose={() => { setRestockTarget(null); setRestockAmount(""); }}
        />
      )}

      {/* 레시피 편집 모달 */}
      {recipeMenu && (
        <RecipeModal
          menu={recipeMenu}
          ingredients={myIngredients}
          onClose={() => setRecipeMenu(null)}
          onSave={async (recipe) => {
            await updateMenuItem(recipeMenu.id, { recipe });
            showToast(t("inv.recipe.saveOk", lang), "success");
            setRecipeMenu(null);
          }}
        />
      )}
    </OwnerShell>
  );
}

// ============================================================
// RecipeTab — 메뉴 카드 그리드. 클릭 시 레시피 편집 모달.
// ============================================================
function RecipeTab({
  menus,
  ingredients,
  onSelect,
}: {
  menus: Menu[];
  ingredients: Ingredient[];
  onSelect: (m: Menu) => void;
}) {
  const lang = useLanguage();
  if (ingredients.length === 0) {
    return (
      <Card padding="lg" className="text-center text-[14px] text-[var(--color-ink-500)]">
        {t("inv.recipe.empty", lang)}
      </Card>
    );
  }
  const ingMap = new Map(ingredients.map((i) => [i.id, i]));
  // 메뉴별 원가·마진 선계산 → 마진 낮은 메뉴를 상단에 모아 경고 (ERP 차용: 위험 한눈에)
  const rows = menus.map((m) => {
    const recipe = m.recipe ?? [];
    let cost = 0;
    for (const r of recipe) {
      const ing = ingMap.get(r.ingredientId);
      if (ing) cost += ing.unitCost * r.quantity;
    }
    const margin = m.price > 0 ? Math.min(100, ((m.price - cost) / m.price) * 100) : 0;
    return { m, cost, margin, hasRecipe: recipe.length > 0 };
  });
  const risky = rows.filter((x) => x.hasRecipe && x.margin < 30);
  return (
    <>
      {risky.length > 0 && (
        <Card padding="md" className="mb-3 border-[1.5px] border-[#ffd1cc] bg-[#fff8f7]">
          <p className="text-[13px] font-extrabold text-[var(--color-danger)]">
            ⚠️ {t("inv.recipe.riskTitle", lang, { n: risky.length })}
          </p>
          <p className="text-[12px] text-[var(--color-ink-600)] mt-1 leading-relaxed">
            {risky.map((x) => x.m.name).join(", ")}
          </p>
        </Card>
      )}
      <p className="text-[12.5px] text-[var(--color-ink-600)] mb-3">{t("inv.recipe.desc", lang)}</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {rows.map(({ m, cost, margin, hasRecipe }) => (
          <Card key={m.id} padding="md" className="hover:bg-[var(--color-navy-50)] cursor-pointer" onClick={() => onSelect(m)}>
            <p className="text-[14.5px] font-extrabold text-[var(--color-navy-900)]">{m.name}</p>
            {!hasRecipe ? (
              <p className="text-[12px] text-[var(--color-ink-500)] mt-1">{t("inv.recipe.noRecipe", lang)}</p>
            ) : (
              <>
                <div className="flex items-center gap-2 mt-1 text-[12px] tabular-nums">
                  <span className="text-[var(--color-ink-600)]">
                    {t("inv.recipe.cost", lang, { amount: fmtKRW(cost) })}
                  </span>
                  <span className={`font-bold ${margin >= 50 ? "text-[var(--color-mint-700)]" : margin >= 30 ? "text-[#f0b400]" : "text-[var(--color-danger)]"}`}>
                    {t("inv.recipe.margin", lang, { pct: margin.toFixed(0) })}
                  </span>
                </div>
                <p className="text-[11.5px] text-[var(--color-ink-500)] mt-1 truncate">
                  {(m.recipe ?? [])
                    .map((r) => ingMap.get(r.ingredientId)?.name)
                    .filter(Boolean)
                    .join(", ")}
                </p>
              </>
            )}
          </Card>
        ))}
      </div>
    </>
  );
}

// ============================================================
// RecipeModal — 메뉴 1인분 레시피 편집
// ============================================================
function RecipeModal({
  menu,
  ingredients,
  onClose,
  onSave,
}: {
  menu: Menu;
  ingredients: Ingredient[];
  onClose: () => void;
  onSave: (recipe: { ingredientId: string; quantity: number }[]) => Promise<void> | void;
}) {
  const lang = useLanguage();
  useModalChrome(true, onClose);
  const [draft, setDraft] = useState<{ ingredientId: string; quantity: number }[]>(
    menu.recipe ? [...menu.recipe] : []
  );
  const ingMap = new Map(ingredients.map((i) => [i.id, i]));

  const updateRow = (idx: number, patch: Partial<{ ingredientId: string; quantity: number }>) => {
    setDraft((d) => d.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };
  const remove = (idx: number) => setDraft((d) => d.filter((_, i) => i !== idx));
  const addRow = () => {
    // 아직 안 쓰인 ingredient 중 첫 번째
    const used = new Set(draft.map((d) => d.ingredientId));
    const next = ingredients.find((i) => !used.has(i.id));
    if (!next) return;
    setDraft((d) => [...d, { ingredientId: next.id, quantity: 0 }]);
  };

  const cost = draft.reduce((s, r) => {
    const ing = ingMap.get(r.ingredientId);
    return s + (ing ? ing.unitCost * r.quantity : 0);
  }, 0);

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[480px] mx-auto bg-white rounded-t-[28px] p-6 pb-[max(env(safe-area-inset-bottom),24px)] max-h-[88vh] overflow-y-auto"
      >
        <div className="w-12 h-1.5 rounded-full bg-[var(--color-ink-100)] mx-auto mb-4" />
        <h2 className="text-[17px] font-extrabold text-[var(--color-navy-900)] mb-1">{menu.name}</h2>
        <p className="text-[12px] text-[var(--color-ink-500)] mb-3 tabular-nums">
          {t("inv.recipe.cost", lang, { amount: fmtKRW(cost) })}
        </p>

        <div className="space-y-2">
          {draft.map((r, idx) => {
            const ing = ingMap.get(r.ingredientId);
            return (
              <div key={idx} className="flex items-center gap-2">
                <select
                  value={r.ingredientId}
                  onChange={(e) => updateRow(idx, { ingredientId: e.target.value })}
                  className="flex-1 h-11 px-3 rounded-[10px] border border-[var(--color-line)] text-[13.5px] font-bold"
                >
                  {ingredients.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  step="0.01"
                  value={r.quantity}
                  onChange={(e) => updateRow(idx, { quantity: Number(e.target.value) || 0 })}
                  className="w-20 h-11 px-2 rounded-[10px] border border-[var(--color-line)] text-[13.5px] font-bold tabular-nums text-right"
                />
                <span className="text-[12px] font-bold text-[var(--color-ink-600)] w-10">{ing?.unit}</span>
                <button
                  onClick={() => remove(idx)}
                  className="w-8 h-8 rounded-full hover:bg-[var(--color-danger)]/10 inline-flex items-center justify-center text-[var(--color-danger)]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>

        <button
          onClick={addRow}
          disabled={draft.length >= ingredients.length}
          className="mt-3 w-full h-11 rounded-[10px] border-2 border-dashed border-[var(--color-line)] text-[13px] font-bold text-[var(--color-ink-600)] hover:border-[var(--color-mint-500)] hover:text-[var(--color-mint-700)] disabled:opacity-40"
        >
          {t("inv.recipe.addItem", lang)}
        </button>

        <div className="grid grid-cols-2 gap-2 mt-5">
          <Button variant="ghost" onClick={onClose}>
            {t("inv.btn.cancel", lang)}
          </Button>
          <Button onClick={() => onSave(draft.filter((r) => r.quantity > 0))}>
            {t("inv.btn.save", lang)}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// CostTab — 원가 리포트
// ============================================================
function CostTab({
  summary,
}: {
  summary: { costToday: number; costWeek: number; byMenu: { name: string; cost: number; revenue: number }[] };
}) {
  const lang = useLanguage();
  if (summary.byMenu.length === 0) {
    return (
      <Card padding="lg" className="text-center text-[14px] text-[var(--color-ink-500)]">
        {t("inv.cost.empty", lang)}
      </Card>
    );
  }
  return (
    <>
      <div className="grid grid-cols-2 gap-2 mb-3">
        <Card padding="md" className="bg-[var(--color-mint-50)] border-[1.5px] border-[var(--color-mint-200)]">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-mint-700)] mb-1">
            {t("inv.cost.today", lang)}
          </p>
          <p className="text-[20px] font-extrabold text-[var(--color-navy-900)] tabular-nums">
            {fmtKRW(summary.costToday)}
          </p>
        </Card>
        <Card padding="md">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-ink-500)] mb-1">
            {t("inv.cost.week", lang)}
          </p>
          <p className="text-[20px] font-extrabold text-[var(--color-navy-900)] tabular-nums">
            {fmtKRW(summary.costWeek)}
          </p>
        </Card>
      </div>
      <Card padding="md">
        <p className="text-[12px] font-bold uppercase tracking-wider text-[var(--color-ink-500)] mb-2">
          {t("inv.cost.byMenu", lang)}
        </p>
        <div className="divide-y divide-[var(--color-line-soft)]">
          {summary.byMenu.map((row) => {
            const margin = row.revenue > 0 ? ((row.revenue - row.cost) / row.revenue) * 100 : 0;
            return (
              <div key={row.name} className="py-2 flex items-center gap-2">
                <span className="flex-1 text-[13.5px] font-bold text-[var(--color-navy-900)] truncate">
                  {row.name}
                </span>
                <span className="text-[12.5px] tabular-nums text-[var(--color-ink-600)]">
                  {fmtKRW(row.cost)}
                </span>
                <span
                  className={`text-[11px] font-extrabold tabular-nums w-12 text-right ${
                    margin >= 50 ? "text-[var(--color-mint-700)]" : margin >= 30 ? "text-[#f0b400]" : "text-[var(--color-danger)]"
                  }`}
                >
                  {margin.toFixed(0)}%
                </span>
              </div>
            );
          })}
        </div>
      </Card>
    </>
  );
}

// ============================================================
// EditModal — 원재료 추가/편집
// ============================================================
function EditModal({
  editing,
  onChange,
  onSave,
  onClose,
}: {
  editing: Partial<Ingredient>;
  onChange: (next: Partial<Ingredient>) => void;
  onSave: () => Promise<void> | void;
  onClose: () => void;
}) {
  const lang = useLanguage();
  useModalChrome(true, onClose);
  // 단가 간편 계산 (ERP 차용) — 구매가÷구매량 → unitCost 자동, 단가 손계산 부담 제거
  const [pp, setPp] = useState("");
  const [pq, setPq] = useState("");
  const applyPurchase = (price: string, qty: string) => {
    setPp(price);
    setPq(qty);
    const p = Number(price);
    const q = Number(qty);
    if (p > 0 && q > 0) onChange({ ...editing, unitCost: Math.round((p / q) * 100) / 100 });
  };
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[440px] mx-auto bg-white rounded-t-[28px] p-6 pb-[max(env(safe-area-inset-bottom),24px)] max-h-[88vh] overflow-y-auto"
      >
        <div className="w-12 h-1.5 rounded-full bg-[var(--color-ink-100)] mx-auto mb-4" />
        <h2 className="text-[17px] font-extrabold text-[var(--color-navy-900)] mb-3">
          {editing.id ? t("inv.btn.save", lang) : t("inv.add", lang)}
        </h2>
        <div className="space-y-3">
          <Input
            label={t("inv.field.name", lang)}
            placeholder={t("inv.field.namePh", lang)}
            value={editing.name ?? ""}
            onChange={(e) => onChange({ ...editing, name: e.target.value })}
          />
          <Input
            label={t("inv.field.unit", lang)}
            placeholder={t("inv.field.unitPh", lang)}
            value={editing.unit ?? ""}
            onChange={(e) => onChange({ ...editing, unit: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label={t("inv.field.stock", lang)}
              inputMode="decimal"
              value={String(editing.stock ?? "")}
              onChange={(e) => onChange({ ...editing, stock: Number(e.target.value) || 0 })}
            />
            <Input
              label={t("inv.field.unitCost", lang)}
              inputMode="decimal"
              value={String(editing.unitCost ?? "")}
              onChange={(e) => onChange({ ...editing, unitCost: Number(e.target.value) || 0 })}
            />
          </div>
          {/* 단가 간편 계산 (ERP 차용) — 영수증의 총 구매가·용량만 넣으면 단가 자동 */}
          <div className="rounded-[12px] bg-[var(--color-navy-50)] border border-[var(--color-navy-100)] p-3">
            <p className="text-[11.5px] font-bold text-[var(--color-navy-700)] mb-2">
              {t("inv.field.autoCost", lang)}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Input
                label={t("inv.field.purchasePrice", lang)}
                inputMode="decimal"
                value={pp}
                onChange={(e) => applyPurchase(e.target.value, pq)}
              />
              <Input
                label={t("inv.field.purchaseQty", lang)}
                inputMode="decimal"
                value={pq}
                onChange={(e) => applyPurchase(pp, e.target.value)}
              />
            </div>
            <p className="text-[10.5px] text-[var(--color-ink-500)] mt-1.5">
              {t("inv.field.autoCostHint", lang)}
            </p>
          </div>
          <Input
            label={t("inv.field.lowThreshold", lang)}
            inputMode="decimal"
            value={editing.lowThreshold !== undefined ? String(editing.lowThreshold) : ""}
            onChange={(e) =>
              onChange({
                ...editing,
                lowThreshold: e.target.value === "" ? undefined : Number(e.target.value),
              })
            }
          />
          <Input
            label={t("inv.field.memo", lang)}
            placeholder={t("inv.field.memoPh", lang)}
            value={editing.memo ?? ""}
            onChange={(e) => onChange({ ...editing, memo: e.target.value })}
          />
        </div>
        <div className="grid grid-cols-2 gap-2 mt-5">
          <Button variant="ghost" onClick={onClose}>
            {t("inv.btn.cancel", lang)}
          </Button>
          <Button onClick={onSave} disabled={!editing.name?.trim() || !editing.unit?.trim()}>
            {t("inv.btn.save", lang)}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// RestockModal — 입고 수량 입력
// ============================================================
function RestockModal({
  ingredient,
  amount,
  setAmount,
  onConfirm,
  onClose,
}: {
  ingredient: Ingredient;
  amount: string;
  setAmount: (v: string) => void;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const lang = useLanguage();
  useModalChrome(true, onClose);
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[400px] mx-auto bg-white rounded-t-[28px] p-6 pb-[max(env(safe-area-inset-bottom),24px)]"
      >
        <div className="w-12 h-1.5 rounded-full bg-[var(--color-ink-100)] mx-auto mb-4" />
        <h2 className="text-[17px] font-extrabold text-[var(--color-navy-900)] mb-3">{ingredient.name}</h2>
        <Input
          label={t("inv.btn.restockAmount", lang)}
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          autoFocus
        />
        <p className="text-[12px] text-[var(--color-ink-500)] mt-2 tabular-nums">
          {t("inv.stockUnit", lang, { n: ingredient.stock, unit: ingredient.unit })} →{" "}
          <span className="font-bold text-[var(--color-mint-700)]">
            {t("inv.stockUnit", lang, { n: ingredient.stock + (Number(amount) || 0), unit: ingredient.unit })}
          </span>
        </p>
        <div className="grid grid-cols-2 gap-2 mt-5">
          <Button variant="ghost" onClick={onClose}>
            {t("inv.btn.cancel", lang)}
          </Button>
          <Button onClick={onConfirm} disabled={!amount || Number(amount) <= 0}>
            {t("inv.btn.restock", lang)}
          </Button>
        </div>
      </div>
    </div>
  );
}
