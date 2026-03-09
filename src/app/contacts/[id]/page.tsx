"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Building, Mail, Phone, Tag, Upload, Trash2, Globe,
  Plus, CheckCircle, MessageSquare, Calendar, Edit3, Save, X,
  Copy, ExternalLink, FileText, Zap,
} from "lucide-react";
import type { Contact, ContactIntelligence, Deal, Task } from "@/lib/types";

function TrustStars({ trust, onChange }: { trust: number; onChange?: (v: number) => void }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <button key={i} onClick={() => onChange?.(i)} className={`text-lg transition-colors ${i <= trust ? "text-amber-400" : "text-zinc-700 hover:text-amber-400/50"}`}>★</button>
      ))}
    </div>
  );
}

function HealthGauge({ score, status, trend }: { score: number; status: string; trend: string }) {
  const radius = 32;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - score / 100);
  const colors: Record<string, string> = { active: "#22c55e", warming: "#06b6d4", cooling: "#f97316", cold: "#ef4444", strategic_pause: "#a855f7" };
  const trendIcons: Record<string, string> = { improving: "↑", stable: "→", declining: "↓" };

  return (
    <div className="flex items-center gap-3">
      <div className="relative w-16 h-16">
        <svg className="transform -rotate-90" width="64" height="64">
          <circle cx="32" cy="32" r={radius} stroke="#27272a" strokeWidth="5" fill="none" />
          <circle cx="32" cy="32" r={radius} stroke={colors[status] || "#71717a"} strokeWidth="5" fill="none" strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-bold text-white">{score}</span>
        </div>
      </div>
      <div>
        <div className="text-xs font-medium text-white capitalize">{status.replace("_", " ")}</div>
        <div className="text-[10px] text-zinc-500">{trendIcons[trend] || ""} {trend}</div>
      </div>
    </div>
  );
}

