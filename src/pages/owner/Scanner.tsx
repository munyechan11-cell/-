import { useState, useEffect, useRef } from 'react';
import { useStore } from '../../store';
import { Users, LayoutGrid, ScanLine, CheckCircle2, XCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';

export default function OwnerScanner() {
  const { useCoupon, coupons, users, tables, currentUser } = useStore();
  const [scanResult, setScanResult] = useState<{ success: boolean; message: string; data?: any } | null>(null);
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
            const data = JSON.parse(decodedText);
            if (data.couponId && data.customerId) {
              handleScan(data.couponId, data.customerId);
              html5QrCode.pause(true); // Pause after successful scan
            } else {
              setScanResult({ success: false, message: '유효하지 않은 QR 코드입니다.' });
            }
          } catch (e) {
            setScanResult({ success: false, message: 'QR 코드 형식이 잘못되었습니다.' });
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
        setScanResult({ success: false, message: '카메라를 시작할 수 없습니다. 권한을 확인해주세요.' });
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
  }, []);

  const handleScan = (couponId: string, customerId: string) => {
    if (!currentUser) return;
    
    const coupon = coupons.find(c => c.id === couponId);
    const customer = users.find(u => u.id === customerId);
    
    // Find which table the customer is currently at
    const table = tables.find(t => t.currentCustomerId === customerId && t.storeId === currentUser.id);

    if (!coupon) {
      setScanResult({ success: false, message: '존재하지 않는 쿠폰입니다.' });
      return;
    }

    if (coupon.status === 'used') {
      setScanResult({ success: false, message: '이미 사용된 쿠폰입니다.' });
      return;
    }

    if (!customer) {
      setScanResult({ success: false, message: '고객 정보를 찾을 수 없습니다.' });
      return;
    }

    if (!table) {
      setScanResult({ success: false, message: '고객이 현재 테이블에 착석해 있지 않습니다.' });
      return;
    }

    // Mark as used
    useCoupon(couponId, table.number);
    setScanResult({ 
      success: true, 
      message: `${customer.name}님의 [${coupon.description}] 서비스가 승인되었습니다.`,
      data: { customer, coupon, table }
    });
  };

  const resetScanner = () => {
    setScanResult(null);
    // Note: To fully resume, we'd need to re-initialize or call resume() on the scanner instance.
    // For simplicity in this demo, reloading the component or just clearing the result works for UI.
    window.location.reload(); // Simple way to reset scanner state
  };

  if (!currentUser) return null;

  return (
    <div className="min-h-full bg-transparent pb-20">
      {/* Header */}
      <div className="bg-transparent text-[#2D1B15] p-6 pt-8 border-b border-[#E7E0D7]">
        <h1 className="text-2xl font-black tracking-tight">서비스 QR 스캐너</h1>
        <p className="text-[#795548] text-sm mt-1 font-medium">고객의 쿠폰 QR을 스캔하세요.</p>
      </div>

      {/* Scanner Area */}
      <div className="p-6">
        <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-sm border border-[#E7E0D7] overflow-hidden">
          {scanResult ? (
            <div className="p-8 text-center">
              {scanResult.success ? (
                <>
                  <CheckCircle2 className="w-20 h-20 text-emerald-500 mx-auto mb-4" />
                  <h2 className="text-2xl font-bold text-[#2D1B15] mb-2">승인 완료</h2>
                  <p className="text-[#5D4037] mb-6">{scanResult.message}</p>
                  
                  {scanResult.data && (
                    <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 mb-6 text-left">
                      <p className="text-sm text-emerald-800 mb-1">
                        <strong>테이블:</strong> {scanResult.data.table.number}번
                      </p>
                      <p className="text-sm text-emerald-800 mb-1">
                        <strong>고객명:</strong> {scanResult.data.customer.name}
                      </p>
                      <p className="text-sm text-emerald-800">
                        <strong>서비스:</strong> {scanResult.data.coupon.description}
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <XCircle className="w-20 h-20 text-red-500 mx-auto mb-4" />
                  <h2 className="text-2xl font-bold text-[#2D1B15] mb-2">승인 실패</h2>
                  <p className="text-[#5D4037] mb-6">{scanResult.message}</p>
                </>
              )}
              
              <button 
                onClick={resetScanner}
                className="w-full bg-[#4E342E] hover:bg-[#3E2723] text-white font-bold py-4 rounded-xl transition-colors"
              >
                다시 스캔하기
              </button>
            </div>
          ) : (
            <div id="reader" className="w-full"></div>
          )}
        </div>
        
        {!scanResult && (
          <div className="mt-6">
            <p className="text-center text-[#795548] text-sm mb-4">
              카메라 권한을 허용해야 스캐너를 사용할 수 있습니다.
            </p>
            <div className="bg-white/90 backdrop-blur-sm p-4 rounded-2xl shadow-sm border border-[#E7E0D7]">
              <p className="text-xs font-bold text-[#795548] mb-2">테스트용 수동 입력 (QR 데이터 JSON)</p>
              <textarea 
                className="w-full text-xs p-2 border border-[#E7E0D7] rounded-lg mb-2"
                rows={3}
                placeholder='{"couponId":"...","customerId":"..."}'
                id="manual-qr-input"
              ></textarea>
              <button 
                onClick={() => {
                  const val = (document.getElementById('manual-qr-input') as HTMLTextAreaElement).value;
                  try {
                    const data = JSON.parse(val);
                    if (data.couponId && data.customerId) {
                      handleScan(data.couponId, data.customerId);
                    }
                  } catch (e) {
                    alert('잘못된 JSON 형식입니다.');
                  }
                }}
                className="w-full bg-[#EFEBE9] text-[#4E342E] py-2 rounded-lg text-sm font-bold hover:bg-stone-300"
              >
                수동으로 스캔 시뮬레이션
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-sm border-t border-[#E7E0D7] flex justify-around p-4 pb-safe z-40">
        <Link to="/owner" className="flex flex-col items-center text-[#A1887F] hover:text-[#2D1B15] transition-colors">
          <LayoutGrid className="w-6 h-6 mb-1" />
          <span className="text-xs font-bold">테이블</span>
        </Link>
        <Link to="/owner/customers" className="flex flex-col items-center text-[#A1887F] hover:text-[#2D1B15] transition-colors">
          <Users className="w-6 h-6 mb-1" />
          <span className="text-xs font-bold">고객관리</span>
        </Link>
        <Link to="/owner/scanner" className="flex flex-col items-center text-[#2D1B15]">
          <ScanLine className="w-6 h-6 mb-1" />
          <span className="text-xs font-bold">스캐너</span>
        </Link>
      </div>
    </div>
  );
}
