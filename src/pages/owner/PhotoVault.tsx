import { useState, useMemo } from 'react';
import { useStore, type PhotoRecord } from '../../store';
import {
  LayoutGrid, Users, BarChart3, Settings, Calendar as CalendarIcon,
  Camera, X, Trash2, Download, LogOut, Utensils, Image as ImageIcon,
  ShieldCheck, ShieldOff
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';

type PhotoFilter = 'all' | 'menu' | 'customer' | 'sns';

export default function OwnerPhotoVault() {
  const {
    currentUser,
    photos = [],
    deletePhoto,
    ownerViewMode
  } = useStore();
  const navigate = useNavigate();

  const [filter, setFilter] = useState<PhotoFilter>('all');
  const [preview, setPreview] = useState<PhotoRecord | null>(null);

  const myPhotos = useMemo(() => {
    if (!currentUser) return [];
    return (photos || [])
      .filter((p) => p.storeId === currentUser.id)
      .filter((p) => {
        if (filter === 'all') return true;
        if (filter === 'menu') return p.type === 'menu';
        if (filter === 'customer') return p.type === 'customer';
        if (filter === 'sns') return p.snsConsent === true;
        return true;
      })
      .sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
  }, [photos, currentUser, filter]);

  const stats = useMemo(() => {
    const all = (photos || []).filter((p) => p.storeId === currentUser?.id);
    return {
      total: all.length,
      menu: all.filter((p) => p.type === 'menu').length,
      customer: all.filter((p) => p.type === 'customer').length,
      sns: all.filter((p) => p.snsConsent === true).length
    };
  }, [photos, currentUser]);

  const handleDelete = async (p: PhotoRecord) => {
    if (!confirm('이 사진을 삭제할까요? (복구 불가)')) return;
    await deletePhoto(p.id);
    if (preview?.id === p.id) setPreview(null);
  };

  const handleDownload = (p: PhotoRecord) => {
    const a = document.createElement('a');
    a.href = p.imageData;
    const ext = (p.imageData.match(/^data:image\/(\w+);/)?.[1]) || 'jpg';
    a.download = `${p.type}-${p.id}.${ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  if (!currentUser) return null;

  return (
    <div className={`flex h-screen overflow-hidden bg-surface-bright bg-gyeol-pattern font-sans text-on-surface ${ownerViewMode === 'mobile' ? 'flex-col' : ''}`}>

      {ownerViewMode === 'desktop' && (
        <aside className="h-screen w-24 lg:w-72 fixed left-0 bg-sidebar-bg shadow-2xl flex flex-col py-8 z-50">
          <div className="px-8 mb-10">
            <Link to="/" className="text-white font-serif italic font-black text-3xl">결</Link>
            <div className="mt-6 hidden lg:block">
              <p className="text-white font-sans font-black text-lg leading-tight">{currentUser.restaurantName}</p>
              <p className="text-white/50 text-[10px] font-black mt-1 tracking-widest uppercase">사진 보관함</p>
            </div>
          </div>
          <nav className="flex-1 space-y-1">
            {[
              { to: '/owner', icon: LayoutGrid, label: '대시보드' },
              { to: '/owner/reservations', icon: CalendarIcon, label: '예약 관리' },
              { to: '/owner/customers', icon: Users, label: '단골 관리' },
              { to: '/owner/photos', icon: Camera, label: '사진 보관', active: true },
              { to: '/owner/statistics', icon: BarChart3, label: '매출 통계' },
              { to: '/owner/brand-settings', icon: Settings, label: '매장 설정' }
            ].map((item, idx) => (
              <Link
                key={idx}
                to={item.to}
                className={`flex items-center gap-4 px-8 py-4 transition-all ${item.active ? 'bg-white text-primary mx-3 rounded-2xl shadow-lg' : 'text-white/60 hover:bg-white/10 hover:text-white'}`}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm font-black hidden lg:block tracking-wide">{item.label}</span>
              </Link>
            ))}
          </nav>
          <button onClick={() => navigate('/')} className="px-8 mt-auto text-white/40 hover:text-white text-sm font-bold flex items-center gap-3 py-3 transition-colors">
            <LogOut className="w-5 h-5" /> <span className="hidden lg:block">로그아웃</span>
          </button>
        </aside>
      )}

      {ownerViewMode === 'mobile' && (
        <nav className="fixed bottom-0 left-0 right-0 bg-sidebar-bg z-[100] px-2 py-2 flex justify-between items-center pb-safe">
          {[
            { to: '/owner', icon: LayoutGrid, label: '홈' },
            { to: '/owner/reservations', icon: CalendarIcon, label: '예약' },
            { to: '/owner/customers', icon: Users, label: '단골' },
            { to: '/owner/brand-settings', icon: Utensils, label: '메뉴' },
            { to: '/owner/photos', icon: Camera, label: '사진', active: true }
          ].map((item, idx) => (
            <Link
              key={idx}
              to={item.to}
              className={`flex flex-col items-center gap-1 px-2 py-2 rounded-xl transition-all min-w-[60px] ${item.active ? 'bg-white text-primary' : 'text-white/60'}`}
            >
              <item.icon className="w-5 h-5" />
              <span className="text-[10px] font-black">{item.label}</span>
            </Link>
          ))}
        </nav>
      )}

      <main className={`${ownerViewMode === 'desktop' ? 'ml-24 lg:ml-72' : 'flex-1 pb-24'} flex-1 h-screen flex flex-col overflow-hidden`}>
        <header className="bg-white/70 backdrop-blur-md border-b border-primary/5 px-5 lg:px-10 pb-5 pt-[calc(env(safe-area-inset-top)+1.25rem)]">
          <p className="text-[10px] font-black text-primary/40 uppercase tracking-[0.3em] mb-1">Photo Vault</p>
          <h1 className="text-2xl lg:text-4xl font-serif italic font-black text-primary">사진 보관함</h1>
          <p className="text-sm lg:text-base font-bold text-on-surface-variant mt-1">
            매장 메뉴 사진 · 손님 동의 받은 SNS용 자료
          </p>
        </header>

        <div className="p-5 lg:p-10 flex-1 overflow-y-auto space-y-6">
          <div className="max-w-6xl mx-auto space-y-6">

            {/* 통계 카드 */}
            <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
              {[
                { label: '전체 사진', value: stats.total, icon: ImageIcon },
                { label: '메뉴 사진', value: stats.menu, icon: Utensils },
                { label: '손님 사진', value: stats.customer, icon: Users },
                { label: 'SNS 동의', value: stats.sns, icon: ShieldCheck, highlight: true }
              ].map((s) => (
                <div key={s.label} className={`p-5 rounded-3xl border transition-all ${s.highlight ? 'bg-gradient-to-br from-gold/10 to-gold/5 border-gold/20' : 'bg-white border-primary/5'} shadow-glass`}>
                  <s.icon className={`w-5 h-5 mb-3 ${s.highlight ? 'text-gold' : 'text-primary/40'}`} />
                  <p className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest mb-1">{s.label}</p>
                  <p className={`text-3xl lg:text-4xl font-black ${s.highlight ? 'text-gold' : 'text-primary'}`}>{s.value}</p>
                </div>
              ))}
            </section>

            {/* 필터 */}
            <section className="bg-white p-2 rounded-2xl border border-primary/5 inline-flex flex-wrap gap-1 shadow-glass">
              {([
                { id: 'all', label: '전체' },
                { id: 'menu', label: '메뉴 사진' },
                { id: 'customer', label: '손님 사진' },
                { id: 'sns', label: 'SNS 동의' }
              ] as { id: PhotoFilter; label: string }[]).map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  className={`px-5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${filter === f.id ? 'bg-primary text-white shadow-md' : 'text-primary/50 hover:bg-surface-container'}`}
                >
                  {f.label}
                </button>
              ))}
            </section>

            {myPhotos.length === 0 ? (
              <div className="bg-white p-12 lg:p-16 rounded-3xl border-2 border-dashed border-primary/15 text-center">
                <Camera className="w-14 h-14 text-primary/20 mx-auto mb-5" />
                <p className="text-xl font-black text-primary mb-2">사진이 없습니다</p>
                <p className="text-sm font-bold text-on-surface-variant max-w-sm mx-auto leading-relaxed">서빙 완료 시 메뉴 사진을 찍어 보내면 자동으로 이곳에 보관됩니다</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 lg:gap-4">
                {myPhotos.map((p) => (
                  <motion.button
                    key={p.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    onClick={() => setPreview(p)}
                    className="group relative aspect-square bg-white rounded-2xl overflow-hidden shadow-glass hover:shadow-premium transition-all border border-primary/5 text-left"
                  >
                    <img src={p.imageData} alt={p.menuName || ''} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/0 to-black/0 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="absolute top-2 left-2 flex gap-1.5">
                      <span className={`text-[10px] font-black px-2 py-1 rounded-lg shadow ${p.type === 'menu' ? 'bg-primary text-white' : 'bg-tertiary text-white'}`}>
                        {p.type === 'menu' ? '메뉴' : '손님'}
                      </span>
                      {p.snsConsent && (
                        <span className="text-[10px] font-black px-2 py-1 rounded-lg bg-gold text-white shadow flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3" /> SNS
                        </span>
                      )}
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 p-3 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                      {p.menuName && <p className="text-sm font-black truncate">{p.menuName}</p>}
                      {p.tableNumber && <p className="text-[10px] font-bold opacity-90 tracking-wide">{p.tableNumber}번 테이블</p>}
                    </div>
                  </motion.button>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      <AnimatePresence>
        {preview && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setPreview(null)}
            className="fixed inset-0 z-[200] bg-sidebar-bg/90 backdrop-blur-sm flex items-center justify-center p-4 lg:p-8"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl shadow-2xl overflow-hidden max-w-3xl w-full max-h-[92vh] flex flex-col"
            >
              <div className="px-5 lg:px-8 py-5 flex justify-between items-center border-b border-primary/5">
                <div className="min-w-0 flex-1 pr-3">
                  <h3 className="text-lg lg:text-2xl font-serif italic font-black text-primary truncate">
                    {preview.menuName || (preview.type === 'menu' ? '메뉴 사진' : '손님 추가 사진')}
                  </h3>
                  <p className="text-xs lg:text-sm font-bold text-on-surface-variant mt-1 truncate">
                    {new Date(preview.createdAt).toLocaleString('ko-KR')}
                    {preview.tableNumber ? ` · ${preview.tableNumber}번 테이블` : ''}
                    {preview.customerName ? ` · ${preview.customerName}` : ''}
                  </p>
                </div>
                <button onClick={() => setPreview(null)} aria-label="닫기" className="p-3 bg-surface-container text-primary/60 rounded-xl hover:bg-surface-container-high transition-colors flex-shrink-0">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto bg-sidebar-bg flex items-center justify-center">
                <img src={preview.imageData} alt="" className="max-w-full max-h-full object-contain" />
              </div>

              <div className="px-5 lg:px-8 py-5 border-t border-primary/5 flex flex-wrap items-center gap-3 bg-surface-bright">
                <div className="flex-1 min-w-[180px]">
                  {preview.snsConsent ? (
                    <span className="flex items-center gap-2 font-black text-gold text-sm">
                      <ShieldCheck className="w-4 h-4" /> SNS 사용 동의 받음
                    </span>
                  ) : (
                    <span className="flex items-center gap-2 font-black text-on-surface-variant text-sm">
                      <ShieldOff className="w-4 h-4" /> SNS 동의 없음
                    </span>
                  )}
                </div>
                <button
                  onClick={() => handleDownload(preview)}
                  className="px-5 py-3 bg-surface-container text-primary rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-surface-container-high flex items-center gap-2 transition-colors"
                >
                  <Download className="w-4 h-4" /> 다운로드
                </button>
                <button
                  onClick={() => handleDelete(preview)}
                  className="px-5 py-3 bg-burgundy/10 text-burgundy rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-burgundy/15 flex items-center gap-2 transition-colors"
                >
                  <Trash2 className="w-4 h-4" /> 삭제
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
