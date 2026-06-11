import { useEffect, useMemo, useState } from "react";
import { MapPin, Save, Receipt, KeyRound, Info, Printer, Plug, CheckCircle2, AlertCircle, Bell, BellOff, Smartphone, Clock, Languages } from "lucide-react";
import { LANGS, useLanguage, setLanguage, t, getLocale } from "../../lib/i18n";
import { cn } from "../../lib/cn";
import { OwnerShell } from "../../components/layout/OwnerShell";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { useStore } from "../../store/store";
import { auth } from "../../lib/firebase";
import { api } from "../../lib/api";
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
import { issuePairingCode } from "../../lib/printBridge";
import { DAY_LABELS, defaultBusinessHours, getStoreOpenStatus, summarizeStatus } from "../../lib/businessHours";
import type { BusinessHours } from "../../lib/types";
import {
  isPushSupported,
  getPermissionState,
  registerOwnerDevice,
  unregisterOwnerDevice,
  type PermissionState,
} from "../../lib/pushNotifications";
import type { Industry, RewardType } from "../../lib/types";
import { THEMES, applyTheme, defaultThemeForIndustry } from "../../lib/themes";

export default function BrandSettings() {
  const { currentUser, updateBrandSettings, updateStoreConfig, updateStoreLocation } = useStore();
  const [printerInfo, setPrinterInfo] = useState<{ name: string } | null>(null);
  const [printerBusy, setPrinterBusy] = useState(false);

  useEffect(() => {
    if (!isWebUsbSupported()) return;
    getAuthorizedPrinters().then((devs) => {
      if (devs.length > 0) {
        const d = devs[0];
        setPrinterInfo({ name: d.productName || d.manufacturerName || t("obs.usb.defaultName", lang) });
      }
    });
  }, []);

  const connectPrinter = async () => {
    setPrinterBusy(true);
    try {
      const dev = await requestPrinter();
      if (dev) {
        setPrinterInfo({ name: dev.productName || dev.manufacturerName || t("obs.usb.defaultName", lang) });
        showToast(t("obs.usb.connected.toast", lang), "success");
      }
    } catch (e: any) {
      showToast(e?.message ?? t("obs.usb.connectFail", lang), "error");
    } finally {
      setPrinterBusy(false);
    }
  };

  const testPrinter = async () => {
    setPrinterBusy(true);
    try {
      await printTestPage();
      showToast(t("obs.usb.testSent", lang), "success");
    } catch (e: any) {
      showToast(e?.message ?? t("obs.usb.testFail", lang), "error");
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
  const [tossSecret, setTossSecret] = useState(""); // write-only — 보안상 화면에 표시하지 않음
  const [kioskEnabled, setKioskEnabled] = useState(!!cfg?.kioskEnabled);
  const [theme, setTheme] = useState(cfg?.theme ?? defaultThemeForIndustry(cfg?.industry));

  const [tierNames, setTierNames] = useState<Record<string, string>>(currentUser?.tierNames ?? {});
  const [tierRewards, setTierRewards] = useState<Record<string, string>>(currentUser?.tierRewards ?? {});

  // 언어 설정 — localStorage 기반, 컴포넌트 단위 구독
  const lang = useLanguage();

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
    showToast(t("obs.ok.basic", lang), "success");
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
      kioskEnabled,
      theme,
    });
    // 시크릿 키 — 입력했을 때만 서버 보안 컬렉션(store_secrets)에 저장. 클라이언트엔 남기지 않음.
    if (tossSecret.trim()) {
      try {
        const idToken = await auth?.currentUser?.getIdToken();
        const res = await fetch(api("/api/store/toss-secret"), {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${idToken ?? ""}` },
          body: JSON.stringify({ storeId, secretKey: tossSecret.trim() }),
        });
        if (res.ok) setTossSecret("");
        else showToast(t("obs.toss.secretFail", lang), "error");
      } catch {
        showToast(t("obs.toss.secretFail", lang), "error");
      }
    }
    // 화면 입력값도 클램프 결과로 정정
    setPointRate(String(rate));
    setStampMax(String(stamps));
    setInactiveDays(String(inactive));
    setRadius(String(r));
    showToast(t("obs.ok.config", lang), "success");
  };

  const captureLocation = async () => {
    try {
      const pos = await getCurrentPosition();
      await updateStoreLocation(storeId, pos.coords.latitude, pos.coords.longitude);
      showToast(t("obs.geo.savedToast", lang, { lat: pos.coords.latitude.toFixed(5), lng: pos.coords.longitude.toFixed(5) }), "success");
    } catch (e: any) {
      showToast(t("obs.geo.fail", lang, { msg: e?.message ?? "" }), "error");
    }
  };

  return (
    <OwnerShell title={t("obs.title", lang)} width="narrow">
      <div className="pb-12">
        <Sec title={t("obs.sec.basic", lang)}>
          <Input label={t("obs.field.storeName", lang)} value={restaurantName} onChange={(e) => setRestaurantName(e.target.value)} />
        </Sec>

        <Sec title={t("obs.sec.language", lang)}>
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--color-navy-50)] inline-flex items-center justify-center flex-shrink-0">
              <Languages className="w-5 h-5 text-[var(--color-navy-700)]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-bold text-[var(--color-navy-900)]">{t("obs.lang.title", lang)}</p>
              <p className="text-[12px] text-[var(--color-ink-500)] font-medium mt-0.5 break-keep">
                {t("obs.lang.desc", lang)}
              </p>
              <div className="flex gap-2 mt-3 flex-wrap">
                {LANGS.map((l) => (
                  <button
                    key={l.code}
                    type="button"
                    onClick={() => setLanguage(l.code)}
                    className={`h-10 px-4 rounded-full border text-[13px] font-bold ${
                      lang === l.code
                        ? "bg-[var(--color-navy-700)] text-white border-transparent"
                        : "bg-white text-[var(--color-ink-700)] border-[var(--color-line)]"
                    }`}
                  >
                    {l.native}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Sec>

        <Sec title={t("obs.sec.pos", lang)}>
          <div>
            <label className="block text-[13px] font-semibold text-[var(--color-navy-800)] mb-2">
              {t("obs.pos.using", lang)}
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
              label={t("obs.pos.apiKeyOption", lang, { label: vendorInfo.keyLabel ?? t("obs.pos.apiLabel", lang) })}
              placeholder={vendorInfo.placeholder ?? t("obs.pos.placeholderDefault", lang)}
              value={posApiKey}
              onChange={(e) => setPosApiKey(e.target.value)}
              leftSlot={<KeyRound className="w-4 h-4" />}
              hint={
                posApiKey
                  ? vendorInfo.hint ?? t("obs.pos.hintAuto", lang)
                  : t("obs.pos.hintNoKey", lang)
              }
            />
          ) : (
            <div className="flex items-start gap-2 p-3.5 rounded-[14px] bg-[var(--color-mint-50)] border border-[var(--color-mint-200)]">
              <Info className="w-4 h-4 text-[var(--color-mint-700)] mt-0.5 shrink-0" />
              <p className="text-[12px] text-[var(--color-mint-700)] font-semibold leading-relaxed">
                {vendorInfo.hint ?? t("obs.pos.hintNone", lang)}
              </p>
            </div>
          )}

          <Input
            label={t("obs.pos.legacy", lang)}
            value={foodtech}
            onChange={(e) => setFoodtech(e.target.value)}
            hint={t("obs.pos.legacyHint", lang)}
          />
        </Sec>

        {/* ===== USB 영수증 프린터 직결 ===== */}
        <Sec title={t("obs.sec.printerUsb", lang)}>
          {!isWebUsbSupported() ? (
            <div className="flex items-start gap-2 p-3.5 rounded-[14px] bg-[#fef2f2] border border-[var(--color-danger)]/30">
              <AlertCircle className="w-4 h-4 text-[var(--color-danger)] mt-0.5 shrink-0" />
              <p className="text-[12px] text-[var(--color-danger)] font-semibold leading-relaxed">
                {t("obs.usb.unsupported", lang)}
                <br />
                <span className="font-medium opacity-90">
                  {t("obs.usb.unsupportedDesc", lang)}
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
                    {t("obs.usb.connected", lang)}
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
                  {t("obs.usb.testPrint", lang)}
                </Button>
                <Button
                  variant="outline"
                  size="md"
                  onClick={connectPrinter}
                  loading={printerBusy}
                  leftIcon={<Plug className="w-4 h-4" />}
                >
                  {t("obs.usb.pickOther", lang)}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-start gap-2 p-3.5 rounded-[14px] bg-[var(--color-navy-50)] border border-[var(--color-navy-200)]">
                <Info className="w-4 h-4 text-[var(--color-navy-700)] mt-0.5 shrink-0" />
                <p className="text-[12px] text-[var(--color-navy-700)] font-semibold leading-relaxed">
                  {t("obs.usb.intro", lang)}
                  <br />
                  <span className="font-medium opacity-90">
                    {t("obs.usb.persistent", lang)}
                  </span>
                </p>
              </div>
              <Button
                block
                onClick={connectPrinter}
                loading={printerBusy}
                leftIcon={<Plug className="w-4 h-4" />}
              >
                {t("obs.usb.connect", lang)}
              </Button>
            </div>
          )}
        </Sec>

        {/* ===== 영업 시간 ===== */}
        <BusinessHoursSection
          owner={currentUser}
          onSave={async (patch) => {
            await updateBrandSettings(storeId, patch);
            showToast(t("obs.ok.hours", lang), "success");
          }}
        />

        {/* ===== 영수증 자동 인쇄 (브릿지) — 옵션 B ===== */}
        <PrintBridgeSection
          storeId={storeId}
          ownerName={currentUser.restaurantName}
          enabled={!!currentUser.printBridgeEnabled}
          device={currentUser.printBridgeDevice}
          onToggle={async (v) => {
            await updateBrandSettings(storeId, { printBridgeEnabled: v });
            showToast(v ? t("obs.ok.bridgeOn", lang) : t("obs.ok.bridgeOff", lang), "success");
          }}
        />

        {/* ===== 푸시 알림 — 사장님 폰/PC 로 새 주문·결제 요청·직원 가입 알림 ===== */}
        <PushNotificationSection
          storeId={storeId}
          prefs={currentUser.pushPrefs}
          deviceCount={(currentUser.fcmTokens ?? []).length}
          onPrefChange={async (patch) => {
            await updateBrandSettings(storeId, {
              pushPrefs: { ...(currentUser.pushPrefs ?? {}), ...patch },
            });
          }}
        />

        <Sec title={t("obs.sec.industry", lang)}>
          <div className="grid grid-cols-4 gap-2">
            {(["cafe", "meat", "bakery", "general"] as Industry[]).map((i) => (
              <Pill key={i} active={industry === i} onClick={() => setIndustry(i)}>
                {i === "cafe" ? t("obs.industry.cafe", lang) : i === "meat" ? t("obs.industry.meat", lang) : i === "bakery" ? t("obs.industry.bakery", lang) : t("obs.industry.general", lang)}
              </Pill>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2 mt-3">
            {(["point", "stamp"] as RewardType[]).map((r) => (
              <Pill key={r} active={rewardType === r} onClick={() => setRewardType(r)}>
                {r === "point" ? t("obs.reward.point", lang) : t("obs.reward.stamp", lang)}
              </Pill>
            ))}
          </div>
          {rewardType === "point" ? (
            <Input
              label={t("obs.field.pointRate", lang)}
              value={pointRate}
              onChange={(e) => setPointRate(e.target.value)}
              hint={t("obs.field.pointRateHint", lang)}
            />
          ) : (
            <Input
              label={t("obs.field.stampMax", lang)}
              value={stampMax}
              onChange={(e) => setStampMax(e.target.value.replace(/\D/g, ""))}
              inputMode="numeric"
            />
          )}
        </Sec>

        <Sec title={t("obs.sec.theme", lang)}>
          <p className="text-[12px] text-[var(--color-ink-500)] -mt-1 mb-1 leading-relaxed break-keep">
            {t("obs.theme.desc", lang)}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {THEMES.map((th) => {
              const active = theme === th.id;
              const recommended = th.recommendedFor?.includes(industry);
              return (
                <button
                  key={th.id}
                  type="button"
                  onClick={() => {
                    setTheme(th.id);
                    applyTheme(th.id); // 즉시 미리보기 (저장 전)
                  }}
                  className={cn(
                    "relative text-left p-3 rounded-[14px] border-2 transition-all active:scale-[0.98]",
                    active
                      ? "border-[var(--color-navy-700)] shadow-[var(--shadow-card)]"
                      : "border-[var(--color-line)] bg-white"
                  )}
                >
                  {recommended && (
                    <span className="absolute top-1.5 right-1.5 text-[9.5px] font-extrabold px-1.5 py-0.5 rounded-full bg-[var(--color-mint-100)] text-[var(--color-mint-700)]">
                      {t("obs.theme.recommend", lang)}
                    </span>
                  )}
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <span
                      className="w-5 h-5 rounded-full border border-black/5 shrink-0"
                      style={{ background: th.primary }}
                    />
                    <span
                      className="w-5 h-5 rounded-full border border-black/5 shrink-0 -ml-2.5"
                      style={{ background: th.accent }}
                    />
                    <span className="text-[16px] ml-0.5">{th.emoji}</span>
                  </div>
                  <p className="text-[13px] font-extrabold text-[var(--color-navy-900)] flex items-center gap-1">
                    {th.name}
                    {active && <CheckCircle2 className="w-3.5 h-3.5 text-[var(--color-navy-700)]" />}
                  </p>
                  <p className="text-[10.5px] text-[var(--color-ink-500)] font-medium leading-snug mt-0.5 break-keep">
                    {th.desc}
                  </p>
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-[var(--color-ink-400)] font-medium mt-1">
            {t("obs.theme.saveHint", lang)}
          </p>
        </Sec>

        <Sec title={t("obs.sec.tierCustom", lang)}>
          <div className="space-y-2">
            {TIER_ORDER.map((tier) => (
              <Card key={tier} padding="sm">
                <p className="text-[12px] font-bold text-[var(--color-navy-700)] mb-2">{tier}</p>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    placeholder={t("obs.tier.aliasPh", lang)}
                    value={tierNames[tier] ?? ""}
                    onChange={(e) => setTierNames({ ...tierNames, [tier]: e.target.value })}
                    className="input-field text-[13px]"
                  />
                  <input
                    placeholder={t("obs.tier.rewardPh", lang)}
                    value={tierRewards[tier] ?? ""}
                    onChange={(e) => setTierRewards({ ...tierRewards, [tier]: e.target.value })}
                    className="input-field text-[13px]"
                  />
                </div>
              </Card>
            ))}
          </div>
        </Sec>

        <Sec title={t("obs.sec.marketing", lang)}>
          <Input
            label={t("obs.marketing.inactive", lang)}
            value={inactiveDays}
            onChange={(e) => setInactiveDays(e.target.value.replace(/\D/g, ""))}
            inputMode="numeric"
          />
          <Toggle label={t("obs.marketing.birthday", lang)} value={birthdayCoupon} onChange={setBirthdayCoupon} />
        </Sec>

        <Sec title={t("obs.sec.sms", lang)}>
          <Input label={t("obs.sms.aligoKey", lang)} value={aligoKey} onChange={(e) => setAligoKey(e.target.value)} />
          <Input label={t("obs.sms.aligoUserId", lang)} value={aligoUserId} onChange={(e) => setAligoUserId(e.target.value)} />
          <Input label={t("obs.sms.sender", lang)} value={aligoSender} onChange={(e) => setAligoSender(e.target.value)} />
          <Input label={t("obs.sms.gateway", lang)} value={smsGatewayUrl} onChange={(e) => setSmsGatewayUrl(e.target.value)} />
        </Sec>

        <Sec title={t("obs.sec.payment", lang)}>
          <Input label={t("obs.payment.toss", lang)} value={tossKey} onChange={(e) => setTossKey(e.target.value)} />
          <Input
            label={t("obs.payment.tossSecret", lang)}
            type="password"
            value={tossSecret}
            onChange={(e) => setTossSecret(e.target.value)}
            placeholder={t("obs.payment.tossSecretPh", lang)}
          />
          <p className="text-[12px] text-[var(--color-ink-500)] mt-1 leading-relaxed">
            {t("obs.payment.tossSecretHelp", lang)}
          </p>
        </Sec>

        <Sec title={t("obs.sec.kiosk", lang)}>
          <Toggle label={t("obs.kiosk.enable", lang)} value={kioskEnabled} onChange={setKioskEnabled} />
          <p className="text-[12px] text-[var(--color-ink-500)] mt-2 leading-relaxed">{t("obs.kiosk.desc", lang)}</p>
        </Sec>

        <Sec title={t("obs.sec.geo", lang)}>
          <Toggle label={t("obs.geo.only", lang)} value={locationOnly} onChange={setLocationOnly} />
          <Input
            label={t("obs.geo.radius", lang)}
            value={radius}
            onChange={(e) => setRadius(e.target.value.replace(/\D/g, ""))}
            inputMode="numeric"
          />
          <Button variant="ghost" size="md" onClick={captureLocation} leftIcon={<MapPin className="w-4 h-4" />} block>
            {t("obs.geo.save", lang)}
          </Button>
          {currentUser.lat && currentUser.lng && (
            <p className="text-[12px] text-[var(--color-ink-600)] mt-1.5 tabular-nums">
              {t("obs.geo.saved", lang, { lat: currentUser.lat.toFixed(5), lng: currentUser.lng.toFixed(5) })}
            </p>
          )}
        </Sec>

        <div className="grid grid-cols-2 gap-3 mt-6 sticky bottom-4">
          <Button variant="ghost" size="lg" onClick={saveBasic} leftIcon={<Save className="w-4 h-4" />}>
            {t("obs.saveBasic", lang)}
          </Button>
          <Button size="lg" onClick={saveConfig} leftIcon={<Save className="w-4 h-4" />}>
            {t("obs.saveConfig", lang)}
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

// 라벨 없는 작은 토글 — 카드 우측 정렬용
function ToggleSwitch({ value, onChange }: { value: boolean; onChange: (v: boolean) => void | Promise<void> }) {
  return (
    <button
      onClick={() => onChange(!value)}
      role="switch"
      aria-checked={value}
      className={`w-11 h-6 rounded-full relative transition-colors shrink-0 ${
        value ? "bg-[var(--color-navy-700)]" : "bg-[var(--color-ink-100)]"
      }`}
    >
      <span
        className={`absolute top-0.5 ${value ? "left-[22px]" : "left-0.5"} w-5 h-5 rounded-full bg-white shadow transition-all`}
      />
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

// ============================================================
// 영수증 자동 인쇄 브릿지 — 사장님 PC 에이전트 페어링 섹션 (옵션 B)
// ============================================================
function PrintBridgeSection({
  storeId,
  ownerName,
  enabled,
  device,
  onToggle,
}: {
  storeId: string;
  ownerName?: string;
  enabled: boolean;
  device?: { name?: string; pairedAt: string };
  onToggle: (v: boolean) => Promise<void>;
}) {
  const lang = useLanguage();
  const locale = getLocale(lang);
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(0);

  // 카운트다운 — 5분 안에 안 쓰면 폐기
  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => {
      const r = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
      setRemaining(r);
      if (r === 0) {
        setCode(null);
        setExpiresAt(null);
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  const requestCode = async () => {
    setBusy(true);
    try {
      const { code, expiresAt } = await issuePairingCode(storeId, ownerName);
      setCode(code);
      setExpiresAt(new Date(expiresAt).getTime());
      showToast(t("obsBridge.toast.issued", lang), "success");
    } catch (e: any) {
      showToast(t("obsBridge.toast.issueFail", lang, { msg: e?.message ?? "" }), "error");
    } finally {
      setBusy(false);
    }
  };

  const copyCode = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      showToast(t("obsBridge.toast.copied", lang), "info");
    } catch {
      showToast(t("obsBridge.toast.copyFail", lang), "error");
    }
  };

  const mmss = (s: number) => {
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${String(r).padStart(2, "0")}`;
  };

  return (
    <Sec title={t("obsBridge.title", lang)}>
      <div className="space-y-3">
        {/* 토글 */}
        <div className="p-3.5 rounded-[14px] border border-[var(--color-line)] bg-white">
          <div className="flex items-start gap-3">
            <Printer className="w-5 h-5 text-[var(--color-navy-700)] mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-bold text-[var(--color-navy-900)]">{t("obsBridge.useAuto", lang)}</p>
              <p className="text-[12px] text-[var(--color-ink-600)] leading-relaxed mt-0.5">
                {t("obsBridge.useAutoDesc", lang)}
              </p>
            </div>
            <ToggleSwitch value={enabled} onChange={onToggle} />
          </div>
        </div>

        {/* 페어링 상태 */}
        {device ? (
          <div className="p-3.5 rounded-[14px] bg-[var(--color-mint-50)] border border-[var(--color-mint-200)]">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-[var(--color-mint-700)] mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold text-[var(--color-mint-700)]">
                  {t("obsBridge.connected", lang, { suffix: device.name ? ` · ${device.name}` : "" })}
                </p>
                <p className="text-[11.5px] text-[var(--color-mint-700)] font-medium opacity-90 mt-0.5">
                  {t("obsBridge.pairedAt", lang, { when: new Date(device.pairedAt).toLocaleString(locale) })}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-3.5 rounded-[14px] bg-[var(--color-navy-50)] border border-[var(--color-navy-200)]">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-[var(--color-navy-700)] mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[12px] text-[var(--color-navy-700)] font-semibold leading-relaxed">
                  {t("obsBridge.noneTitle", lang)}
                  <br />
                  <span className="font-medium opacity-90">
                    {t("obsBridge.noneDesc", lang)}
                  </span>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 코드 발급·표시 */}
        {code ? (
          <div className="p-4 rounded-[14px] bg-white border-2 border-[var(--color-navy-700)]">
            <p className="text-[11px] font-bold text-[var(--color-ink-500)] uppercase tracking-wider text-center">
              {t("obsBridge.codeLabel", lang, { time: mmss(remaining) })}
            </p>
            <button
              onClick={copyCode}
              className="w-full mt-2 text-[34px] font-extrabold text-[var(--color-navy-900)] tabular-nums tracking-[0.25em] text-center active:scale-[0.97] transition-transform"
              aria-label={t("obsBridge.codeCopy", lang)}
            >
              {code}
            </button>
            <p className="text-[11.5px] text-[var(--color-ink-500)] text-center mt-2">
              {t("obsBridge.codeHint", lang)}
            </p>
          </div>
        ) : (
          <Button
            block
            variant="outline"
            onClick={requestCode}
            loading={busy}
            leftIcon={<KeyRound className="w-4 h-4" />}
          >
            {device ? t("obsBridge.btn.repair", lang) : t("obsBridge.btn.issue", lang)}
          </Button>
        )}

        {/* 다운로드 버튼 — GitHub Releases 최신 버전을 OS 자동 감지로 안내 */}
        <a
          href="https://github.com/munyechan11-cell/-/releases/latest"
          target="_blank"
          rel="noreferrer noopener"
          className="block w-full text-center h-12 leading-[48px] rounded-[14px] bg-[var(--color-navy-700)] text-white text-[13px] font-bold hover:bg-[var(--color-navy-800)] active:scale-[0.98] transition-all"
        >
          {t("obsBridge.download", lang)}
        </a>

        {/* 다운로드 가이드 */}
        <div className="text-[11.5px] text-[var(--color-ink-500)] leading-relaxed border-t border-[var(--color-line)] pt-3">
          <p className="font-bold text-[var(--color-ink-700)] mb-1">{t("obsBridge.guide.title", lang)}</p>
          <ol className="list-decimal pl-4 space-y-0.5">
            <li>{t("obsBridge.guide.step1", lang)}</li>
            <li>{t("obsBridge.guide.step2", lang)}</li>
            <li>{t("obsBridge.guide.step3", lang)}</li>
            <li>{t("obsBridge.guide.step4", lang)}</li>
          </ol>
        </div>
      </div>
    </Sec>
  );
}

// ============================================================
// 푸시 알림 섹션 — 권한 요청·디바이스 등록·종류별 ON/OFF
// ============================================================
function PushNotificationSection({
  storeId,
  prefs,
  deviceCount,
  onPrefChange,
}: {
  storeId: string;
  prefs?: { newOrder?: boolean; paymentRequest?: boolean; staffJoin?: boolean; couponRequest?: boolean };
  deviceCount: number;
  onPrefChange: (patch: NonNullable<typeof prefs>) => Promise<void>;
}) {
  const lang = useLanguage();
  const [supported, setSupported] = useState<boolean | null>(null);
  const [perm, setPerm] = useState<PermissionState>("default");
  const [busy, setBusy] = useState(false);
  const [registered, setRegistered] = useState(deviceCount > 0);

  useEffect(() => {
    let alive = true;
    (async () => {
      const ok = await isPushSupported();
      const p = await getPermissionState();
      if (!alive) return;
      setSupported(ok);
      setPerm(p);
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => { setRegistered(deviceCount > 0); }, [deviceCount]);

  const [lastErrorDetail, setLastErrorDetail] = useState<string>("");
  const [lastErrorReason, setLastErrorReason] = useState<string>("");

  const enable = async () => {
    setBusy(true);
    setLastErrorDetail("");
    setLastErrorReason("");
    try {
      const r = await registerOwnerDevice(storeId);
      if (r.ok) {
        setRegistered(true);
        setPerm("granted");
        showToast(t("obsPush.toast.on", lang), "success");
        return;
      }
      // 실패 — reason 별 친화 메시지 + 상세 에러 카드
      setLastErrorReason(r.reason ?? "error");
      setLastErrorDetail(r.detail ?? "");
      switch (r.reason) {
        case "unsupported":
          showToast(t("obsPush.toast.unsupported", lang), "info");
          break;
        case "denied":
          showToast(t("obsPush.toast.denied", lang), "error");
          setPerm("denied");
          break;
        case "no-vapid":
          showToast(t("obsPush.toast.noVapid", lang), "error");
          break;
        case "sw-register-failed":
          showToast(t("obsPush.toast.swFail", lang), "error");
          break;
        case "no-auth":
          showToast(t("obsPush.toast.noAuth", lang), "error");
          break;
        case "firestore-error":
          showToast(t("obsPush.toast.firestore", lang, { detail: r.detail ?? "" }).slice(0, 100), "error");
          break;
        default:
          showToast(t("obsPush.toast.fail", lang, { detail: r.detail ?? t("obsPush.toast.reasonUnknown", lang) }), "error");
      }
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    try {
      await unregisterOwnerDevice(storeId);
      setRegistered(false);
      showToast(t("obsPush.toast.off", lang), "info");
    } finally {
      setBusy(false);
    }
  };

  const isOn = perm === "granted" && registered;

  return (
    <Sec title={t("obsPush.title", lang)}>
      <div className="space-y-3">
        {/* 상태 카드 */}
        {supported === false ? (
          <div className="flex items-start gap-2 p-3.5 rounded-[14px] bg-[#fef2f2] border border-[var(--color-danger)]/30">
            <AlertCircle className="w-4 h-4 text-[var(--color-danger)] mt-0.5 shrink-0" />
            <p className="text-[12px] text-[var(--color-danger)] font-semibold leading-relaxed">
              {t("obsPush.unsupported", lang)}
              <br />
              <span className="font-medium opacity-90">
                {t("obsPush.unsupportedDesc", lang)}
              </span>
            </p>
          </div>
        ) : perm === "denied" ? (
          <div className="flex items-start gap-2 p-3.5 rounded-[14px] bg-[#fff8e6] border border-[#f0b400]/40">
            <AlertCircle className="w-4 h-4 text-[#b07b00] mt-0.5 shrink-0" />
            <p className="text-[12px] text-[#b07b00] font-semibold leading-relaxed">
              {t("obsPush.denied", lang)}
            </p>
          </div>
        ) : (
          <div className={`flex items-start gap-2 p-3.5 rounded-[14px] ${
            isOn
              ? "bg-[var(--color-mint-50)] border border-[var(--color-mint-200)]"
              : "bg-[var(--color-navy-50)] border border-[var(--color-navy-200)]"
          }`}>
            {isOn ? (
              <CheckCircle2 className="w-4 h-4 text-[var(--color-mint-700)] mt-0.5 shrink-0" />
            ) : (
              <Info className="w-4 h-4 text-[var(--color-navy-700)] mt-0.5 shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className={`text-[13px] font-bold ${isOn ? "text-[var(--color-mint-700)]" : "text-[var(--color-navy-700)]"}`}>
                {isOn ? t("obsPush.onTitle", lang, { n: deviceCount }) : t("obsPush.offTitle", lang)}
              </p>
              <p className={`text-[11.5px] font-medium opacity-90 mt-0.5 ${isOn ? "text-[var(--color-mint-700)]" : "text-[var(--color-navy-700)]"}`}>
                {isOn ? t("obsPush.onDesc", lang) : t("obsPush.offDesc", lang)}
              </p>
            </div>
          </div>
        )}

        {/* 실패 진단 카드 — reason 별 해결법 */}
        {lastErrorReason && !isOn && (
          <div className="p-3.5 rounded-[14px] bg-[#fef2f2] border border-[var(--color-danger)]/40">
            <p className="text-[12.5px] font-extrabold text-[var(--color-danger)] mb-1">
              {t("obsPush.failTitle", lang, { reason:
                ({
                  "no-vapid": t("obsPush.reason.noVapid", lang),
                  "sw-register-failed": t("obsPush.reason.swFail", lang),
                  "denied": t("obsPush.reason.denied", lang),
                  "no-auth": t("obsPush.reason.noAuth", lang),
                  "firestore-error": t("obsPush.reason.firestore", lang),
                  "unsupported": t("obsPush.reason.unsupported", lang),
                  "error": t("obsPush.reason.error", lang),
                } as Record<string, string>)[lastErrorReason] || lastErrorReason
              })}
            </p>
            <p className="text-[11.5px] text-[var(--color-ink-700)] leading-relaxed font-medium">
              {({
                "no-vapid": t("obsPush.help.noVapid", lang),
                "sw-register-failed": t("obsPush.help.swFail", lang),
                "denied": t("obsPush.help.denied", lang),
                "no-auth": t("obsPush.help.noAuth", lang),
                "firestore-error": t("obsPush.help.firestore", lang),
                "unsupported": t("obsPush.help.unsupported", lang),
              } as Record<string, string>)[lastErrorReason] || t("obsPush.help.fallback", lang)}
            </p>
            {lastErrorDetail && (
              <details className="mt-2">
                <summary className="text-[10.5px] text-[var(--color-ink-500)] cursor-pointer font-bold">
                  {t("obsPush.detailLabel", lang)}
                </summary>
                <p className="mt-1 text-[10.5px] font-mono break-all text-[var(--color-ink-600)] bg-white p-2 rounded">
                  {lastErrorDetail}
                </p>
              </details>
            )}
          </div>
        )}

        {/* ON/OFF 큰 버튼 */}
        {supported !== false && perm !== "denied" && (
          <Button
            block
            onClick={isOn ? disable : enable}
            loading={busy}
            variant={isOn ? "outline" : "primary"}
            leftIcon={isOn ? <BellOff className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
          >
            {isOn ? t("obsPush.btn.off", lang) : t("obsPush.btn.on", lang)}
          </Button>
        )}

        {/* 종류별 ON/OFF — 등록된 디바이스가 있을 때만 노출 */}
        {deviceCount > 0 && (
          <div className="rounded-[14px] border border-[var(--color-line)] divide-y divide-[var(--color-line)] bg-white">
            <PrefRow
              icon="🔔"
              label={t("obsPush.pref.newOrder", lang)}
              hint={t("obsPush.pref.newOrderHint", lang)}
              value={prefs?.newOrder !== false}
              onChange={(v) => onPrefChange({ newOrder: v })}
            />
            <PrefRow
              icon="💳"
              label={t("obsPush.pref.payment", lang)}
              hint={t("obsPush.pref.paymentHint", lang)}
              value={prefs?.paymentRequest !== false}
              onChange={(v) => onPrefChange({ paymentRequest: v })}
            />
            <PrefRow
              icon="🎟"
              label={t("obsPush.pref.coupon", lang)}
              hint={t("obsPush.pref.couponHint", lang)}
              value={prefs?.couponRequest !== false}
              onChange={(v) => onPrefChange({ couponRequest: v })}
            />
            <PrefRow
              icon="👤"
              label={t("obsPush.pref.staff", lang)}
              hint={t("obsPush.pref.staffHint", lang)}
              value={prefs?.staffJoin !== false}
              onChange={(v) => onPrefChange({ staffJoin: v })}
            />
          </div>
        )}

        {/* 안내 */}
        <div className="text-[11px] text-[var(--color-ink-500)] leading-relaxed border-t border-[var(--color-line)] pt-3 flex items-start gap-2">
          <Smartphone className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <div>
            <p className="font-bold text-[var(--color-ink-700)] mb-1">{t("obsPush.multi.title", lang)}</p>
            <p>
              {t("obsPush.multi.desc", lang)}
            </p>
          </div>
        </div>
      </div>
    </Sec>
  );
}

function PrefRow({
  icon, label, hint, value, onChange,
}: { icon: string; label: string; hint: string; value: boolean; onChange: (v: boolean) => void | Promise<void> }) {
  return (
    <div className="flex items-center gap-3 px-3.5 py-3">
      <span className="text-[18px]">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-[13.5px] font-bold text-[var(--color-navy-900)]">{label}</p>
        <p className="text-[11px] text-[var(--color-ink-500)] font-medium">{hint}</p>
      </div>
      <ToggleSwitch value={value} onChange={onChange} />
    </div>
  );
}

// ============================================================
// 영업 시간 섹션 — 요일별 시간 + 휴게시간 + 24시 + 임시 휴무일
// ============================================================
function BusinessHoursSection({
  owner,
  onSave,
}: {
  owner: { businessHours?: BusinessHours; temporarilyClosed?: boolean; temporaryClosedReason?: string } | null;
  onSave: (patch: { businessHours?: BusinessHours; temporarilyClosed?: boolean; temporaryClosedReason?: string }) => Promise<void>;
}) {
  const lang = useLanguage();
  const init = useMemo(() => owner?.businessHours ?? defaultBusinessHours(), [owner?.businessHours]);
  const [bh, setBh] = useState<BusinessHours>(init);
  const [tempClosed, setTempClosed] = useState(!!owner?.temporarilyClosed);
  const [tempReason, setTempReason] = useState(owner?.temporaryClosedReason ?? "");
  const [closedDate, setClosedDate] = useState("");

  useEffect(() => setBh(init), [init]);
  useEffect(() => { setTempClosed(!!owner?.temporarilyClosed); }, [owner?.temporarilyClosed]);
  useEffect(() => { setTempReason(owner?.temporaryClosedReason ?? ""); }, [owner?.temporaryClosedReason]);

  const status = getStoreOpenStatus(owner);

  const updateWeekly = (idx: number, patch: Partial<NonNullable<BusinessHours["weekly"]>[number]>) => {
    const weekly = [...(bh.weekly ?? [])];
    weekly[idx] = { ...weekly[idx], ...patch };
    setBh({ ...bh, weekly });
  };

  const addClosedDate = () => {
    if (!closedDate) return;
    const dates = Array.from(new Set([...(bh.closedDates ?? []), closedDate]));
    setBh({ ...bh, closedDates: dates });
    setClosedDate("");
  };
  const removeClosedDate = (d: string) => {
    setBh({ ...bh, closedDates: (bh.closedDates ?? []).filter((x) => x !== d) });
  };

  return (
    <Sec title={t("obsBh.title", lang)}>
      <div className="space-y-3">
        {/* 현재 상태 카드 */}
        <div className={cn(
          "p-3.5 rounded-[14px] flex items-center gap-2.5",
          status.open
            ? "bg-[var(--color-mint-50)] border border-[var(--color-mint-200)]"
            : "bg-[#fef2f2] border border-[var(--color-danger)]/40"
        )}>
          <span className={cn("w-2 h-2 rounded-full", status.open ? "bg-[var(--color-mint-500)] animate-pulse" : "bg-[var(--color-danger)]")} />
          <p className={cn("text-[13px] font-extrabold", status.open ? "text-[var(--color-mint-700)]" : "text-[var(--color-danger)]")}>
            {t("obsBh.current", lang, { status: summarizeStatus(status) })}
          </p>
        </div>

        {/* 24시 영업 */}
        <div className="p-3 rounded-[12px] border border-[var(--color-line)] flex items-center gap-3">
          <Clock className="w-4 h-4 text-[var(--color-navy-700)]" />
          <div className="flex-1">
            <p className="text-[13px] font-bold text-[var(--color-navy-900)]">{t("obsBh.h24.title", lang)}</p>
            <p className="text-[11px] text-[var(--color-ink-500)]">{t("obsBh.h24.desc", lang)}</p>
          </div>
          <ToggleSwitch value={!!bh.open24h} onChange={(v) => setBh({ ...bh, open24h: v })} />
        </div>

        {/* 요일별 시간 */}
        {!bh.open24h && (
          <div className="rounded-[12px] border border-[var(--color-line)] divide-y divide-[var(--color-line)] bg-white">
            {DAY_LABELS.map((label, idx) => {
              const w = bh.weekly?.[idx] ?? { open: "09:00", close: "22:00", closed: false };
              return (
                <div key={idx} className="px-3 py-2.5 flex items-center gap-2 flex-wrap">
                  <span className="w-8 text-[12.5px] font-extrabold text-[var(--color-navy-900)]">{label}</span>
                  {w.closed ? (
                    <span className="text-[12px] font-bold text-[var(--color-danger)] flex-1">{t("obsBh.day.closed", lang)}</span>
                  ) : (
                    <>
                      <input
                        type="time"
                        value={w.open ?? "09:00"}
                        onChange={(e) => updateWeekly(idx, { open: e.target.value })}
                        className="h-9 px-2 rounded-md border border-[var(--color-line)] text-[13px] font-semibold tabular-nums"
                      />
                      <span className="text-[11px] text-[var(--color-ink-500)]">~</span>
                      <input
                        type="time"
                        value={w.close ?? "22:00"}
                        onChange={(e) => updateWeekly(idx, { close: e.target.value })}
                        className="h-9 px-2 rounded-md border border-[var(--color-line)] text-[13px] font-semibold tabular-nums"
                      />
                      {w.breakStart || w.breakEnd ? (
                        <span className="text-[10.5px] text-[var(--color-warn)] font-bold">
                          {t("obsBh.day.breakLine", lang, { start: w.breakStart ?? "??", end: w.breakEnd ?? "??" })}
                        </span>
                      ) : (
                        <button
                          onClick={() => updateWeekly(idx, { breakStart: "15:00", breakEnd: "17:00" })}
                          className="text-[10.5px] font-bold text-[var(--color-navy-700)] hover:underline"
                        >
                          {t("obsBh.day.addBreak", lang)}
                        </button>
                      )}
                    </>
                  )}
                  <button
                    onClick={() => updateWeekly(idx, { closed: !w.closed })}
                    className={cn(
                      "ml-auto text-[10.5px] font-bold px-2 py-1 rounded-md",
                      w.closed ? "bg-[var(--color-mint-100)] text-[var(--color-mint-700)]" : "bg-[#fef2f2] text-[var(--color-danger)]"
                    )}
                  >
                    {w.closed ? t("obsBh.day.toOpen", lang) : t("obsBh.day.toClosed", lang)}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* 임시 휴무일 (날짜) */}
        <div className="rounded-[12px] border border-[var(--color-line)] p-3">
          <p className="text-[12.5px] font-bold text-[var(--color-navy-900)] mb-2">{t("obsBh.closedDates.title", lang)}</p>
          <div className="flex items-center gap-2 mb-2">
            <input
              type="date"
              value={closedDate}
              onChange={(e) => setClosedDate(e.target.value)}
              className="flex-1 h-9 px-2 rounded-md border border-[var(--color-line)] text-[13px] font-semibold"
            />
            <button
              onClick={addClosedDate}
              disabled={!closedDate}
              className="h-9 px-3 rounded-md bg-[var(--color-navy-700)] text-white text-[12px] font-bold disabled:opacity-40"
            >
              {t("obsBh.closedDates.add", lang)}
            </button>
          </div>
          {(bh.closedDates ?? []).length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {(bh.closedDates ?? []).sort().map((d) => (
                <span key={d} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-[var(--color-ink-50)] text-[11px] font-bold text-[var(--color-ink-700)]">
                  {d}
                  <button onClick={() => removeClosedDate(d)} className="text-[var(--color-danger)] hover:text-[#a52323]">×</button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* 임시 마감 토글 */}
        <div className="rounded-[12px] border-2 border-[var(--color-warn)]/30 bg-[#fff8e6] p-3">
          <div className="flex items-center gap-3 mb-2">
            <AlertCircle className="w-4 h-4 text-[var(--color-warn)]" />
            <div className="flex-1">
              <p className="text-[12.5px] font-bold text-[#b07b00]">{t("obsBh.emergency.title", lang)}</p>
              <p className="text-[10.5px] text-[#b07b00]/80">{t("obsBh.emergency.desc", lang)}</p>
            </div>
            <ToggleSwitch value={tempClosed} onChange={async (v) => {
              setTempClosed(v);
              await onSave({ temporarilyClosed: v, temporaryClosedReason: v ? tempReason : "" });
            }} />
          </div>
          {tempClosed && (
            <input
              type="text"
              placeholder={t("obsBh.emergency.reasonPh", lang)}
              value={tempReason}
              onChange={(e) => setTempReason(e.target.value)}
              onBlur={() => onSave({ temporarilyClosed: true, temporaryClosedReason: tempReason })}
              className="w-full h-9 px-2.5 rounded-md border border-[#f0b400]/40 bg-white text-[12.5px] font-semibold"
            />
          )}
        </div>

        <Button block onClick={() => onSave({ businessHours: bh })} leftIcon={<Save className="w-4 h-4" />}>
          {t("obsBh.save", lang)}
        </Button>
      </div>
    </Sec>
  );
}
