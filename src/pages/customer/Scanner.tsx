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

  const retryCountRef = useRef(0);

  const startScanner = async (mode: "environment" | "user") => {
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

    try {
      if (scannerRef.current.isScanning) {
        await scannerRef.current.stop();
      }
      await scannerRef.current.start({ facingMode: mode }, config, onScanSuccess, () => {});
      retryCountRef.current = 0;
    } catch (err: any) {
      console.error("Scanner start error:", err);
      const errorMessage = String(err);
      
      if (errorMessage.includes("NotAllowedError") || errorMessage.includes("Permission denied")) {
        setError("카메라 접근 권한이 거부되었습니다. 브라우저 설정에서 카메라 권한을 허용해주세요.");
      } else if (errorMessage.includes("NotFoundError") || errorMessage.includes("Requested device not found")) {
        setError("사용 가능한 카메라를 찾을 수 없습니다.");
      } else if (errorMessage.includes("NotReadableError") || errorMessage.includes("Could not start video source")) {
        setError("카메라를 시작할 수 없습니다. 다른 앱에서 카메라를 사용 중인지 확인해주세요.");
      } else {
        setError(`카메라 초기화 오류: ${errorMessage}`);
      }

      if (retryCountRef.current < 2) {
        retryCountRef.current += 1;
        setTimeout(() => startScanner(mode), 1000);
      }
    }
  };

  useEffect(() => {
    startScanner(facingMode);

    return () => {
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch(console.error);
      }
    };
  }, [facingMode]);

  const toggleCamera = () => {
    setFacingMode(prev => prev === "environment" ? "user" : "environment");
  };

  return (
    <div className="min-h-full bg-transparent flex flex-col">
      <div className="bg-transparent text-[#2D1B15] p-6 pt-8 flex items-center border-b border-[#E7E0D7]">
        <Link to="/" className="p-2 -ml-2 hover:bg-white/50 rounded-full transition-colors mr-2">
          <ArrowLeft className="w-6 h-6" />
        </Link>
        <h1 className="text-2xl font-black tracking-tight flex-1">테이블 스캔</h1>
      </div>

      <div className="flex-1 p-6 flex flex-col items-center justify-center">
        <div className="w-full max-w-sm bg-white/90 backdrop-blur-sm p-6 rounded-3xl shadow-sm border border-[#E7E0D7]">
          <div className="text-center mb-6">
            <ScanLine className="w-12 h-12 text-[#D84315] mx-auto mb-3" />
            <h2 className="text-xl font-bold text-[#2D1B15] mb-2">테이블 QR 스캔</h2>
            <p className="text-[#795548] text-sm">테이블에 있는 QR 코드를 스캔해주세요.</p>
          </div>

          <div className="relative rounded-2xl overflow-hidden bg-black aspect-square mb-6">
            <div id="reader" className="w-full h-full"></div>
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm mb-4 text-center font-bold border border-red-200">
              {error}
            </div>
          )}

          <div className="flex gap-2">
            <button 
              onClick={toggleCamera}
              className="flex-1 bg-[#EFEBE9] text-[#5D4037] py-3 rounded-xl font-bold hover:bg-[#E7E0D7] transition-colors flex items-center justify-center"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              카메라 전환
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
