"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Search, UserCircle, Briefcase, CheckCircle, Plus, Mail, Phone,
  Upload, Scan, ArrowRight, Zap, Globe, X,
} from "lucide-react";
import type { Contact, Deal, Task } from "@/lib/types";

interface CommandResult {
  id: string;
  type: "contact" | "deal" | "task" | "action";
  title: string;
  subtitle?: string;
  icon: typeof Search;
  href?: string;
  action?: () => void | Promise<void>;
  color?: string;
}

export default function CommandBar() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CommandResult[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [mode, setMode] = useState<"search" | "add-task" | "add-contact" | "log-interaction">("search");
  const [formData, setFormData] = useState({ name: "", org: "", email: "", title: "", contactId: "" });
  const [toast, setToast] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load data when opened
  useEffect(() => {
    if (!open) return;
    fetch("/api/contacts").then((r) => r.json()).then(setContacts).catch(() => {});
    fetch("/api/deals").then((r) => r.json()).then(setDeals).catch(() => {});
    fetch("/api/tasks").then((r) => r.json()).then(setTasks).catch(() => {});
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  // Global keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setOpen(true); setMode("search"); setQuery(""); }
      if (e.key === "Escape") { setOpen(false); setMode("search"); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Toast auto-dismiss
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  const showToast = (msg: string) => setToast(msg);

  // Complete task inline
  const completeTask = useCallback(async (id: string, title: string) => {
    await fetch(`/api/tasks/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "completed" }) });
    showToast(`Completed: ${title}`);
    setTasks((ts) => ts.filter((t) => t.id !== id));
  }, []);

  // Log interaction
  const logInteraction = useCallback(async (contactId: string, contactName: string, type: string) => {
    await fetch(`/api/contacts/${contactId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ last_interaction: new Date().toISOString() }),
    });
    await fetch(`/api/contacts/${contactId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ _action: "add_note", text: `Logged ${type} interaction` }),
    });
    showToast(`Logged ${type} with ${contactName}`);
    setOpen(false);
  }, []);

  // Advance deal
  const advanceDeal = useCallback(async (dealId: string, title: string, currentStage: string) => {
    const order = ["lead", "qualified", "proposal", "negotiation", "closed_won"];
    const idx = order.indexOf(currentStage);
    if (idx < 0 || idx >= order.length - 1) return;
    await fetch(`/api/deals/${dealId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stage: order[idx + 1] }) });
    showToast(`Advanced: ${title} → ${order[idx + 1]}`);
    setOpen(false);
  }, []);

  // Build results
  useEffect(() => {
    if (mode !== "search") return;
    const q = query.toLowerCase().trim();

    const builtinActions: CommandResult[] = [
      { id: "act-extract", type: "action", title: "Upload & Extract Conversation", icon: Upload, href: "/upload", color: "text-brand-400" },
      { id: "act-scan", type: "action", title: "Run Intelligence Scan", icon: Scan, action: async () => { await fetch("/api/scan", { method: "POST" }); showToast("Scan complete"); setOpen(false); }, color: "text-yellow-400" },
      { id: "act-add-task", type: "action", title: "Create Task", icon: Plus, action: () => { setMode("add-task"); setFormData({ ...formData, title: "" }); }, color: "text-green-400" },
      { id: "act-add-contact", type: "action", title: "Add Contact", icon: Plus, action: () => { setMode("add-contact"); setFormData({ name: "", org: "", email: "", title: "", contactId: "" }); }, color: "text-cyan-400" },
      { id: "act-log", type: "action", title: "Log Interaction", icon: Phone, action: () => { setMode("log-interaction"); setFormData({ ...formData, contactId: "" }); setQuery(""); }, color: "text-purple-400" },
    ];

    if (!q) {
      // Show actions + open tasks
      const openTasks = tasks.filter((t) => t.status === "pending" || t.status === "in_progress").slice(0, 5).map((t): CommandResult => ({
        id: `task-${t.id}`, type: "task", title: t.title, subtitle: `${t.priority} · ${t.owner || "unassigned"}`,
        icon: CheckCircle,
        action: () => completeTask(t.id, t.title),
        color: t.priority === "high" ? "text-red-400" : "text-yellow-400",
      }));
      setResults([...builtinActions, ...openTasks]);
      setSelectedIdx(0);
      return;
    }

    const matchedContacts = contacts.filter((c) => c.name.toLowerCase().includes(q) || c.organization.toLowerCase().includes(q)).slice(0, 5).map((c): CommandResult => ({
      id: `contact-${c.id}`, type: "contact", title: c.name, subtitle: `${c.organization} · ${c.relationship_type}`,
      icon: UserCircle, href: `/contacts/${c.id}`, color: "text-cyan-400",
    }));

    const matchedDeals = deals.filter((d) => d.title.toLowerCase().includes(q)).slice(0, 5).map((d): CommandResult => ({
      id: `deal-${d.id}`, type: "deal", title: d.title, subtitle: `${d.stage} · ${d.win_probability}%`,
      icon: Briefcase, href: `/deals/${d.id}`, color: "text-purple-400",
    }));

    const matchedTasks = tasks.filter((t) => t.title.toLowerCase().includes(q) && t.status !== "completed").slice(0, 5).map((t): CommandResult => ({
      id: `task-${t.id}`, type: "task", title: t.title, subtitle: `${t.priority} · ${t.status}`,
      icon: CheckCircle, action: () => completeTask(t.id, t.title), color: "text-green-400",
    }));

    const matchedActions = builtinActions.filter((a) => a.title.toLowerCase().includes(q));

    setResults([...matchedActions, ...matchedContacts, ...matchedDeals, ...matchedTasks]);
    setSelectedIdx(0);
  }, [query, contacts, deals, tasks, mode, completeTask]);

  const executeResult = (r: CommandResult) => {
    if (r.action) r.action();
    else if (r.href) { router.push(r.href); setOpen(false); }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setSelectedIdx((i) => Math.min(i + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSelectedIdx((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter" && mode === "search" && results[selectedIdx]) { executeResult(results[selectedIdx]); }
  };

  const handleQuickTask = async () => {
    if (!formData.title.trim()) return;
    await fetch("/api/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: formData.title, priority: "medium", source: "manual" }) });
    showToast(`Task created: ${formData.title}`);
    setOpen(false); setMode("search");
  };

  const handleQuickContact = async () => {
    if (!formData.name.trim()) return;
    await fetch("/api/contacts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: formData.name, organization: formData.org, email: formData.email, relationship_type: "client" }) });
    showToast(`Contact added: ${formData.name}`);
    setOpen(false); setMode("search");
  };

  if (!open) {
    return (
      <>
        {/* Floating trigger */}
        <button onClick={() => { setOpen(true); setMode("search"); setQuery(""); }} className="fixed bottom-4 right-4 z-50 flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-400 text-xs hover:border-zinc-600 hover:text-zinc-300 transition-colors shadow-lg">
          <Search size={12} /> <span className="text-zinc-600">⌘K</span>
        </button>
        {/* Toast */}
        {toast && (
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] px-4 py-2 rounded-lg bg-green-900/80 border border-green-800 text-green-300 text-xs animate-fade-in shadow-lg">
            {toast}
          </div>
        )}
      </>
    );
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm" onClick={() => { setOpen(false); setMode("search"); }} />

      {/* Command palette */}
      <div className="fixed top-[15%] left-1/2 -translate-x-1/2 z-[100] w-full max-w-lg">
        <div className="bg-[#0d0d12] border border-zinc-700 rounded-xl shadow-2xl overflow-hidden">
          {/* Input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800">
            <Search size={16} className="text-zinc-500 shrink-0" />
            {mode === "search" ? (
              <input ref={inputRef} value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={handleKeyDown}
                placeholder="Search contacts, deals, tasks... or type a command"
                className="flex-1 bg-transparent text-sm text-white placeholder-zinc-600 outline-none" autoFocus />
            ) : mode === "add-task" ? (
              <input ref={inputRef} value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && handleQuickTask()}
                placeholder="Task title... (Enter to create)" className="flex-1 bg-transparent text-sm text-white placeholder-zinc-600 outline-none" autoFocus />
            ) : mode === "add-contact" ? (
              <input ref={inputRef} value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Contact name..." className="flex-1 bg-transparent text-sm text-white placeholder-zinc-600 outline-none" autoFocus />
            ) : (
              <input ref={inputRef} value={query} onChange={(e) => setQuery(e.target.value)}
                placeholder="Search contact to log interaction..." className="flex-1 bg-transparent text-sm text-white placeholder-zinc-600 outline-none" autoFocus />
            )}
            <button onClick={() => { setOpen(false); setMode("search"); }} className="text-zinc-600 hover:text-zinc-400">
              <X size={14} />
            </button>
          </div>

          {/* Mode-specific content */}
          {mode === "add-contact" && formData.name && (
            <div className="px-4 py-3 space-y-2 border-b border-zinc-800">
              <div className="flex gap-2">
                <input value={formData.org} onChange={(e) => setFormData({ ...formData, org: e.target.value })} placeholder="Organization" className="flex-1 px-2 py-1.5 bg-zinc-900 border border-zinc-800 rounded text-xs text-white placeholder-zinc-600 outline-none focus:border-brand-500" />
                <input value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="Email" className="flex-1 px-2 py-1.5 bg-zinc-900 border border-zinc-800 rounded text-xs text-white placeholder-zinc-600 outline-none focus:border-brand-500" />
              </div>
              <button onClick={handleQuickContact} className="w-full py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs rounded transition-colors">Create Contact</button>
            </div>
          )}

          {mode === "add-task" && (
            <div className="px-4 py-2 border-b border-zinc-800">
              <span className="text-[10px] text-zinc-600">Press Enter to create task</span>
            </div>
          )}

          {mode === "log-interaction" && (
            <div className="max-h-[300px] overflow-y-auto">
              {contacts.filter((c) => !query || c.name.toLowerCase().includes(query.toLowerCase())).slice(0, 10).map((c) => (
                <div key={c.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-zinc-800/50 transition-colors">
                  <UserCircle size={14} className="text-zinc-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-white">{c.name}</span>
                    <span className="text-[10px] text-zinc-600 ml-2">{c.organization}</span>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => logInteraction(c.id, c.name, "call")} className="px-2 py-1 rounded bg-green-900/20 text-green-400 text-[10px] hover:bg-green-900/30 transition-colors flex items-center gap-1">
                      <Phone size={9} /> Call
                    </button>
                    <button onClick={() => logInteraction(c.id, c.name, "email")} className="px-2 py-1 rounded bg-blue-900/20 text-blue-400 text-[10px] hover:bg-blue-900/30 transition-colors flex items-center gap-1">
                      <Mail size={9} /> Email
                    </button>
                    <button onClick={() => logInteraction(c.id, c.name, "meeting")} className="px-2 py-1 rounded bg-purple-900/20 text-purple-400 text-[10px] hover:bg-purple-900/30 transition-colors flex items-center gap-1">
                      <Globe size={9} /> Meet
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Search results */}
          {mode === "search" && (
            <div className="max-h-[350px] overflow-y-auto">
              {results.map((r, i) => {
                const Icon = r.icon;
                return (
                  <button key={r.id} onClick={() => executeResult(r)} onMouseEnter={() => setSelectedIdx(i)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${i === selectedIdx ? "bg-zinc-800/70" : "hover:bg-zinc-800/40"}`}>
                    <Icon size={14} className={`shrink-0 ${r.color || "text-zinc-500"}`} />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-white block truncate">{r.title}</span>
                      {r.subtitle && <span className="text-[10px] text-zinc-600">{r.subtitle}</span>}
                    </div>
                    {r.type === "task" && <span className="text-[9px] text-zinc-600 px-1.5 py-0.5 rounded bg-zinc-800">⏎ complete</span>}
                    {r.href && <ArrowRight size={10} className="text-zinc-700" />}
                  </button>
                );
              })}
              {results.length === 0 && query && (
                <div className="px-4 py-6 text-center text-xs text-zinc-600">No results for &ldquo;{query}&rdquo;</div>
              )}
            </div>
          )}

          {/* Footer */}
          <div className="px-4 py-2 border-t border-zinc-800 flex items-center gap-3 text-[9px] text-zinc-600">
            <span>↑↓ navigate</span>
            <span>⏎ select</span>
            <span>esc close</span>
            {mode !== "search" && <button onClick={() => { setMode("search"); setQuery(""); }} className="ml-auto text-brand-400 hover:text-brand-300">← back to search</button>}
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[110] px-4 py-2 rounded-lg bg-green-900/80 border border-green-800 text-green-300 text-xs shadow-lg">
          {toast}
        </div>
      )}
    </>
  );
}
