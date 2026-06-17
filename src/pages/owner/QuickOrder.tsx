import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus, Minus, ShoppingCart, ChevronUp, CreditCard, UserPlus, ArrowRightLeft } from "lucide-react";
import { OwnerShell } from "../../components/layout/OwnerShell";
import { useStore } from "../../store/store";
import { useLanguage, t, fmtKRW } from "../../lib/i18n";
import { showToast } from "../../lib/toast";
import { OptionPickerModal } from "../../components/order/OptionPickerModal";
import type { Menu, SelectedOption } from "../../lib/types";

interface CartLine { menuId: string; qty: number; selectedOptions: SelectedOption[]; unitPrice: number; }
// 같은 메뉴라도 옵션이 다르면 다른 라인. 옵션 없으면 키=menuId
const lineKey = (menuId: string, opts: SelectedOption[]) =>
  opts.length === 0 ? menuId : `${menuId}|${opts.map((o) => o.optionId).slice().sort().join(",")}`;
const optionSummary = (opts: SelectedOption[]) => opts.map((o) => o.optionName).join(" · ");

/**
 * 빠른 주문 + 테이블/대기 (사장 카운터 POS).
 *
 * 카페 "구두주문 → 자유 착석" 해결:
 *  - 자리 정한 손님 → 테이블 탭 → 메뉴 → 주문
 *  - 구두·자리미정 손님 → "대기" 탭으로 받았다가, 손님이 앉으면 "테이블로 이동"
 *  - 같은 탭(테이블/대기)에 추가주문이 누적 → 나갈 때 일괄 결제(approvePayment)
 * 대기 탭 = 가상 번호(WAIT_BASE+n)로 실제 테이블(1~)과 구분. 이동 시 moveOrdersTable 로 번호 변경.
 */
const WAIT_BASE = 900;

