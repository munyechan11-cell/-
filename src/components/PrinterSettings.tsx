import React, { useState, useEffect } from 'react';
import { Printer, Wifi, WifiOff, CheckCircle2, Loader2 } from 'lucide-react';
import {
  isBluetoothSupported, pairPrinter, isPrinterConnected,
  getConnectedPrinterName, disconnectPrinter, printTestPage
} from '../lib/escposPrinter';
import { showToast } from '../store';

interface Props {
  storeName: string;
}

export default function PrinterSettings({ storeName }: Props) {
  const [, force] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const t = setInterval(() => force((n) => n + 1), 2000);
    return () => clearInterval(t);
  }, []);

  const supported = isBluetoothSupported();
  const connected = isPrinterConnected();
  const name = getConnectedPrinterName();

  const handlePair = async () => {
    setBusy(true);
    try {
      const r = await pairPrinter();
      showToast(`${r.name} 연결 완료`, 'success');
      force((n) => n + 1);
    } catch (e: any) {
      if (e?.name !== 'NotFoundError') {
        showToast(`연결 실패: ${e.message || '알 수 없는 오류'}`, 'error');
      }
    } finally {
      setBusy(false);
    }
  };

  const handleDisconnect = async () => {
    await disconnectPrinter();
    showToast('프린터 연결 해제됨', 'info');
    force((n) => n + 1);
  };

  const handleTest = async () => {
    setBusy(true);
    try {
      await printTestPage(storeName);
      showToast('테스트 인쇄 전송됨', 'success');
    } catch (e: any) {
      showToast(`인쇄 실패: ${e.message}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="bg-white p-8 rounded-3xl border-2 border-primary/10 shadow-sm">
      <div className="flex items-center gap-4 mb-6">
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${connected ? 'bg-emerald-500/15 text-emerald-700' : 'bg-primary/10 text-primary/60'}`}>
          <Printer className="w-7 h-7" />
        </div>
        <div>
          <h2 className="text-2xl font-black text-primary">영수증 프린터</h2>
          <p className="text-base font-bold text-primary/70 mt-1">
            새 주문이 오면 자동으로 영수증을 출력합니다
          </p>
        </div>
      </div>

      {!supported && (
        <div className="bg-burgundy/5 border-2 border-burgundy/20 rounded-2xl p-6 mb-5">
          <p className="text-base font-bold text-burgundy mb-2">⚠️ 이 브라우저는 지원되지 않습니다</p>
          <p className="text-sm font-bold text-burgundy/80 leading-relaxed">
            Chrome 또는 Edge 브라우저로 접속해 주세요. (아이폰은 지원되지 않습니다)
          </p>
        </div>
      )}

      {supported && (
        <>
          <div className={`rounded-2xl p-6 mb-5 border-2 ${connected ? 'bg-emerald-500/5 border-emerald-500/30' : 'bg-surface-container border-primary/10'}`}>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                {connected ? (
                  <CheckCircle2 className="w-6 h-6 text-emerald-700" />
                ) : (
                  <WifiOff className="w-6 h-6 text-primary/40" />
                )}
                <div>
                  <p className={`text-lg font-black ${connected ? 'text-emerald-800' : 'text-primary/70'}`}>
                    {connected ? '연결됨' : '연결 안 됨'}
                  </p>
                  {connected && name && (
                    <p className="text-sm font-bold text-emerald-700/80 mt-0.5">{name}</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {!connected ? (
              <button
                onClick={handlePair}
                disabled={busy}
                className="col-span-full py-5 bg-primary text-white rounded-2xl font-black text-lg hover:bg-accent-burgundy transition-all shadow-lg flex items-center justify-center gap-3 disabled:opacity-50"
              >
                {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Wifi className="w-5 h-5" />}
                프린터 연결하기
              </button>
            ) : (
              <>
                <button
                  onClick={handleTest}
                  disabled={busy}
                  className="py-5 bg-emerald-500 text-white rounded-2xl font-black text-lg hover:bg-emerald-600 transition-all shadow-lg flex items-center justify-center gap-3 disabled:opacity-50"
                >
                  {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Printer className="w-5 h-5" />}
                  테스트 인쇄
                </button>
                <button
                  onClick={handleDisconnect}
                  disabled={busy}
                  className="py-5 bg-white border-2 border-burgundy/30 text-burgundy rounded-2xl font-black text-lg hover:bg-burgundy hover:text-white transition-all"
                >
                  연결 해제
                </button>
              </>
            )}
          </div>

          <div className="mt-6 p-5 bg-gold/5 border-2 border-gold/20 rounded-2xl">
            <p className="text-sm font-bold text-primary leading-relaxed">
              💡 <span className="text-base font-black">사용 안내</span><br/>
              · 블루투스가 켜진 상태에서 [프린터 연결하기]를 눌러주세요<br/>
              · 영수증 프린터(58mm)가 페어링 목록에 뜨면 선택<br/>
              · 한 번 연결하면 새 주문마다 자동으로 인쇄됩니다<br/>
              · 브라우저를 닫으면 다시 연결해야 합니다
            </p>
          </div>
        </>
      )}
    </section>
  );
}
