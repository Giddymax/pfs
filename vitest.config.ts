import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    // Integration tests sign in over the network and call real RPCs —
    // slower than a pure unit test, give them room.
    testTimeout: 20_000,
    hookTimeout: 20_000,
    // RPC/integration tests share ZZTEST fixture rows on one real project;
    // running files in parallel risks two tests racing over the same
    // account balance. Sequential is slower but correct.
    fileParallelism: false,
  },
});
