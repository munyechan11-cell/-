import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Phone, Store as StoreIcon, Receipt, KeyRound, Info } from "lucide-react";
import { MobileShell } from "../../components/layout/MobileShell";
import { TopBar } from "../../components/ui/TopBar";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { formatPhoneNumber } from "../../lib/ids";
import { showToast } from "../../lib/toast";
import { useStore } from "../../store/store";
import { cn } from "../../lib/cn";
import { POS_VENDORS, getVendor, type PosVendor } from "../../lib/posVendors";

type Mode = "login" | "signup";

export default function OwnerLogin() {
  const nav = useNavigate();
  const { login } = useStore();
  const [mode, setMode] = useState<Mode>("login");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [restaurantName, setRestaurantName] = useState("");
  const [posVendor, setPosVendor] = useState<PosVendor>("none");
  const [posApiKey, setPosApiKey] = useState("");
  const [loading, setLoading] = useState(false);

  const vendorInfo = useMemo(() => getVendor(posVendor), [posVendor]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (phone.replace(/\D/g, "").length < 10 || !name.trim()) {
      showToast("이름과 전화번호를 정확히 입력해 주세요.", "error");
      return;
    }
    if (mode === "signup" && !restaurantName.trim()) {
      showToast("매장명을 입력해 주세요.", "error");
      return;
    }
    setLoading(true);
    try {
      await login({
        phone,
        name,
        role: "owner",
        restaurantName: restaurantName || undefined,
        authType: "phone",
        posVendor: mode === "signup" ? posVendor : undefined,
        posApiKey: mode === "signup" ? posApiKey || undefined : undefined,
        signInOnly: mode === "login", // 로그인 모드에선 자동 가입 막음
      });
      nav("/owner", { replace: true });
    } catch (e: any) {
      showToast(
        mode === "login"
          ? "일치하는 사장님 계정이 없어요. '신규 등록' 탭으로 가입해 주세요."
          : `가입 실패: ${e?.message ?? ""}`,
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <MobileShell>
      <TopBar title="사장님 관리" back />
      <div className="px-6 pt-6 pb-16">
        <h1 className="headline-section mb-1">
          {mode === "login" ? "사장님 로그인" : "신규 가맹 등록"}
        </h1>
        <p className="body-md text-[var(--color-ink-500)]">
          매장을 단단하게 관리하는 결의 시작.
        </p>

        <div className="mt-6 grid grid-cols-2 p-1 bg-[var(--color-navy-50)] rounded-[14px]">
          {(["login", "signup"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={cn(
                "h-11 rounded-[10px] text-[13px] font-bold tracking-tight transition-all",
                mode === m
                  ? "bg-white text-[var(--color-navy-800)] shadow-[var(--shadow-press)]"
                  : "text-[var(--color-ink-500)]"
              )}
            >
              {m === "login" ? "로그인" : "신규 등록"}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="mt-7 space-y-4">
          <Input
            label="성함"
            placeholder="대표자 성함"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            label="전화번호"
            placeholder="010-0000-0000"
            value={phone}
            onChange={(e) => setPhone(formatPhoneNumber(e.target.value))}
            inputMode="numeric"
            leftSlot={<Phone className="w-4 h-4" />}
          />
          {mode === "signup" && (
            <>
              <Input
                label="매장명"
                placeholder="예) 결 카페"
                value={restaurantName}
                onChange={(e) => setRestaurantName(e.target.value)}
                leftSlot={<StoreIcon className="w-4 h-4" />}
              />

              {/* ===== POS 벤더 ===== */}
              <div>
                <label className="block text-[13px] font-semibold text-[var(--color-navy-800)] mb-2">
                  사용 중인 POS
                </label>
                <div className="relative">
                  <select
                    value={posVendor}
                    onChange={(e) => {
                      setPosVendor(e.target.value as PosVendor);
                      setPosApiKey("");
                    }}
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
                    <br />
                    <span className="font-medium opacity-90">
                      주문이 접수될 때마다 영수증 인쇄 창이 자동으로 열립니다. 나중에 브랜드 설정에서 변경할 수 있어요.
                    </span>
                  </p>
                </div>
              )}
            </>
          )}

          <Button
            block
            type="submit"
            loading={loading}
            disabled={!phone || !name || (mode === "signup" && !restaurantName)}
          >
            {mode === "login" ? "로그인" : "가맹 등록하기"}
          </Button>
        </form>

        {mode === "signup" && (
          <p className="mt-4 text-[12px] text-[var(--color-ink-500)] text-center">
            가입 시 매장당 기본 테이블 15개가 자동으로 생성됩니다.
          </p>
        )}
      </div>
    </MobileShell>
  );
}
