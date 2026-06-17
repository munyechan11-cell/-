import { useMemo, useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { X, Plus, Minus, ShoppingCart, CheckCircle2, ChevronUp } from "lucide-react";
import { useStore } from "../../store/store";
import { useLanguage, t, fmtKRW } from "../../lib/i18n";
import { OptionPickerModal } from "../../components/order/OptionPickerModal";
import type { Menu, SelectedOption } from "../../lib/types";

interface CartLine { menuId: string; qty: number; selectedOptions: SelectedOption[]; unitPrice: number; }
const lineKey = (menuId: string, opts: SelectedOption[]) =>
  opts.length === 0 ? menuId : `${menuId}|${opts.map((o) => o.optionId).slice().sort().join(",")}`;
const optionSummary = (opts: SelectedOption[]) => opts.map((o) => o.optionName).join(" · ");

/**
 * 손님 셀프 키오스크 — 매장 비치 태블릿용 풀스크린 주문.
 * 테이블 선택 → 메뉴 담기 → 주문(placeOrder). 게스트(customerId=kiosk_T{n}) 로 접수.
 * 사장님이 /biz/owner/kiosk 에서 띄워 손님에게 건넴.
 */
export default function KioskMode() {
  const { menus, tables, currentUser, placeOrder } = useStore();
  const lang = useLanguage();
  const nav = useNavigate();

  const storeId = currentUser?.id ?? "";
  const [table, setTable] = useState<number | null>(null);
  const [cart, setCart] = useState<Record<string, CartLine>>({});
  const [picker, setPicker] = useState<Menu | null>(null);
  const [category, setCategory] = useState<string>("__all");
  const [cartOpen, setCartOpen] = useState(false);
  const [ordered, setOrdered] = useState(false);
  const [busy, setBusy] = useState(false);

  const storeMenus = useMemo(
    () => menus.filter((m) => m.storeId === storeId && m.isAvailable !== false),
    [menus, storeId]
  );
  const categories = useMemo(
    () => Array.from(new Set(storeMenus.map((m) => m.category).filter(Boolean))),
    [storeMenus]
  );
  const shown = category === "__all" ? storeMenus : storeMenus.filter((m) => m.category === category);
  const menuById = useMemo(() => new Map(storeMenus.map((m) => [m.id, m])), [storeMenus]);

  const cartLines = Object.entries(cart)
    .map(([key, line]) => {
      const m = menuById.get(line.menuId);
      return m ? { key, menu: m, qty: line.qty, selectedOptions: line.selectedOptions, unitPrice: line.unitPrice } : null;
    })
    .filter((x): x is { key: string; menu: Menu; qty: number; selectedOptions: SelectedOption[]; unitPrice: number } => x !== null);
  const total = cartLines.reduce((s, l) => s + l.unitPrice * l.qty, 0);
  const cartCount = cartLines.reduce((s, l) => s + l.qty, 0);
  const menuInCart = (menuId: string) => cartLines.filter((l) => l.menu.id === menuId).reduce((s, l) => s + l.qty, 0);

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

  const submit = async () => {
    if (!table || cartCount === 0 || busy) return;
    setBusy(true);
    try {
      const items = cartLines.map((l) => ({
        menuId: l.menu.id,
        name: l.menu.name,
        quantity: l.qty,
        price: l.unitPrice,
        ...(l.selectedOptions.length ? { selectedOptions: l.selectedOptions } : {}),
      }));
      await placeOrder({ storeId, tableNumber: table, customerId: `kiosk_T${table}`, items });
      setCart({});
      setCartOpen(false);
      setOrdered(true);
    } catch {
      setBusy(false);
    }
  };

  // 키오스크 옵트인 — 설정에서 꺼져 있으면 진입 차단 (URL 직접 접근 방어)
  if (currentUser?.storeConfig?.kioskEnabled !== true) {
    return <Navigate to="/biz/owner" replace />;
  }

  // ── 완료 화면 ──
  if (ordered) {
    return (
      <div className="min-h-screen bg-[var(--color-bg)] flex flex-col items-center justify-center gap-5 px-6 text-center">
        <CheckCircle2 className="w-20 h-20 text-[var(--color-mint-500)]" />
        <h1 className="text-[26px] font-extrabold text-[var(--color-navy-900)]">{t("kiosk.orderDone", lang)}</h1>
        <p className="text-[15px] text-[var(--color-ink-600)]">{t("kiosk.table", lang, { n: table ?? 0 })}</p>
        <button
          onClick={() => { setOrdered(false); setBusy(false); }}
          className="h-14 px-8 rounded-2xl bg-[var(--color-navy-700)] text-white text-[17px] font-extrabold shadow-[var(--shadow-navy)]"
        >
          {t("kiosk.newOrder", lang)}
        </button>
      </div>
    );
  }

  // ── 테이블 선택 화면 ──
  if (table === null) {
    const sorted = [...tables].filter((tb) => tb.storeId === storeId).sort((a, b) => a.number - b.number);
    return (
      <div className="min-h-screen bg-[var(--color-bg)] flex flex-col">
        <KioskHeader title={t("kiosk.selectTable", lang)} onExit={() => nav("/biz/owner")} lang={lang} />
        <div className="flex-1 overflow-y-auto p-6">
          {sorted.length === 0 ? (
            <p className="text-center text-[15px] text-[var(--color-ink-500)] py-16">{t("kiosk.noTables", lang)}</p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3 max-w-[800px] mx-auto">
              {sorted.map((tb) => (
                <button
                  key={tb.id}
                  onClick={() => setTable(tb.number)}
                  className="aspect-square rounded-2xl bg-white border-2 border-[var(--color-line)] hover:border-[var(--color-navy-700)] text-[24px] font-extrabold text-[var(--color-navy-900)] tabular-nums shadow-sm"
                >
                  {tb.number}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── 메뉴 + 장바구니 화면 ──
  return (
    <div className="min-h-screen bg-[var(--color-bg)] flex flex-col">
      <KioskHeader
        title={t("kiosk.table", lang, { n: table })}
        onExit={() => setTable(null)}
        lang={lang}
      />

      {/* 카테고리 탭 */}
      <div className="flex gap-2 overflow-x-auto px-4 py-3 border-b border-[var(--color-line)] bg-white shrink-0">
        {[{ k: "__all", label: t("kiosk.allMenu", lang) }, ...categories.map((c) => ({ k: c, label: c }))].map((c) => (
          <button
            key={c.k}
            onClick={() => setCategory(c.k)}
            className={`h-10 px-4 rounded-full text-[14px] font-bold whitespace-nowrap shrink-0 transition-colors ${
              category === c.k
                ? "bg-[var(--color-navy-700)] text-white"
                : "bg-[var(--color-bg)] text-[var(--color-ink-600)]"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* 메뉴 그리드 */}
      <div className="flex-1 overflow-y-auto p-4 pb-28">
        {shown.length === 0 ? (
          <p className="text-center text-[15px] text-[var(--color-ink-500)] py-16">{t("kiosk.noMenu", lang)}</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 max-w-[1000px] mx-auto">
            {shown.map((m) => (
              <button
                key={m.id}
                onClick={() => onMenuTap(m)}
                className="relative bg-white rounded-2xl border border-[var(--color-line)] overflow-hidden text-left active:scale-[0.98] transition-transform"
              >
                {m.imageUrl ? (
                  <img src={m.imageUrl} alt="" className="w-full aspect-[4/3] object-cover" />
                ) : (
                  <div className="w-full aspect-[4/3] bg-[var(--color-navy-50)]" />
                )}
                <div className="p-3">
                  <p className="text-[14.5px] font-bold text-[var(--color-navy-900)] break-keep leading-tight">{m.name}</p>
                  <p className="text-[14px] font-extrabold text-[var(--color-navy-700)] tabular-nums mt-1">{fmtKRW(m.price)}</p>
                  {m.optionGroups?.length ? <p className="text-[11px] font-bold text-[var(--color-ink-400)] mt-0.5">{t("opt.has", lang)}</p> : null}
                </div>
                {menuInCart(m.id) ? (
                  <span className="absolute top-2 right-2 w-7 h-7 rounded-full bg-[var(--color-navy-700)] text-white text-[13px] font-extrabold inline-flex items-center justify-center tabular-nums">
                    {menuInCart(m.id)}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 장바구니 펼침 */}
      {cartOpen && cartCount > 0 && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-end" onClick={() => setCartOpen(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full bg-white rounded-t-[24px] max-h-[70vh] overflow-y-auto p-4 pb-32"
          >
            <p className="text-[16px] font-extrabold text-[var(--color-navy-900)] mb-3">{t("kiosk.cart", lang)}</p>
            <div className="space-y-2">
              {cartLines.map((l) => (
                <div key={l.key} className="flex items-center gap-3">
                  <span className="flex-1 min-w-0 break-keep">
                    <span className="text-[14px] font-semibold text-[var(--color-navy-900)]">{l.menu.name}</span>
                    {l.selectedOptions.length > 0 && (
                      <span className="block text-[12px] text-[var(--color-ink-500)]">{optionSummary(l.selectedOptions)}</span>
                    )}
                  </span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => decLine(l.key)} className="w-9 h-9 rounded-full bg-[var(--color-bg)] inline-flex items-center justify-center"><Minus className="w-4 h-4" /></button>
                    <span className="w-6 text-center text-[15px] font-bold tabular-nums">{l.qty}</span>
                    <button onClick={() => incLine(l.key)} className="w-9 h-9 rounded-full bg-[var(--color-bg)] inline-flex items-center justify-center"><Plus className="w-4 h-4" /></button>
                  </div>
                  <span className="w-20 text-right text-[14px] font-bold tabular-nums text-[var(--color-navy-900)]">{fmtKRW(l.unitPrice * l.qty)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {picker && <OptionPickerModal menu={picker} lang={lang} onConfirm={onPickerConfirm} onClose={() => setPicker(null)} />}

      {/* 하단 주문 바 */}
      {cartCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-[var(--color-line)] px-4 py-3 pb-[max(env(safe-area-inset-bottom),12px)] flex items-center gap-3">
          <button
            onClick={() => setCartOpen((v) => !v)}
            className="flex items-center gap-2 text-[var(--color-navy-900)]"
          >
            <span className="relative">
              <ShoppingCart className="w-6 h-6" />
              <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[var(--color-danger)] text-white text-[11px] font-extrabold inline-flex items-center justify-center tabular-nums">{cartCount}</span>
            </span>
            <ChevronUp className={`w-4 h-4 transition-transform ${cartOpen ? "rotate-180" : ""}`} />
          </button>
          <span className="text-[18px] font-extrabold tabular-nums text-[var(--color-navy-900)]">{fmtKRW(total)}</span>
          <button
            onClick={submit}
            disabled={busy}
            className="ml-auto h-12 px-7 rounded-2xl bg-[var(--color-navy-700)] text-white text-[16px] font-extrabold shadow-[var(--shadow-navy)] disabled:opacity-50"
          >
            {t("kiosk.order", lang)}
          </button>
        </div>
      )}
    </div>
  );
}

function KioskHeader({ title, onExit, lang }: { title: string; onExit: () => void; lang: ReturnType<typeof useLanguage> }) {
  return (
    <header className="flex items-center gap-3 px-5 h-[60px] border-b border-[var(--color-line)] bg-white shrink-0">
      <h1 className="text-[18px] font-extrabold text-[var(--color-navy-900)]">{title}</h1>
      <button
        onClick={onExit}
        className="ml-auto w-10 h-10 rounded-full hover:bg-[var(--color-navy-50)] inline-flex items-center justify-center"
        aria-label={t("kiosk.exit", lang)}
      >
        <X className="w-5 h-5" />
      </button>
    </header>
  );
}
