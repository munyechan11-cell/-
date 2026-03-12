import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useStore } from '../../store';
import { Html5Qrcode } from 'html5-qrcode';
import { ScanLine, LogOut, Store, ArrowLeft, RefreshCw } from 'lucide-react'; // RefreshCw 아이콘 추가

export default function CustomerScanner() {
  const { currentUser, logout, recordVisit, users } = useStore();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment"); // 카메라 방향 상태
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const usersRef = useRef(users);

  useEffect(() => {
    usersRef.current = users;
  }, [users]);

  // 카메라 시작 함수 분리
  const startScanner = async (mode: "environment" | "user", retryCount = 0) => {
    if (!scannerRef.current) {
      scannerRef.current = new Html5Qrcode("reader");
    }

    const config = { fps: 10, qrbox: { width: 250, height: 250 } };
    
    const onScanSuccess = (decodedText: string) => {
      // ... 기존 스캔 성공 로직 동일 ...
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
      // 기존에 실행 중이면 중지 후 시작
      if (scannerRef.current.isScanning) {
        await scannerRef.current.stop();
      }
      await scannerRef.current.start({ facingMode: mode }, config, onScanSuccess, () => {});
    } catch (err: any) {
      console.error("Scanner start error:", err);
      const errorMessage = String(err);
      
      // If NotReadableError occurs (often when camera is in use or environment camera doesn't exist), try the other camera
      if (errorMessage.includes('NotReadableError') || errorMessage.includes('OverconstrainedError')) {
        if (retryCount === 0) {
          console.log("Retrying with different camera mode...");
          const fallbackMode = mode === "environment" ? "user" : "environment";
          setFacingMode(fallbackMode); // This will trigger the useEffect again
          return;
        }
      }

      if (errorMessage.includes('NotAllowedError') || errorMessage.includes('Permission denied')) {
        setError('카메라 접근 권한이 거부되었습니다. 브라우저 설정에서 카메라 권한을 허용해주세요.');
      } else {
        setError(`카메라를 시작할 수 없습니다 (${errorMessage}). 기기의 카메라 상태를 확인해주세요.`);
      }
    }
  };

  // 초기 실행 및 방향 변경 시 실행
  useEffect(() => {
    let isMounted = true;
    const timer = setTimeout(() => {
      if (isMounted) {
        startScanner(facingMode);
      }
    }, 100);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop().catch(console.error);
      }
    };
  }, [facingMode]); // facingMode가 바뀔 때마다 다시 실행

  // 카메라 전환 핸들러
  const toggleCamera = () => {
    setFacingMode(prev => prev === "environment" ? "user" : "environment");
  };

  const handleLogout = () => {
    if (currentUser) {
      logout();
    }
    navigate('/');
  };

  // For testing without a real camera
  const handleTestScan = () => {
    const owner = users.find(u => u.role === 'owner');
    if (owner) {
      navigate(`/customer/store/${owner.id}/table/1`);
    } else {
      setError('등록된 가게가 없습니다.');
    }
  };

  return (
    <div className="min-h-full bg-transparent pb-20 flex flex-col">
      {/* Header */}
      <div className="bg-transparent text-[#2D1B15] p-6 pt-8 border-b border-[#E7E0D7] flex justify-between items-center relative">
        <Link to="/" className="p-2 bg-white/80 rounded-full hover:bg-white shadow-sm border border-[#E7E0D7]">
          <ArrowLeft className="w-5 h-5 text-[#D84315]" />
        </Link>
        <div className="text-center flex-1">
          <h1 className="text-2xl font-black tracking-tight">가게 QR 스캔</h1>
        </div>
        
        {/* 카메라 전환 버튼 추가 */}
        <button onClick={toggleCamera} className="p-2 bg-white/80 rounded-full hover:bg-white shadow-sm border border-[#E7E0D7] mr-2">
          <RefreshCw className="w-5 h-5 text-[#D84315]" />
        </button>

        {currentUser ? (
          <button onClick={handleLogout} className="p-2 bg-white/80 rounded-full hover:bg-white shadow-sm border border-[#E7E0D7]">
            <LogOut className="w-5 h-5 text-[#D84315]" />
          </button>
        ) : (
          <div className="w-9"></div> /* Spacer for alignment */
        )}
      </div>

      <div className="flex-1 p-6 flex flex-col items-center justify-center">
        <div className="bg-white/90 backdrop-blur-sm p-4 rounded-3xl shadow-sm border border-[#E7E0D7] w-full max-w-sm relative overflow-hidden">
          <div id="reader" className="w-full"></div>
          
          {error && (
            <div className="mt-4 p-3 bg-red-50 text-red-600 text-sm font-bold rounded-xl text-center">
              {error}
            </div>
          )}
          
          <div className="mt-6 text-center">
            <ScanLine className="w-8 h-8 text-[#D84315] mx-auto mb-2" />
            <p className="text-[#795548] font-medium">
              카메라를 QR 코드에 향하게 해주세요
            </p>
          </div>
        </div>

        <button 
          onClick={handleTestScan}
          className="mt-8 bg-[#EFEBE9] hover:bg-stone-300 text-[#4E342E] font-bold py-3 px-6 rounded-xl transition-colors flex items-center"
        >
          <Store className="w-5 h-5 mr-2" />
          테스트용: 첫번째 가게로 입장
        </button>
      </div>
    </div>
  );
}