import { useEffect, useState } from "react";
import { Input } from "./Input";

interface Props {
  value: number;
  min?: number;
  max?: number;
  onCommit: (v: number) => void;
  /** 사용자 입력 중에는 매 키마다 onCommit을 호출하지 않고, blur/Enter 시에만 호출 */
  className?: string;
  label?: string;
  hint?: string;
}

/**
 * Controlled number input that batches updates:
 * - 로컬 state로 입력값을 받고 (빈 칸 허용)
 * - blur 또는 Enter 시에만 onCommit 호출
 * - 외부 value가 변경되면 동기화
 */
export function NumberField({ value, min, max, onCommit, ...rest }: Props) {
  const [local, setLocal] = useState(String(value));

  // 외부 값이 변경되면 동기화 (다른 클라이언트가 변경했을 때)
  useEffect(() => {
    setLocal(String(value));
  }, [value]);

  const commit = () => {
    if (local === "") {
      setLocal(String(value));
      return;
    }
    let n = Number(local);
    if (!Number.isFinite(n)) {
      setLocal(String(value));
      return;
    }
    if (min !== undefined) n = Math.max(min, n);
    if (max !== undefined) n = Math.min(max, n);
    if (n !== value) onCommit(n);
    setLocal(String(n));
  };

  return (
    <Input
      type="text"
      inputMode="numeric"
      value={local}
      onChange={(e) => setLocal(e.target.value.replace(/[^\d]/g, ""))}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
      {...rest}
    />
  );
}
