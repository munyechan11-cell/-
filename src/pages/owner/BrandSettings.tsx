import { useEffect, useMemo, useState } from "react";
import { MapPin, Save, Receipt, KeyRound, Info, Printer, Plug, CheckCircle2, AlertCircle } from "lucide-react";
import { OwnerShell } from "../../components/layout/OwnerShell";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { useStore } from "../../store/store";
import { showToast } from "../../lib/toast";
import { getCurrentPosition } from "../../lib/geo";
import { TIER_ORDER } from "../../lib/tier";
import { POS_VENDORS, getVendor, type PosVendor } from "../../lib/posVendors";
import {
  isWebUsbSupported,
  requestPrinter,
  getAuthorizedPrinters,
  printTestPage,
} from "../../lib/thermalPrinter";
import type { Industry, RewardType } from "../../lib/types";

export default function BrandSettings() {
  const { currentUser, updateBrandSettings, updateStoreConfig, updateStoreLocation } = useStore();
  const [printerInfo, setPrinterInfo] = useState<{ name: string } | null>(null);
  const [printerBusy, setPrinterBusy] = useState(false);

  useEffect(() => {
    if (!isWebUsbSupported()) return;
    getAuthorizedPrinters().then((devs) => {
      if (devs.length > 0) {
        const d = devs[0];
        setPrinterInfo({ name: d.productName || d.manufacturerName || "USB 프린터" });
      }
    });
  }, []);

  const connectPrinter = async () => {
    setPrinterBusy(true);
    try {
      const dev = await requestPrinter();
      if (dev) {
        setPrinterInfo({ name: dev.productName || dev.manufacturerName || "USB 프린터" });
        showToast("프린터가 연결되었습니다. 테스트 인쇄로 확인해 보세요.", "success");
      }
    } catch (e: any) {
      showToast(e?.message ?? "프린터 연결 실패", "error");
    } finally {
      setPrinterBusy(false);
    }
  };

  const testPrinter = async () => {
    setPrinterBusy(true);
    try {
      await printTestPage();
      showToast("테스트 인쇄를 전송했습니다.", "success");
    } catch (e: any) {
      showToast(e?.message ?? "테스트 인쇄 실패", "error");
    } finally {
      setPrinterBusy(false);
    }
  };

  const storeId = currentUser?.id ?? "";
  const cfg = currentUser?.storeConfig;

  const [restaurantName, setRestaurantName] = useState(currentUser?.restaurantName ?? "");
  const [posVendor, setPosVendor] = useState<PosVendor>((currentUser?.posVendor as PosVendor) ?? "none");
  const [posApiKey, setPosApiKey] = useState(currentUser?.posApiKey ?? "");
  const [foodtech, setFoodtech] = useState(currentUser?.foodtechStoreCode ?? "");
  const vendorInfo = useMemo(() => getVendor(posVendor), [posVendor]);
  const [aligoKey, setAligoKey] = useState(currentUser?.aligoKey ?? "");
  const [aligoUserId, setAligoUserId] = useState(currentUser?.aligoUserId ?? "");
  const [aligoSender, setAligoSender] = useState(currentUser?.aligoSender ?? "");
  const [smsGatewayUrl, setSmsGatewayUrl] = useState(currentUser?.smsGatewayUrl ?? "");

  const [industry, setIndustry] = useState<Industry>(cfg?.industry ?? "general");
  const [rewardType, setRewardType] = useState<RewardType>(cfg?.rewardType ?? "point");
  const [pointRate, setPointRate] = useState(String(cfg?.pointRate ?? 0.05));
  const [stampMax, setStampMax] = useState(String(cfg?.stampMax ?? 10));
  const [inactiveDays, setInactiveDays] = useState(String(cfg?.marketingTriggers?.inactiveDays ?? 30));
  const [birthdayCoupon, setBirthdayCoupon] = useState(!!cfg?.marketingTriggers?.birthdayCoupon);
  const [locationOnly, setLocationOnly] = useState(!!cfg?.locationAccessOnly);
  const [radius, setRadius] = useState(String(cfg?.allowedRadius ?? 100));
  const [tossKey, setTossKey] = useState(cfg?.tossClientKey ?? "");

  const [tierNames, setTierNames] = useState<Record<string, string>>(currentUser?.tierNames ?? {});
  const [tierRewards, setTierRewards] = useState<Record<string, string>>(currentUser?.tierRewards ?? {});

  if (!currentUser) return null;

  const saveBasic = async () => {
    // 빈 값은 명시적으로 null로 보내 Firestore에서 필드를 비움 (undefined는 merge 시 변경 없음)
    await updateBrandSettings(storeId, {
      restaurantName,
      posVendor,
      posApiKey: (posVendor === "none" ? null : posApiKey) || null,
      foodtechStoreCode: foodtech || null,
      aligoKey: aligoKey || null,
      aligoUserId: aligoUserId || null,
      aligoSender: aligoSender || null,
      smsGatewayUrl: smsGatewayUrl || null,
      tierNames,
      tierRewards,
    } as any);
    showToast("기본 설정을 저장했습니다.", "success");
  };

  const saveConfig = async () => {
    // 비율 클램프 (음수·1초과 방지)
    const rate = Math.max(0, Math.min(1, Number(pointRate) || 0));
    const stamps = Math.max(1, Math.min(100, Number(stampMax) || 10));
    const inactive = Math.max(1, Math.min(365, Number(inactiveDays) || 30));
    const r = Math.max(10, Math.min(5000, Number(radius) || 100));

    await updateStoreConfig(storeId, {
      industry,
      rewardType,
      pointRate: rate,
      stampMax: stamps,
      marketingTriggers: { inactiveDays: inactive, birthdayCoupon },
      locationAccessOnly: locationOnly,
      allowedRadius: r,
      tossClientKey: (tossKey || null) as any,
    });
    // 화면 입력값도 클램프 결과로 정정
    setPointRate(String(rate));
    setStampMax(String(stamps));
    setInactiveDays(String(inactive));
    setRadius(String(r));
    showToast("매장 운영 설정을 저장했습니다.", "success");
  };

  const captureLocation = async () => {
    try {
      const pos = await getCurrentPosition();
      await updateStoreLocation(storeId, pos.coords.latitude, pos.coords.longitude);
      showToast(`위치 저장됨 (${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)})`, "success");
    } catch (e: any) {
      showToast(`위치 가져오기 실패: ${e?.message ?? ""}`, "error");
    }
  };

  return (
    <OwnerShell title="브랜드 설정" width="narrow">
      <div className="pb-12">
        <Sec title="기본 정보">
          <Input label="매장명" value={restaurantName} onChange={(e) => setRestaurantName(e.target.value)} />
        </Sec>

        <Sec title="POS 연동">
          <div>
            <label className="block text-[13px] font-semibold text-[var(--color-navy-800)] mb-2">
              사용 중인 POS
            </label>
            <div className="relative">
              <select
                value={posVendor}
                onChange={(e) => setPosVendor(e.target.value as PosVendor)}
                className="input-field appearance-none pr-10"
              >
                {POS_VENDORS.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
              </select>
              <Receipt className="w-4 h-4 absolute right-4 top-1/2 -translate-y-1/2 text-[var(--color-ink-400)] pointer-events-none" />
            </div>
          </div>

          {vendorInfo.needsApiKey ? (
            <Input
              label={`${vendorInfo.keyLabel ?? "API 키"} (선택)`}
              placeholder={vendorInfo.placeholder ?? "선택 입력"}
              value={posApiKey}
              onChange={(e) => setPosApiKey(e.target.value)}
              leftSlot={<KeyRound className="w-4 h-4" />}
              hint={
                posApiKey
                  ? vendorInfo.hint ?? "주문이 자동으로 POS로 전달됩니다."
                  : "비워두면 영수증 자동 인쇄로 동작합니다."
              }
            />
          ) : (
            <div className="flex items-start gap-2 p-3.5 rounded-[14px] bg-[var(--color-mint-50)] border border-[var(--color-mint-200)]">
              <Info className="w-4 h-4 text-[var(--color-mint-700)] mt-0.5 shrink-0" />
              <p className="text-[12px] text-[var(--color-mint-700)] font-semibold leading-relaxed">
                {vendorInfo.hint ?? "POS를 사용하지 않습니다."}
              </p>
            </div>
          )}

          <Input
            label="레거시 푸드테크 코드 (선택)"
            value={foodtech}
            onChange={(e) => setFoodtech(e.target.value)}
            hint="기존 푸드테크 연동을 쓰는 경우만 입력. 위 POS 키가 우선합니다."
          />
        </Sec>

        {/* ===== USB 영수증 프린터 직결 ===== */}
        <Sec title="영수증 프린터 (USB 직결)">
          {!isWebUsbSupported() ? (
            <div className="flex items-start gap-2 p-3.5 rounded-[14px] bg-[#fef2f2] border border-[var(--color-danger)]/30">
              <AlertCircle className="w-4 h-4 text-[var(--color-danger)] mt-0.5 shrink-0" />
              <p className="text-[12px] text-[var(--color-danger)] font-semibold leading-relaxed">
                이 브라우저는 USB 직결 인쇄를 지원하지 않습니다.
                <br />
                <span className="font-medium opacity-90">
                  Chrome 또는 Edge에서 접속하시면 영수증 프린터에 직접 인쇄할 수 있어요.
                  현재는 팝업 인쇄로 동작합니다.
                </span>
              </p>
            </div>
          ) : printerInfo ? (
            <div className="space-y-3">
              <div className="flex items-start gap-2 p-3.5 rounded-[14px] bg-[var(--color-mint-50)] border border-[var(--color-mint-200)]">
                <CheckCircle2 className="w-4 h-4 text-[var(--color-mint-700)] mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold text-[var(--color-mint-700)]">
                    {printerInfo.name}
                  </p>
                  <p className="text-[12px] text-[var(--color-mint-700)] font-medium opacity-90 mt-0.5">
                    연결됨 · 새 주문마다 자동 인쇄됩니다.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="ghost"
                  size="md"
                  onClick={testPrinter}
                  loading={printerBusy}
                  leftIcon={<Printer className="w-4 h-4" />}
                >
                  테스트 인쇄
                </Button>
                <Button
                  variant="outline"
                  size="md"
                  onClick={connectPrinter}
                  loading={printerBusy}
                  leftIcon={<Plug className="w-4 h-4" />}
                >
                  다른 프린터 선택
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-start gap-2 p-3.5 rounded-[14px] bg-[var(--color-navy-50)] border border-[var(--color-navy-200)]">
                <Info className="w-4 h-4 text-[var(--color-navy-700)] mt-0.5 shrink-0" />
                <p className="text-[12px] text-[var(--color-navy-700)] font-semibold leading-relaxed">
                  POS와 같은 USB 영수증 프린터(빅솔론·엡손 등)에 직접 인쇄할 수 있습니다.
                  <br />
                  <span className="font-medium opacity-90">
                    한 번만 연결해 두면 새 주문이 들어올 때마다 자동으로 인쇄돼요. 팝업이 뜨지 않습니다.
                  </span>
                </p>
              </div>
              <Button
                block
                onClick={connectPrinter}
                loading={printerBusy}
                leftIcon={<Plug className="w-4 h-4" />}
              >
                USB 프린터 연결하기
              </Button>
            </div>
          )}
        </Sec>

        <Sec title="업종 · 보상">
          <div className="grid grid-cols-4 gap-2">
            {(["cafe", "meat", "bakery", "general"] as Industry[]).map((i) => (
              <Pill key={i} active={industry === i} onClick={() => setIndustry(i)}>
                {i === "cafe" ? "카페" : i === "meat" ? "정육" : i === "bakery" ? "베이커리" : "일반"}
              </Pill>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2 mt-3">
            {(["point", "stamp"] as RewardType[]).map((r) => (
              <Pill key={r} active={rewardType === r} onClick={() => setRewardType(r)}>
                {r === "point" ? "포인트 적립" : "스탬프"}
              </Pill>
            ))}
          </div>
          {rewardType === "point" ? (
            <Input
              label="적립율 (0~1)"
              value={pointRate}
              onChange={(e) => setPointRate(e.target.value)}
              hint="예: 0.05 → 매출의 5%"
            />
          ) : (
            <Input
              label="스탬프 최대 개수"
              value={stampMax}
              onChange={(e) => setStampMax(e.target.value.replace(/\D/g, ""))}
              inputMode="numeric"
            />
          )}
        </Sec>

        <Sec title="등급 커스텀 (이름·보상)">
          <div className="space-y-2">
            {TIER_ORDER.map((t) => (
              <Card key={t} padding="sm">
                <p className="text-[12px] font-bold text-[var(--color-navy-700)] mb-2">{t}</p>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    placeholder="별명"
                    value={tierNames[t] ?? ""}
                    onChange={(e) => setTierNames({ ...tierNames, [t]: e.target.value })}
                    className="input-field text-[13px]"
                  />
                  <input
                    placeholder="자동 보상 문구"
                    value={tierRewards[t] ?? ""}
                    onChange={(e) => setTierRewards({ ...tierRewards, [t]: e.target.value })}
                    className="input-field text-[13px]"
                  />
                </div>
              </Card>
            ))}
          </div>
        </Sec>

        <Sec title="마케팅 자동화">
          <Input
            label="휴면 기준 (일)"
            value={inactiveDays}
            onChange={(e) => setInactiveDays(e.target.value.replace(/\D/g, ""))}
            inputMode="numeric"
          />
          <Toggle label="생일 자동 쿠폰 발급" value={birthdayCoupon} onChange={setBirthdayCoupon} />
        </Sec>

        <Sec title="SMS · 알림">
          <Input label="알리고 API Key" value={aligoKey} onChange={(e) => setAligoKey(e.target.value)} />
          <Input label="알리고 USER ID" value={aligoUserId} onChange={(e) => setAligoUserId(e.target.value)} />
          <Input label="발신번호" value={aligoSender} onChange={(e) => setAligoSender(e.target.value)} />
          <Input label="SMS 게이트웨이 URL" value={smsGatewayUrl} onChange={(e) => setSmsGatewayUrl(e.target.value)} />
        </Sec>

        <Sec title="결제">
          <Input label="토스페이먼츠 Client Key" value={tossKey} onChange={(e) => setTossKey(e.target.value)} />
        </Sec>

        <Sec title="GPS 지오펜싱">
          <Toggle label="매장 근처에서만 입장 허용" value={locationOnly} onChange={setLocationOnly} />
          <Input
            label="허용 반경 (m)"
            value={radius}
            onChange={(e) => setRadius(e.target.value.replace(/\D/g, ""))}
            inputMode="numeric"
          />
          <Button variant="ghost" size="md" onClick={captureLocation} leftIcon={<MapPin className="w-4 h-4" />} block>
            현재 위치를 매장으로 저장
          </Button>
          {currentUser.lat && currentUser.lng && (
            <p className="text-[12px] text-[var(--color-ink-600)] mt-1.5 tabular-nums">
              저장됨: {currentUser.lat.toFixed(5)}, {currentUser.lng.toFixed(5)}
            </p>
          )}
        </Sec>

        <div className="grid grid-cols-2 gap-3 mt-6 sticky bottom-4">
          <Button variant="ghost" size="lg" onClick={saveBasic} leftIcon={<Save className="w-4 h-4" />}>
            기본 저장
          </Button>
          <Button size="lg" onClick={saveConfig} leftIcon={<Save className="w-4 h-4" />}>
            운영 설정 저장
          </Button>
        </div>
      </div>
    </OwnerShell>
  );
}

function Sec({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-5">
      <h2 className="text-[13px] font-bold text-[var(--color-ink-500)] uppercase tracking-wide px-1 mb-2">{title}</h2>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`h-11 rounded-[12px] text-[13px] font-bold ${
        active
          ? "bg-[var(--color-navy-700)] text-white shadow-[var(--shadow-navy)]"
          : "bg-white border border-[var(--color-line)] text-[var(--color-ink-700)]"
      }`}
    >
      {children}
    </button>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className="w-full flex items-center gap-3 py-3 text-left"
    >
      <span
        className={`w-11 h-6 rounded-full relative transition-colors ${
          value ? "bg-[var(--color-navy-700)]" : "bg-[var(--color-ink-100)]"
        }`}
      >
        <span
          className={`absolute top-0.5 ${value ? "left-[22px]" : "left-0.5"} w-5 h-5 rounded-full bg-white shadow transition-all`}
        />
      </span>
      <span className="text-[14px] font-semibold text-[var(--color-navy-900)]">{label}</span>
    </button>
  );
}
