import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../lib/api";

/**
 * 가게 공개 브랜드 사이트 (TODO 8-2).
 *
 * 로그인 없이 누구나 보는 매장 사이트. /site/:storeId 공개 라우트.
 * 서버 /api/site/:storeId 가 공개 가능한 매장 데이터(메뉴·리뷰·영업시간·소셜)만 내려줌.
 * 디자인 감성 레퍼런스(베끼지 않음): 따뜻한 크림 톤 · 세리프 헤드라인 · 사진 중심 · 넉넉한 여백.
 * 주문 후 알림 → "가게 사이트 접속" 버튼이 이 페이지로 연결되는 흐름.
 */
type SiteData = {
  store: {
    name: string;
    industry: string;
    theme: string;
    phone: string;
    businessHours: { weekly?: Array<{ open?: string; close?: string; closed?: boolean }>; open24h?: boolean } | null;
    temporarilyClosed: boolean;
    instagram: string;
  };
  menu: Array<{ name: string; price: number; category: string; imageUrl: string; description: string }>;
  reviews: Array<{ rating: number; text: string; name: string; date: string; photoId: string | null }>;
  gallery: string[];
};

const DAY_KO = ["일", "월", "화", "수", "목", "금", "토"]; // weekly[0]=일요일 (getDay 규약)
const imgUrl = (photoId: string) => api(`/api/marketing/image/${encodeURIComponent(photoId)}`);
const won = (n: number) => "₩" + (n || 0).toLocaleString("ko-KR");

