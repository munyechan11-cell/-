// 결 브랜드 마크 — 앱 아이콘(public/icon.svg)과 동일한 디자인의 인라인 SVG.
// 네이비 스퀴클 + ㄱ 모노그램 + 단골/적립을 뜻하는 골드 포인트.
// className 으로 크기·그림자 등을 지정해서 어디서든 재사용.
export function GyeolMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" className={className} aria-label="결" role="img">
      <defs>
        <linearGradient id="gm-navy" x1="0.12" y1="0.05" x2="0.9" y2="1">
          <stop offset="0" stopColor="#244b82" />
          <stop offset="0.55" stopColor="#173762" />
          <stop offset="1" stopColor="#0c2344" />
        </linearGradient>
        <radialGradient id="gm-sheen" cx="0.3" cy="0.22" r="0.75">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.18" />
          <stop offset="0.55" stopColor="#ffffff" stopOpacity="0.04" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="gm-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffd66b" />
          <stop offset="0.5" stopColor="#f7b733" />
          <stop offset="1" stopColor="#e8951f" />
        </linearGradient>
        <linearGradient id="gm-ink" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#e8eefb" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="512" height="512" rx="120" ry="120" fill="url(#gm-navy)" />
      <rect x="0" y="0" width="512" height="512" rx="120" ry="120" fill="url(#gm-sheen)" />
      <path
        d="M 162 168 H 350 V 352"
        fill="none"
        stroke="url(#gm-ink)"
        strokeWidth="54"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="222" cy="300" r="38" fill="url(#gm-gold)" />
    </svg>
  );
}
