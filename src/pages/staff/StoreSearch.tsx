import { useMemo, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { Search, Store as StoreIcon, LogOut } from "lucide-react";
import { MobileShell } from "../../components/layout/MobileShell";
import { TopBar } from "../../components/ui/TopBar";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { useStore } from "../../store/store";
import { showToast } from "../../lib/toast";

export default function StaffStoreSearch() {
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const { users, currentUser, requestJoinStore, logout } = useStore();
  const [q, setQ] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const presetPosition = sp.get("position") ?? currentUser?.position ?? "";
  const [position, setPosition] = useState(presetPosition);

  // 훅은 무조건 호출 — 이후 게이트
  const owners = useMemo(() => {
    const all = users.filter((u) => u.role === "owner" && u.status !== "deleted");
    if (!q.trim()) return all.slice(0, 30);
    const key = q.trim().toLowerCase();
    return all.filter((u) =>
      (u.restaurantName ?? "").toLowerCase().includes(key) ||
      (u.name ?? "").toLowerCase().includes(key) ||
      (u.phone ?? "").includes(key)
    );
  }, [users, q]);

  if (!currentUser) return <Navigate to="/biz/owner/login" replace />;
  if (currentUser.role !== "staff") {
    return <Navigate to={currentUser.role === "owner" ? "/biz/owner" : "/customer"} replace />;
  }
  if (currentUser.employerStatus === "approved" && currentUser.employerStoreId) {
    return <Navigate to="/biz/staff" replace />;
  }
  if (currentUser.employerStoreId && currentUser.employerStatus === "pending") {
    return <Navigate to="/biz/staff/pending" replace />;
  }

  const apply = async (storeId: string) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await requestJoinStore(storeId, position || undefined);
      nav("/biz/staff/pending", { replace: true });
    } catch (e: any) {
      showToast(`요청 실패: ${e?.message ?? ""}`, "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <MobileShell>
      <TopBar
        title="매장 찾기"
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
      <div className="px-5 pt-5 pb-12 space-y-5">
        <div>
          <h1 className="headline-section mb-1.5">소속 매장 검색</h1>
          <p className="body-md text-[var(--color-ink-600)]">
            가입할 매장을 선택하면 사장님께 승인 요청이 전송돼요.
          </p>
        </div>

        <Input
          label="직책 (선택)"
          placeholder="예) 홀, 주방"
          value={position}
          onChange={(e) => setPosition(e.target.value)}
        />

        <Input
          label="매장 검색"
          placeholder="매장명·대표자명·전화"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          leftSlot={<Search className="w-4 h-4" />}
        />

        <div className="space-y-2.5">
          {owners.length === 0 ? (
            <Card padding="lg" className="text-center body-md text-[var(--color-ink-500)]">
              검색 결과가 없습니다.
            </Card>
          ) : (
            owners.map((o) => (
              <Card key={o.id} padding="md" className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-[var(--color-navy-50)] text-[var(--color-navy-800)] inline-flex items-center justify-center shrink-0">
                  <StoreIcon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-bold text-[var(--color-navy-900)] truncate">
                    {o.restaurantName || "(매장명 없음)"}
                  </p>
                  <p className="text-[13px] text-[var(--color-ink-600)] truncate font-medium">
                    대표 {o.name}
                  </p>
                </div>
                <Button size="md" onClick={() => apply(o.id)} loading={submitting}>
                  신청
                </Button>
              </Card>
            ))
          )}
        </div>
      </div>
    </MobileShell>
  );
}
