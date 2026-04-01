import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useStore } from '../../store';
import { Html5Qrcode } from 'html5-qrcode';
import { 
  ScanLine, ArrowLeft, RefreshCw, Sparkles, 
  ShieldCheck, Heart, Star, Award, ChevronRight, 
  LayoutGrid, Zap, Store as StoreIcon, ArrowUpRight,
  Maximize, Camera, QrCode
} from 'lucide-react';

export default function CustomerScanner() {
  const { currentUser, users } = useStore();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const usersRef = useRef(users);

  useEffect(() => {
    usersRef.current = users;
  }, [users]);

  const isTransitioningRef = useRef(false);
  const retryCountRef = useRef(0);

  const startScanner = async (mode: "environment" | "user") => {
    if (isTransitioningRef.current) return;
    isTransitioningRef.current = true;

    try {
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode("reader");
      }

      const config = { fps: 10, qrbox: { width: 280, height: 280 } };
      const onScanSuccess = (decodedText: string) => {
        try {
          if (decodedText.includes('/customer/store/')) {
            navigate(decodedText.includes('http') ? new URL(decodedText).pathname : decodedText);
            return;
          }
          const data = JSON.parse(decodedText);
          if (data.storeId && data.tableNumber) {
            navigate(`/customer/store/${data.storeId}/table/${data.tableNumber}`);
          }
        } catch (e) { setError('QR 코드를 인식할 수 없습니다.'); }
      };

      if (scannerRef.current.isScanning) {
        await scannerRef.current.stop();
      } else if (scannerRef.current.getState && scannerRef.current.getState() === 2) {
        await scannerRef.current.stop();
      }
      
      await scannerRef.current.start({ facingMode: mode }, config, onScanSuccess, () => {});
      retryCountRef.current = 0;
      setError(null);
    } catch (err: any) {
      console.error("Scanner start error:", err);
      const errorMessage = String(err);
      if (errorMessage.includes("NotAllowedError") || errorMessage.includes("Permission denied")) {
        setError("카메라 권한이 필요합니다. 설정에서 권한을 허용해 주세요.");
      } else {
        setError(`스캐너 초기화 오류: ${errorMessage}`);
      }
    } finally {
      isTransitioningRef.current = false;
    }
  };

  useEffect(() => {
    let isMounted = true;
    const initScanner = async () => {
      if (!isMounted) return;
      await startScanner(facingMode);
    };
    const timer = setTimeout(initScanner, 300);
    return () => {
      isMounted = false;
      clearTimeout(timer);
      if (scannerRef.current && scannerRef.current.isScanning && !isTransitioningRef.current) {
        isTransitioningRef.current = true;
        scannerRef.current.stop().catch(console.error).finally(() => { isTransitioningRef.current = false; });
      }
    };
  }, [facingMode]);

  const toggleCamera = () => setFacingMode(prev => prev === "environment" ? "user" : "environment");

  return (
    <div className="min-h-screen bg-[#fdfaf7] text-[#261c1a] font-sans selection:bg-primary/10 flex flex-col items-center">
      
      {/* Header */}
      <header className="w-full max-w-md p-6 flex justify-between items-center bg-white/80 backdrop-blur-md sticky top-0 z-40 border-b border-[#e5dcd3]">
        <Link to="/" className="p-2.5 bg-surface-container rounded-full text-on-surface-variant/40 hover:text-primary transition-all">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="text-center">
           <h1 className="font-serif font-black text-xl italic tracking-tight">QR 스캔</h1>
           <p className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant/50">매장 입장하기</p>
        </div>
        <div className="w-10"></div>
      </header>

      <main className="w-full max-w-md p-6 flex-1 flex flex-col gap-10 py-12">
        <section className="text-center space-y-4">
           <div className="w-20 h-20 bg-primary rounded-3xl mx-auto flex items-center justify-center text-white shadow-xl rotate-3"><QrCode className="w-10 h-10" /></div>
           <h2 className="text-2xl font-serif font-black italic">매장 QR 스캔</h2>
           <p className="text-sm opacity-60 px-8 leading-relaxed">테이블에 비치된 QR 코드를 사각형 안에 맞춰주세요. 자동으로 매장 페이지로 이동합니다.</p>
        </section>

        {/* Scanner Body */}
        <div className="relative aspect-square w-full max-w-sm mx-auto bg-black rounded-[3rem] overflow-hidden shadow-2xl border-4 border-white">
           <div id="reader" className="w-full h-full"></div>
           
           {/* Custom Overlay */}
           <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="w-64 h-64 border-2 border-white/20 rounded-3xl relative">
                 <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-2xl"></div>
                 <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-2xl"></div>
                 <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-2xl"></div>
                 <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-2xl"></div>
                 
                 {/* Animation Scan Line */}
                 <div className="absolute left-0 right-0 top-0 h-0.5 bg-primary/40 shadow-[0_0_15px_rgba(74,14,14,0.5)] animate-scan"></div>
              </div>
           </div>
        </div>

        {error && (
          <div className="bg-burgundy/5 p-6 rounded-2xl border border-burgundy/10 text-center space-y-2">
             <ShieldCheck className="w-6 h-6 text-burgundy mx-auto opacity-40" />
             <p className="text-xs font-bold text-burgundy">{error}</p>
          </div>
        )}

        <div className="flex gap-4">
           <button onClick={toggleCamera} className="flex-1 py-4 bg-white border border-[#e5dcd3] rounded-2xl flex items-center justify-center gap-3 text-[10px] font-bold uppercase tracking-widest text-[#261c1a]/60 hover:border-primary/30 transition-all">
              <RefreshCw className="w-4 h-4" />
              카메라 전환
           </button>
           <button 
             onClick={() => {
               const code = prompt('매장 링크나 암호를 입력하세요:');
               if (code) {
                 const match = code.match(/(\/customer\/store\/[^/]+\/table\/\d+)/);
                 if (match) navigate(match[1]);
                 else setError('잘못된 형식입니다.');
               }
             }}
             className="flex-[1.5] py-4 bg-primary text-white rounded-2xl flex items-center justify-center gap-3 text-[10px] font-bold uppercase tracking-widest shadow-xl shadow-primary/20 hover:bg-accent-burgundy transition-all"
           >
              <ArrowUpRight className="w-4 h-4" />
              직접 입력
           </button>
        </div>
      </main>

      <footer className="p-8 opacity-20 text-center">
         <p className="text-[8px] font-black uppercase tracking-[0.5em]">결 SECURE SCAN SYSTEM</p>
      </footer>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes scan {
          0% { top: 0; }
          100% { top: 100%; }
        }
        .animate-scan {
          animation: scan 2s linear infinite;
        }
      `}} />
    </div>
  );
}
