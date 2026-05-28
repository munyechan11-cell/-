import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center bg-[var(--color-bg)]">
      <div className="text-7xl font-extrabold text-[var(--color-navy-700)] tracking-tighter">
        404
      </div>
      <p className="mt-3 text-[15px] text-[var(--color-ink-500)] font-medium">
        요청하신 페이지를 찾을 수 없습니다.
      </p>
      <Link
        to="/"
        className="mt-8 h-12 px-6 inline-flex items-center rounded-[14px] bg-[var(--color-navy-700)] text-white font-bold"
      >
        홈으로
      </Link>
    </div>
  );
}
