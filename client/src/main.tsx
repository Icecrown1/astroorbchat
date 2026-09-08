import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Спринт F: облегчённый режим — АВТО только на слабых Android (iOS-GPU вывозят анимации).
// Safari/WebKit занижает hardwareConcurrency ради антифингерпринта — из-за этого iPhone 15 Pro
// ложно попадал в lite. Ручное управление: localStorage.perfLite = '1' (вкл) / '0' (выкл).
try {
  const manual = localStorage.getItem("perfLite");
  const isAndroid = /Android/i.test(navigator.userAgent);
  const cores = (navigator as any).hardwareConcurrency || 8;
  const mem = (navigator as any).deviceMemory || 8;
  const autoLite = isAndroid && (cores <= 4 || mem <= 4);
  if (manual === "1" || (manual !== "0" && autoLite)) {
    document.documentElement.classList.add("perf-lite");
  }
} catch { /* noop */ }

createRoot(document.getElementById("root")!).render(<App />);
