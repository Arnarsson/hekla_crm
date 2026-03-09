"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, Plus, Mail, Phone, ExternalLink, Globe, MoreHorizontal, CheckCircle, Trash2, Tag } from "lucide-react";
import type { Contact } from "@/lib/types";

const TYPE_COLORS: Record<string, string> = {
  client: "bg-green-900/30 text-green-400",
  partner: "bg-blue-900/30 text-blue-400",
  gatekeeper: "bg-yellow-900/30 text-yellow-400",
  referral: "bg-purple-900/30 text-purple-400",
  competitor: "bg-red-900/30 text-red-400",
  internal: "bg-zinc-800 text-zinc-400",
};

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<"name" | "strength" | "last_interaction" | "trust">("last_interaction");
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/contacts").then((r) => r.json()).then(setContacts).catch(console.error);
  }, []);

  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 2000); return () => clearTimeout(t); }, [toast]);
  const flash = (msg: string) => setToast(msg);

  const logInteraction = async (c: Contact, type: string) => {
    await fetch(`/api/contacts/${c.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ last_interaction: new Date().toISOString() }) });
    await fetch(`/api/contacts/${c.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ _action: "add_note", text: `Logged ${type}` }) });
    setContacts((cs) => cs.map((x) => x.id === c.id ? { ...x, last_interaction: new Date().toISOString() } : x));
    flash(`Logged ${type} with ${c.name}`);
  };

  const deleteContact = async (id: string) => {
    await fetch(`/api/contacts/${id}`, { method: "DELETE" });
    setContacts((cs) => cs.filter((c) => c.id !== id));
  };

  const filtered = contacts.filter((c) => {
    const matchSearch = !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.organization.toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === "all" || c.relationship_type === typeFilter;
    return matchSearch && matchType;
  }).sort((a, b) => {
    if (sortBy === "name") return a.name.localeCompare(b.name);
    if (sortBy === "strength") return b.relationship_strength - a.relationship_strength;
    if (sortBy === "trust") return (b.trust || 3) - (a.trust || 3);
    return new Date(b.last_interaction).getTime() - new Date(a.last_interaction).getTime();
  });

  const toggleSelect = (id: string) => {
    setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const selectAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((c) => c.id)));
  };

  const bulkDelete = async () => {
    if (!confirm(`Delete ${selected.size} contacts?`)) return;
    await Promise.all(Array.from(selected).map((id) => fetch(`/api/contacts/${id}`, { method: "DELETE" })));
    setContacts((cs) => cs.filter((c) => !selected.has(c.id)));
    setSelected(new Set());
  };

  const now = new Date();
  const types = ["all", "client", "partner", "gatekeeper", "referral", "competitor", "internal"];

  return (
    <div className="page-container">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Contacts</h1>
          <p className="text-xs text-zinc-500 mt-0.5">{contacts.length} relationships tracked</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 px-3 py-2 rounded-lg btn btn-primary btn-xs">
          <Plus size={14} /> Add Contact
        </button>
      </div>

      {showForm && <ContactForm onSave={(c) => { setContacts([c, ...contacts]); setShowForm(false); }} onCancel={() => setShowForm(false)} />}

      {/* Filters + Sort */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input type="text" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-9 pr-3 py-1.5 input text-xs" />
        </div>
        <div className="flex gap-0.5">
          {types.map((t) => (
            <button key={t} onClick={() => setTypeFilter(t)} className={`px-2.5 py-1 rounded-lg text-[10px] capitalize transition-colors ${typeFilter === t ? "bg-brand-600/20 text-brand-400" : "text-zinc-500 hover:text-zinc-300"}`}>
              {t}
            </button>
          ))}
        </div>
        <div className="ml-auto flex gap-0.5">
          {(["last_interaction", "strength", "trust", "name"] as const).map((s) => (
            <button key={s} onClick={() => setSortBy(s)} className={`px-2.5 py-1 rounded-lg text-[10px] capitalize transition-colors ${sortBy === s ? "bg-zinc-700 text-zinc-200" : "text-zinc-600 hover:text-zinc-400"}`}>
              {s === "last_interaction" ? "Recent" : s}
            </button>
          ))}
        </div>
      </div>

      {/* Batch actions */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 p-2 rounded-lg bg-zinc-800/70 border border-zinc-700">
          <span className="text-xs text-zinc-400">{selected.size} selected</span>
          <button onClick={bulkDelete} className="text-[10px] px-2 py-1 rounded bg-red-900/30 text-red-400 hover:bg-red-900/50 transition-colors flex items-center gap-1">
            <Trash2 size={10} /> Delete
          </button>
          <button onClick={() => setSelected(new Set())} className="text-[10px] text-zinc-500 hover:text-zinc-300 ml-auto">Clear</button>
        </div>
      )}

      {/* Table */}
      <div className="surface overflow-hidden">
        <table className="data-table">
          <thead>
            <tr>
              <th className="w-8"><input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0} onChange={selectAll} className="accent-[var(--accent)]" /></th>
              <th>Contact</th>
              <th>Type</th>
              <th>Trust</th>
              <th>Strength</th>
              <th>Status</th>
              <th>Last Seen</th>
              <th className="w-24">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => {
              const days = Math.floor((now.getTime() - new Date(c.last_interaction).getTime()) / 86400000);
              const isStale = days > 14;
              return (
                <tr key={c.id} className={isStale ? "bg-red-950/10" : ""}>
                  <td><input type="checkbox" checked={selected.has(c.id)} onChange={() => toggleSelect(c.id)} className="accent-[var(--accent)]" /></td>
                  <td>
                    <Link href={`/contacts/${c.id}`} className="text-white hover:text-brand-400 transition-colors font-medium text-sm">{c.name}</Link>
                    <span className="block text-[10px] text-zinc-600">{c.organization}{c.role ? ` · ${c.role}` : ""}</span>
                  </td>
                  <td><span className={`text-[10px] px-2 py-0.5 rounded-full ${TYPE_COLORS[c.relationship_type] || "bg-zinc-800 text-zinc-400"}`}>{c.relationship_type}</span></td>
                  <td>
                    <span className="text-xs text-amber-400">{"★".repeat(c.trust || 3)}<span className="text-zinc-700">{"★".repeat(5 - (c.trust || 3))}</span></span>
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="w-12 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${c.relationship_strength}%`, backgroundColor: c.relationship_strength > 60 ? "#22c55e" : c.relationship_strength > 30 ? "#eab308" : "#ef4444" }} />
                      </div>
                      <span className="text-[10px] text-zinc-500 w-6">{c.relationship_strength}</span>
                    </div>
                  </td>
                  <td>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${c.engagement_status === "active" ? "bg-green-900/30 text-green-400" : c.engagement_status === "warming" ? "bg-cyan-900/30 text-cyan-400" : c.engagement_status === "cooling" ? "bg-orange-900/30 text-orange-400" : "bg-red-900/30 text-red-400"}`}>
                      {(c.engagement_status || "unknown").replace("_", " ")}
                    </span>
                  </td>
                  <td>
                    <span className={`text-[10px] ${isStale ? "text-red-400" : "text-zinc-500"}`}>
                      {days === 0 ? "Today" : `${days}d ago`}
                    </span>
                  </td>
                  <td>
                    <div className="flex gap-0.5">
                      {c.email && (
                        <a href={`mailto:${c.email}`} onClick={() => logInteraction(c, "email")} className="w-6 h-6 rounded bg-zinc-800 hover:bg-brand-600/20 hover:text-brand-400 text-zinc-600 flex items-center justify-center transition-colors" title={`Email ${c.email}`}>
                          <Mail size={11} />
                        </a>
                      )}
                      {c.phone && (
                        <a href={`tel:${c.phone}`} onClick={() => logInteraction(c, "call")} className="w-6 h-6 rounded bg-zinc-800 hover:bg-green-600/20 hover:text-green-400 text-zinc-600 flex items-center justify-center transition-colors" title={`Call ${c.phone}`}>
                          <Phone size={11} />
                        </a>
                      )}
                      {c.linkedin_url && (
                        <a href={c.linkedin_url} target="_blank" rel="noopener noreferrer" className="w-6 h-6 rounded bg-zinc-800 hover:bg-blue-600/20 hover:text-blue-400 text-zinc-600 flex items-center justify-center transition-colors" title="LinkedIn">
                          <Globe size={11} />
                        </a>
                      )}
                      <Link href={`/contacts/${c.id}`} className="w-6 h-6 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-600 flex items-center justify-center transition-colors" title="Detail">
                        <ExternalLink size={11} />
                      </Link>
                      <button onClick={() => deleteContact(c.id)} className="w-6 h-6 rounded bg-zinc-800 hover:bg-red-900/30 text-zinc-700 hover:text-red-400 flex items-center justify-center transition-colors" title="Delete">
                        <Trash2 size={10} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={8} className="text-center text-zinc-600 py-6 text-xs">No contacts found</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

function ContactForm({ onSave, onCancel }: { onSave: (c: Contact) => void; onCancel: () => void }) {
  const [form, setForm] = useState({ name: "", organization: "", role: "", relationship_type: "client", email: "", phone: "", linkedin_url: "" });

  const handleSubmit = async () => {
    if (!form.name.trim()) return;
    const res = await fetch("/api/contacts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    if (res.ok) { const c = await res.json(); onSave(c); }
  };

  return (
    <div className="surface p-4 space-y-3">
      <h3 className="text-xs font-semibold text-white">New Contact</h3>
      <div className="grid grid-cols-3 gap-3">
        <input placeholder="Name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="px-3 py-1.5 input text-xs" />
        <input placeholder="Organization" value={form.organization} onChange={(e) => setForm({ ...form, organization: e.target.value })} className="px-3 py-1.5 input text-xs" />
        <input placeholder="Role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="px-3 py-1.5 input text-xs" />
        <select value={form.relationship_type} onChange={(e) => setForm({ ...form, relationship_type: e.target.value })} className="px-3 py-1.5 input text-xs">
          <option value="client">Client</option><option value="partner">Partner</option><option value="gatekeeper">Gatekeeper</option><option value="referral">Referral</option><option value="competitor">Competitor</option><option value="internal">Internal</option>
        </select>
        <input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="px-3 py-1.5 input text-xs" />
        <input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="px-3 py-1.5 input text-xs" />
      </div>
      <div className="flex gap-2">
        <button onClick={handleSubmit} className="px-3 py-1.5 btn btn-primary btn-xs rounded-lg transition-colors">Save</button>
        <button onClick={onCancel} className="px-3 py-1.5 btn btn-surface btn-xs rounded-lg transition-colors">Cancel</button>
      </div>
    </div>
  );
}
