import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useStore } from '../../store';
import { Html5Qrcode } from 'html5-qrcode';
import { ScanLine, ArrowLeft, RefreshCw } from 'lucide-react';

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

      const config = { fps: 10, qrbox: { width: 250, height: 250 } };
      
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
        } catch (e) { setError('QR 코드를 읽을 수 없습니다.'); }
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
        setError("카메라 접근 권한이 거부되었습니다. 브라우저 설정에서 카메라 권한을 허용해주세요.");
      } else if (errorMessage.includes("NotFoundError") || errorMessage.includes("Requested device not found") || errorMessage.includes("OverconstrainedError")) {
        if (mode === "environment") {
          console.log("Environment camera not found, falling back to user camera.");
          setFacingMode("user");
          return;
        }
        setError("사용 가능한 카메라를 찾을 수 없습니다.");
      } else if (errorMessage.includes("NotReadableError") || errorMessage.includes("Could not start video source")) {
        setError("카메라를 시작할 수 없습니다. 다른 앱에서 카메라를 사용 중인지 확인해주세요.");
      } else if (errorMessage.includes("already under transition")) {
        // Ignore transition errors, they will resolve on next retry or user action
        console.warn("Scanner is already transitioning states.");
      } else {
        setError(`카메라 초기화 오류: ${errorMessage}`);
      }

      // Only retry if it's not a permission or hardware missing error
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
    
    // Small delay to allow DOM to render the #reader element properly
    const timer = setTimeout(initScanner, 100);

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
    <div className="min-h-full bg-slate-50 flex flex-col">
      <div className="bg-white text-slate-900 p-6 pt-8 flex items-center border-b border-slate-100 sticky top-0 z-10">
        <Link to="/" className="p-2 -ml-2 hover:bg-slate-100 rounded-full transition-colors mr-2">
          <ArrowLeft className="w-6 h-6" />
        </Link>
        <h1 className="text-2xl font-bold tracking-tight flex-1">테이블 스캔</h1>
      </div>

      <div className="flex-1 p-6 flex flex-col items-center justify-center">
        <div className="w-full max-w-sm bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <ScanLine className="w-8 h-8 text-indigo-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">테이블 QR 스캔</h2>
            <p className="text-slate-500 text-sm">테이블에 있는 QR 코드를 스캔해주세요.</p>
          </div>

          <div className="relative rounded-2xl overflow-hidden bg-slate-900 aspect-square mb-6 shadow-inner">
            <div id="reader" className="w-full h-full"></div>
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm mb-4 text-center font-medium border border-red-100">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button 
              onClick={toggleCamera}
              className="flex-1 bg-slate-100 text-slate-700 py-3.5 rounded-xl font-semibold hover:bg-slate-200 transition-colors flex items-center justify-center text-sm"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              카메라 전환
            </button>
            <button 
              onClick={() => {
                const url = prompt('테이블 QR 코드 링크를 붙여넣어주세요.\n(예: https://gyeol.onrender.com/customer/store/...)');
                if (url) {
                  try {
                    const parsed = new URL(url);
                    if (parsed.pathname.includes('/customer/store/')) {
                      navigate(parsed.pathname);
                    } else {
                      setError('올바른 테이블 링크가 아닙니다.');
                    }
                  } catch (e) {
                    if (url.includes('/customer/store/')) {
                      navigate(url);
                    } else {
                      setError('올바른 테이블 링크가 아닙니다.');
                    }
                  }
                }
              }}
              className="flex-1 bg-indigo-600 text-white py-3.5 rounded-xl font-semibold hover:bg-indigo-700 transition-colors flex items-center justify-center text-sm shadow-sm shadow-indigo-200"
            >
              링크로 입장
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
