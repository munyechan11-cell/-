import { Navigate, useNavigate } from "react-router-dom";
import { Clock, LogOut, X, Search } from "lucide-react";
import { MobileShell } from "../../components/layout/MobileShell";
import { TopBar } from "../../components/ui/TopBar";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { useStore } from "../../store/store";
import { useLanguage, t } from "../../lib/i18n";

export default function StaffPending() {
  const nav = useNavigate();
  const { currentUser, users, cancelJoinRequest, logout } = useStore();
  const lang = useLanguage();

  if (!currentUser) return <Navigate to="/biz/owner/login" replace />;
  if (currentUser.role !== "staff") {
    return <Navigate to={currentUser.role === "owner" ? "/biz/owner" : "/customer"} replace />;
  }
  if (currentUser.employerStatus === "approved" && currentUser.employerStoreId) {
    return <Navigate to="/biz/staff" replace />;
  }
  if (!currentUser.employerStoreId) {
    return <Navigate to="/biz/staff/store-search" replace />;
  }

  const store = users.find((u) => u.id === currentUser.employerStoreId);
  const rejected = currentUser.employerStatus === "rejected";

  return (
    <MobileShell>
      <TopBar
        title={rejected ? t("spending.title.rejected", lang) : t("spending.title.pending", lang)}
        right={
          <button
            onClick={() => {
              logout();
              nav("/", { replace: true });
            }}
            className="inline-flex items-center gap-1 h-10 px-3 rounded-full text-[13px] font-semibold text-[var(--color-ink-600)] hover:bg-[var(--color-navy-50)]"
          >
            <LogOut className="w-4 h-4" /> {t("spending.logout", lang)}
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
            {rejected ? t("spending.rejectedTitle", lang) : t("spending.pendingTitle", lang)}
          </p>
          <p className="body-md text-[var(--color-ink-700)] mt-3 font-semibold">
            {store?.restaurantName ?? t("spending.storeFallback", lang)}
          </p>
          {!rejected && (
            <p className="body-md text-[var(--color-ink-500)] mt-3 leading-relaxed">
              {t("spending.desc.line1", lang)}
              <br />
              {t("spending.desc.line2", lang)}
            </p>
          )}

          <div className="mt-7 grid gap-2.5">
            <Button
              variant="outline"
              onClick={async () => {
                await cancelJoinRequest();
                nav("/biz/staff/store-search", { replace: true });
              }}
              leftIcon={rejected ? <Search className="w-4 h-4" /> : <X className="w-4 h-4" />}
            >
              {rejected ? t("spending.cta.other", lang) : t("spending.cta.retry", lang)}
            </Button>
          </div>
        </Card>
      </div>
    </MobileShell>
  );
}
