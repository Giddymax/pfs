import { config } from "dotenv";
import { resolve } from "path";

// Loaded once for the whole Vitest run (see vitest.config.ts's setupFiles).
config({ path: resolve(__dirname, "../.env.test") });
