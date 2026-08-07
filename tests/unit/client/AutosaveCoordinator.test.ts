import {afterEach, describe, expect, it, vi} from "vitest";

import AutosaveCoordinator, {
  type AutosaveState,
} from "@/client/AutosaveCoordinator";

afterEach(() => {
  vi.useRealTimers();
});

function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return {promise, reject, resolve};
}

function setup(save = vi.fn(async (_snapshot: {value: number}) => {})) {
  let value = 0;
  const states: AutosaveState[] = [];
  const errors: unknown[] = [];
  const coordinator = new AutosaveCoordinator({
    getSnapshot: () => ({value}),
    onError: (error) => errors.push(error),
    onStateChange: (state) => states.push(state),
    save,
  });
  return {
    coordinator,
    errors,
    setValue(nextValue: number) {
      value = nextValue;
    },
    states,
  };
}

describe("AutosaveCoordinator", () => {
  it("coalesces rapid edits into one debounced snapshot", async () => {
    vi.useFakeTimers();
    const save = vi.fn(async (_snapshot: {value: number}) => {});
    const {coordinator, setValue, states} = setup(save);

    setValue(1);
    coordinator.markChanged();
    await vi.advanceTimersByTimeAsync(600);
    setValue(2);
    coordinator.markChanged();
    await vi.advanceTimersByTimeAsync(999);

    expect(save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(save).toHaveBeenCalledOnce();
    expect(save).toHaveBeenCalledWith({value: 2});
    expect(states.at(-1)).toEqual({dirty: false, phase: "saved"});
  });

  it("flushes immediately and serializes a newer edit behind an active save", async () => {
    vi.useFakeTimers();
    const first = deferred();
    const second = deferred();
    const save = vi.fn()
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise);
    const {coordinator, setValue} = setup(save);

    setValue(1);
    coordinator.markChanged({immediate: true});
    expect(save).toHaveBeenCalledWith({value: 1});

    setValue(2);
    coordinator.markChanged();
    await vi.advanceTimersByTimeAsync(1000);
    expect(save).toHaveBeenCalledOnce();

    first.resolve();
    await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(2));
    expect(save).toHaveBeenLastCalledWith({value: 2});
    second.resolve();
    await vi.waitFor(() => expect(coordinator.hasUnsavedChanges()).toBe(false));
  });

  it("retains failed changes and saves them when manually retried", async () => {
    const failure = new Error("offline");
    const save = vi.fn()
      .mockRejectedValueOnce(failure)
      .mockResolvedValueOnce(undefined);
    const {coordinator, errors, setValue, states} = setup(save);

    setValue(1);
    coordinator.markChanged();
    await expect(coordinator.flush()).resolves.toBe(false);
    expect(coordinator.hasUnsavedChanges()).toBe(true);
    expect(errors).toEqual([failure]);
    expect(states.at(-1)).toEqual({dirty: true, phase: "error"});

    await expect(coordinator.flush()).resolves.toBe(true);
    expect(coordinator.hasUnsavedChanges()).toBe(false);
    expect(states.at(-1)).toEqual({dirty: false, phase: "saved"});
  });

  it("cancels pending work when disposed", async () => {
    vi.useFakeTimers();
    const save = vi.fn(async (_snapshot: {value: number}) => {});
    const {coordinator, setValue} = setup(save);

    setValue(1);
    coordinator.markChanged();
    coordinator.dispose();
    await vi.runAllTimersAsync();

    expect(save).not.toHaveBeenCalled();
    await expect(coordinator.flush()).resolves.toBe(false);
  });

  it("suppresses errors from an active save after disposal", async () => {
    const active = deferred();
    const save = vi.fn(() => active.promise);
    const {coordinator, errors, setValue, states} = setup(save);

    setValue(1);
    coordinator.markChanged({immediate: true});
    expect(save).toHaveBeenCalledOnce();
    const completion = coordinator.flush();
    coordinator.dispose();
    active.reject(new Error("late failure"));
    await expect(completion).resolves.toBe(false);

    expect(errors).toEqual([]);
    expect(states).not.toContainEqual({dirty: true, phase: "error"});
  });
});
