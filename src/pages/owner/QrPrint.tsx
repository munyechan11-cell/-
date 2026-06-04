import { useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Printer, Copy, Check, Link as LinkIcon, AlertTriangle, LayoutGrid, Sparkles, Maximize2 } from "lucide-react";
import { OwnerShell } from "../../components/layout/OwnerShell";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { useStore } from "../../store/store";
import { showToast } from "../../lib/toast";
import { cn } from "../../lib/cn";

type Template = "minimal" | "deluxe" | "wide";
type PageSize = "a4" | "label" | "card";

const TEMPLATE_META: Record<Template, { label: string; sub: string; icon: any }> = {
  minimal: { label: "미니멀", sub: "기본·낮은 잉크",           icon: LayoutGrid },
  deluxe:  { label: "디럭스",  sub: "사용 방법 포함 (추천)",   icon: Sparkles },
  wide:    { label: "와이드",  sub: "테이블 번호 크게",         icon: Maximize2 },
};

const PAGE_META: Record<PageSize, { label: string; defaultCols: number; defaultSize: number }> = {
  a4:    { label: "A4 (일반 종이)",      defaultCols: 3, defaultSize: 140 },
  label: { label: "스티커 라벨 (24칸)",  defaultCols: 4, defaultSize: 90  },
  card:  { label: "명함 종이 (10칸)",    defaultCols: 2, defaultSize: 120 },
};

