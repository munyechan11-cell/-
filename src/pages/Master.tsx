import { useMemo, useState } from "react";
import { Shield, Lock, LogOut, Trash2, Users, Store, Search } from "lucide-react";
import { MobileShell } from "../components/layout/MobileShell";
import { TopBar } from "../components/ui/TopBar";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { useStore } from "../store/store";
import { showToast } from "../lib/toast";

export default function Master() {
  const { isMaster, loginMaster, logoutMaster, users, deleteUser, setMasterPassword } = useStore();
  const [pw, setPw] = useState("");
  const [tab, setTab] = useState<"owners" | "customers" | "settings">("owners");
  const [newPw, setNewPw] = useState("");
  const [search, setSearch] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const matched = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.name?.toLowerCase().includes(q) ||
        u.phone?.includes(q) ||
        u.restaurantName?.toLowerCase().includes(q)
    );
  }, [users, search]);

  const handleDelete = async (id: string, role: "owner" | "customer", label: string) => {
    if (!confirm(`'${label}' 을(를) 삭제하시겠습니까?\n관련 데이터가 모두 정리되며 되돌릴 수 없습니다.`)) return;
    setDeletingId(id);
    try {
      await deleteUser(id, role);
    } catch (e: any) {
      showToast(`삭제 실패: ${e?.message ?? ""}`, "error");
    } finally {
      setDeletingId(null);
    }
  };

  if (!isMaster) {
    return (
      <MobileShell>
        <TopBar title="시스템 관리자" back />
        <div className="px-6 pt-12 text-center">
          <div className="inline-flex w-16 h-16 rounded-2xl bg-[var(--color-navy-700)] items-center justify-center mb-6 shadow-[var(--shadow-navy)]">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="headline-section mb-1">마스터 인증</h1>
          <p className="body-md text-[var(--color-ink-500)] mb-8">
            관리자 비밀번호를 입력하세요.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              loginMaster(pw);
            }}
            className="space-y-4 text-left"
          >
            <Input
              type="password"
              label="비밀번호"
              placeholder="••••"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              leftSlot={<Lock className="w-4 h-4" />}
            />
            <Button block type="submit" disabled={!pw}>
              로그인
            </Button>
          </form>
        </div>
      </MobileShell>
    );
  }

  const owners = matched.filter((u) => u.role === "owner");
  const customers = matched.filter((u) => u.role === "customer");

  return (
    <MobileShell>
      <TopBar
        title="시스템 관리자"
        back
        right={
          <button
            onClick={logoutMaster}
            className="w-10 h-10 rounded-full hover:bg-[var(--color-navy-50)] inline-flex items-center justify-center"
          >
            <LogOut className="w-4 h-4 text-[var(--color-navy-800)]" />
          </button>
        }
      />
      <div className="px-5 pt-2">
        <div className="grid grid-cols-3 gap-2 mb-4">
          <StatCard icon={<Store className="w-4 h-4" />} label="가맹점" value={owners.length} />
          <StatCard icon={<Users className="w-4 h-4" />} label="고객" value={customers.length} />
          <StatCard label="삭제" value={users.filter((u) => u.status === "deleted").length} />
        </div>

        <div className="grid grid-cols-3 p-1 bg-white border border-[var(--color-line)] rounded-[14px] mb-4">
          {(["owners", "customers", "settings"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={
                "h-10 rounded-[10px] text-[13px] font-bold transition-all " +
                (tab === t
                  ? "bg-[var(--color-navy-700)] text-white"
                  : "text-[var(--color-ink-500)]")
              }
            >
              {t === "owners" ? "가맹점" : t === "customers" ? "고객" : "설정"}
            </button>
          ))}
        </div>

        {(tab === "owners" || tab === "customers") && (
          <Input
            placeholder="이름·전화번호·매장명 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftSlot={<Search className="w-4 h-4" />}
            className="mb-3"
          />
        )}

        {tab === "owners" && (
          <div className="space-y-2">
            {owners.length === 0 && <EmptyText>{search ? "검색 결과가 없습니다." : "등록된 가맹점이 없습니다."}</EmptyText>}
            {owners.map((u) => (
              <UserRow
                key={u.id}
                title={u.restaurantName || u.name}
                subtitle={`${u.name} · ${u.phone || "—"}`}
                deleted={u.status === "deleted"}
                deleting={deletingId === u.id}
                onDelete={() => handleDelete(u.id, "owner", u.restaurantName || u.name)}
              />
            ))}
          </div>
        )}

        {tab === "customers" && (
          <div className="space-y-2">
            {customers.length === 0 && <EmptyText>{search ? "검색 결과가 없습니다." : "등록된 고객이 없습니다."}</EmptyText>}
            {customers.map((u) => (
              <UserRow
                key={u.id}
                title={u.name}
                subtitle={`${u.phone || "—"} · ${u.authType ?? "phone"}`}
                deleted={u.status === "deleted"}
                deleting={deletingId === u.id}
                onDelete={() => handleDelete(u.id, "customer", u.name)}
              />
            ))}
          </div>
        )}

        {tab === "settings" && (
          <Card padding="lg">
            <h3 className="text-[15px] font-extrabold text-[var(--color-navy-900)] mb-1">
              마스터 비밀번호 변경
            </h3>
            <p className="text-[13px] text-[var(--color-ink-500)] mb-4">
              새 비밀번호는 즉시 적용됩니다.
            </p>
            <Input
              type="password"
              placeholder="새 비밀번호"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
            />
            <Button
              block
              className="mt-4"
              disabled={!newPw}
              onClick={async () => {
                await setMasterPassword(newPw);
                setNewPw("");
              }}
            >
              비밀번호 저장
            </Button>
          </Card>
        )}
      </div>
    </MobileShell>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon?: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <Card padding="sm" className="text-center">
      <div className="flex items-center justify-center gap-1 text-[var(--color-ink-500)] text-[11px] font-semibold mb-1">
        {icon}
        {label}
      </div>
      <div className="text-[20px] font-extrabold text-[var(--color-navy-900)]">{value}</div>
    </Card>
  );
}

function UserRow({
  title,
  subtitle,
  deleted,
  deleting,
  onDelete,
}: {
  title: string;
  subtitle: string;
  deleted?: boolean;
  deleting?: boolean;
  onDelete: () => void;
}) {
  return (
    <Card padding="md" className="flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-bold text-[var(--color-navy-900)] truncate">
          {title}
          {deleted && (
            <span className="ml-2 text-[10px] font-bold text-[var(--color-danger)] uppercase">
              deleted
            </span>
          )}
        </p>
        <p className="text-[12px] text-[var(--color-ink-500)] truncate">{subtitle}</p>
      </div>
      <button
        onClick={onDelete}
        disabled={deleting}
        className="w-9 h-9 rounded-full inline-flex items-center justify-center hover:bg-[var(--color-danger)]/10 text-[var(--color-danger)] disabled:opacity-50"
        aria-label="삭제"
      >
        {deleting ? (
          <span className="w-3.5 h-3.5 border-2 border-[var(--color-danger)] border-t-transparent rounded-full animate-spin" />
        ) : (
          <Trash2 className="w-4 h-4" />
        )}
      </button>
    </Card>
  );
}

function EmptyText({ children }: { children: React.ReactNode }) {
  return (
    <Card padding="lg" className="text-center">
      <p className="text-[14px] text-[var(--color-ink-500)] font-medium">{children}</p>
    </Card>
  );
}
