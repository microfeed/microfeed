import {beforeEach, describe, expect, it, vi} from "vitest";

const {toast} = vi.hoisted(() => ({
  toast: {
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock("sonner", () => ({toast}));

import {showToast} from "@/client/ToastUtils";

describe("showToast", () => {
  beforeEach(() => vi.clearAllMocks());

  it("keeps success feedback visible long enough to notice", () => {
    showToast("Updated!", "success");

    expect(toast.success).toHaveBeenCalledWith("Updated!", {duration: 3000});
  });

  it("keeps error feedback visible longer than success feedback", () => {
    showToast("Failed. Please try again.", "error");

    expect(toast.error).toHaveBeenCalledWith("Failed. Please try again.", {
      duration: 6000,
    });
  });

  it("keeps no-change guidance visible", () => {
    showToast("No changes to save.", "info");

    expect(toast.info).toHaveBeenCalledWith("No changes to save.", {
      duration: 4000,
    });
  });

  it("preserves an explicitly requested duration", () => {
    showToast("Custom duration", "info", 2000);

    expect(toast.info).toHaveBeenCalledWith("Custom duration", {duration: 2000});
  });
});