export default function ContactDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [contact, setContact] = useState<Contact | null>(null);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [intel, setIntel] = useState<ContactIntelligence | null>(null);
  const [noteText, setNoteText] = useState("");
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ email: "", phone: "", linkedin_url: "", role: "", organization: "" });
  const [taskTitle, setTaskTitle] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`/api/contacts/${id}?intelligence=true`).then((r) => r.json()).then((c) => {
      setContact(c);
      if (c.intelligence) setIntel(c.intelligence);
      setEditForm({ email: c.email || "", phone: c.phone || "", linkedin_url: c.linkedin_url || "", role: c.role || "", organization: c.organization || "" });
    }).catch(console.error);
    fetch("/api/deals").then((r) => r.json()).then((all: Deal[]) => setDeals(all.filter((d) => d.contact_ids.includes(id as string)))).catch(console.error);
    fetch("/api/tasks").then((r) => r.json()).then((all: Task[]) => setTasks(all.filter((t) => t.owner && contact?.name && t.owner.toLowerCase().includes(contact.name.split(" ")[0].toLowerCase())))).catch(console.error);
  }, [id]);

  // Reload tasks when contact loads
  useEffect(() => {
    if (!contact) return;
    fetch("/api/tasks").then((r) => r.json()).then((all: Task[]) => {
      const firstName = contact.name.split(" ")[0].toLowerCase();
      setTasks(all.filter((t) => t.owner && t.owner.toLowerCase().includes(firstName) && t.status !== "completed" && t.status !== "cancelled"));
    }).catch(console.error);
  }, [contact?.id]);

  const patch = async (data: Record<string, unknown>) => {
    const res = await fetch(`/api/contacts/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    if (res.ok) setContact(await res.json());
  };

  const handleTrustChange = (trust: number) => patch({ trust });

  const handleAddNote = async () => {
    if (!noteText.trim()) return;
    const res = await fetch(`/api/contacts/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ _action: "add_note", text: noteText }) });
    if (res.ok) { setContact(await res.json()); setNoteText(""); }
  };

  const handleDeleteNote = async (noteId: string) => {
    const res = await fetch(`/api/contacts/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ _action: "delete_note", note_id: noteId }) });
    if (res.ok) setContact(await res.json());
  };

  const handleSaveEdit = async () => {
    await patch(editForm);
    setEditing(false);
  };

  const handleCreateTask = async () => {
    if (!taskTitle.trim()) return;
    await fetch("/api/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: taskTitle, owner: contact?.name || "", priority: "medium", source: "manual" }) });
    setTaskTitle("");
    // Reload tasks
    if (contact) {
      const all = await fetch("/api/tasks").then((r) => r.json());
      const firstName = contact.name.split(" ")[0].toLowerCase();
      setTasks(all.filter((t: Task) => t.owner && t.owner.toLowerCase().includes(firstName) && t.status !== "completed" && t.status !== "cancelled"));
    }
  };

  const handleCompleteTask = async (taskId: string) => {
    await fetch(`/api/tasks/${taskId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "completed" }) });
    setTasks((ts) => ts.filter((t) => t.id !== taskId));
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    await fetch("/api/extract", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversation: text, source_filename: file.name, source_type: "other", context_label: `Upload for ${contact?.name}` }),
    });
    const updated = await fetch(`/api/contacts/${id}?intelligence=true`).then((r) => r.json());
    setContact(updated);
    if (updated.intelligence) setIntel(updated.intelligence);
  };

  const handleDelete = async () => {
    if (!confirm("Delete this contact?")) return;
    await fetch(`/api/contacts/${id}`, { method: "DELETE" });
    router.push("/contacts");
  };

  const copyEmail = () => { if (contact?.email) navigator.clipboard.writeText(contact.email); };

  if (!contact) {
    return <div className="page-container"><div className="surface p-8 text-center" style={{ color: "var(--text-muted)" }}>Loading...</div></div>;
  }

  const days = Math.floor((Date.now() - new Date(contact.last_interaction).getTime()) / 86400000);

  return (
    <div className="page-container">
          <div className="flex items-center justify-between">
            <button onClick={() => router.back()} className="flex items-center gap-2 text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
              <ArrowLeft size={14} /> Back
            </button>
            <div className="flex gap-2">
              <button onClick={() => setEditing(!editing)} className="btn btn-surface btn-xs flex items-center gap-1.5">
                <Edit3 size={10} /> Edit
              </button>
              <button onClick={handleDelete} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-red-900/30 text-zinc-500 hover:text-red-400 text-[10px] transition-colors">
                <Trash2 size={10} /> Delete
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Main content */}
            <div className="lg:col-span-8 space-y-4">
              {/* Header card */}
              <div className="surface p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <h1 className="text-xl font-bold text-white">{contact.name}</h1>
                    <div className="flex items-center gap-3 mt-1 text-xs text-zinc-400">
                      {contact.organization && <span className="flex items-center gap-1"><Building size={12} /> {contact.organization}</span>}
                      {contact.role && <span>{contact.role}</span>}
                      <span className={days > 14 ? "text-red-400" : "text-zinc-500"}>{days === 0 ? "Active today" : `${days}d since contact`}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <TrustStars trust={contact.trust || 3} onChange={handleTrustChange} />
                    <div className="text-2xl font-bold text-white mt-1">{contact.relationship_strength}</div>
                    <div className="text-[9px] text-zinc-600 uppercase">Strength</div>
                  </div>
                </div>

                {/* Contact info + quick actions */}
                {editing ? (
                  <div className="mt-3 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <input placeholder="Email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} className="input text-xs" />
                      <input placeholder="Phone" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} className="input text-xs" />
                      <input placeholder="Organization" value={editForm.organization} onChange={(e) => setEditForm({ ...editForm, organization: e.target.value })} className="input text-xs" />
                      <input placeholder="Role" value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value })} className="input text-xs" />
                      <input placeholder="LinkedIn URL" value={editForm.linkedin_url} onChange={(e) => setEditForm({ ...editForm, linkedin_url: e.target.value })} className="input text-xs col-span-2" />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={handleSaveEdit} className="btn btn-primary btn-xs flex items-center gap-1"><Save size={10} /> Save</button>
                      <button onClick={() => setEditing(false)} className="btn btn-surface btn-xs flex items-center gap-1"><X size={10} /> Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 flex items-center gap-2 flex-wrap">
                    {contact.email && (
                      <a href={`mailto:${contact.email}`} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-600/10 hover:bg-brand-600/20 text-brand-400 text-xs transition-colors">
                        <Mail size={12} /> {contact.email}
                      </a>
                    )}
                    {contact.email && (
                      <button onClick={copyEmail} className="w-7 h-7 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-500 flex items-center justify-center transition-colors" title="Copy email">
                        <Copy size={11} />
                      </button>
                    )}
                    {contact.phone && (
                      <a href={`tel:${contact.phone}`} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-900/20 hover:bg-green-900/30 text-green-400 text-xs transition-colors">
                        <Phone size={12} /> {contact.phone}
                      </a>
                    )}
                    {contact.linkedin_url && (
                      <a href={contact.linkedin_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-900/20 hover:bg-blue-900/30 text-blue-400 text-xs transition-colors">
                        <Globe size={12} /> LinkedIn
                      </a>
                    )}
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ml-auto ${TYPE_COLORS[contact.relationship_type] || "bg-zinc-800 text-zinc-400"}`}>{contact.relationship_type}</span>
                  </div>
                )}
              </div>

              {/* Quick task create */}
              <div className="surface p-3">
                <div className="flex gap-2">
                  <input value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleCreateTask()}
                    placeholder={`Create task for ${contact.name.split(" ")[0]}...`} className="input text-xs flex-1" />
                  <button onClick={handleCreateTask} className="btn btn-primary btn-xs flex items-center gap-1"><Plus size={12} /> Task</button>
                  <input type="file" ref={fileRef} className="hidden" onChange={handleUpload} accept=".txt,.json,.csv" />
                  <button onClick={() => fileRef.current?.click()} className="btn btn-surface btn-xs flex items-center gap-1"><Upload size={12} /> Upload</button>
                </div>
              </div>

              {/* Open Tasks */}
              {tasks.length > 0 && (
                <div className="surface p-4">
                  <h3 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest mb-2 flex items-center gap-1"><Zap size={10} /> Open Tasks</h3>
                  <div className="space-y-1">
                    {tasks.map((t) => (
                      <div key={t.id} className="flex items-center gap-2 p-2 rounded hover:bg-zinc-800/50 group transition-colors">
                        <button onClick={() => handleCompleteTask(t.id)} className="w-4 h-4 rounded border border-zinc-700 group-hover:border-brand-500 shrink-0 transition-colors hover:bg-brand-500/20" />
                        <span className="text-xs text-zinc-300 flex-1">{t.title}</span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded ${t.priority === "high" ? "bg-red-900/30 text-red-400" : "bg-zinc-800 text-zinc-500"}`}>{t.priority}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              <div className="surface p-4">
                <h3 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest mb-2 flex items-center gap-1"><MessageSquare size={10} /> Notes</h3>
                <div className="flex gap-2 mb-2">
                  <input value={noteText} onChange={(e) => setNoteText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleAddNote()}
                    placeholder="Add a note..." className="input text-xs flex-1" />
                  <button onClick={handleAddNote} className="btn btn-surface btn-xs">Add</button>
                </div>
                <div className="space-y-1.5">
                  {(contact.notes || []).map((note) => (
                    <div key={note.id} className="flex items-start justify-between p-2.5 rounded-lg bg-zinc-900/50 border border-zinc-800">
                      <div>
                        <p className="text-xs text-zinc-300">{note.text}</p>
                        <span className="text-[9px] text-zinc-700">{new Date(note.created_at).toLocaleString()}</span>
                      </div>
                      <button onClick={() => handleDeleteNote(note.id)} className="text-zinc-700 hover:text-red-400 transition-colors"><Trash2 size={11} /></button>
                    </div>
                  ))}
                  {(!contact.notes || contact.notes.length === 0) && <p className="text-[10px] text-zinc-700">No notes yet</p>}
                </div>
              </div>

              {/* Linked Deals */}
              {deals.length > 0 && (
                <div className="surface p-4">
                  <h3 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest mb-2">Linked Deals</h3>
                  <div className="space-y-1.5">
                    {deals.map((d) => (
                      <Link key={d.id} href={`/deals/${d.id}`} className="flex items-center justify-between p-2.5 rounded-lg border border-zinc-800 hover:border-zinc-700 transition-colors">
                        <div>
                          <span className="text-xs text-white font-medium">{d.title}</span>
                          <span className={`ml-2 text-[10px] px-1.5 py-0.5 rounded-full capitalize ${d.stage === "closed_won" ? "bg-green-900/30 text-green-400" : "bg-zinc-800 text-zinc-400"}`}>{d.stage.replace("_", " ")}</span>
                        </div>
                        <span className="text-xs text-zinc-500">{d.win_probability}%</span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right sidebar */}
            <div className="lg:col-span-4 space-y-4">
              {/* Health */}
              {intel && (
                <>
                  <div className="surface p-4">
                    <h3 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest mb-3">Health</h3>
                    <HealthGauge score={intel.engagement_score} status={intel.engagement_status} trend={intel.trend} />
                    <div className="mt-3 space-y-1.5 text-[10px]">
                      <div className="flex justify-between"><span className="text-zinc-600">Risk</span><span className={`capitalize ${intel.risk_level === "critical" ? "text-red-400" : intel.risk_level === "high" ? "text-orange-400" : "text-zinc-400"}`}>{intel.risk_level}</span></div>
                      <div className="flex justify-between"><span className="text-zinc-600">Strength</span><span className="text-zinc-300 capitalize">{intel.relationship_strength_label}</span></div>
                      <div className="flex justify-between"><span className="text-zinc-600">Days silent</span><span className={`${intel.days_since_contact > 14 ? "text-red-400" : "text-zinc-300"}`}>{intel.days_since_contact}</span></div>
                    </div>
                  </div>

                  {/* Next Actions */}
                  {intel.next_actions.length > 0 && (
                    <div className="surface p-4">
                      <h3 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest mb-2">Recommended Actions</h3>
                      <div className="space-y-1.5">
                        {intel.next_actions.map((action, i) => (
                          <div key={i} className={`p-2.5 border rounded-lg ${action.priority === "urgent" || action.priority === "high" ? "border-orange-900/30 bg-orange-950/20" : "border-zinc-800 bg-zinc-900/30"}`}>
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-zinc-300">{action.action}</span>
                              <span className={`text-[8px] uppercase px-1.5 py-0.5 rounded ${action.priority === "urgent" ? "bg-red-900/30 text-red-400" : action.priority === "high" ? "bg-orange-900/30 text-orange-400" : "bg-zinc-800 text-zinc-500"}`}>{action.priority}</span>
                            </div>
                            <span className="text-[9px] text-zinc-600">{action.context}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Summary */}
                  <div className="surface p-4">
                    <h3 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest mb-2">Summary</h3>
                    <p className="text-[11px] text-zinc-400 leading-relaxed">{intel.strategic_summary}</p>
                  </div>
                </>
              )}

              {/* Source extractions */}
              <div className="surface p-4">
                <h3 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest mb-2 flex items-center gap-1"><FileText size={10} /> Sources</h3>
                {contact.source_extractions.length === 0 ? (
                  <p className="text-[10px] text-zinc-700">No linked extractions</p>
                ) : (
                  <div className="space-y-1">
                    {contact.source_extractions.map((eid) => (
                      <Link key={eid} href={`/pipelines/${eid}`} className="flex items-center gap-1 text-[10px] text-brand-400 hover:text-brand-300 truncate">
                        <ExternalLink size={9} /> {eid.slice(0, 12)}...
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              {/* Tags */}
              {contact.tags.length > 0 && (
                <div className="surface p-4">
                  <h3 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest mb-2">Tags</h3>
                  <div className="flex flex-wrap gap-1">
                    {contact.tags.map((t) => (
                      <span key={t} className="text-[9px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400">{t}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
    </div>
  );
}

const TYPE_COLORS: Record<string, string> = {
  client: "bg-green-900/30 text-green-400",
  partner: "bg-blue-900/30 text-blue-400",
  gatekeeper: "bg-yellow-900/30 text-yellow-400",
  referral: "bg-purple-900/30 text-purple-400",
  competitor: "bg-red-900/30 text-red-400",
  internal: "bg-zinc-800 text-zinc-400",
};
