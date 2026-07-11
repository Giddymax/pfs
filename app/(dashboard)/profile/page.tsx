"use client";

import { useRef, useState, useEffect, type FormEvent } from "react";
import { Camera, Eye, EyeOff, KeyRound, Loader2, ShieldCheck, UserRound, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { PageHeader, Card } from "@/components/ui";
import type { Profile } from "@/lib/types";

export default function ProfilePage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single<Profile>();
      if (data) {
        setProfile(data);
        setPhotoPreview(data.photo_url);
      }
      setLoading(false);
    }
    load();
  }, []);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError("Photo must be under 5 MB.");
      return;
    }

    setError(null);
    setSuccess(false);

    const reader = new FileReader();
    reader.onload = () => setPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);

    uploadPhoto(file);
  }

  async function uploadPhoto(file: File) {
    setUploading(true);
    setError(null);
    setSuccess(false);

    try {
      const fd = new FormData();
      fd.append("photo", file);
      const res = await fetch("/api/profile/photo", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Upload failed");
      setPhotoPreview(json.photo_url);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function clearPhoto() {
    setPhotoPreview(profile?.photo_url ?? null);
    setSuccess(false);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin text-[#0033AA]/40" />
      </div>
    );
  }

  if (!profile) return null;

  // Render the self-service password change card (stateful, extracted below)
  function ChangePasswordCard() {
    const [newPw, setNewPw] = useState("");
    const [confirmPw, setConfirmPw] = useState("");
    const [showNew, setShowNew] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [saving, setSaving] = useState(false);
    const [pwError, setPwError] = useState<string | null>(null);
    const [pwSuccess, setPwSuccess] = useState(false);

    async function handleSubmit(e: FormEvent) {
      e.preventDefault();
      setPwError(null);
      setPwSuccess(false);

      if (newPw.length < 8) {
        setPwError("Password must be at least 8 characters.");
        return;
      }
      if (newPw !== confirmPw) {
        setPwError("Passwords do not match.");
        return;
      }

      setSaving(true);
      try {
        const res = await fetch("/api/profile/password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password: newPw }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Failed to change password.");
        setPwSuccess(true);
        setNewPw("");
        setConfirmPw("");
      } catch (err) {
        setPwError(err instanceof Error ? err.message : "Failed to change password.");
      } finally {
        setSaving(false);
      }
    }

    return (
      <Card className="mt-6">
        <div className="flex items-center gap-2 border-b border-[#0033AA]/8 px-5 py-4">
          <KeyRound size={15} className="text-[#0033AA]/60" />
          <h2 className="text-[15px] font-semibold text-[#0033AA]">Change password</h2>
        </div>
        <form onSubmit={handleSubmit} className="px-5 py-5 space-y-4">
          {pwError && (
            <div className="rounded-md border border-[#B3432B]/25 bg-[#B3432B]/[0.06] px-3.5 py-2.5 text-[12.5px] text-[#963522]">
              {pwError}
            </div>
          )}
          {pwSuccess && (
            <div className="rounded-md border border-[#1F6E4A]/25 bg-[#1F6E4A]/[0.06] px-3.5 py-2.5 text-[12.5px] text-[#1F6E4A]">
              Password updated successfully.
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-[0.1em] text-[#0A2240]/50">
              New password
            </label>
            <div className="relative">
              <input
                type={showNew ? "text" : "password"}
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                minLength={8}
                required
                className="w-full rounded-md border border-[#0A2240]/15 px-3.5 py-2.5 pr-10 text-[13.5px] text-[#0A2240] outline-none transition-colors focus:border-[#0033AA] focus:ring-1 focus:ring-[#0033AA]/20"
              />
              <button
                type="button"
                onClick={() => setShowNew((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#0A2240]/35 hover:text-[#0A2240]/70"
                aria-label={showNew ? "Hide password" : "Show password"}
              >
                {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            <p className="mt-1 text-[11.5px] text-[#0A2240]/40">Minimum 8 characters.</p>
          </div>

          <div>
            <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-[0.1em] text-[#0A2240]/50">
              Confirm new password
            </label>
            <div className="relative">
              <input
                type={showConfirm ? "text" : "password"}
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                required
                className="w-full rounded-md border border-[#0A2240]/15 px-3.5 py-2.5 pr-10 text-[13.5px] text-[#0A2240] outline-none transition-colors focus:border-[#0033AA] focus:ring-1 focus:ring-[#0033AA]/20"
              />
              <button
                type="button"
                onClick={() => setShowConfirm((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#0A2240]/35 hover:text-[#0A2240]/70"
                aria-label={showConfirm ? "Hide password" : "Show password"}
              >
                {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-md bg-[#0033AA] px-5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#002884] disabled:opacity-60"
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              {saving ? "Saving…" : "Update password"}
            </button>
          </div>
        </form>
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        eyebrow="Account"
        title="My Profile"
        description="Update your profile photo. This photo is shown in the sidebar and visible to other staff."
      />

      <Card>
        <div className="border-b border-[#0033AA]/8 px-5 py-4">
          <h2 className="text-[15px] font-semibold text-[#0033AA]">Profile photo</h2>
        </div>
        <div className="px-5 py-6">
          <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
            <div className="relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-[#0033AA]/20 bg-[#0033AA]/[0.03] sm:h-28 sm:w-28">
              {photoPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photoPreview}
                  alt={profile.full_name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <UserRound size={36} className="text-[#0033AA]/25" />
              )}
              {uploading && (
                <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40">
                  <Loader2 size={20} className="animate-spin text-white" />
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="inline-flex items-center gap-2 rounded-md border border-[#0033AA]/20 px-4 py-2 text-[13px] font-medium text-[#0033AA] transition-colors hover:bg-[#0033AA]/5 disabled:opacity-60"
                >
                  <Camera size={15} />
                  {photoPreview ? "Change photo" : "Upload photo"}
                </button>
                {photoPreview && !uploading && (
                  <button
                    type="button"
                    onClick={clearPhoto}
                    className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-[13px] font-medium text-[#0A2240]/45 transition-colors hover:text-[#963522]"
                  >
                    <X size={14} />
                    Reset
                  </button>
                )}
              </div>
              <p className="text-[12px] text-[#0A2240]/45">
                JPG or PNG, clear face photo. Max 5 MB.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png, image/jpeg"
                aria-label="Upload profile photo"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
          </div>

          {error && (
            <div className="mt-4 rounded-md border border-[#B3432B]/25 bg-[#B3432B]/[0.06] px-3.5 py-2.5 text-[12.5px] text-[#963522]">
              {error}
            </div>
          )}
          {success && (
            <div className="mt-4 rounded-md border border-[#1F6E4A]/25 bg-[#1F6E4A]/[0.06] px-3.5 py-2.5 text-[12.5px] text-[#1F6E4A]">
              Photo updated successfully.
            </div>
          )}
        </div>
      </Card>

      <Card className="mt-6">
        <div className="border-b border-[#0033AA]/8 px-5 py-4">
          <h2 className="text-[15px] font-semibold text-[#0033AA]">Account details</h2>
        </div>
        <div className="space-y-3 px-5 py-5">
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-[#0A2240]/55">Full name</span>
            <span className="text-[13.5px] font-medium text-[#0A2240]">{profile.full_name}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-[#0A2240]/55">Email</span>
            <span className="text-[13.5px] font-medium text-[#0A2240]">{profile.email}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-[#0A2240]/55">Role</span>
            <span className="inline-flex items-center gap-1 text-[13.5px] font-medium text-[#0A2240]">
              {profile.role === "admin" && <ShieldCheck size={13} className="text-[#0033AA]" />}
              {profile.role === "admin" ? "Administrator" : "Staff"}
            </span>
          </div>
        </div>
      </Card>

      <ChangePasswordCard />
    </div>
  );
}
