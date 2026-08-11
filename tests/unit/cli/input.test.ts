import {describe, expect, it} from "vitest";

import {readJsonObjectInput} from "../../../packages/cli/src/http";

async function* chunks(...values: string[]) {
  for (const value of values) yield Buffer.from(value);
}

describe("microfeed CLI framed JSON input", () => {
  it("finishes after one complete object without waiting for EOF", async () => {
    let requestedAnotherChunk = false;
    async function* openStream() {
      yield Buffer.from('{"title":"Ready"}\n');
      requestedAnotherChunk = true;
      yield Buffer.from("should not be read");
    }

    await expect(readJsonObjectInput("-", openStream()))
      .resolves.toBe('{"title":"Ready"}');
    expect(requestedAnotherChunk).toBe(false);
  });

  it("handles nested structures, split strings, escapes, and braces in strings", async () => {
    const input = '{"content_html":"<p>{\\"ok\\"}</p>","nested":[{"a":1}]}';
    await expect(readJsonObjectInput("-", chunks(
      input.slice(0, 9),
      input.slice(9, 24),
      input.slice(24),
      "  \n",
    ))).resolves.toBe(input);
  });

  it("decodes UTF-8 characters split across input chunks", async () => {
    const input = '{"title":"发布"}';
    const encoded = new TextEncoder().encode(input);
    async function* splitUtf8() {
      yield encoded.slice(0, 11);
      yield encoded.slice(11, 12);
      yield encoded.slice(12);
    }

    await expect(readJsonObjectInput("-", splitUtf8())).resolves.toBe(input);
  });

  it("rejects non-objects, mismatched delimiters, trailing data, and incomplete input", async () => {
    await expect(readJsonObjectInput("-", chunks("[]")))
      .rejects.toThrow("JSON object");
    await expect(readJsonObjectInput("-", chunks('{"a":]}')))
      .rejects.toThrow("JSON object");
    await expect(readJsonObjectInput("-", chunks('{"a":}')))
      .rejects.toThrow("valid JSON object");
    await expect(readJsonObjectInput("-", chunks('{"a":1} extra')))
      .rejects.toThrow("exactly one JSON object");
    await expect(readJsonObjectInput("-", chunks('{"a":1')))
      .rejects.toThrow("ended before one complete JSON object");
  });
});