export default function QrPrint() {
  const { currentUser, effectiveStoreId, tables, users } = useStore();
  const storeId = effectiveStoreId;
  const owner = users.find((u) => u.id === storeId);
  const storeName = owner?.restaurantName ?? currentUser?.restaurantName ?? "결";
  const isMobile = typeof window !== "undefined" && window.innerWidth < 640;

  const [template, setTemplate] = useState<Template>("deluxe");
  const [pageSize, setPageSize] = useState<PageSize>("a4");
  const [cols, setCols] = useState(isMobile ? 2 : PAGE_META.a4.defaultCols);
  const [size, setSize] = useState(isMobile ? 100 : PAGE_META.a4.defaultSize);

  const myTables = useMemo(
    () => tables.filter((t) => t.storeId === storeId && t.type !== "door").sort((a, b) => a.number - b.number),
    [tables, storeId]
  );

  // VITE_APP_URL 우선 — 로컬·미리보기에서 잘못된 QR 인쇄 사고 차단
  const rawEnvUrl = ((import.meta as any).env?.VITE_APP_URL as string | undefined)?.trim();
  const envUrl = rawEnvUrl
    ? (rawEnvUrl.startsWith("http://") || rawEnvUrl.startsWith("https://") ? rawEnvUrl : `https://${rawEnvUrl}`).replace(/\/$/, "")
    : "";
  const browserOrigin = typeof window !== "undefined" ? window.location.origin : "";
  const origin = envUrl || browserOrigin;
  const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)/i.test(origin);

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const copyUrl = async (url: string, id: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 1500);
      showToast("URL을 복사했어요.", "success");
    } catch {
      showToast("복사 실패 — URL을 길게 눌러 직접 복사해 주세요.", "error");
    }
  };

  const applyPageSize = (p: PageSize) => {
    setPageSize(p);
    setCols(PAGE_META[p].defaultCols);
    setSize(PAGE_META[p].defaultSize);
  };

  return (
    <OwnerShell
      title="QR 인쇄"
      width="full"
      headerRight={
        <button
          onClick={() => window.print()}
          className="h-10 px-4 rounded-full bg-[var(--color-navy-700)] text-white inline-flex items-center gap-1.5 text-[13px] font-bold shadow-[var(--shadow-navy)] no-print"
        >
          <Printer className="w-4 h-4" />
          인쇄
        </button>
      }
    >
      <div className="no-print max-w-md space-y-3">
        {/* 진단 */}
        <Card padding="md">
          <div className="flex items-center gap-2 mb-2">
            <LinkIcon className="w-4 h-4 text-[var(--color-navy-700)]" />
            <h3 className="text-[13px] font-extrabold text-[var(--color-navy-900)]">QR이 가리키는 주소</h3>
          </div>
          <p className="text-[12px] font-bold text-[var(--color-navy-800)] break-all bg-[var(--color-navy-50)] rounded-lg px-2.5 py-1.5">
            {origin || "(주소 미설정)"}
          </p>
          {isLocal && (
            <div className="mt-2 flex items-start gap-1.5 text-[11.5px] font-bold text-[var(--color-warn)]">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>로컬 환경이에요. 인쇄 전 운영 도메인에서 열어주세요.</span>
            </div>
          )}
        </Card>

        {/* 템플릿 선택 */}
        <Card padding="md">
          <p className="text-[11.5px] font-extrabold text-[var(--color-ink-500)] uppercase tracking-wide mb-2">템플릿</p>
          <div className="grid grid-cols-3 gap-2">
            {(["minimal", "deluxe", "wide"] as Template[]).map((t) => {
              const meta = TEMPLATE_META[t];
              const Icon = meta.icon;
              const active = template === t;
              return (
                <button
                  key={t}
                  onClick={() => setTemplate(t)}
                  className={cn(
                    "rounded-[12px] p-2.5 border-[1.5px] transition-all text-left flex flex-col items-start gap-1",
                    active
                      ? "border-[var(--color-navy-700)] bg-[var(--color-navy-50)]"
                      : "border-[var(--color-line)] bg-white hover:bg-[var(--color-navy-50)]/40"
                  )}
                >
                  <Icon className={cn("w-4 h-4", active ? "text-[var(--color-navy-700)]" : "text-[var(--color-ink-500)]")} />
                  <p className="text-[12.5px] font-extrabold text-[var(--color-navy-900)]">{meta.label}</p>
                  <p className="text-[10px] text-[var(--color-ink-500)] font-semibold leading-tight">{meta.sub}</p>
                </button>
              );
            })}
          </div>
        </Card>

        {/* 종이 크기 */}
        <Card padding="md">
          <p className="text-[11.5px] font-extrabold text-[var(--color-ink-500)] uppercase tracking-wide mb-2">종이</p>
          <div className="grid grid-cols-3 gap-2 mb-3">
            {(["a4", "label", "card"] as PageSize[]).map((p) => {
              const active = pageSize === p;
              return (
                <button
                  key={p}
                  onClick={() => applyPageSize(p)}
                  className={cn(
                    "rounded-[10px] h-12 px-2 border-[1.5px] text-[11.5px] font-bold leading-tight transition-all",
                    active
                      ? "border-[var(--color-navy-700)] bg-[var(--color-navy-50)] text-[var(--color-navy-800)]"
                      : "border-[var(--color-line)] bg-white text-[var(--color-ink-600)]"
                  )}
                >
                  {PAGE_META[p].label}
                </button>
              );
            })}
          </div>

          <div className="space-y-2">
            <div>
              <label className="text-[11.5px] font-semibold text-[var(--color-ink-600)]">
                열 수: <span className="text-[var(--color-navy-800)] font-bold">{cols}</span>
              </label>
              <input type="range" min={1} max={6} value={cols} onChange={(e) => setCols(Number(e.target.value))} className="w-full mt-1" />
            </div>
            <div>
              <label className="text-[11.5px] font-semibold text-[var(--color-ink-600)]">
                QR 크기: <span className="text-[var(--color-navy-800)] font-bold">{size}px</span>
              </label>
              <input type="range" min={60} max={220} step={10} value={size} onChange={(e) => setSize(Number(e.target.value))} className="w-full mt-1" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-3">
            <div className="rounded-[10px] bg-[var(--color-navy-50)] px-2.5 py-2">
              <p className="text-[10px] font-bold text-[var(--color-ink-500)] uppercase">테이블</p>
              <p className="text-[16px] font-extrabold text-[var(--color-navy-900)] leading-tight">{myTables.length}개</p>
            </div>
            <div className="rounded-[10px] bg-[var(--color-mint-50)] px-2.5 py-2">
              <p className="text-[10px] font-bold text-[var(--color-mint-700)] uppercase">예상 페이지</p>
              <p className="text-[16px] font-extrabold text-[var(--color-navy-900)] leading-tight">
                약 {Math.max(1, Math.ceil(myTables.length / (cols * Math.max(1, Math.floor(8 / Math.max(1, cols))))))}장
              </p>
            </div>
          </div>
          <Button block className="mt-3" onClick={() => window.print()} leftIcon={<Printer className="w-4 h-4" />}>
            인쇄하기
          </Button>
        </Card>

        {myTables.length === 0 && (
          <Card padding="lg" className="text-center text-[14px] text-[var(--color-ink-500)]">
            인쇄할 테이블이 없습니다.
          </Card>
        )}
      </div>

      {/* 미리보기·인쇄 영역 */}
      <div
        className="mt-5 grid gap-3 print:gap-2"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {myTables.map((t) => {
          const url = `${origin}/customer/store/${storeId}/table/${t.number}`;
          return (
            <QrCard
              key={t.id}
              template={template}
              storeName={storeName}
              tableNumber={t.number}
              url={url}
              size={size}
              copyState={copiedId === t.id}
              onCopy={() => copyUrl(url, t.id)}
            />
          );
        })}
      </div>

      <style>{`
        @media print {
          @page { margin: 8mm; }
          body { background: white; }
          .qr-card { page-break-inside: avoid; break-inside: avoid; }
        }
      `}</style>
    </OwnerShell>
  );
}

