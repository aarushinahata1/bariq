import { createRoot } from "react-dom/client";
import App from "./App";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import "./index.css";

const root = document.getElementById("root")!;

try {
  createRoot(root).render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
} catch (e) {
  console.error("Fatal render error:", e);
  const wrapper = document.createElement("div");
  wrapper.style.cssText = "padding:40px;font-family:sans-serif;color:#dc2626;background:#fef2f2;min-height:100vh";
  const heading = document.createElement("h2");
  heading.textContent = "App failed to start";
  const pre = document.createElement("pre");
  pre.style.cssText = "font-size:13px;white-space:pre-wrap";
  pre.textContent = String(e);
  const hint = document.createElement("p");
  hint.textContent = "Check browser console (F12) for full details.";
  wrapper.append(heading, pre, hint);
  root.replaceChildren(wrapper);
}
