/**
 * 설정 창에서 메인 프로세스 IPC 를 안전하게 호출하기 위한 브릿지.
 * contextIsolation: true 환경에서 contextBridge 로 화이트리스트만 노출.
 */
import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("gyeolAgent", {
  getAll: () => ipcRenderer.invoke("config:get-all"),
  listPrinters: () => ipcRenderer.invoke("printers:list"),
  selectPrinter: (p: { name: string; vendor: string; width?: number }) =>
    ipcRenderer.invoke("printer:select", p),
  testPrint: () => ipcRenderer.invoke("printer:test"),
  exchangeCode: (code: string, deviceName?: string) =>
    ipcRenderer.invoke("pairing:exchange", { code, deviceName }),
  reset: () => ipcRenderer.invoke("config:reset"),
  getHistory: () => ipcRenderer.invoke("history:get"),
  checkUpdate: () => ipcRenderer.invoke("update:check"),
});
