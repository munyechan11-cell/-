import { useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Printer } from "lucide-react";
import { OwnerShell } from "../../components/layout/OwnerShell";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { useStore } from "../../store/store";

export default function QrPrint() {
  const { currentUser, tables } = useStore();
  const storeId = currentUser?.id ?? "";
  const storeName = currentUser?.restaurantName ?? "결";
  const [cols, setCols] = useState(3);
  const [size, setSize] = useState(120);

  const myTables = useMemo(
    () => tables.filter((t) => t.storeId === storeId && t.type !== "door").sort((a, b) => a.number - b.number),
    [tables, storeId]
  );

  const origin = typeof window !== "undefined" ? window.location.origin : "";

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
      <div className="no-print max-w-md">
        <Card padding="md" className="space-y-3">
          <div>
            <label className="text-[12px] font-semibold text-[var(--color-navy-800)]">
              열 수: {cols}
            </label>
            <input
              type="range"
              min={2}
              max={5}
              value={cols}
              onChange={(e) => setCols(Number(e.target.value))}
              className="w-full mt-1"
            />
          </div>
          <div>
            <label className="text-[12px] font-semibold text-[var(--color-navy-800)]">
              QR 크기: {size}px
            </label>
            <input
              type="range"
              min={80}
              max={200}
              step={10}
              value={size}
              onChange={(e) => setSize(Number(e.target.value))}
              className="w-full mt-1"
            />
          </div>
          <Button block onClick={() => window.print()} leftIcon={<Printer className="w-4 h-4" />}>
            인쇄하기
          </Button>
        </Card>

        {myTables.length === 0 && (
          <Card padding="lg" className="text-center text-[14px] text-[var(--color-ink-500)] mt-3">
            인쇄할 테이블이 없습니다.
          </Card>
        )}
      </div>

      <div
        className="mt-5 grid gap-3 print:gap-2"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {myTables.map((t) => (
          <div
            key={t.id}
            className="bg-white border border-[var(--color-line)] rounded-[14px] p-3 flex flex-col items-center text-center print:border-black print:border print:rounded-none"
          >
            <p className="text-[10px] font-bold text-[var(--color-ink-500)] uppercase tracking-wide">{storeName}</p>
            <p className="text-[20px] font-extrabold text-[var(--color-navy-900)] tracking-tighter mb-1.5">
              테이블 {t.number}
            </p>
            <QRCodeSVG
              value={`${origin}/customer/store/${storeId}/table/${t.number}`}
              size={size}
              level="M"
              includeMargin={true}
            />
            <p className="text-[10px] text-[var(--color-ink-500)] mt-1.5 font-medium">QR을 찍어 입장하세요</p>
          </div>
        ))}
      </div>

      <style>{`
        @media print {
          @page { margin: 10mm; }
          body { background: white; }
        }
      `}</style>
    </OwnerShell>
  );
}
