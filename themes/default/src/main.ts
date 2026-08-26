import "./theme.css";

const placeholder = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP88eNnPQAJQwNqJHSUZQAAAABJRU5ErkJggg==";
const themeStorageKey = "microfeed-public-theme";
const themePreferences = ["system", "light", "dark"] as const;

type ThemePreference = typeof themePreferences[number];

function parseThemePreference(value: string | null): ThemePreference {
  return themePreferences.includes(value as ThemePreference)
    ? value as ThemePreference
    : "light";
}

function applyTheme(preference: ThemePreference): void {
  const isDark = preference === "dark" || (
    preference === "system" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
  document.documentElement.classList.toggle("dark", isDark);
  document.documentElement.dataset.themePreference = preference;
  document.documentElement.dataset.colorMode = isDark ? "dark" : "light";
  document.documentElement.style.colorScheme = isDark ? "dark" : "light";
}

function enableColorTheme(): void {
  const menu = document.querySelector<HTMLElement>(
    "[data-microfeed-theme-menu]",
  );
  const trigger = menu?.querySelector<HTMLButtonElement>(
    "[data-microfeed-theme-trigger]",
  );
  const panel = menu?.querySelector<HTMLElement>("[role=menu]");
  const options = Array.from(
    menu?.querySelectorAll<HTMLButtonElement>(
      "[data-microfeed-theme-option]",
    ) ?? [],
  );
  if (!menu || !trigger || !panel || options.length === 0) return;

  let preference = parseThemePreference(
    document.documentElement.dataset.themePreference ?? null,
  );

  const updateTheme = (nextPreference: ThemePreference): void => {
    preference = nextPreference;
    applyTheme(preference);
    trigger.setAttribute("aria-label", `Color theme: ${preference}`);
    for (const option of options) {
      option.setAttribute(
        "aria-checked",
        String(option.dataset.microfeedThemeOption === preference),
      );
    }
  };

  const setMenuOpen = (isOpen: boolean): void => {
    panel.hidden = !isOpen;
    trigger.setAttribute("aria-expanded", String(isOpen));
  };

  trigger.addEventListener("click", () => {
    setMenuOpen(panel.hidden);
  });

  for (const option of options) {
    option.addEventListener("click", () => {
      const nextPreference = parseThemePreference(
        option.dataset.microfeedThemeOption ?? null,
      );
      try {
        window.localStorage.setItem(themeStorageKey, nextPreference);
      } catch {
        // The preference still applies to the current page.
      }
      updateTheme(nextPreference);
      setMenuOpen(false);
      trigger.focus();
    });
  }

  const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");
  systemTheme.addEventListener("change", () => {
    if (preference === "system") applyTheme("system");
  });
  window.addEventListener("storage", (event) => {
    if (event.key === themeStorageKey) {
      updateTheme(parseThemePreference(event.newValue));
    }
  });
  document.addEventListener("pointerdown", (event) => {
    if (event.target instanceof Node && !menu.contains(event.target)) {
      setMenuOpen(false);
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || panel.hidden) return;
    setMenuOpen(false);
    trigger.focus();
  });

  updateTheme(preference);
}

function enableLazyImages(): void {
  if (!("IntersectionObserver" in window)) return;
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting || !(entry.target instanceof HTMLImageElement)) continue;
      const lazyImage = entry.target;
      const source = lazyImage.dataset.src;
      if (!source) continue;
      const image = document.createElement("img");
      image.src = source;
      image.alt = lazyImage.alt;
      image.onload = () => {
        const link = document.createElement("a");
        link.href = source;
        link.target = "_blank";
        link.rel = "noopener";
        link.append(image);
        lazyImage.replaceWith(link);
      };
      observer.unobserve(lazyImage);
    }
  });

  document.querySelectorAll<HTMLImageElement>('img:not([loading="lazy"])')
    .forEach((image) => {
      image.dataset.src = image.src;
      image.classList.add("loader");
      image.src = placeholder;
      observer.observe(image);
    });
}

function enableOverflowNavigation(): void {
  for (const navigation of document.querySelectorAll<HTMLElement>(
    "[data-microfeed-site-nav]",
  )) {
    const linkContainer = navigation.querySelector<HTMLElement>(".mf-nav-links");
    const links = Array.from(
      navigation.querySelectorAll<HTMLAnchorElement>("[data-microfeed-nav-item]"),
    );
    const overflow = navigation.querySelector<HTMLDetailsElement>(
      "[data-microfeed-nav-overflow]",
    );
    const menu = overflow?.querySelector<HTMLElement>(
      "[data-microfeed-nav-overflow-menu]",
    );
    const summary = overflow?.querySelector<HTMLElement>("summary");
    if (!linkContainer || !overflow || !menu || !summary) continue;

    const mobileNavigation = window.matchMedia("(max-width: 600px)");
    const arrangeLinks = (): void => {
      overflow.open = false;

      if (mobileNavigation.matches) {
        for (const link of links) menu.append(link);
        overflow.hidden = links.length === 0;
        summary.setAttribute("aria-label", "Page menu");
        return;
      }

      for (const link of links.slice(0, 2)) {
        linkContainer.insertBefore(link, overflow);
      }
      for (const link of links.slice(2)) menu.append(link);
      overflow.hidden = links.length <= 2;
      summary.setAttribute("aria-label", "More pages");
    };

    const updateExpandedState = () => {
      summary.setAttribute("aria-expanded", String(overflow.open));
    };
    overflow.addEventListener("toggle", updateExpandedState);
    menu.addEventListener("click", () => {
      overflow.open = false;
    });
    document.addEventListener("pointerdown", (event) => {
      if (event.target instanceof Node && !overflow.contains(event.target)) {
        overflow.open = false;
      }
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") overflow.open = false;
    });
    mobileNavigation.addEventListener("change", arrangeLinks);
    arrangeLinks();
    updateExpandedState();
  }
}

function enableTheme(): void {
  enableColorTheme();
  enableLazyImages();
  enableOverflowNavigation();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", enableTheme, {once: true});
} else {
  enableTheme();
}
