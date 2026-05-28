import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CheckCircle2, Store, AlertTriangle } from "lucide-react";
import { MobileShell } from "../../components/layout/MobileShell";
import { useStore } from "../../store/store";
import { Button } from "../../components/ui/Button";

export default function TableEntry() {
  const { storeId, tableNumber } = useParams();
  const nav = useNavigate();
  const { currentUser, users, recordVisit } = useStore();

  const [status, setStatus] = useState<"checking" | "recording" | "done" | "missing" | "denied">(
    "checking"
  );
  const [attempts, setAttempts] = useState(0);

  // Login guard
  useEffect(() => {
    if (!currentUser || currentUser.role !== "customer") {
      nav(`/customer/store/${storeId}/login?table=${tableNumber}`, { replace: true });
    }
  }, [currentUser, storeId, tableNumber, nav]);

  // Verify store exists (with retries) + 한 번만 recordVisit 호출
  useEffect(() => {
    if (!currentUser || currentUser.role !== "customer") return;
    if (!storeId || !tableNumber) {
      setStatus("missing");
      return;
    }
    // 이미 처리 중이거나 완료된 상태면 더 이상 실행하지 않음
    if (status !== "checking") return;

    const owner = users.find((u) => u.id === storeId && u.role === "owner");
    if (owner) {
      setStatus("recording");
      recordVisit(currentUser.id, Number(tableNumber), storeId)
        .then(() => {
          setStatus("done");
          setTimeout(() => nav(`/customer/store/${storeId}`, { replace: true }), 1000);
        })
        .catch(() => setStatus("denied"));
      return;
    }
    if (attempts < 10) {
      const t = setTimeout(() => setAttempts((a) => a + 1), 300);
      return () => clearTimeout(t);
    }
    setStatus("missing");
  }, [attempts, users, storeId, tableNumber, currentUser, recordVisit, nav, status]);

  return (
    <MobileShell>
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
        {status === "checking" && (
          <>
            <Loader />
            <Title>매장을 찾는 중</Title>
            <Sub>잠시만 기다려 주세요.</Sub>
          </>
        )}
        {status === "recording" && (
          <>
            <Loader />
            <Title>방문을 기록하는 중</Title>
            <Sub>테이블 {tableNumber}번에 정성을 담아 적립 중입니다.</Sub>
          </>
        )}
        {status === "done" && (
          <>
            <div className="w-20 h-20 rounded-2xl bg-[var(--color-mint-100)] flex items-center justify-center mb-6 animate-[pop_.35s_ease-out]">
              <CheckCircle2 className="w-10 h-10 text-[var(--color-mint-700)]" />
            </div>
            <Title>방문이 기록되었습니다</Title>
            <Sub>잠시 후 메뉴로 이동합니다.</Sub>
            <style>{`@keyframes pop{from{transform:scale(.7);opacity:0}to{transform:scale(1);opacity:1}}`}</style>
          </>
        )}
        {status === "missing" && (
          <>
            <div className="w-20 h-20 rounded-2xl bg-[var(--color-ink-50)] flex items-center justify-center mb-6">
              <Store className="w-10 h-10 text-[var(--color-ink-500)]" />
            </div>
            <Title>매장을 찾을 수 없습니다</Title>
            <Sub>QR이 손상되었거나 폐업한 매장일 수 있어요.</Sub>
            <Button className="mt-8" onClick={() => nav("/", { replace: true })}>
              홈으로
            </Button>
          </>
        )}
        {status === "denied" && (
          <>
            <div className="w-20 h-20 rounded-2xl bg-[#fef2f2] flex items-center justify-center mb-6">
              <AlertTriangle className="w-10 h-10 text-[var(--color-danger)]" />
            </div>
            <Title>방문 기록에 실패했습니다</Title>
            <Sub>네트워크를 확인하고 다시 시도해 주세요.</Sub>
            <Button className="mt-8" onClick={() => window.location.reload()}>
              다시 시도
            </Button>
          </>
        )}
      </div>
    </MobileShell>
  );
}

function Loader() {
  return (
    <div className="relative w-16 h-16 mb-6">
      <div className="absolute inset-0 rounded-full border-[3px] border-[var(--color-navy-100)]" />
      <div className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-[var(--color-navy-700)] animate-[spin_.9s_linear_infinite]" />
    </div>
  );
}
function Title({ children }: { children: React.ReactNode }) {
  return <h1 className="text-[22px] font-extrabold text-[var(--color-navy-900)] tracking-tight">{children}</h1>;
}
function Sub({ children }: { children: React.ReactNode }) {
  return <p className="text-[14px] text-[var(--color-ink-500)] mt-2 font-medium max-w-[280px]">{children}</p>;
}
