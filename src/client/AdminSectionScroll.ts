export function scrollExpandedAdminSectionIntoView(
  event: {currentTarget: HTMLDetailsElement},
) {
  const details = event.currentTarget;
  if (!details.open) return;

  requestAnimationFrame(() => {
    if (!details.open || !details.isConnected) return;
    const summary = details.querySelector("summary");
    if (!summary) return;

    const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth";
    const scrollRoot = document.getElementById("admin-page-content");
    // Desktop scrolls inside the admin panel; mobile scrolls the document.
    if (scrollRoot && ["auto", "scroll"].includes(getComputedStyle(scrollRoot).overflowY)) {
      scrollRoot.scrollTo({
        behavior,
        top: scrollRoot.scrollTop + summary.getBoundingClientRect().top - scrollRoot.getBoundingClientRect().top,
      });
    } else {
      const header = scrollRoot?.previousElementSibling;
      const headerHeight = header && getComputedStyle(header).position === "sticky"
        ? header.getBoundingClientRect().height : 0;
      window.scrollTo({
        behavior,
        top: window.scrollY + summary.getBoundingClientRect().top - headerHeight,
      });
    }
  });
}
