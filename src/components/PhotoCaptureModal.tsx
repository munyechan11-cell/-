import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Camera, Image as ImageIcon, X, Loader2, CheckCircle2 } from 'lucide-react';
import { fileToCompressedDataUrl, estimateBytes } from '../lib/imageUtils';
import { showToast } from '../store';

interface Props {
  open: boolean;
  title: string;
  hint?: string;
  /** 'environment' = 후면(메뉴 사진), 'user' = 전면(셀카). undefined = 사용자 선택 */
  cameraFacing?: 'environment' | 'user';
  /** 추가 입력 필드: 메뉴 이름 등 */
  extraField?: { label: string; value: string; onChange: (v: string) => void; placeholder?: string };
  submitLabel?: string;
  onClose: () => void;
  onCapture: (dataUrl: string) => Promise<void> | void;
}

export default function PhotoCaptureModal({
  open, title, hint, cameraFacing, extraField, submitLabel = '저장하기',
  onClose, onCapture
}: Props) {
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('이미지 파일만 업로드 가능합니다.', 'error');
      return;
    }
    setBusy(true);
    try {
      const compressed = await fileToCompressedDataUrl(file);
      const bytes = estimateBytes(compressed);
      if (bytes > 950_000) {
        showToast('이미지가 너무 큽니다. 더 작은 사진으로 시도해 주세요.', 'error');
        return;
      }
      setPreview(compressed);
    } catch (err) {
      console.error(err);
      showToast('이미지 처리 실패', 'error');
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    if (!preview) {
      showToast('먼저 사진을 추가해 주세요.', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await onCapture(preview);
      setPreview(null);
    } catch (err) {
      console.error(err);
      showToast('저장 실패. 다시 시도해 주세요.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const close = () => {
    if (submitting) return;
    setPreview(null);
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm flex items-end lg:items-center justify-center p-0 lg:p-6"
          onClick={close}
        >
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 30, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white w-full max-w-md rounded-t-[3rem] lg:rounded-[3rem] shadow-premium overflow-hidden flex flex-col max-h-[92vh]"
          >
            <div className="px-7 pt-7 pb-4 flex justify-between items-start border-b border-primary/5">
              <div>
                <h3 className="font-sans text-lg lg:text-xl font-black text-primary tracking-tight">{title}</h3>
                {hint && <p className="text-[10px] font-black uppercase tracking-widest text-primary/40 mt-1">{hint}</p>}
              </div>
              <button onClick={close} disabled={submitting} className="p-2 text-primary/40 hover:text-primary disabled:opacity-50">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-7 py-6 space-y-5 overflow-y-auto no-scrollbar">
              {/* Preview area */}
              <div className="relative aspect-[4/3] bg-surface-container rounded-[1.5rem] border-2 border-dashed border-primary/15 overflow-hidden flex items-center justify-center">
                {busy ? (
                  <div className="flex flex-col items-center gap-3 text-primary/40">
                    <Loader2 className="w-8 h-8 animate-spin" />
                    <span className="text-[10px] font-black uppercase tracking-widest">사진 처리 중...</span>
                  </div>
                ) : preview ? (
                  <>
                    <img src={preview} alt="preview" className="w-full h-full object-cover" />
                    <button
                      onClick={() => setPreview(null)}
                      className="absolute top-3 right-3 p-2 bg-black/60 backdrop-blur text-white rounded-full hover:bg-black/80"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-2 text-primary/30 px-6 text-center">
                    <ImageIcon className="w-10 h-10" />
                    <span className="text-[11px] font-black uppercase tracking-widest">아래 버튼으로 사진 추가</span>
                  </div>
                )}
              </div>

              {/* Buttons: camera / file */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => cameraRef.current?.click()}
                  disabled={busy || submitting}
                  className="py-4 bg-primary text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-accent-burgundy transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Camera className="w-4 h-4" /> 카메라
                </button>
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={busy || submitting}
                  className="py-4 bg-surface-container text-primary border border-primary/10 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-primary/5 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <ImageIcon className="w-4 h-4" /> 갤러리
                </button>
              </div>

              <input
                ref={cameraRef}
                type="file"
                accept="image/*"
                capture={cameraFacing || undefined}
                onChange={handleFile}
                className="hidden"
              />
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                onChange={handleFile}
                className="hidden"
              />

              {extraField && (
                <label className="block">
                  <span className="block text-[10px] font-black text-primary/50 uppercase tracking-[0.2em] mb-1.5">
                    {extraField.label}
                  </span>
                  <input
                    type="text"
                    value={extraField.value}
                    onChange={(e) => extraField.onChange(e.target.value)}
                    placeholder={extraField.placeholder}
                    className="w-full bg-surface-container border border-primary/10 rounded-2xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </label>
              )}
            </div>

            <div className="px-7 py-5 border-t border-primary/5 flex gap-3 bg-surface-bright/50">
              <button
                onClick={close}
                disabled={submitting}
                className="flex-1 py-3.5 bg-white border border-primary/10 text-primary rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-primary/5 transition-all disabled:opacity-50"
              >
                취소
              </button>
              <button
                onClick={submit}
                disabled={!preview || submitting || busy}
                className="flex-[2] py-3.5 bg-emerald-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                {submitLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
