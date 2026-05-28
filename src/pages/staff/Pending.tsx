import { Navigate, useNavigate } from "react-router-dom";
import { Clock, LogOut, X, Search } from "lucide-react";
import { MobileShell } from "../../components/layout/MobileShell";
import { TopBar } from "../../components/ui/TopBar";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { useStore } from "../../store/store";

export default function StaffPending() {
  const nav = useNavigate();
  const { currentUser, users, cancelJoinRequest, logout } = useStore();

  if (!currentUser) return <Navigate to="/owner/login" replace />;
  if (currentUser.role !== "staff") {
    return <Navigate to={currentUser.role === "owner" ? "/owner" : "/customer"} replace />;
  }
  if (currentUser.employerStatus === "approved" && currentUser.employerStoreId) {
    return <Navigate to="/staff" replace />;
  }
  if (!currentUser.employerStoreId) {
    return <Navigate to="/staff/store-search" replace />;
  }

  const store = users.find((u) => u.id === currentUser.employerStoreId);
  const rejected = currentUser.employerStatus === "rejected";

  return (
    <MobileShell>
      <TopBar
        title={rejected ? "가입 거절" : "승인 대기"}
        right={
          <button
            onClick={() => {
              logout();
              nav("/", { replace: true });
            }}
            className="inline-flex items-center gap-1 h-10 px-3 rounded-full text-[13px] font-semibold text-[var(--color-ink-600)] hover:bg-[var(--color-navy-50)]"
          >
            <LogOut className="w-4 h-4" /> 로그아웃
          </button>
        }
      />
      <div className="px-5 pt-8 pb-12">
        <Card padding="lg" className="text-center">
          <div
            className={`w-20 h-20 rounded-full inline-flex items-center justify-center mb-5 ${
              rejected
                ? "bg-[#fff1e0] text-[var(--color-warn)]"
                : "bg-[var(--color-mint-100)] text-[var(--color-mint-700)]"
            }`}
          >
            <Clock className="w-9 h-9" />
          </div>
          <p className="headline-section">
            {rejected ? "가입이 거절되었어요" : "사장님 승인 대기 중"}
          </p>
          <p className="body-md text-[var(--color-ink-700)] mt-3 font-semibold">
            {store?.restaurantName ?? "선택한 매장"}
          </p>
          {!rejected && (
            <p className="body-md text-[var(--color-ink-500)] mt-3 leading-relaxed">
              사장님이 가입을 승인하면
              <br />
              자동으로 매장 기능이 열려요.
            </p>
          )}

          <div className="mt-7 grid gap-2.5">
            <Button
              variant="outline"
              onClick={async () => {
                await cancelJoinRequest();
                nav("/staff/store-search", { replace: true });
              }}
              leftIcon={rejected ? <Search className="w-4 h-4" /> : <X className="w-4 h-4" />}
            >
              {rejected ? "다른 매장 선택" : "요청 취소하고 다시 검색"}
            </Button>
          </div>
        </Card>
      </div>
    </MobileShell>
  );
}
