import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("photo") as File | null;

  if (!file || !(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "No photo provided" }, { status: 400 });
  }

  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: "Photo must be under 5 MB" }, { status: 400 });
  }

  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${user.id}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("profile-photos")
    .upload(path, file, { upsert: true });

  if (uploadError) {
    return NextResponse.json({ error: "Upload failed: " + uploadError.message }, { status: 400 });
  }

  const { data: publicUrlData } = supabase.storage.from("profile-photos").getPublicUrl(path);
  const photo_url = `${publicUrlData.publicUrl}?t=${Date.now()}`;

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ photo_url })
    .eq("id", user.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 400 });
  }

  return NextResponse.json({ photo_url });
}
