import React, { useRef } from 'react';
import { useStore } from '../../store';
import { QRCodeSVG } from 'qrcode.react';
import { Printer, ArrowLeft, Download, Scissors } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function QrPrint() {
  const { currentUser, tables } = useStore();
  const navigate = useNavigate();
  const printRef = useRef<HTMLDivElement>(null);

  if (!currentUser) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-surface-bright p-8 lg:p-16 font-sans">
      {/* Action Header - Hidden on Print */}
      <header className="max-w-5xl mx-auto mb-12 flex justify-between items-center print:hidden">
        <div className="flex items-center gap-6">
          <button 
            onClick={() => navigate('/owner')}
            className="p-4 bg-white rounded-2xl shadow-premium hover:bg-primary/5 transition-all text-primary"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-3xl font-black text-primary tracking-tight">테이블 QR 프린트 키트</h1>
            <p className="text-[10px] font-black text-primary/30 uppercase tracking-[0.4em]">Printable Table Assets</p>
          </div>
        </div>
        
        <button 
          onClick={handlePrint}
          className="px-8 py-4 bg-primary text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl hover:bg-accent-burgundy transition-all flex items-center gap-3"
        >
          <Printer className="w-5 h-5" />
          지금 인쇄하기
        </button>
      </header>

      {/* Print Instructions - Hidden on Print */}
      <div className="max-w-5xl mx-auto mb-12 grid grid-cols-1 md:grid-cols-3 gap-6 print:hidden">
        {[
          { icon: Scissors, title: '절취 가이드', desc: '회색 점선을 따라 자르면 테이블에 딱 맞는 사이즈가 됩니다.' },
          { icon: Download, title: '고해상도 출력', desc: '프린터 설정에서 품질을 "높음"으로 설정해 주세요.' },
          { icon: Printer, title: '종이 권장', desc: '약간 두꺼운 종이나 코팅지에 인쇄하면 더 오래 사용 가능합니다.' }
        ].map((item, idx) => (
          <div key={idx} className="bg-white/50 p-6 rounded-3xl border border-primary/5 flex items-start gap-4">
            <item.icon className="w-6 h-6 text-primary/40 shrink-0" />
            <div>
              <p className="text-xs font-black text-primary mb-1">{item.title}</p>
              <p className="text-[10px] font-medium text-primary/40 leading-relaxed">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* QR Grid - The actual printable content */}
      <div ref={printRef} className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-3 gap-8 print:gap-4 print:grid-cols-3">
        {tables.map((table) => (
          <div 
            key={table.number} 
            className="aspect-[3/4] bg-white border-2 border-dashed border-primary/10 rounded-[2rem] p-8 flex flex-col items-center justify-between shadow-premium print:shadow-none print:border-primary/5 print:m-2"
          >
            <div className="text-center w-full">
              <p className="text-[10px] font-black text-primary/40 uppercase tracking-[0.5em] mb-1">{currentUser.restaurantName}</p>
              <div className="h-0.5 bg-primary/5 w-12 mx-auto"></div>
            </div>

            <div className="bg-gyeol-pattern p-6 rounded-[2.5rem] border-4 border-white shadow-xl flex flex-col items-center gap-4">
              <QRCodeSVG 
                value={`${window.location.origin}/customer/store/${currentUser.id}/table/${table.number}`} 
                size={140} 
                level="H" 
                includeMargin={true}
              />
            </div>

            <div className="text-center">
              <p className="text-4xl font-serif font-black italic text-primary leading-none mb-1">{table.number}</p>
              <p className="text-[8px] font-black text-primary/30 uppercase tracking-widest">TABLE NUMBER</p>
            </div>

            <div className="w-full flex justify-between items-center pt-4 border-t border-primary/5">
               <span className="text-[7px] font-bold text-primary/20">GYEOL SMART SYSTEM</span>
               <div className="flex gap-1">
                  {[1,2,3].map(i => <div key={i} className="w-1 h-1 bg-primary/10 rounded-full"></div>)}
               </div>
            </div>
          </div>
        ))}
      </div>

      {/* Print CSS Overrides */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body { background: white !important; margin: 0; padding: 0; }
          .print-hidden { display: none !important; }
          @page { size: A4; margin: 1cm; }
        }
      `}} />
    </div>
  );
}
