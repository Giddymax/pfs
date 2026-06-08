import { create } from "zustand";
import type { Profile } from "@/lib/types";

interface AuthState {
  profile: Profile | null;
  setProfile: (profile: Profile | null) => void;
  isAdmin: () => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  profile: null,
  setProfile: (profile) => set({ profile }),
  isAdmin: () => get().profile?.role === "admin",
}));
