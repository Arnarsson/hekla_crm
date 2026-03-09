"use client";

import { useEffect, useState } from "react";
import { Users, Plus, Trash2, RefreshCw, Copy, Shield } from "lucide-react";

interface Partner {
  id: string;
  name: string;
  email: string;
  token: string;
  role: "viewer" | "contributor";
  created_at: string;
  last_login?: string;
}

interface TeamUser {
  id: string;
  name: string;
  email: string;
  role: "admin";
  created_at: string;
  last_login?: string;
}

export default function SettingsPage() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [teamUsers, setTeamUsers] = useState<TeamUser[]>([]);
  const [showPartnerForm, setShowPartnerForm] = useState(false);
  const [showUserForm, setShowUserForm] = useState(false);
  const [partnerForm, setPartnerForm] = useState({ name: "", email: "", role: "viewer" });
  const [userForm, setUserForm] = useState({ name: "", email: "", password: "" });
  const [toast, setToast] = useState<string | null>(null);
  const [newToken, setNewToken] = useState<string | null>(null);

  const loadPartners = () => { fetch("/api/partners").then((r) => r.json()).then(setPartners).catch(console.error); };
  const loadUsers = () => { fetch("/api/users").then((r) => r.json()).then(setTeamUsers).catch(console.error); };
  useEffect(() => { loadPartners(); loadUsers(); }, []);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 3000); return () => clearTimeout(t); }, [toast]);

  const flash = (msg: string) => setToast(msg);

  // Team member actions
  const handleCreateUser = async () => {
    if (!userForm.name || !userForm.email || !userForm.password) return;
    const res = await fetch("/api/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(userForm) });
    if (res.ok) {
      setShowUserForm(false);
      setUserForm({ name: "", email: "", password: "" });
      loadUsers();
      flash(`Team member created: ${userForm.name}`);
    } else {
      const data = await res.json();
      flash(`Error: ${data.error}`);
    }
  };

  const handleDeleteUser = async (id: string, name: string) => {
    if (!confirm(`Remove team member ${name}? They won't be able to log in.`)) return;
    await fetch(`/api/users?id=${id}`, { method: "DELETE" });
    loadUsers();
    flash(`Removed: ${name}`);
  };

  // Partner actions
  const handleCreatePartner = async () => {
    if (!partnerForm.name || !partnerForm.email) return;
    const res = await fetch("/api/partners", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(partnerForm) });
    if (res.ok) {
      const partner = await res.json();
      setNewToken(partner.token);
      setShowPartnerForm(false);
      setPartnerForm({ name: "", email: "", role: "viewer" });
      loadPartners();
      flash(`Partner created: ${partner.name}`);
    }
  };

  const handleDeletePartner = async (id: string, name: string) => {
    if (!confirm(`Remove partner ${name}?`)) return;
    await fetch(`/api/partners?id=${id}`, { method: "DELETE" });
    loadPartners();
    flash(`Removed: ${name}`);
  };

  const handleRegenerate = async (id: string) => {
    const res = await fetch("/api/partners", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    if (res.ok) {
      const partner = await res.json();
      setNewToken(partner.token);
      loadPartners();
      flash("Token regenerated");
    }
  };

  const copyLink = (token: string) => {
    const url = `${window.location.origin}/shared?token=${token}`;
    navigator.clipboard.writeText(url);
    flash("Share link copied");
  };

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">Manage team members and partner access</p>
      </div>

      <div className="space-y-5">
        {/* Team Members */}
        <div className="surface p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-semibold uppercase tracking-widest flex items-center gap-2" style={{ color: "var(--text-muted)" }}>
              <Shield size={12} /> Team Members
            </h2>
            <button onClick={() => setShowUserForm(!showUserForm)} className="btn btn-primary btn-xs flex items-center gap-1.5">
              <Plus size={12} /> Add Member
            </button>
          </div>

          {showUserForm && (
            <div className="mb-4 p-3 rounded-lg border space-y-2" style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
              <div className="grid grid-cols-3 gap-2">
                <input placeholder="Name" value={userForm.name} onChange={(e) => setUserForm({ ...userForm, name: e.target.value })} className="input text-xs" />
                <input placeholder="Email" type="email" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} className="input text-xs" />
                <input placeholder="Password" type="password" value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} className="input text-xs" />
              </div>
              <div className="flex gap-2">
                <button onClick={handleCreateUser} className="btn btn-primary btn-xs">Create</button>
                <button onClick={() => setShowUserForm(false)} className="btn btn-surface btn-xs">Cancel</button>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            {teamUsers.length === 0 ? (
              <p className="text-xs py-4 text-center" style={{ color: "var(--text-muted)" }}>No team members yet. Add cofounders so they can log in with their own email.</p>
            ) : teamUsers.map((u) => (
              <div key={u.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-white/5 group transition-colors">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-medium uppercase" style={{ background: "var(--accent)", color: "var(--bg)" }}>
                  {u.name.slice(0, 2)}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>{u.name}</span>
                  <div className="flex items-center gap-2 text-[10px]" style={{ color: "var(--text-muted)" }}>
                    <span>{u.email}</span>
                    <span className="uppercase text-[9px] font-medium" style={{ color: "var(--accent)" }}>{u.role}</span>
                    {u.last_login && <span>Last: {new Date(u.last_login).toLocaleDateString()}</span>}
                  </div>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => handleDeleteUser(u.id, u.name)} className="w-6 h-6 rounded flex items-center justify-center transition-colors hover:bg-red-900/30 hover:text-red-400" style={{ color: "var(--text-muted)" }} title="Remove">
                    <Trash2 size={10} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Partner Access */}
        <div className="surface p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-semibold uppercase tracking-widest flex items-center gap-2" style={{ color: "var(--text-muted)" }}>
              <Users size={12} /> Partner Access
            </h2>
            <button onClick={() => setShowPartnerForm(!showPartnerForm)} className="btn btn-primary btn-xs flex items-center gap-1.5">
              <Plus size={12} /> Add Partner
            </button>
          </div>

          {newToken && (
            <div className="mb-4 p-3 rounded-lg bg-green-950/40 border border-green-900/50">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-green-400 font-medium">New access token (save it now):</span>
                <button onClick={() => setNewToken(null)} className="text-green-700 hover:text-green-400 text-xs">Dismiss</button>
              </div>
              <div className="flex items-center gap-2">
                <code className="text-xs text-green-300 bg-green-950/60 px-2 py-1 rounded flex-1 font-mono">{newToken}</code>
                <button onClick={() => copyLink(newToken)} className="px-2 py-1 rounded bg-green-900/50 text-green-300 hover:bg-green-900 text-[10px] flex items-center gap-1 transition-colors">
                  <Copy size={9} /> Copy share link
                </button>
              </div>
              <div className="mt-2 text-[10px] text-zinc-500">
                Share URL: <code className="text-zinc-400">{baseUrl}/shared?token={newToken}</code>
              </div>
            </div>
          )}

          {showPartnerForm && (
            <div className="mb-4 p-3 rounded-lg border space-y-2" style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
              <div className="grid grid-cols-3 gap-2">
                <input placeholder="Name" value={partnerForm.name} onChange={(e) => setPartnerForm({ ...partnerForm, name: e.target.value })} className="input text-xs" />
                <input placeholder="Email" value={partnerForm.email} onChange={(e) => setPartnerForm({ ...partnerForm, email: e.target.value })} className="input text-xs" />
                <select value={partnerForm.role} onChange={(e) => setPartnerForm({ ...partnerForm, role: e.target.value })} className="input text-xs">
                  <option value="viewer">Viewer</option>
                  <option value="contributor">Contributor</option>
                </select>
              </div>
              <div className="flex gap-2">
                <button onClick={handleCreatePartner} className="btn btn-primary btn-xs">Create</button>
                <button onClick={() => setShowPartnerForm(false)} className="btn btn-surface btn-xs">Cancel</button>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            {partners.length === 0 ? (
              <p className="text-xs py-4 text-center" style={{ color: "var(--text-muted)" }}>No partners yet. Add one to share read-only activity logs.</p>
            ) : partners.map((p) => (
              <div key={p.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-white/5 group transition-colors">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-medium uppercase" style={{ background: "var(--surface)", color: "var(--text-muted)" }}>
                  {p.name.slice(0, 2)}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>{p.name}</span>
                  <div className="flex items-center gap-2 text-[10px]" style={{ color: "var(--text-muted)" }}>
                    <span>{p.email}</span>
                    <span className="capitalize">{p.role}</span>
                    {p.last_login && <span>Last: {new Date(p.last_login).toLocaleDateString()}</span>}
                  </div>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => copyLink(p.token)} className="w-6 h-6 rounded flex items-center justify-center transition-colors hover:bg-white/10" style={{ color: "var(--text-muted)" }} title="Copy share link">
                    <Copy size={10} />
                  </button>
                  <button onClick={() => handleRegenerate(p.id)} className="w-6 h-6 rounded flex items-center justify-center transition-colors hover:bg-yellow-900/30 hover:text-yellow-400" style={{ color: "var(--text-muted)" }} title="Regenerate token">
                    <RefreshCw size={10} />
                  </button>
                  <button onClick={() => handleDeletePartner(p.id, p.name)} className="w-6 h-6 rounded flex items-center justify-center transition-colors hover:bg-red-900/30 hover:text-red-400" style={{ color: "var(--text-muted)" }} title="Remove">
                    <Trash2 size={10} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
