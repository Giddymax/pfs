import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, ClientStatusBadge, EmptyState } from "@/components/ui";
import type { Client } from "@/lib/types";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const supabase = await createClient();

  let query = supabase.from("clients").select("*").order("created_at", { ascending: false });
  if (q && q.trim()) {
    const term = q.trim();
    query = query.or(`full_name.ilike.%${term}%,phone.ilike.%${term}%,client_code.ilike.%${term}%`);
  }

  const { data: clients } = await query.returns<Client[]>();

  return (
    <div>
      <PageHeader
        eyebrow="Clients"
        title="All clients"
        description="Search, review, and open a client's profile to manage their loans."
        action={
          <Link
            href="/clients/new"
            className="inline-flex items-center gap-2 rounded-md bg-[#0033AA] px-5 py-2.5 text-[13.5px] font-semibold text-[#FFFFFF] transition-colors hover:bg-[#002884]"
          >
            <Plus size={16} />
            Register client
          </Link>
        }
      />

      <form className="mb-6 max-w-sm">
        <div className="relative">
          <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#0033AA]/35" />
          <input
            type="text"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Search by name, phone, or client code…"
            className="w-full rounded-md border border-[#0033AA]/15 bg-white py-2.5 pl-10 pr-4 text-[14px] outline-none transition-colors placeholder:text-[#0A2240]/35 focus:border-[#0062E1]"
          />
        </div>
      </form>

      {!clients || clients.length === 0 ? (
        <EmptyState
          title={q ? "No clients match your search" : "No clients registered yet"}
          description={q ? "Try a different name, phone number or client code." : "Register your first client to start building their profile."}
          action={
            !q && (
              <Link href="/clients/new" className="inline-flex items-center gap-2 rounded-md bg-[#0033AA] px-5 py-2.5 text-[13.5px] font-semibold text-[#FFFFFF] hover:bg-[#002884]">
                <Plus size={15} /> Register client
              </Link>
            )
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-[#0033AA]/8 bg-white shadow-sm">
          <table className="w-full text-left text-[14px]">
            <thead>
              <tr className="border-b border-[#0033AA]/8 bg-[#0033AA]/[0.02] text-[11px] uppercase tracking-[0.1em] text-[#0A2240]/45">
                <th className="px-5 py-3 font-semibold">Client</th>
                <th className="px-5 py-3 font-semibold">Code</th>
                <th className="px-5 py-3 font-semibold">Phone</th>
                <th className="px-5 py-3 font-semibold">Occupation</th>
                <th className="px-5 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#0033AA]/6">
              {clients.map((client) => (
                <tr key={client.id} className="transition-colors hover:bg-[#0033AA]/[0.025]">
                  <td className="px-5 py-3.5">
                    <Link href={`/clients/${client.id}`} className="flex items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#0033AA]/10 bg-[#0033AA]/5 text-[12px] font-semibold text-[#0033AA]">
                        {client.photo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={client.photo_url} alt={client.full_name} className="h-full w-full object-cover" />
                        ) : (
                          initials(client.full_name)
                        )}
                      </span>
                      <span className="font-medium text-[#0A2240] hover:text-[#0033AA]">{client.full_name}</span>
                    </Link>
                  </td>
                  <td className="px-5 py-3.5 text-[#0A2240]/55">{client.client_code}</td>
                  <td className="px-5 py-3.5 text-[#0A2240]/55">{client.phone}</td>
                  <td className="px-5 py-3.5 text-[#0A2240]/55">{client.occupation ?? "—"}</td>
                  <td className="px-5 py-3.5">
                    <ClientStatusBadge status={client.status} />
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

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}
