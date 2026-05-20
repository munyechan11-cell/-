import React, { useState, useMemo } from 'react';
import { useStore } from '../../store';
import {
  LayoutGrid, Users, BarChart3, Settings, Calendar as CalendarIcon,
  Camera, X, Trash2, Download, LogOut, Utensils, Image as ImageIcon,
  ShieldCheck, ShieldOff
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';

type PhotoRecord = any;

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
      .filter((p: PhotoRecord) => p.storeId === currentUser.id)
      .filter((p: PhotoRecord) => {
        if (filter === 'all') return true;
        if (filter === 'menu') return p.type === 'menu';
        if (filter === 'customer') return p.type === 'customer';
        if (filter === 'sns') return p.snsConsent === true;
        return true;
      })
      .sort((a: PhotoRecord, b: PhotoRecord) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
  }, [photos, currentUser, filter]);

  const stats = useMemo(() => {
    const all = (photos || []).filter((p: PhotoRecord) => p.storeId === currentUser?.id);
    return {
      total: all.length,
      menu: all.filter((p: PhotoRecord) => p.type === 'menu').length,
      customer: all.filter((p: PhotoRecord) => p.type === 'customer').length,
      sns: all.filter((p: PhotoRecord) => p.snsConsent === true).length
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
    <div className={`flex h-screen overflow-hidden bg-stone-50 font-sans text-stone-900 ${ownerViewMode === 'mobile' ? 'flex-col' : ''}`}>

      {ownerViewMode === 'desktop' && (
        <aside className="h-screen w-24 lg:w-72 fixed left-0 bg-stone-900 shadow-2xl flex flex-col py-8 z-50">
          <div className="px-8 mb-10">
            <Link to="/" className="text-white font-sans font-black text-3xl">결</Link>
            <div className="mt-6 hidden lg:block">
              <p className="text-white font-sans font-black text-lg leading-tight">{currentUser.restaurantName}</p>
              <p className="text-stone-400 text-sm font-bold mt-1">사진 보관함</p>
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
                className={`flex items-center gap-4 px-8 py-4 transition-all ${item.active ? 'bg-white text-stone-900 mx-3 rounded-2xl shadow-lg' : 'text-stone-300 hover:bg-white/10 hover:text-white'}`}
              >
                <item.icon className="w-6 h-6 flex-shrink-0" />
                <span className="text-base font-black hidden lg:block">{item.label}</span>
              </Link>
            ))}
          </nav>
          <button onClick={() => navigate('/')} className="px-8 mt-auto text-stone-400 hover:text-white text-base font-bold flex items-center gap-3 py-3">
            <LogOut className="w-5 h-5" /> <span className="hidden lg:block">로그아웃</span>
          </button>
        </aside>
      )}

      {ownerViewMode === 'mobile' && (
        <nav className="fixed bottom-0 left-0 right-0 bg-stone-900 border-t-2 border-stone-800 z-[100] px-2 py-2 flex justify-between items-center safe-area-bottom">
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
              className={`flex flex-col items-center gap-1 px-2 py-2 rounded-xl transition-all min-w-[60px] ${item.active ? 'bg-white text-stone-900' : 'text-stone-400'}`}
            >
              <item.icon className="w-6 h-6" />
              <span className="text-xs font-black">{item.label}</span>
            </Link>
          ))}
        </nav>
      )}

      <main className={`${ownerViewMode === 'desktop' ? 'ml-24 lg:ml-72' : 'flex-1 pb-24'} flex-1 h-screen flex flex-col overflow-hidden`}>
        <header className="bg-white border-b-2 border-stone-200 px-5 lg:px-10 pb-5 pt-[calc(env(safe-area-inset-top)+1.25rem)]">
          <h1 className="text-2xl lg:text-4xl font-black text-stone-900">사진 보관함</h1>
          <p className="text-base lg:text-lg font-bold text-stone-600 mt-1">
            매장 메뉴 사진 · 손님 동의 받은 SNS용 자료
          </p>
        </header>

        <div className="p-5 lg:p-10 flex-1 overflow-y-auto space-y-6">
          <div className="max-w-6xl mx-auto space-y-6">

            {/* 통계 카드 — 크게 */}
            <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
              {[
                { label: '전체 사진', value: stats.total, icon: ImageIcon, color: 'bg-stone-100 text-stone-800', accent: 'text-stone-900' },
                { label: '메뉴 사진', value: stats.menu, icon: Utensils, color: 'bg-emerald-50 text-emerald-800', accent: 'text-emerald-700' },
                { label: '손님 사진', value: stats.customer, icon: Users, color: 'bg-blue-50 text-blue-800', accent: 'text-blue-700' },
                { label: 'SNS 동의', value: stats.sns, icon: ShieldCheck, color: 'bg-amber-50 text-amber-800', accent: 'text-amber-700' }
              ].map((s) => (
                <div key={s.label} className={`${s.color} p-5 rounded-3xl border-2 border-stone-200`}>
                  <s.icon className={`w-6 h-6 mb-2`} />
                  <p className="text-base font-black mb-1">{s.label}</p>
                  <p className={`text-3xl lg:text-4xl font-black ${s.accent}`}>{s.value}</p>
                </div>
              ))}
            </section>

            {/* 필터 */}
            <section className="bg-white p-3 rounded-3xl border-2 border-stone-200 inline-flex flex-wrap gap-2 shadow-sm">
              {([
                { id: 'all', label: '전체' },
                { id: 'menu', label: '메뉴 사진' },
                { id: 'customer', label: '손님 사진' },
                { id: 'sns', label: 'SNS 동의' }
              ] as { id: PhotoFilter; label: string }[]).map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  className={`px-5 py-3 rounded-2xl text-base font-black transition-all ${filter === f.id ? 'bg-stone-900 text-white shadow-lg' : 'text-stone-600 hover:bg-stone-100'}`}
                >
                  {f.label}
                </button>
              ))}
            </section>

            {myPhotos.length === 0 ? (
              <div className="bg-white p-12 lg:p-16 rounded-3xl border-2 border-dashed border-stone-300 text-center">
                <Camera className="w-16 h-16 text-stone-300 mx-auto mb-5" />
                <p className="text-2xl font-black text-stone-700 mb-2">사진이 없습니다</p>
                <p className="text-base font-bold text-stone-500">서빙 완료 시 메뉴 사진을 찍어 보내면 자동으로 이곳에 보관됩니다</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 lg:gap-4">
                {myPhotos.map((p: PhotoRecord) => (
                  <motion.button
                    key={p.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    onClick={() => setPreview(p)}
                    className="group relative aspect-square bg-white rounded-3xl overflow-hidden shadow-sm hover:shadow-lg transition-all border-2 border-stone-200 text-left"
                  >
                    <img src={p.imageData} alt={p.menuName || ''} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/0 to-black/0 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="absolute top-2 left-2 flex gap-1.5">
                      <span className={`text-sm font-black px-2.5 py-1 rounded-xl shadow ${p.type === 'menu' ? 'bg-emerald-600 text-white' : 'bg-blue-600 text-white'}`}>
                        {p.type === 'menu' ? '메뉴' : '손님'}
                      </span>
                      {p.snsConsent && (
                        <span className="text-sm font-black px-2.5 py-1 rounded-xl bg-amber-500 text-white shadow flex items-center gap-1">
                          <ShieldCheck className="w-4 h-4" /> SNS
                        </span>
                      )}
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 p-3 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                      {p.menuName && <p className="text-base font-black truncate">{p.menuName}</p>}
                      {p.tableNumber && <p className="text-sm font-bold opacity-90">{p.tableNumber}번 테이블</p>}
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
            className="fixed inset-0 z-[200] bg-stone-900/90 flex items-center justify-center p-4 lg:p-8"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl shadow-2xl overflow-hidden max-w-3xl w-full max-h-[92vh] flex flex-col"
            >
              <div className="px-5 lg:px-8 py-5 flex justify-between items-center border-b-2 border-stone-200">
                <div>
                  <h3 className="text-xl lg:text-2xl font-black text-stone-900">
                    {preview.menuName || (preview.type === 'menu' ? '메뉴 사진' : '손님 추가 사진')}
                  </h3>
                  <p className="text-base font-bold text-stone-600 mt-1">
                    {new Date(preview.createdAt).toLocaleString('ko-KR')}
                    {preview.tableNumber ? ` · ${preview.tableNumber}번 테이블` : ''}
                    {preview.customerName ? ` · ${preview.customerName}` : ''}
                  </p>
                </div>
                <button onClick={() => setPreview(null)} className="p-3 bg-stone-100 text-stone-700 rounded-xl hover:bg-stone-200">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto bg-stone-900 flex items-center justify-center">
                <img src={preview.imageData} alt="" className="max-w-full max-h-full object-contain" />
              </div>

              <div className="px-5 lg:px-8 py-5 border-t-2 border-stone-200 flex flex-wrap items-center gap-3 bg-stone-50">
                <div className="flex-1">
                  {preview.snsConsent ? (
                    <span className="flex items-center gap-2 font-black text-amber-700 text-base">
                      <ShieldCheck className="w-5 h-5" /> SNS 사용 동의 받음
                    </span>
                  ) : (
                    <span className="flex items-center gap-2 font-black text-stone-500 text-base">
                      <ShieldOff className="w-5 h-5" /> SNS 동의 없음
                    </span>
                  )}
                </div>
                <button
                  onClick={() => handleDownload(preview)}
                  className="px-5 py-3 bg-stone-100 text-stone-800 rounded-2xl text-base font-black hover:bg-stone-200 flex items-center gap-2"
                >
                  <Download className="w-5 h-5" /> 다운로드
                </button>
                <button
                  onClick={() => handleDelete(preview)}
                  className="px-5 py-3 bg-red-50 text-red-700 rounded-2xl text-base font-black hover:bg-red-100 flex items-center gap-2"
                >
                  <Trash2 className="w-5 h-5" /> 삭제
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
