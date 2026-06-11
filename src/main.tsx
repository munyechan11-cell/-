import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { StoreProvider } from "./store/store";
import { bootstrapTheme } from "./lib/themes";

// 부팅 즉시 캐시된 매장 테마 적용 — store 로드 전 색 깜빡임 방지
bootstrapTheme();

window.addEventListener("unhandledrejection", (e) => {
  console.error("[unhandledrejection]", e.reason);
});
window.addEventListener("error", (e) => {
  console.error("[global error]", e.error);
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <StoreProvider>
        <App />
      </StoreProvider>
    </ErrorBoundary>
  </StrictMode>
);
