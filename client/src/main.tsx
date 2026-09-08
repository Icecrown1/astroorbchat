import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Спринт F: слабые устройства — облегчённый режим (без тяжёлых анимаций и блюров)
try {
  const cores = (navigator as any).hardwareConcurrency || 8;
  const mem = (navigator as any).deviceMemory || 8;
  if (cores <= 4 || mem <= 4 || localStorage.getItem("perfLite") === "1") {
    document.documentElement.classList.add("perf-lite");
  }
} catch { /* noop */ }

createRoot(document.getElementById("root")!).render(<App />);
