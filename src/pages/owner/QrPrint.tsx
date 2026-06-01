import { useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Printer, Copy, Check, Link as LinkIcon, AlertTriangle } from "lucide-react";
import { OwnerShell } from "../../components/layout/OwnerShell";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { useStore } from "../../store/store";
import { showToast } from "../../lib/toast";

export default function QrPrint() {
  const { currentUser, effectiveStoreId, tables, users } = useStore();
  const storeId = effectiveStoreId;
  const storeName =
    users.find((u) => u.id === storeId)?.restaurantName ?? currentUser?.restaurantName ?? "결";
  // 모바일에선 미리보기가 가독성을 잃지 않도록 cols=2로 시작 (인쇄 시 사장님이 조정)
  const isMobile = typeof window !== "undefined" && window.innerWidth < 640;
  const [cols, setCols] = useState(isMobile ? 2 : 3);
  const [size, setSize] = useState(isMobile ? 100 : 120);

  const myTables = useMemo(
    () => tables.filter((t) => t.storeId === storeId && t.type !== "door").sort((a, b) => a.number - b.number),
    [tables, storeId]
  );

  // 환경변수 VITE_APP_URL이 있으면 운영 URL을 강제 사용 (localhost·미리보기 환경에서 잘못된 QR이 인쇄되는 사고 방지)
  // 프로토콜이 빠진 입력(`gyeol.com`)도 https:// 자동 부여
  const rawEnvUrl = ((import.meta as any).env?.VITE_APP_URL as string | undefined)?.trim();
  const envUrl = rawEnvUrl
    ? (rawEnvUrl.startsWith("http://") || rawEnvUrl.startsWith("https://")
        ? rawEnvUrl
        : `https://${rawEnvUrl}`
      ).replace(/\/$/, "")
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
      showToast("URL을 복사했어요. 브라우저에 붙여 테스트할 수 있어요.", "success");
    } catch {
      showToast("복사 실패 — URL을 길게 눌러 직접 복사해 주세요.", "error");
    }
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
      <div className="no-print max-w-md">
        {/* 진단: 어떤 URL이 QR에 박힐지 명시 */}
        <Card padding="md" className="mb-3">
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
              <span>
                로컬/미리보기 환경입니다. 인쇄 전 <b>운영 도메인</b>에서 열거나 환경변수 <code className="bg-[var(--color-ink-50)] px-1 rounded">VITE_APP_URL</code>을 설정하세요.
              </span>
            </div>
          )}
          {!isLocal && (
            <p className="text-[11px] text-[var(--color-ink-500)] mt-1.5 font-medium leading-snug">
              일반 카메라 앱으로 QR을 찍으면 이 주소로 바로 이동해 손님 로그인·테이블 연동이 진행됩니다.
            </p>
          )}
        </Card>

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
        {myTables.map((t) => {
          const url = `${origin}/customer/store/${storeId}/table/${t.number}`;
          return (
            <div
              key={t.id}
              className="bg-white border border-[var(--color-line)] rounded-[14px] p-3 flex flex-col items-center text-center print:border-black print:border print:rounded-none"
            >
              <p className="text-[11px] font-bold text-[var(--color-ink-600)] uppercase tracking-wide break-keep">{storeName}</p>
              <p className="text-[20px] font-extrabold text-[var(--color-navy-900)] tracking-tighter mb-1.5">
                테이블 {t.number}
              </p>
              <QRCodeSVG value={url} size={size} level="M" includeMargin={true} />
              <p className="text-[11px] text-[var(--color-ink-600)] mt-1.5 font-medium">QR을 찍어 입장하세요</p>
              <button
                onClick={() => copyUrl(url, t.id)}
                className="no-print mt-1.5 text-[10px] font-bold text-[var(--color-navy-700)] hover:underline inline-flex items-center gap-1"
              >
                {copiedId === t.id ? (
                  <>
                    <Check className="w-3 h-3" /> 복사됨
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" /> URL 복사
                  </>
                )}
              </button>
            </div>
          );
        })}
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
