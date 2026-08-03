import {afterEach, describe, expect, it, vi} from "vitest";

import {preventCloseWhenChanged} from "@/client/BrowserUtils";

afterEach(() => {
  vi.unstubAllGlobals();
});

function installEventTargets() {
  const windowListeners = new Map<string, EventListener>();
  const documentListeners = new Map<string, EventListener>();
  const windowTarget = {
    addEventListener: vi.fn((name: string, listener: EventListener) => {
      windowListeners.set(name, listener);
    }),
    removeEventListener: vi.fn((name: string, listener: EventListener) => {
      if (windowListeners.get(name) === listener) windowListeners.delete(name);
    }),
  };
  const documentTarget = {
    addEventListener: vi.fn((name: string, listener: EventListener) => {
      documentListeners.set(name, listener);
    }),
    removeEventListener: vi.fn((name: string, listener: EventListener) => {
      if (documentListeners.get(name) === listener) documentListeners.delete(name);
    }),
  };
  vi.stubGlobal("window", windowTarget);
  vi.stubGlobal("document", documentTarget);
  return {documentListeners, documentTarget, windowListeners, windowTarget};
}

describe("preventCloseWhenChanged", () => {
  it("leaves browser and Astro navigation untouched while the page is clean", () => {
    const {documentListeners, windowListeners} = installEventTargets();
    preventCloseWhenChanged(() => false);
    const beforeUnload = {preventDefault: vi.fn(), returnValue: undefined};
    const beforePreparation = {preventDefault: vi.fn()};

    windowListeners.get("beforeunload")?.(beforeUnload as unknown as Event);
    documentListeners.get("astro:before-preparation")?.(
      beforePreparation as unknown as Event,
    );

    expect(beforeUnload.preventDefault).not.toHaveBeenCalled();
    expect(beforePreparation.preventDefault).not.toHaveBeenCalled();
  });

  it("delegates dirty Astro navigation to native beforeunload protection", () => {
    const {documentListeners, windowListeners} = installEventTargets();
    preventCloseWhenChanged(() => true);
    const beforeUnload = {preventDefault: vi.fn(), returnValue: undefined};
    const beforePreparation = {preventDefault: vi.fn()};

    documentListeners.get("astro:before-preparation")?.(
      beforePreparation as unknown as Event,
    );
    windowListeners.get("beforeunload")?.(beforeUnload as unknown as Event);

    expect(beforePreparation.preventDefault).toHaveBeenCalledOnce();
    expect(beforeUnload.preventDefault).toHaveBeenCalledOnce();
    expect(beforeUnload.returnValue).toBe("");
  });

  it("removes both listeners during island cleanup", () => {
    const {documentListeners, documentTarget, windowListeners, windowTarget} =
      installEventTargets();
    const cleanup = preventCloseWhenChanged(() => true);

    cleanup();

    expect(windowTarget.removeEventListener).toHaveBeenCalledOnce();
    expect(documentTarget.removeEventListener).toHaveBeenCalledOnce();
    expect(windowListeners.size).toBe(0);
    expect(documentListeners.size).toBe(0);
  });
});
