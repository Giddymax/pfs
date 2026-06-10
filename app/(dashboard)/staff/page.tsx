import { redirect } from "next/navigation";
import { ShieldCheck, UserRound } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, EmptyState } from "@/components/ui";
import { StaffStatusToggle } from "@/components/staff-status-toggle";
import { AddStaffButton, EditStaffButton, DeleteStaffButton } from "@/components/staff-form";
import type { Profile } from "@/lib/types";

export default async function StaffPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single<Profile>();
  if (!profile || profile.role !== "admin") redirect("/");

  const { data: staff } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false })
    .returns<Profile[]>();

  return (
    <div>
      <PageHeader
        eyebrow="Administration"
        title="Staff accounts"
        description="Manage who has access to Prime Financial Service. Create new accounts, update names or roles, activate or deactivate login, or remove accounts entirely."
        action={<AddStaffButton />}
      />

      {!staff || staff.length === 0 ? (
        <EmptyState title="No staff accounts found" description="Staff and admin profiles will appear here once created." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-[#0033AA]/8 bg-white shadow-sm">
          <table className="w-full text-left text-[14px]">
            <thead>
              <tr className="border-b border-[#0033AA]/8 bg-[#0033AA]/[0.02] text-[11px] uppercase tracking-[0.1em] text-[#0A2240]/45">
                <th className="px-5 py-3 font-semibold">Name</th>
                <th className="px-5 py-3 font-semibold">Email</th>
                <th className="px-5 py-3 font-semibold">Role</th>
                <th className="px-5 py-3 font-semibold">Status</th>
                <th className="px-5 py-3 font-semibold">Joined</th>
                <th className="px-5 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#0033AA]/6">
              {staff.map((member) => (
                <tr key={member.id} className="transition-colors hover:bg-[#0033AA]/[0.025]">
                  <td className="px-5 py-3.5">
                    <span className="flex items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#0033AA]/10 bg-[#0033AA]/5 text-[#0033AA]/40">
                        <UserRound size={16} />
                      </span>
                      <span className="font-medium text-[#0A2240]">{member.full_name}</span>
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-[#0A2240]/55">{member.email}</td>
                  <td className="px-5 py-3.5">
                    <span className="inline-flex items-center gap-1.5 text-[#0A2240]/70">
                      {member.role === "admin" && <ShieldCheck size={14} className="text-[#0033AA]" />}
                      {member.role === "admin" ? "Administrator" : "Staff"}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wide ${
                        member.is_active
                          ? "border-[#1F6E4A]/25 bg-[#1F6E4A]/10 text-[#1F6E4A]"
                          : "border-[#0A2240]/15 bg-[#0A2240]/8 text-[#0A2240]/45"
                      }`}
                    >
                      {member.is_active ? "Active" : "Deactivated"}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-[#0A2240]/55">
                    {new Date(member.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1.5">
                      <StaffStatusToggle profileId={member.id} isActive={member.is_active} isSelf={member.id === profile.id} />
                      <EditStaffButton profileId={member.id} fullName={member.full_name} role={member.role} />
                      {member.id !== profile.id && (
                        <DeleteStaffButton profileId={member.id} fullName={member.full_name} />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
