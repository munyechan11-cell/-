/**
 * 모달 공통 UX 훅 — body 스크롤 잠금 + ESC 닫기.
 *
 * 기존엔 모달마다 useEffect 로 `document.body.style.overflow` 를 잠그고
 * 복원했는데, 두 모달이 겹쳐 열리면 늦게 열린 모달이 "auto" 가 아닌
 * "hidden" 을 prev 로 기억해 두 번 닫혀도 스크롤이 풀리지 않는 버그가
 * 있었음. counter 패턴으로 modal stack 추적 → 마지막 모달이 닫힐 때만
 * 원래 overflow 로 복원.
 */
import { useEffect } from "react";

let modalStack = 0;
let previousOverflow = "";

function pushModal() {
  if (typeof document === "undefined") return;
  if (modalStack === 0) {
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  modalStack++;
}

function popModal() {
  if (typeof document === "undefined") return;
  modalStack = Math.max(0, modalStack - 1);
  if (modalStack === 0) {
    document.body.style.overflow = previousOverflow;
  }
}

export function useModalChrome(active: boolean, onClose?: () => void) {
  // body scroll lock
  useEffect(() => {
    if (!active) return;
    pushModal();
    return () => popModal();
  }, [active]);

  // ESC 닫기 (onClose 가 주어진 경우만)
  useEffect(() => {
    if (!active || !onClose) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [active, onClose]);
}
