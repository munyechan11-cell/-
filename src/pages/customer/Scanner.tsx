import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Html5Qrcode } from "html5-qrcode";
import { Camera, FlipHorizontal2, Keyboard } from "lucide-react";
import { MobileShell } from "../../components/layout/MobileShell";
import { TopBar } from "../../components/ui/TopBar";
import { Button } from "../../components/ui/Button";
import { showToast } from "../../lib/toast";

const SCAN_ID = "gyeol-qr-scanner";

export default function Scanner() {
  const nav = useNavigate();
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const inst = new Html5Qrcode(SCAN_ID);
    scannerRef.current = inst;

    const handle = (decoded: string) => {
      if (cancelled) return;
      try {
        // JSON
        if (decoded.trim().startsWith("{")) {
          const obj = JSON.parse(decoded);
          if (obj.storeId && obj.tableNum) {
            stop().finally(() =>
              nav(`/customer/store/${obj.storeId}/table/${obj.tableNum}`)
            );
            return;
          }
        }
        // URL with path
        const m = decoded.match(/\/customer\/store\/([^/?#]+)\/table\/([^/?#]+)/);
        if (m) {
          stop().finally(() => nav(`/customer/store/${m[1]}/table/${m[2]}`));
          return;
        }
        // URL with ?table=
        const u = new URL(decoded);
        const pathMatch = u.pathname.match(/\/customer\/store\/([^/?#]+)/);
        const t = u.searchParams.get("table");
        if (pathMatch && t) {
          stop().finally(() => nav(`/customer/store/${pathMatch[1]}/table/${t}`));
          return;
        }
        showToast("결 QR이 아닙니다.", "error");
      } catch {
        showToast("QR 형식을 인식하지 못했어요.", "error");
      }
    };

    const start = async () => {
      try {
        await inst.start(
          { facingMode: facing },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          handle,
          () => {}
        );
        if (!cancelled) setScanning(true);
      } catch (e: any) {
        if (cancelled) return;
        const msg =
          e?.name === "NotAllowedError"
            ? "카메라 권한이 차단되었습니다. 브라우저 설정에서 허용해 주세요."
            : "카메라를 사용할 수 없습니다.";
        setError(msg);
      }
    };

    const stop = async () => {
      try {
        if (inst.isScanning) await inst.stop();
        await inst.clear();
      } catch {}
    };

    start();

    return () => {
      cancelled = true;
      stop();
    };
  }, [facing, nav]);

  const manualInput = () => {
    const storeId = prompt("매장 ID를 입력하세요");
    if (!storeId) return;
    const tableNum = prompt("테이블 번호");
    if (!tableNum) return;
    nav(`/customer/store/${storeId}/table/${tableNum}`);
  };

  return (
    <MobileShell>
      <TopBar title="QR 스캔" back transparent />
      <div className="px-5">
        <div className="relative aspect-square w-full rounded-[28px] overflow-hidden bg-[var(--color-navy-900)] mt-2">
          <div id={SCAN_ID} className="absolute inset-0 [&_video]:object-cover [&_video]:w-full [&_video]:h-full" />
          {/* Frame overlay */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute inset-8 border-2 border-white/80 rounded-[24px]">
              {[
                "top-0 left-0",
                "top-0 right-0 rotate-90",
                "bottom-0 right-0 rotate-180",
                "bottom-0 left-0 -rotate-90",
              ].map((p) => (
                <span
                  key={p}
                  className={`absolute w-8 h-8 border-t-4 border-l-4 border-[var(--color-mint-500)] rounded-tl-xl ${p}`}
                />
              ))}
            </div>
          </div>
          {!scanning && !error && (
            <div className="absolute inset-0 flex items-center justify-center text-white/80 text-sm">
              <Camera className="w-5 h-5 mr-2" /> 카메라 시작 중...
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white p-6 text-center">
              <p className="text-sm font-semibold mb-3">{error}</p>
              <Button variant="mint" size="sm" onClick={() => window.location.reload()}>
                다시 시도
              </Button>
            </div>
          )}
        </div>

        <p className="text-center mt-6 text-[14px] text-[var(--color-ink-500)] font-medium">
          매장 QR을 사각형 안에 맞춰주세요.
        </p>

        <div className="flex gap-3 mt-6">
          <Button
            variant="outline"
            block
            size="md"
            onClick={() => setFacing((f) => (f === "environment" ? "user" : "environment"))}
            leftIcon={<FlipHorizontal2 className="w-4 h-4" />}
          >
            카메라 전환
          </Button>
          <Button variant="ghost" block size="md" onClick={manualInput} leftIcon={<Keyboard className="w-4 h-4" />}>
            수동 입력
          </Button>
        </div>
      </div>
    </MobileShell>
  );
}
