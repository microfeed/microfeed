import "./theme.css";

const placeholder = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP88eNnPQAJQwNqJHSUZQAAAABJRU5ErkJggg==";

function enableClassicLazyImages(): void {
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

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", enableClassicLazyImages, {once: true});
} else {
  enableClassicLazyImages();
}
