import "./theme.css";

const placeholder = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP88eNnPQAJQwNqJHSUZQAAAABJRU5ErkJggg==";

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
    const links = Array.from(
      navigation.querySelectorAll<HTMLAnchorElement>("[data-microfeed-nav-item]"),
    );
    if (links.length <= 2) continue;

    const overflow = navigation.querySelector<HTMLDetailsElement>(
      "[data-microfeed-nav-overflow]",
    );
    const menu = overflow?.querySelector<HTMLElement>(
      "[data-microfeed-nav-overflow-menu]",
    );
    const summary = overflow?.querySelector<HTMLElement>("summary");
    if (!overflow || !menu || !summary) continue;

    for (const link of links.slice(2)) menu.append(link);
    overflow.hidden = false;
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
    updateExpandedState();
  }
}

function enableTheme(): void {
  enableLazyImages();
  enableOverflowNavigation();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", enableTheme, {once: true});
} else {
  enableTheme();
}
