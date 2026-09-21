import {runInNewContext} from "node:vm";
import {afterEach, describe, expect, it, vi} from "vitest";
import {publicSearchHtml} from "@/shared/PublicSearch";

class ElementStub {
  value = "";
  textContent = "";
  className = "";
  children: ElementStub[] = [];
  listeners = new Map<string, Array<(event: Record<string, unknown>) => void>>();
  form?: ElementStub;
  container?: ElementStub;
  addEventListener(name: string, listener: (event: Record<string, unknown>) => void) {
    this.listeners.set(name, [...this.listeners.get(name) ?? [], listener]);
  }
  emit(name: string, properties: Record<string, unknown> = {}) {
    const event = {target: this, currentTarget: this, preventDefault: vi.fn(), ...properties};
    for (const listener of this.listeners.get(name) ?? []) listener(event);
    return event;
  }
  closest() { return this.form; }
  querySelector() { return this.container; }
  hasAttribute() { return false; }
  replaceChildren() { this.children = []; }
  appendChild(element: ElementStub) { this.children.push(element); }
}

function publicInput() {
  const input = new ElementStub();
  input.form = new ElementStub();
  const container = new ElementStub();
  input.form.container = container;
  const fetch = vi.fn().mockResolvedValue({ok: true, json: async () => ({items: []})});
  const html = publicSearchHtml();
  const script = html.slice(html.indexOf("<script>") + 8, html.lastIndexOf("</script>"));
  runInNewContext(script, {
    AbortController, URL, fetch,
    window: {setTimeout, clearTimeout, location: {origin: "https://feed.example.com"}},
    document: {
      querySelector: () => null,
      querySelectorAll: (selector: string) => selector === "[data-microfeed-search-input]" ? [input] : [],
      addEventListener: () => {},
      createElement: () => new ElementStub(),
    },
  });
  return {input, fetch, container};
}

afterEach(() => vi.useRealTimers());

describe("public search input composition", () => {
  it("waits for composition to finish and suppresses composition Enter and submit", async () => {
    vi.useFakeTimers();
    const {input, fetch} = publicInput();
    input.value = "中文";
    input.emit("input");
    await vi.advanceTimersByTimeAsync(100);
    input.emit("compositionstart");
    input.value = "日本語";
    input.emit("input");
    await vi.advanceTimersByTimeAsync(500);
    expect(fetch).not.toHaveBeenCalled();
    expect(input.emit("keydown", {key: "Enter"}).preventDefault).toHaveBeenCalled();
    expect(input.form!.emit("submit").preventDefault).toHaveBeenCalled();
    input.emit("compositionend");
    await vi.advanceTimersByTimeAsync(150);
    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch.mock.calls[0]![0].searchParams.get("q")).toBe("日本語");
    expect(input.emit("keydown", {key: "Enter", keyCode: 229}).preventDefault).toHaveBeenCalled();
  });

  it("aborts an in-flight request when composition starts", async () => {
    vi.useFakeTimers();
    const {input, fetch} = publicInput();
    input.value = "中文";
    input.emit("input");
    await vi.advanceTimersByTimeAsync(150);
    const signal = fetch.mock.calls[0]![1].signal as AbortSignal;
    input.emit("compositionstart");
    expect(signal.aborted).toBe(true);
  });

  it("counts supplementary characters as single characters", async () => {
    vi.useFakeTimers();
    const {input, fetch, container} = publicInput();
    input.value = "𠀀";
    input.emit("input");
    await vi.advanceTimersByTimeAsync(150);
    expect(fetch).not.toHaveBeenCalled();
    expect(container.children[0]?.textContent).toContain("one more character");
    input.value = "𠀀𠀁";
    input.emit("input");
    await vi.advanceTimersByTimeAsync(150);
    expect(fetch).toHaveBeenCalledOnce();
  });
});