// ============================================================
// QR 카드 — 템플릿 3종
// ============================================================
function QrCard({
  template, storeName, tableNumber, url, size, copyState, onCopy,
}: {
  template: Template;
  storeName: string;
  tableNumber: number;
  url: string;
  size: number;
  copyState: boolean;
  onCopy: () => void;
}) {
  const baseCls = "qr-card bg-white border border-[var(--color-line)] rounded-[14px] flex flex-col items-center text-center print:border-black print:border print:rounded-none";

  if (template === "minimal") {
    return (
      <div className={cn(baseCls, "p-3")}>
        <p className="text-[10.5px] font-bold text-[var(--color-ink-600)] uppercase tracking-wider break-keep">{storeName}</p>
        <p className="text-[18px] font-extrabold text-[var(--color-navy-900)] mb-1.5 leading-tight">테이블 {tableNumber}</p>
        <QRCodeSVG value={url} size={size} level="M" includeMargin={true} />
        <p className="text-[10.5px] text-[var(--color-ink-600)] mt-1.5 font-semibold">QR을 찍어 입장</p>
        <CopyButton onCopy={onCopy} copied={copyState} />
      </div>
    );
  }

  if (template === "wide") {
    return (
      <div className={cn(baseCls, "p-3.5")}>
        <p className="text-[20px] sm:text-[24px] font-extrabold text-[var(--color-navy-900)] tracking-tighter leading-none">
          테이블 {tableNumber}
        </p>
        <p className="text-[10.5px] font-bold text-[var(--color-ink-600)] uppercase tracking-wider break-keep mt-1">{storeName}</p>
        <div className="my-2">
          <QRCodeSVG value={url} size={size} level="M" includeMargin={true} />
        </div>
        <div className="text-[10px] font-semibold text-[var(--color-ink-600)] leading-snug">
          📱 QR을 찍어 메뉴 주문 · 단골 적립
        </div>
        <CopyButton onCopy={onCopy} copied={copyState} />
      </div>
    );
  }

  // deluxe (추천)
  return (
    <div className={cn(baseCls, "p-3.5 relative overflow-hidden")}>
      {/* 상단 매장명 배너 */}
      <div className="w-full -mt-3.5 -mx-3.5 px-3.5 py-1.5 bg-[var(--color-navy-700)] text-white print:bg-black">
        <p className="text-[11px] font-extrabold tracking-tight truncate">{storeName}</p>
      </div>

      <p className="text-[28px] font-extrabold text-[var(--color-navy-900)] tracking-tighter leading-none mt-3">
        {tableNumber}
      </p>
      <p className="text-[10.5px] font-bold text-[var(--color-ink-500)] uppercase tracking-wide -mt-0.5 mb-2">
        Table No.
      </p>

      <div className="border-[1.5px] border-[var(--color-navy-700)]/15 rounded-[12px] p-2 mb-2 print:border-black">
        <QRCodeSVG value={url} size={size} level="M" includeMargin={true} />
      </div>

      {/* 사용 방법 3단계 */}
      <div className="text-left w-full mt-1 space-y-0.5">
        {[
          { n: 1, t: "QR 카메라로 찍기" },
          { n: 2, t: "메뉴 선택 → 주문" },
          { n: 3, t: "결제는 자리에서!" },
        ].map((s) => (
          <div key={s.n} className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded-full bg-[var(--color-mint-500)] text-white inline-flex items-center justify-center font-extrabold text-[9px] shrink-0">
              {s.n}
            </span>
            <p className="text-[10px] font-bold text-[var(--color-navy-900)] leading-tight">{s.t}</p>
          </div>
        ))}
      </div>

      <p className="text-[8.5px] text-[var(--color-ink-400)] mt-2 font-semibold tracking-wide">
        powered by 결(Gyeol)
      </p>
      <CopyButton onCopy={onCopy} copied={copyState} />
    </div>
  );
}

function CopyButton({ onCopy, copied }: { onCopy: () => void; copied: boolean }) {
  return (
    <button
      onClick={onCopy}
      className="no-print mt-2 text-[10px] font-bold text-[var(--color-navy-700)] hover:underline inline-flex items-center gap-1"
    >
      {copied ? (
        <>
          <Check className="w-3 h-3" /> 복사됨
        </>
      ) : (
        <>
          <Copy className="w-3 h-3" /> URL 복사
        </>
      )}
    </button>
  );
}
