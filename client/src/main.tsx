import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

const root = document.getElementById("root")!;

try {
  createRoot(root).render(<App />);
} catch (e) {
  console.error("Fatal render error:", e);
  root.innerHTML = `<div style="padding:40px;font-family:sans-serif;color:#dc2626;background:#fef2f2;min-height:100vh">
    <h2>App failed to start</h2>
    <pre style="font-size:13px;white-space:pre-wrap">${e}</pre>
    <p>Check browser console (F12) for full details.</p>
  </div>`;
}
