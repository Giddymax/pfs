import { redirect } from "next/navigation";
import { ShieldCheck, UserRound } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, EmptyState } from "@/components/ui";
import { TableFilter, type FilterOption } from "@/components/table-filter";
import { StaffStatusToggle } from "@/components/staff-status-toggle";
import { AddStaffButton, EditStaffButton, DeleteStaffButton } from "@/components/staff-form";
import type { Profile } from "@/lib/types";

const ROLE_OPTIONS: FilterOption[] = [
  { value: "admin", label: "Administrator" },
  { value: "staff", label: "Staff" },
];

const ACTIVE_OPTIONS: FilterOption[] = [
  { value: "active", label: "Active" },
  { value: "deactivated", label: "Deactivated" },
];

export default async function StaffPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string; active?: string }>;
}) {
  const { role, active } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single<Profile>();
  if (!profile || profile.role !== "admin") redirect("/");

  const qs = new URLSearchParams({
    ...(role ? { role } : {}),
    ...(active ? { active } : {}),
  }).toString();

  let query = supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });
  if (role) query = query.eq("role", role);
  if (active === "active") query = query.eq("is_active", true);
  if (active === "deactivated") query = query.eq("is_active", false);

  const { data: staff } = await query.returns<Profile[]>();

  return (
    <div>
      <PageHeader
        eyebrow="Administration"
        title="Staff accounts"
        description="Manage who has access to Prime Financial Service. Create new accounts, update names or roles, activate or deactivate login, or remove accounts entirely."
        action={<AddStaffButton />}
      />

      {/* Mobile filter controls */}
      <div className="mb-4 flex flex-wrap items-center gap-3 lg:hidden">
        <span className="text-[11.5px] font-medium text-[#0A2240]/40">Filter:</span>
        <TableFilter param="role" label="Role" options={ROLE_OPTIONS} current={role} qs={qs} />
        <TableFilter param="active" label="Status" options={ACTIVE_OPTIONS} current={active} qs={qs} />
      </div>

      {!staff || staff.length === 0 ? (
        <EmptyState
          title={role || active ? "No staff match this filter" : "No staff accounts found"}
          description={role || active ? "Try adjusting the filters." : "Staff and admin profiles will appear here once created."}
        />
      ) : (
        <>
          {/* ── Mobile card list (hidden on lg+) ─────────────────────── */}
          <ul className="space-y-3 lg:hidden">
            {staff.map((member) => (
              <li key={member.id} className="rounded-xl border border-[#1D3461]/8 bg-white shadow-sm">
                <div className="px-4 py-3.5">
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#1D3461]/10 bg-[#1D3461]/5 text-[#1D3461]/40">
                      <UserRound size={18} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[14px] font-semibold text-[#0A2240]">{member.full_name}</p>
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10.5px] font-semibold tracking-wide ${
                          member.is_active
                            ? "border-[#1F6E4A]/25 bg-[#1F6E4A]/10 text-[#1F6E4A]"
                            : "border-[#0A2240]/15 bg-[#0A2240]/8 text-[#0A2240]/45"
                        }`}>
                          {member.is_active ? "Active" : "Deactivated"}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-[12px] text-[#0A2240]/50">{member.email}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-3 text-[12px] text-[#0A2240]/55">
                        <span className="inline-flex items-center gap-1">
                          {member.role === "admin" && <ShieldCheck size={12} className="text-[#1D3461]" />}
                          {member.role === "admin" ? "Administrator" : "Staff"}
                        </span>
                        <span>
                          Joined {new Date(member.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[#1D3461]/6 pt-3">
                    <StaffStatusToggle profileId={member.id} isActive={member.is_active} isSelf={member.id === profile.id} />
                    <EditStaffButton profileId={member.id} fullName={member.full_name} role={member.role} />
                    {member.id !== profile.id && (
                      <DeleteStaffButton profileId={member.id} fullName={member.full_name} />
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>

          {/* ── Desktop table (hidden on mobile) ─────────────────────── */}
          <div className="hidden overflow-hidden rounded-xl border border-[#1D3461]/8 bg-white shadow-sm lg:block">
            <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-[14px]">
              <thead>
                <tr className="border-b border-[#1D3461]/8 bg-[#1D3461]/[0.02] text-[11px] uppercase tracking-[0.1em] text-[#0A2240]/45">
                  <th className="px-5 py-3 font-semibold">Name</th>
                  <th className="px-5 py-3 font-semibold">Email</th>
                  <th aria-label="Role" className="px-5 py-3 font-semibold">
                    <TableFilter param="role" label="Role" options={ROLE_OPTIONS} current={role} qs={qs} />
                  </th>
                  <th aria-label="Status" className="px-5 py-3 font-semibold">
                    <TableFilter param="active" label="Status" options={ACTIVE_OPTIONS} current={active} qs={qs} />
                  </th>
                  <th className="px-5 py-3 font-semibold">Joined</th>
                  <th className="px-5 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1D3461]/6">
                {staff.map((member) => (
                  <tr key={member.id} className="transition-colors hover:bg-[#1D3461]/[0.025]">
                    <td className="px-5 py-3.5">
                      <span className="flex items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#1D3461]/10 bg-[#1D3461]/5 text-[#1D3461]/40">
                          <UserRound size={16} />
                        </span>
                        <span className="font-medium text-[#0A2240]">{member.full_name}</span>
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-[#0A2240]/55">{member.email}</td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center gap-1.5 text-[#0A2240]/70">
                        {member.role === "admin" && <ShieldCheck size={14} className="text-[#1D3461]" />}
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
          </div>
        </>
      )}
    </div>
  );
}
