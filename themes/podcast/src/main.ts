import "./theme.css";

const storageKey = "microfeed-public-theme";
const preferences = ["system", "light", "dark"] as const;
type Preference = typeof preferences[number];

function preference(value: string | null): Preference {
  return preferences.includes(value as Preference) ? value as Preference : "system";
}

function apply(next: Preference): void {
  const dark = next === "dark" || (
    next === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches
  );
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.dataset.themePreference = next;
  document.documentElement.dataset.colorMode = dark ? "dark" : "light";
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
}

function start(): void {
  const menu = document.querySelector<HTMLDetailsElement>("[data-theme-menu]");
  const options = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-theme-option]"));
  let current = preference(document.documentElement.dataset.themePreference ?? null);
  const update = (next: Preference): void => {
    current = next;
    apply(next);
    for (const option of options) {
      option.setAttribute("aria-checked", String(option.dataset.themeOption === next));
    }
  };
  for (const option of options) {
    option.addEventListener("click", () => {
      const next = preference(option.dataset.themeOption ?? null);
      try {
        window.localStorage.setItem(storageKey, next);
      } catch {
        // The preference still applies for this page.
      }
      update(next);
      if (menu) menu.open = false;
    });
  }
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (current === "system") apply(current);
  });
  update(current);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", start, {once: true});
} else {
  start();
}
