import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Html5Qrcode } from "html5-qrcode";
import { Camera, FlipHorizontal2, Keyboard } from "lucide-react";
import { MobileShell } from "../../components/layout/MobileShell";
import { TopBar } from "../../components/ui/TopBar";
import { Button } from "../../components/ui/Button";
import { showToast } from "../../lib/toast";
import { useLanguage, t } from "../../lib/i18n";

const SCAN_ID = "gyeol-qr-scanner";

export default function Scanner() {
  const nav = useNavigate();
  const lang = useLanguage();
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let handled = false; // 첫 번째 성공 디코드 이후 중복 navigate 방지
    const inst = new Html5Qrcode(SCAN_ID);
    scannerRef.current = inst;

    const navigateOnce = (path: string) => {
      if (handled) return;
      handled = true;
      stop().finally(() => nav(path));
    };

    const handle = (decoded: string) => {
      if (cancelled || handled) return;
      try {
        // JSON
        if (decoded.trim().startsWith("{")) {
          const obj = JSON.parse(decoded);
          if (obj.storeId && obj.tableNum) {
            navigateOnce(`/customer/store/${obj.storeId}/table/${obj.tableNum}`);
            return;
          }
        }
        // URL with path
        const m = decoded.match(/\/customer\/store\/([^/?#]+)\/table\/([^/?#]+)/);
        if (m) {
          navigateOnce(`/customer/store/${m[1]}/table/${m[2]}`);
          return;
        }
        // URL with ?table=
        const u = new URL(decoded);
        const pathMatch = u.pathname.match(/\/customer\/store\/([^/?#]+)/);
        const tableQ = u.searchParams.get("table");
        if (pathMatch && tableQ) {
          navigateOnce(`/customer/store/${pathMatch[1]}/table/${tableQ}`);
          return;
        }
        showToast(t("scanner.notGyeolQr"), "error");
      } catch {
        showToast(t("scanner.invalidQr"), "error");
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
            ? t("scanner.cameraBlocked")
            : t("scanner.cameraFail");
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
    const storeId = prompt(t("scanner.askStore"));
    if (!storeId) return;
    const tableNum = prompt(t("scanner.askTable"));
    if (!tableNum) return;
    nav(`/customer/store/${storeId}/table/${tableNum}`);
  };

  return (
    <MobileShell>
      <TopBar title={t("scanner.title", lang)} back transparent />
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
            <div className="absolute inset-0 flex items-center justify-center text-white/90 text-[14px] font-semibold">
              <Camera className="w-5 h-5 mr-2" /> {t("scanner.starting", lang)}
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white p-6 text-center bg-black/60">
              <p className="text-[14px] font-semibold mb-3 leading-relaxed">{error}</p>
              <Button variant="mint" size="sm" onClick={() => window.location.reload()}>
                {t("entry.retry", lang)}
              </Button>
            </div>
          )}
        </div>

        <p className="text-center mt-6 text-[15px] text-[var(--color-ink-700)] font-semibold">
          {t("scanner.guide", lang)}
        </p>
        <p className="text-center mt-1 text-[13px] text-[var(--color-ink-500)]">
          {t("scanner.guideTip", lang)}
        </p>

        <div className="flex gap-3 mt-6">
          <Button
            variant="outline"
            block
            size="md"
            onClick={() => setFacing((f) => (f === "environment" ? "user" : "environment"))}
            leftIcon={<FlipHorizontal2 className="w-4 h-4" />}
          >
            {t("scanner.flip", lang)}
          </Button>
          <Button variant="ghost" block size="md" onClick={manualInput} leftIcon={<Keyboard className="w-4 h-4" />}>
            {t("scanner.manual", lang)}
          </Button>
        </div>
      </div>
    </MobileShell>
  );
}