export default function StoreSite() {
  const { storeId = "" } = useParams();
  const [data, setData] = useState<SiteData | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");

  useEffect(() => {
    let alive = true;
    setState("loading");
    fetch(api(`/api/site/${encodeURIComponent(storeId)}`))
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d) => { if (alive) { setData(d); setState("ok"); document.title = `${d?.store?.name ?? "가게"} · 결`; } })
      .catch(() => { if (alive) setState("error"); });
    return () => { alive = false; };
  }, [storeId]);

  const categories = useMemo(() => {
    if (!data) return [];
    const map = new Map<string, SiteData["menu"]>();
    for (const m of data.menu) {
      const c = m.category || "메뉴";
      (map.get(c) ?? map.set(c, []).get(c)!).push(m);
    }
    return Array.from(map.entries());
  }, [data]);

  if (state === "loading") {
    return (
      <div className="min-h-screen bg-[#faf7f2] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-[#cbbfae] border-t-[#9a6b43] animate-spin" />
      </div>
    );
  }
  if (state === "error" || !data) {
    return (
      <div className="min-h-screen bg-[#faf7f2] flex flex-col items-center justify-center text-center px-6 text-[#5b5249]">
        <p className="font-serif text-[22px] text-[#2b2622] mb-1">사이트를 찾을 수 없어요</p>
        <p className="text-[14px] text-[#8a7f74]">주소를 확인해 주세요.</p>
      </div>
    );
  }

  const { store, reviews, gallery } = data;
  const hero = gallery[0];
  const orderHref = `/customer/store/${encodeURIComponent(storeId)}`;
  const avgRating = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;

  return (
    <div className="min-h-screen bg-[#faf7f2] text-[#2b2622] antialiased">
      {/* ===== 상단 바 (스티키) ===== */}
      <nav className="sticky top-0 z-30 bg-[#faf7f2]/85 backdrop-blur border-b border-[#ece4d8]">
        <div className="max-w-[1080px] mx-auto px-5 h-14 flex items-center justify-between">
          <span className="font-serif text-[18px] tracking-tight text-[#2b2622]">{store.name}</span>
          <div className="hidden sm:flex items-center gap-6 text-[13px] font-semibold text-[#6b6055]">
            <a href="#menu" className="hover:text-[#9a6b43] transition-colors">메뉴</a>
            {reviews.length > 0 && <a href="#reviews" className="hover:text-[#9a6b43] transition-colors">리뷰</a>}
            <a href="#visit" className="hover:text-[#9a6b43] transition-colors">방문</a>
          </div>
          <Link to={orderHref} className="h-9 px-4 rounded-full bg-[#9a6b43] text-white text-[13px] font-bold inline-flex items-center hover:bg-[#85572f] transition-colors">
            주문하기
          </Link>
        </div>
      </nav>

      {/* ===== 히어로 ===== */}
      <header className="relative">
        <div className="relative h-[78vh] min-h-[460px] w-full overflow-hidden">
          {hero ? (
            <img src={imgUrl(hero)} alt="" className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-[#e9ddcb] to-[#cbb79a]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/15 to-black/30" />
          <div className="relative h-full max-w-[1080px] mx-auto px-6 flex flex-col items-center justify-center text-center text-white">
            <p className="text-[12px] tracking-[0.35em] uppercase opacity-80 mb-4">Welcome</p>
            <h1 className="font-serif text-[40px] sm:text-[64px] leading-[1.05] tracking-tight drop-shadow-sm">{store.name}</h1>
            {store.temporarilyClosed ? (
              <span className="mt-5 px-4 py-1.5 rounded-full bg-white/90 text-[#9a3b2f] text-[13px] font-bold">오늘은 임시 휴무예요</span>
            ) : (
              <Link to={orderHref} className="mt-7 h-12 px-7 rounded-full bg-white text-[#2b2622] text-[14px] font-extrabold inline-flex items-center gap-2 hover:bg-[#f3ece1] transition-colors shadow-lg">
                메뉴 보고 주문하기 →
              </Link>
            )}
            {avgRating > 0 && (
              <p className="mt-5 text-[13px] text-white/90 inline-flex items-center gap-1.5">
                <span className="text-[#ffd36b]">{"★".repeat(Math.round(avgRating))}</span>
                <span className="opacity-80">{avgRating.toFixed(1)} · 리뷰 {reviews.length}</span>
              </p>
            )}
          </div>
        </div>
      </header>

      {/* ===== 메뉴 ===== */}
      <section id="menu" className="max-w-[1080px] mx-auto px-6 py-20 sm:py-28 scroll-mt-16">
        <SectionTitle eyebrow="Our Menu" title="메뉴" />
        {categories.length === 0 ? (
          <p className="text-center text-[#8a7f74] py-10">메뉴 준비 중이에요.</p>
        ) : (
          <div className="space-y-16 mt-12">
            {categories.map(([cat, items]) => (
              <div key={cat}>
                <h3 className="font-serif text-[24px] text-[#2b2622] mb-6 pb-2 border-b border-[#e8ddcd]">{cat}</h3>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-7">
                  {items.map((m, i) => (
                    <article key={i} className="group">
                      <div className="aspect-[4/3] rounded-2xl overflow-hidden bg-[#efe7da] mb-3">
                        {m.imageUrl ? (
                          <img src={m.imageUrl} alt={m.name} className="w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-500" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[#c3b49d] font-serif text-[28px]">{m.name[0]}</div>
                        )}
                      </div>
                      <div className="flex items-baseline justify-between gap-2">
                        <h4 className="font-bold text-[15px] text-[#2b2622] truncate">{m.name}</h4>
                        <span className="text-[14px] font-extrabold text-[#9a6b43] tabular-nums shrink-0">{won(m.price)}</span>
                      </div>
                      {m.description && <p className="text-[12.5px] text-[#8a7f74] mt-1 leading-relaxed line-clamp-2">{m.description}</p>}
                    </article>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ===== 리뷰 ===== */}
      {reviews.length > 0 && (
        <section id="reviews" className="bg-[#f3ebe0] py-20 sm:py-28 scroll-mt-16">
          <div className="max-w-[1080px] mx-auto px-6">
            <SectionTitle eyebrow="Reviews" title="손님들의 이야기" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-12">
              {reviews.map((r, i) => (
                <figure key={i} className="rounded-2xl bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)] flex flex-col">
                  <div className="text-[#f0a82e] text-[15px] mb-3">{"★".repeat(Math.max(1, Math.min(5, r.rating)))}<span className="text-[#e0d6c6]">{"★".repeat(5 - Math.max(1, Math.min(5, r.rating)))}</span></div>
                  <blockquote className="text-[14px] text-[#3d3630] leading-relaxed flex-1">"{r.text}"</blockquote>
                  {r.photoId && (
                    <img src={imgUrl(r.photoId)} alt="" className="mt-4 rounded-xl w-full h-36 object-cover" />
                  )}
                  <figcaption className="mt-4 text-[12px] text-[#8a7f74] flex items-center justify-between">
                    <span className="font-bold text-[#6b6055]">{r.name}</span>
                    <span>{r.date}</span>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ===== 방문 정보 ===== */}
      <section id="visit" className="max-w-[1080px] mx-auto px-6 py-20 sm:py-28 scroll-mt-16">
        <SectionTitle eyebrow="Visit Us" title="방문 안내" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mt-12">
          <div>
            <h3 className="font-serif text-[20px] mb-4">영업 시간</h3>
            {store.businessHours?.open24h ? (
              <p className="text-[15px] font-bold text-[#9a6b43]">연중무휴 24시간</p>
            ) : store.businessHours?.weekly?.length ? (
              <ul className="space-y-2">
                {store.businessHours.weekly.slice(0, 7).map((w, i) => (
                  <li key={i} className="flex items-center justify-between text-[14px] border-b border-[#ece4d8] pb-2">
                    <span className="font-bold text-[#6b6055] w-8">{DAY_KO[i]}</span>
                    <span className={w?.closed ? "text-[#b6a892]" : "text-[#3d3630] font-semibold tabular-nums"}>
                      {w?.closed ? "휴무" : `${w?.open ?? "—"} – ${w?.close ?? "—"}`}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[14px] text-[#8a7f74]">영업 시간 정보 준비 중</p>
            )}
          </div>
          <div className="space-y-5">
            <h3 className="font-serif text-[20px] mb-1">연락 · 채널</h3>
            {store.phone && (
              <a href={`tel:${store.phone}`} className="block text-[15px] font-bold text-[#9a6b43]">{store.phone}</a>
            )}
            {store.instagram && (
              <a href={`https://instagram.com/${store.instagram}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-[14px] font-bold text-[#6b6055] hover:text-[#9a6b43]">
                <span className="w-6 h-6 rounded-md bg-gradient-to-br from-[#f58529] to-[#dd2a7b]" />@{store.instagram}
              </a>
            )}
            <Link to={orderHref} className="mt-2 h-12 px-6 rounded-full bg-[#9a6b43] text-white text-[14px] font-extrabold inline-flex items-center hover:bg-[#85572f] transition-colors">
              지금 주문하기 →
            </Link>
          </div>
        </div>
      </section>

      {/* ===== 푸터 ===== */}
      <footer className="bg-[#2b2622] text-[#cabfae] py-12">
        <div className="max-w-[1080px] mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="font-serif text-[18px] text-white">{store.name}</span>
          <span className="text-[12px] text-[#8c8170]">
            결(Gyeol)로 만든 가게 사이트
          </span>
        </div>
      </footer>
    </div>
  );
}

function SectionTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="text-center">
      <p className="text-[11px] tracking-[0.3em] uppercase text-[#b08e63] font-bold mb-3">{eyebrow}</p>
      <h2 className="font-serif text-[30px] sm:text-[40px] text-[#2b2622] tracking-tight">{title}</h2>
    </div>
  );
}
