import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(__dirname),
  },
  transpilePackages: [
    "sonner",
    "lucide-react",
    "next-themes",
    "@supabase/supabase-js",
    "@supabase/ssr",
  ],
};

export default nextConfig;
