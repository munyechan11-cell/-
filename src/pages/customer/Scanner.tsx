import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useStore } from '../../store';
import { Html5Qrcode } from 'html5-qrcode';
import { 
  ScanLine, ArrowLeft, RefreshCw, Sparkles, 
  ShieldCheck, Heart, Star, Award, ChevronRight, 
  LayoutGrid, Zap, Store as StoreIcon, ArrowUpRight,
  Maximize, Camera
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
        } catch (e) { setError('The cipher could not be decrypted.'); }
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
        setError("Camera access is required for decryption. Please enable access in your settings.");
      } else if (errorMessage.includes("NotFoundError") || errorMessage.includes("Requested device not found") || errorMessage.includes("OverconstrainedError")) {
        if (mode === "environment") {
          setFacingMode("user");
          return;
        }
        setError("No visual sensor detected.");
      } else if (errorMessage.includes("NotReadableError") || errorMessage.includes("Could not start video source")) {
        setError("The sensor is currently occupied by another process.");
      } else {
        setError(`Sensor Initialization Error: ${errorMessage}`);
      }

      if (!errorMessage.includes("NotAllowedError") && !errorMessage.includes("NotFoundError") && retryCountRef.current < 2) {
        retryCountRef.current += 1;
        setTimeout(() => {
          if (scannerRef.current) startScanner(mode);
        }, 1500);
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
        scannerRef.current.stop().catch(console.error).finally(() => {
          isTransitioningRef.current = false;
        });
      }
    };
  }, [facingMode]);

  const toggleCamera = () => {
    setFacingMode(prev => prev === "environment" ? "user" : "environment");
  };

  return (
    <div className="min-h-screen bg-surface-bright flex flex-col hanji-texture relative overflow-hidden">
      <div className="lattice-overlay absolute inset-0 pointer-events-none opacity-10"></div>
      
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-xl p-8 pt-12 border-b border-primary/5 sticky top-0 z-40 animate-in slide-in-from-top-12 duration-700">
        <div className="flex justify-between items-center relative">
          <Link to="/" className="p-3 hover:bg-primary/10 rounded-2xl text-primary/30 hover:text-primary transition-all">
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <div className="text-center">
             <h1 className="text-5xl font-serif font-black text-primary leading-none tracking-tighter italic select-none">결</h1>
             <p className="text-[10px] font-black text-primary/40 uppercase tracking-[0.4em] mt-1 italic">매장 찾기</p>
          </div>
          <div className="w-12"></div> {/* Spacer for symmetry */}
        </div>
      </header>

      <main className="flex-1 p-8 flex flex-col items-center justify-center relative z-10 animate-in fade-in zoom-in duration-1000">
        <div className="w-full max-w-lg bg-white rounded-[4rem] p-12 shadow-3xl border border-primary/10 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full -mr-16 -mt-16"></div>
          
          <div className="text-center mb-12 relative z-10">
            <div className="w-20 h-20 rounded-[2rem] bg-burgundy/10 flex items-center justify-center mx-auto mb-8 rotate-3 hover:rotate-0 transition-transform">
              <ScanLine className="w-10 h-10 text-burgundy" strokeWidth={1} />
            </div>
            <h2 className="text-2xl font-serif font-black text-primary mb-2 italic tracking-tighter">암호 해독 (스캔)</h2>
            <p className="text-primary/40 text-[10px] font-black uppercase tracking-[0.3em]">테이블의 QR 코드를 사각형 안에 맞춰주세요</p>
          </div>

          {/* Scanner Container */}
          <div className="relative rounded-[3rem] overflow-hidden bg-black/90 aspect-square mb-12 shadow-2xl border-4 border-primary/5 group">
            <div id="reader" className="w-full h-full"></div>
            
            {/* Custom Scan Overlay */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
               <div className="w-64 h-64 border-2 border-white/20 rounded-[2.5rem] relative">
                  <div className="absolute top-0 left-0 w-12 h-12 border-t-4 border-l-4 border-burgundy rounded-tl-[1.5rem]"></div>
                  <div className="absolute top-0 right-0 w-12 h-12 border-t-4 border-r-4 border-burgundy rounded-tr-[1.5rem]"></div>
                  <div className="absolute bottom-0 left-0 w-12 h-12 border-b-4 border-l-4 border-burgundy rounded-bl-[1.5rem]"></div>
                  <div className="absolute bottom-0 right-0 w-12 h-12 border-b-4 border-r-4 border-burgundy rounded-br-[1.5rem]"></div>
                  
                  {/* Scanning Animation Line */}
                  <div className="absolute left-0 right-0 top-0 h-0.5 bg-burgundy/50 shadow-[0_0_20px_2px_rgba(159,18,57,0.5)] animate-scan-line"></div>
               </div>
            </div>
          </div>

          {error && (
            <div className="bg-burgundy/5 p-8 rounded-[2.5rem] border border-burgundy/10 mb-10 animate-in slide-in-from-bottom-4 transition-all">
               <div className="flex items-start space-x-4 mb-4">
                  <ShieldCheck className="w-6 h-6 text-burgundy shrink-0" />
                  <p className="text-xs font-serif italic text-burgundy leading-relaxed">{error}</p>
               </div>
               <div className="h-px bg-burgundy/10 w-full mb-4"></div>
               <p className="text-[10px] font-black text-burgundy/40 uppercase tracking-widest leading-relaxed">
                  팁: 스캔이 안 될 경우 아래의 <span className="text-burgundy">직접 코드 입력</span> 기능을 이용하세요.
               </p>
            </div>
          )}

          <div className="flex gap-4">
            <button 
              onClick={toggleCamera}
              className="flex-1 bg-primary/10 hover:bg-primary/20 border border-primary/10 text-primary/50 hover:text-primary py-5 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all flex items-center justify-center space-x-3"
            >
              <RefreshCw className="w-4 h-4" />
              <span>카메라 전환</span>
            </button>
            <button 
              onClick={() => {
                const urlInput = prompt('매장 링크나 암호를 입력하세요:');
                if (urlInput) {
                  const match = urlInput.match(/(\/customer\/store\/[^/]+\/table\/\d+)/);
                  if (match && match[1]) navigate(match[1]);
                  else setError('잘못된 형식의 암호입니다.');
                }
              }}
              className="flex-[1.5] bg-burgundy text-white py-5 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all shadow-2xl shadow-burgundy/20 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center space-x-3"
            >
              <ArrowUpRight className="w-4 h-4" />
              <span>직접 코드 입력</span>
            </button>
          </div>
        </div>

        <div className="mt-16 flex flex-col items-center opacity-20">
           <Zap className="w-8 h-8 text-primary mb-4" fill="currentColor" />
           <p className="text-[10px] font-black uppercase tracking-[0.5em]">시스템 보안 작동 중</p>
        </div>
      </main>
    </div>
  );
}
