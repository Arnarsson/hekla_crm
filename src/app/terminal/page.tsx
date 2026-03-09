"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Terminal as TerminalIcon } from "lucide-react";

interface TerminalLine {
  type: "input" | "output" | "error" | "system";
  text: string;
}

interface SearchResult {
  type: "contact" | "deal" | "task";
  id: string;
  title: string;
  subtitle: string;
}

export default function TerminalPage() {
  const router = useRouter();
  const [lines, setLines] = useState<TerminalLine[]>([
    { type: "system", text: "Hekla Mission Control Terminal v1.0" },
    { type: "system", text: "Type 'help' for available commands." },
  ]);
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [lines]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const addLine = (type: TerminalLine["type"], text: string) => {
    setLines((l) => [...l, { type, text }]);
  };

  const addLines = (newLines: TerminalLine[]) => {
    setLines((l) => [...l, ...newLines]);
  };

  const executeCommand = async (cmd: string) => {
    const trimmed = cmd.trim();
    if (!trimmed) return;

    addLine("input", `$ ${trimmed}`);
    setHistory((h) => [...h, trimmed]);
    setHistoryIdx(-1);

    const parts = trimmed.split(/\s+/);
    const command = parts[0].toLowerCase();
    const args = parts.slice(1).join(" ");

    try {
      switch (command) {
        case "help":
          addLines([
            { type: "system", text: "Available commands:" },
            { type: "output", text: "  search <query>     Search contacts, deals, tasks" },
            { type: "output", text: "  stats              Show system statistics" },
            { type: "output", text: "  scan               Run auto-action scan" },
            { type: "output", text: "  task <title>       Create a quick task" },
            { type: "output", text: "  go <page>          Navigate (contacts, deals, tasks, daily, inbox...)" },
            { type: "output", text: "  contacts           List contacts" },
            { type: "output", text: "  deals              List active deals" },
            { type: "output", text: "  tasks              List active tasks" },
            { type: "output", text: "  overdue            Show overdue tasks" },
            { type: "output", text: "  brain              Check brain status" },
            { type: "output", text: "  clear              Clear terminal" },
            { type: "output", text: "  help               Show this help" },
          ]);
          break;

        case "clear":
          setLines([]);
          break;

        case "stats": {
          const [contacts, deals, tasks, activities] = await Promise.all([
            fetch("/api/contacts").then((r) => r.json()),
            fetch("/api/deals").then((r) => r.json()),
            fetch("/api/tasks").then((r) => r.json()),
            fetch("/api/activities").then((r) => r.json()),
          ]);
          const active = tasks.filter((t: { status: string }) => t.status === "pending" || t.status === "in_progress");
          const overdue = active.filter((t: { deadline: string }) => {
            if (!t.deadline) return false;
            try { return new Date(t.deadline) < new Date(); } catch { return false; }
          });
          addLines([
            { type: "system", text: "System Statistics:" },
            { type: "output", text: `  Contacts:     ${contacts.length}` },
            { type: "output", text: `  Deals:        ${deals.length} (${deals.filter((d: { stage: string }) => d.stage !== "closed_won" && d.stage !== "closed_lost").length} active)` },
            { type: "output", text: `  Tasks:        ${tasks.length} (${active.length} active, ${overdue.length} overdue)` },
            { type: "output", text: `  Activities:   ${activities.length}` },
          ]);
          break;
        }

        case "scan": {
          addLine("system", "Running auto-action scan...");
          const res = await fetch("/api/scan", { method: "POST" });
          const data = await res.json();
          addLines([
            { type: "system", text: "Scan complete:" },
            { type: "output", text: `  Overdue tasks:    ${data.overdue_tasks}` },
            { type: "output", text: `  Stale deals:      ${data.stale_deals}` },
            { type: "output", text: `  Decaying:         ${data.decaying_relationships}` },
            { type: "output", text: `  Follow-ups:       ${data.follow_up_suggestions}` },
            { type: "output", text: `  Tasks created:    ${data.tasks_created}` },
          ]);
          break;
        }

        case "task": {
          if (!args) { addLine("error", "Usage: task <title>"); break; }
          const res = await fetch("/api/tasks", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: args, priority: "medium", source: "manual" }),
          });
          if (res.ok) addLine("system", `Task created: ${args}`);
          else addLine("error", "Failed to create task");
          break;
        }

        case "search": {
          if (!args) { addLine("error", "Usage: search <query>"); break; }
          addLine("system", `Searching for "${args}"...`);
          const [contacts, deals, tasks] = await Promise.all([
            fetch("/api/contacts").then((r) => r.json()),
            fetch("/api/deals").then((r) => r.json()),
            fetch("/api/tasks").then((r) => r.json()),
          ]);
          const q = args.toLowerCase();
          const results: SearchResult[] = [];
          for (const c of contacts) {
            if (c.name?.toLowerCase().includes(q) || c.organization?.toLowerCase().includes(q)) {
              results.push({ type: "contact", id: c.id, title: c.name, subtitle: c.organization || "" });
            }
          }
          for (const d of deals) {
            if (d.title?.toLowerCase().includes(q)) {
              results.push({ type: "deal", id: d.id, title: d.title, subtitle: d.stage });
            }
          }
          for (const t of tasks) {
            if (t.title?.toLowerCase().includes(q)) {
              results.push({ type: "task", id: t.id, title: t.title, subtitle: `${t.status} - ${t.priority}` });
            }
          }
          if (results.length === 0) {
            addLine("output", "No results found.");
          } else {
            addLines(results.slice(0, 15).map((r) => ({
              type: "output" as const,
              text: `  [${r.type}] ${r.title}${r.subtitle ? ` (${r.subtitle})` : ""}`,
            })));
            if (results.length > 15) addLine("output", `  ...and ${results.length - 15} more`);
          }
          break;
        }

        case "contacts": {
          const contacts = await fetch("/api/contacts").then((r) => r.json());
          if (contacts.length === 0) { addLine("output", "No contacts."); break; }
          addLine("system", `${contacts.length} contacts:`);
          addLines(contacts.slice(0, 20).map((c: { name: string; organization: string; relationship_type: string }) => ({
            type: "output" as const,
            text: `  ${c.name} — ${c.organization || "No org"} (${c.relationship_type})`,
          })));
          break;
        }

        case "deals": {
          const deals = await fetch("/api/deals").then((r) => r.json());
          const active = deals.filter((d: { stage: string }) => d.stage !== "closed_won" && d.stage !== "closed_lost");
          if (active.length === 0) { addLine("output", "No active deals."); break; }
          addLine("system", `${active.length} active deals:`);
          addLines(active.map((d: { title: string; stage: string; owner: string }) => ({
            type: "output" as const,
            text: `  ${d.title} — ${d.stage}${d.owner ? ` (${d.owner})` : ""}`,
          })));
          break;
        }

        case "tasks": {
          const tasks = await fetch("/api/tasks").then((r) => r.json());
          const active = tasks.filter((t: { status: string }) => t.status === "pending" || t.status === "in_progress");
          if (active.length === 0) { addLine("output", "No active tasks."); break; }
          addLine("system", `${active.length} active tasks:`);
          addLines(active.slice(0, 20).map((t: { title: string; priority: string; owner: string }) => ({
            type: "output" as const,
            text: `  [${t.priority}] ${t.title}${t.owner ? ` (${t.owner})` : ""}`,
          })));
          break;
        }

        case "overdue": {
          const tasks = await fetch("/api/tasks").then((r) => r.json());
          const now = new Date();
          const overdue = tasks.filter((t: { status: string; deadline: string }) => {
            if (t.status === "completed" || t.status === "cancelled") return false;
            if (!t.deadline) return false;
            try { return new Date(t.deadline) < now; } catch { return false; }
          });
          if (overdue.length === 0) { addLine("output", "No overdue tasks!"); break; }
          addLine("system", `${overdue.length} overdue tasks:`);
          addLines(overdue.map((t: { title: string; deadline: string; owner: string }) => ({
            type: "output" as const,
            text: `  ${t.title} — due ${t.deadline}${t.owner ? ` (${t.owner})` : ""}`,
          })));
          break;
        }

        case "brain": {
          const res = await fetch("/api/brain").then((r) => r.json());
          addLine("system", `Brain: ${res.online ? "ONLINE" : "OFFLINE"} — ${res.url}`);
          break;
        }

        case "go": {
          const pages: Record<string, string> = {
            home: "/", dashboard: "/", contacts: "/contacts", deals: "/deals",
            tasks: "/tasks", daily: "/daily", inbox: "/inbox", issues: "/issues",
            brain: "/brain", upload: "/upload", logs: "/logs", mission: "/mission",
            settings: "/settings", office: "/office", "open-loops": "/open-loops",
            loops: "/open-loops", transcriptions: "/transcriptions",
          };
          const target = pages[args.toLowerCase()];
          if (target) {
            addLine("system", `Navigating to ${target}...`);
            setTimeout(() => router.push(target), 300);
          } else {
            addLine("error", `Unknown page: ${args}. Try: ${Object.keys(pages).join(", ")}`);
          }
          break;
        }

        default:
          addLine("error", `Unknown command: ${command}. Type 'help' for available commands.`);
      }
    } catch (err) {
      addLine("error", `Error: ${err instanceof Error ? err.message : "Command failed"}`);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      executeCommand(input);
      setInput("");
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (history.length > 0) {
        const idx = historyIdx < 0 ? history.length - 1 : Math.max(historyIdx - 1, 0);
        setHistoryIdx(idx);
        setInput(history[idx]);
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIdx >= 0) {
        const idx = historyIdx + 1;
        if (idx >= history.length) { setHistoryIdx(-1); setInput(""); }
        else { setHistoryIdx(idx); setInput(history[idx]); }
      }
    }
  };

  const colorForType = (type: TerminalLine["type"]) => {
    switch (type) {
      case "input": return "var(--accent)";
      case "output": return "var(--text-secondary)";
      case "error": return "#ef4444";
      case "system": return "var(--text-muted)";
    }
  };

  return (
    <div className="page-container">
      <div>
        <h1 className="page-title flex items-center gap-2">
          <TerminalIcon size={20} style={{ color: "var(--accent)" }} />
          Terminal
        </h1>
        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
          Command interface — search, create, navigate
        </p>
      </div>

      <div
        className="surface mt-3 font-mono text-[12px] flex flex-col"
        style={{ minHeight: "500px", maxHeight: "calc(100vh - 200px)" }}
        onClick={() => inputRef.current?.focus()}
      >
        {/* Output */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-0.5">
          {lines.map((line, i) => (
            <div key={i} style={{ color: colorForType(line.type) }}>
              {line.text}
            </div>
          ))}
        </div>

        {/* Input */}
        <div className="flex items-center gap-2 p-4 border-t" style={{ borderColor: "var(--border)" }}>
          <span style={{ color: "var(--accent)" }}>$</span>
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent outline-none text-[12px]"
            style={{ color: "var(--text-primary)" }}
            placeholder="Type a command..."
            autoFocus
          />
        </div>
      </div>
    </div>
  );
}