export default function QuickOrder() {
  const { menus, orders, tables, effectiveStoreId, placeOrder, approvePayment, moveOrdersTable } = useStore();
  const lang = useLanguage();
  // 매장 id = 사장이면 본인, 출근한 직원이면 소속 매장(employerStoreId). 직원 본인 id 를 쓰면
  // 메뉴·테이블이 0건이 되고 placeOrder 가 고아 주문을 만들므로 반드시 effectiveStoreId 사용.
  const storeId = effectiveStoreId;

  const [activeTab, setActiveTab] = useState<number | null>(null);
  const [cart, setCart] = useState<Record<string, CartLine>>({});
  const [picker, setPicker] = useState<Menu | null>(null);
  const [category, setCategory] = useState("__all");
  const [cartOpen, setCartOpen] = useState(false);
  const [moving, setMoving] = useState(false);
  const [busy, setBusy] = useState(false);

  const storeMenus = useMemo(() => menus.filter((m) => m.storeId === storeId && m.isAvailable !== false), [menus, storeId]);
  const categories = useMemo(() => Array.from(new Set(storeMenus.map((m) => m.category).filter(Boolean))), [storeMenus]);
  const shown = category === "__all" ? storeMenus : storeMenus.filter((m) => m.category === category);
  const menuById = useMemo(() => new Map(storeMenus.map((m) => [m.id, m])), [storeMenus]);
  const storeTables = useMemo(() => tables.filter((tb) => tb.storeId === storeId).sort((a, b) => a.number - b.number), [tables, storeId]);

  // 미결제 주문 tableNumber별 합계
  const unpaidByTable = useMemo(() => {
    const map = new Map<number, { total: number; count: number }>();
    orders
      .filter((o) => o.storeId === storeId && o.status !== "cancelled" && o.paymentStatus !== "paid")
      .forEach((o) => {
        const g = map.get(o.tableNumber) ?? { total: 0, count: 0 };
        g.total += o.totalAmount;
        g.count += 1;
        map.set(o.tableNumber, g);
      });
    return map;
  }, [orders, storeId]);

  const waitTabs = useMemo(
    () => Array.from(unpaidByTable.keys()).filter((n) => n >= WAIT_BASE).sort((a, b) => a - b),
    [unpaidByTable]
  );

  const tabItems = useMemo(() => {
    if (activeTab == null) return [];
    return orders
      .filter((o) => o.storeId === storeId && o.tableNumber === activeTab && o.status !== "cancelled" && o.paymentStatus !== "paid")
      .flatMap((o) => o.items);
  }, [orders, storeId, activeTab]);
  const tabTotal = tabItems.reduce((s, it) => s + it.price * it.quantity, 0);

  const cartLines = Object.entries(cart)
    .map(([key, line]) => {
      const m = menuById.get(line.menuId);
      return m ? { key, menu: m, qty: line.qty, selectedOptions: line.selectedOptions, unitPrice: line.unitPrice } : null;
    })
    .filter((x): x is { key: string; menu: Menu; qty: number; selectedOptions: SelectedOption[]; unitPrice: number } => x !== null);
  const cartTotal = cartLines.reduce((s, l) => s + l.unitPrice * l.qty, 0);
  const cartCount = cartLines.reduce((s, l) => s + l.qty, 0);
  const menuInCart = (menuId: string) => cartLines.filter((l) => l.menu.id === menuId).reduce((s, l) => s + l.qty, 0);

  // 라인 추가/병합 — 같은 메뉴+같은 옵션이면 수량+1
  const addLine = (m: Menu, opts: SelectedOption[], unitPrice: number) =>
    setCart((c) => {
      const key = lineKey(m.id, opts);
      const ex = c[key];
      return { ...c, [key]: ex ? { ...ex, qty: ex.qty + 1 } : { menuId: m.id, qty: 1, selectedOptions: opts, unitPrice } };
    });
  const onMenuTap = (m: Menu) => (m.optionGroups?.length ? setPicker(m) : addLine(m, [], m.price));
  const onPickerConfirm = (opts: SelectedOption[], unitPrice: number) => {
    if (picker) addLine(picker, opts, unitPrice);
    setPicker(null);
  };
  const incLine = (key: string) => setCart((c) => (c[key] ? { ...c, [key]: { ...c[key], qty: c[key].qty + 1 } } : c));
  const decLine = (key: string) =>
    setCart((c) => {
      const n = { ...c };
      if ((n[key]?.qty ?? 0) > 1) n[key] = { ...n[key], qty: n[key].qty - 1 };
      else delete n[key];
      return n;
    });

  const selectTab = (n: number) => {
    setActiveTab(n);
    setCart({});
    setCartOpen(false);
  };
  const newWait = () => selectTab((waitTabs.length ? Math.max(...waitTabs) : WAIT_BASE) + 1);

  // 대시보드 등에서 ?newWait=1 로 진입하면 바로 새 대기 탭을 연다.
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    if (searchParams.get("newWait")) {
      newWait();
      searchParams.delete("newWait");
      setSearchParams(searchParams, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addToTab = async () => {
    if (activeTab == null || cartCount === 0 || busy) return;
    setBusy(true);
    try {
      const items = cartLines.map((l) => ({ menuId: l.menu.id, name: l.menu.name, quantity: l.qty, price: l.unitPrice, ...(l.selectedOptions.length ? { selectedOptions: l.selectedOptions } : {}) }));
      const cid = activeTab >= WAIT_BASE ? `walkin_W${activeTab}` : `pos_T${activeTab}`;
      await placeOrder({ storeId, tableNumber: activeTab, customerId: cid, items, manual: true });
      setCart({});
      setCartOpen(false);
      showToast(t("quick.added", lang), "success");
    } catch {
      /* placeOrder 가 토스트 표시 */
    } finally {
      setBusy(false);
    }
  };

  const payTab = async () => {
    if (activeTab == null || busy) return;
    setBusy(true);
    try {
      const paid = await approvePayment(storeId, activeTab);
      if (paid > 0) {
        showToast(t("quick.paid", lang, { amount: fmtKRW(paid, lang) }), "success");
        setActiveTab(null);
        setCart({});
      }
    } finally {
      setBusy(false);
    }
  };

  const moveToTable = async (toTable: number) => {
    if (activeTab == null) return;
    await moveOrdersTable(storeId, activeTab, toTable);
    setActiveTab(toTable);
    setMoving(false);
    showToast(t("quick.moved", lang, { n: toTable }), "success");
  };

  const isWait = activeTab != null && activeTab >= WAIT_BASE;
  const tabLabel = activeTab == null ? "" : isWait ? t("quick.waitN", lang, { n: activeTab - WAIT_BASE }) : t("quick.tableN", lang, { n: activeTab });

  return (
    <OwnerShell title={t("quick.title", lang)} width="full">
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
        {/* ===== 좌: 테이블 + 대기 ===== */}
        <div className="space-y-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-ink-400)] mb-2">{t("quick.tables", lang)}</p>
            {storeTables.length === 0 ? (
              <p className="text-[12.5px] text-[var(--color-ink-500)]">{t("quick.noTables", lang)}</p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {storeTables.map((tb) => {
                  const u = unpaidByTable.get(tb.number);
                  return (
                    <button
                      key={tb.id}
                      onClick={() => selectTab(tb.number)}
                      className={`relative aspect-square rounded-xl border text-[18px] font-extrabold tabular-nums ${
                        activeTab === tb.number
                          ? "border-[var(--color-navy-700)] bg-[var(--color-navy-50)] text-[var(--color-navy-900)]"
                          : u
                          ? "border-[var(--color-mint-300)] bg-[var(--color-mint-50)] text-[var(--color-navy-900)]"
                          : "border-[var(--color-line)] bg-white text-[var(--color-ink-600)]"
                      }`}
                    >
                      {tb.number}
                      {u && <span className="absolute bottom-1 left-0 right-0 text-[9.5px] font-bold text-[var(--color-mint-700)] tabular-nums">{fmtKRW(u.total, lang)}</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-ink-400)] mb-2">{t("quick.waiting", lang)}</p>
            {/* 대기 주문은 빠르게 받는 경우가 많아 큼직한 버튼으로 */}
            <button
              onClick={newWait}
              className="w-full h-12 mb-2.5 rounded-xl bg-[var(--color-navy-700)] text-[var(--color-on-primary,white)] font-extrabold text-[14px] inline-flex items-center justify-center gap-2 active:scale-[0.98] transition-transform shadow-[var(--shadow-press)]"
            >
              <UserPlus className="w-5 h-5" />
              {t("quick.newWait", lang)}
            </button>
            {waitTabs.length === 0 ? (
              <p className="text-[12.5px] text-[var(--color-ink-500)]">{t("quick.noWaiting", lang)}</p>
            ) : (
              <div className="space-y-1.5">
                {waitTabs.map((n) => {
                  const u = unpaidByTable.get(n)!;
                  return (
                    <button
                      key={n}
                      onClick={() => selectTab(n)}
                      className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between ${
                        activeTab === n ? "border-[var(--color-navy-700)] bg-[var(--color-navy-50)]" : "border-[var(--color-line)] bg-white"
                      }`}
                    >
                      <span className="font-bold text-[var(--color-navy-900)]">{t("quick.waitN", lang, { n: n - WAIT_BASE })}</span>
                      <span className="text-[12px] font-bold tabular-nums text-[var(--color-navy-700)]">{fmtKRW(u.total, lang)}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ===== 우: 메뉴 + 주문 ===== */}
        {activeTab == null ? (
          <div className="flex items-center justify-center h-[300px] text-[14px] text-[var(--color-ink-500)] border border-dashed border-[var(--color-line)] rounded-2xl text-center px-6">
            {t("quick.selectTab", lang)}
          </div>
        ) : (
          <div>
            <div className="rounded-2xl bg-white border border-[var(--color-line)] p-4 mb-3">
              <div className="flex items-center justify-between mb-2 gap-2">
                <p className="font-extrabold text-[var(--color-navy-900)]">{tabLabel}</p>
                <div className="flex items-center gap-2">
                  {isWait && tabTotal > 0 && (
                    <button onClick={() => setMoving(true)} className="h-9 px-3 rounded-lg border border-[var(--color-navy-300)] text-[13px] font-bold text-[var(--color-navy-700)] inline-flex items-center gap-1">
                      <ArrowRightLeft className="w-3.5 h-3.5" />
                      {t("quick.toTable", lang)}
                    </button>
                  )}
                  {tabTotal > 0 && (
                    <button onClick={payTab} disabled={busy} className="h-9 px-4 rounded-lg bg-[var(--color-mint-700)] text-white text-[13px] font-bold inline-flex items-center gap-1.5 disabled:opacity-50">
                      <CreditCard className="w-4 h-4" />
                      {t("quick.pay", lang, { amount: fmtKRW(tabTotal, lang) })}
                    </button>
                  )}
                </div>
              </div>
              {tabItems.length === 0 ? (
                <p className="text-[12.5px] text-[var(--color-ink-500)]">{t("quick.emptyTab", lang)}</p>
              ) : (
                <div className="space-y-1">
                  {tabItems.map((it, i) => (
                    <div key={i} className="flex justify-between text-[13px]">
                      <span className="text-[var(--color-ink-700)]">
                        {it.name} × {it.quantity}
                      </span>
                      <span className="tabular-nums font-semibold text-[var(--color-navy-900)]">{fmtKRW(it.price * it.quantity, lang)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-2 overflow-x-auto mb-3">
              {[{ k: "__all", label: t("quick.allMenu", lang) }, ...categories.map((c) => ({ k: c, label: c }))].map((c) => (
                <button
                  key={c.k}
                  onClick={() => setCategory(c.k)}
                  className={`h-9 px-3.5 rounded-full text-[13px] font-bold whitespace-nowrap shrink-0 ${
                    category === c.k ? "bg-[var(--color-navy-700)] text-white" : "bg-[var(--color-bg)] text-[var(--color-ink-600)]"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 pb-28">
              {shown.map((m) => (
                <button key={m.id} onClick={() => onMenuTap(m)} className="relative bg-white rounded-xl border border-[var(--color-line)] p-3 text-left active:scale-[0.98] transition-transform">
                  <p className="text-[13.5px] font-bold text-[var(--color-navy-900)] break-keep leading-tight">{m.name}</p>
                  <p className="text-[13px] font-extrabold text-[var(--color-navy-700)] tabular-nums mt-1">{fmtKRW(m.price, lang)}</p>
                  {m.optionGroups?.length ? (
                    <p className="text-[10.5px] font-bold text-[var(--color-ink-400)] mt-0.5">{t("opt.has", lang)}</p>
                  ) : null}
                  {menuInCart(m.id) ? (
                    <span className="absolute top-2 right-2 w-6 h-6 rounded-full bg-[var(--color-navy-700)] text-white text-[12px] font-bold inline-flex items-center justify-center tabular-nums">{menuInCart(m.id)}</span>
                  ) : null}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 테이블 이동 모달 */}
      {moving && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setMoving(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-[400px] bg-white rounded-2xl p-5 max-h-[80vh] overflow-y-auto">
            <p className="font-extrabold text-[var(--color-navy-900)] mb-3">{t("quick.selectTableToMove", lang)}</p>
            {storeTables.length === 0 ? (
              <p className="text-[13px] text-[var(--color-ink-500)]">{t("quick.noTables", lang)}</p>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {storeTables.map((tb) => {
                  // 이미 미결제 주문이 있는 테이블은 민트색 + 금액으로 표시 — 합석/주문 합쳐짐을 사장이 인지하도록
                  const u = unpaidByTable.get(tb.number);
                  return (
                    <button
                      key={tb.id}
                      onClick={() => moveToTable(tb.number)}
                      className={`relative aspect-square rounded-xl border text-[16px] font-extrabold tabular-nums ${
                        u
                          ? "border-[var(--color-mint-300)] bg-[var(--color-mint-50)] text-[var(--color-navy-900)]"
                          : "border-[var(--color-line)] hover:border-[var(--color-navy-700)]"
                      }`}
                    >
                      {tb.number}
                      {u && (
                        <span className="absolute bottom-1 left-0 right-0 text-[9px] font-bold text-[var(--color-mint-700)] tabular-nums">
                          {fmtKRW(u.total, lang)}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 카트 펼침 (수량 조정) */}
      {activeTab != null && cartOpen && cartCount > 0 && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-end" onClick={() => setCartOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full bg-white rounded-t-[24px] max-h-[70vh] overflow-y-auto p-4 pb-32 max-w-[640px] mx-auto">
            <p className="text-[16px] font-extrabold text-[var(--color-navy-900)] mb-3">{t("quick.cart", lang)}</p>
            <div className="space-y-2">
              {cartLines.map((l) => (
                <div key={l.key} className="flex items-center gap-3">
                  <span className="flex-1 min-w-0 break-keep">
                    <span className="text-[14px] font-semibold text-[var(--color-navy-900)]">{l.menu.name}</span>
                    {l.selectedOptions.length > 0 && (
                      <span className="block text-[12px] text-[var(--color-ink-500)]">{optionSummary(l.selectedOptions)}</span>
                    )}
                  </span>
                  <button onClick={() => decLine(l.key)} className="w-9 h-9 rounded-full bg-[var(--color-bg)] inline-flex items-center justify-center"><Minus className="w-4 h-4" /></button>
                  <span className="w-6 text-center text-[15px] font-bold tabular-nums">{l.qty}</span>
                  <button onClick={() => incLine(l.key)} className="w-9 h-9 rounded-full bg-[var(--color-bg)] inline-flex items-center justify-center"><Plus className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {picker && <OptionPickerModal menu={picker} onConfirm={onPickerConfirm} onClose={() => setPicker(null)} />}

      {/* 하단 카트 바 */}
      {activeTab != null && cartCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-[var(--color-line)] px-4 py-3 pb-[max(env(safe-area-inset-bottom),12px)] flex items-center gap-3 lg:left-[260px]">
          <button onClick={() => setCartOpen((v) => !v)} className="flex items-center gap-2 text-[var(--color-navy-900)]">
            <span className="relative">
              <ShoppingCart className="w-6 h-6" />
              <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[var(--color-danger)] text-white text-[11px] font-extrabold inline-flex items-center justify-center tabular-nums">{cartCount}</span>
            </span>
            <ChevronUp className={`w-4 h-4 transition-transform ${cartOpen ? "rotate-180" : ""}`} />
          </button>
          <span className="text-[17px] font-extrabold tabular-nums text-[var(--color-navy-900)]">{fmtKRW(cartTotal, lang)}</span>
          <button onClick={addToTab} disabled={busy} className="ml-auto h-12 px-6 rounded-xl bg-[var(--color-navy-700)] text-white text-[15px] font-extrabold shadow-[var(--shadow-navy)] disabled:opacity-50">
            {t("quick.addOrder", lang)}
          </button>
        </div>
      )}
    </OwnerShell>
  );
}
