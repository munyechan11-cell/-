import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useStore } from '../../store';
import { Html5Qrcode } from 'html5-qrcode';
import { ScanLine, LogOut, Store, ArrowLeft } from 'lucide-react';

export default function CustomerScanner() {
  const { currentUser, logout, recordVisit, users } = useStore();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    if (scannerRef.current) return;

    const initScanner = async () => {
      try {
        const html5QrCode = new Html5Qrcode("reader");
        scannerRef.current = html5QrCode;

        const config = { fps: 10, qrbox: { width: 250, height: 250 } };
        
        const onScanSuccess = (decodedText: string) => {
          try {
            const text = decodedText;
            if (text.includes('/customer/store/')) {
              try {
                const url = new URL(text);
                navigate(url.pathname + url.search);
              } catch (urlError) {
                // If it's not a valid URL but just a path
                navigate(text);
              }
              return;
            }
            
            // Fallback for old JSON format
            const data = JSON.parse(text);
            if (data.storeId && data.tableNumber) {
              const store = users.find(u => u.id === data.storeId && u.role === 'owner');
              if (store) {
                navigate(`/customer/store/${data.storeId}/table/${data.tableNumber}`);
              } else {
                setError('유효하지 않은 가게 QR입니다.');
              }
            } else {
              setError('잘못된 QR 형식입니다.');
            }
          } catch (e) {
            setError('QR 코드를 읽을 수 없습니다.');
          }
        };

        const onScanFailure = (error: any) => {
          // Ignore continuous scanning errors
        };

        try {
          const devices = await Html5Qrcode.getCameras();
          if (devices && devices.length > 0) {
            // Try to find a back camera
            const backCamera = devices.find(d => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('environment'));
            const cameraId = backCamera ? backCamera.id : devices[0].id;
            
            await html5QrCode.start(cameraId, config, onScanSuccess, onScanFailure);
          } else {
            // Fallback to facingMode if getCameras returns empty but no error
            await html5QrCode.start({ facingMode: "environment" }, config, onScanSuccess, onScanFailure);
          }
        } catch (e) {
          console.log("Camera access failed, trying fallback", e);
          // Ultimate fallback
          await html5QrCode.start({ facingMode: "user" }, config, onScanSuccess, onScanFailure);
        }
      } catch (err) {
        console.error("Error starting scanner", err);
        setError('카메라를 시작할 수 없습니다. 권한을 확인해주세요.');
      }
    };

    // Small delay to ensure DOM element is ready
    const timer = setTimeout(() => {
      initScanner();
    }, 100);

    return () => {
      clearTimeout(timer);
      if (scannerRef.current) {
        scannerRef.current.stop().then(() => {
          scannerRef.current?.clear();
          scannerRef.current = null;
        }).catch(console.error);
      }
    };
  }, [users]);

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
        <Link to="/" className="p-2 bg-white/80 rounded-full hover:bg-white shadow-sm border border-[#E7E0D7] transition-colors">
          <ArrowLeft className="w-5 h-5 text-[#D84315]" />
        </Link>
        <div className="text-center flex-1">
          <h1 className="text-2xl font-black tracking-tight">가게 QR 스캔</h1>
          <p className="text-[#795548] text-sm mt-1 font-medium">테이블의 QR 코드를 스캔해주세요</p>
        </div>
        {currentUser ? (
          <button onClick={handleLogout} className="p-2 bg-white/80 rounded-full hover:bg-white shadow-sm border border-[#E7E0D7] transition-colors">
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
