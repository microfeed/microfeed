import "./theme.css";

const storageKey = "microfeed-color-mode";

function applyColorMode(mode: string | null): void {
  const dark = mode === "dark" || (
    mode !== "light" && matchMedia("(prefers-color-scheme: dark)").matches
  );
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  document.querySelectorAll<HTMLElement>("[data-theme-label]").forEach((label) => {
    label.textContent = dark ? "Light" : "Dark";
  });
}

let savedMode: string | null = null;
try { savedMode = localStorage.getItem(storageKey); } catch { /* Sandboxed previews have no storage origin. */ }
applyColorMode(savedMode);

document.addEventListener("click", async (event) => {
  const target = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-action]") : null;
  if (!target) return;
  if (target.dataset.action === "theme") {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    try { localStorage.setItem(storageKey, next); } catch { /* Preview-only mode is still applied below. */ }
    applyColorMode(next);
  }
  if (target.dataset.action === "copy") {
    const url = target.dataset.url || location.href;
    try { await navigator.clipboard.writeText(url); } catch { /* Clipboard may be unavailable in isolated previews. */ }
    const original = target.textContent;
    target.textContent = "Copied";
    setTimeout(() => { target.textContent = original; }, 1600);
  }
});
