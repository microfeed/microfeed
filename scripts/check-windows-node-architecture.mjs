if (process.platform === "win32" && process.arch !== "x64") {
  process.stderr.write(
    "microfeed: Windows development requires the x64 build of Node.js " +
      "because Cloudflare's local runtime does not provide a native Windows " +
      `${process.arch} executable. Install x64 Node.js from ` +
      "https://nodejs.org/, verify `node -p \"process.arch\"` prints `x64`, " +
      "then rerun the same command.\n",
  );
  process.exitCode = 1;
}
