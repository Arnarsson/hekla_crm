"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ListTodo,
  CircleDot,
  Users,
  Kanban,
  Upload,
  FileText,
  Brain,
  Mic,
  Activity,
  RefreshCw,
  Bell,
  Settings,
  Terminal,
  Search,
  ChevronLeft,
  ChevronRight,
  Flame,
  Inbox,
  CalendarDays,
  ScrollText,
  Target,
  Zap,
} from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  badge?: string | number;
  shortcut?: string;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

const NAV: NavSection[] = [
  {
    label: "Command",
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard, shortcut: "D" },
      { href: "/inbox", label: "Inbox", icon: Inbox, shortcut: "I" },
      { href: "/tasks", label: "Tasks", icon: ListTodo, shortcut: "T" },
      { href: "/issues", label: "Issues", icon: CircleDot, shortcut: "G" },
      { href: "/daily", label: "Daily Focus", icon: Target },
    ],
  },
  {
    label: "CRM",
    items: [
      { href: "/contacts", label: "Contacts", icon: Users, shortcut: "C" },
      { href: "/deals", label: "Pipeline", icon: Kanban },
      { href: "/open-loops", label: "Open Loops", icon: RefreshCw },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { href: "/brain", label: "Brain", icon: Brain },
      { href: "/transcriptions", label: "Transcriptions", icon: Mic },
      { href: "/upload", label: "Upload", icon: Upload },
      { href: "/pipelines", label: "Extractions", icon: FileText },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/agent-activity", label: "Agents", icon: Zap },
      { href: "/logs", label: "Activity Log", icon: ScrollText },
      { href: "/terminal", label: "Terminal", icon: Terminal },
      { href: "/integrations", label: "Integrations", icon: Activity },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [brainOnline, setBrainOnline] = useState<boolean | null>(null);
  const [agentCount, setAgentCount] = useState(0);

  useEffect(() => {
    const check = () => {
      fetch("/api/brain")
        .then((r) => r.json())
        .then((d) => setBrainOnline(d.online))
        .catch(() => setBrainOnline(false));
    };
    check();
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, []);

  // Keyboard shortcuts for nav
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") return;

      const shortcuts: Record<string, string> = { d: "/", i: "/inbox", t: "/tasks", g: "/issues", c: "/contacts" };
      const target = shortcuts[e.key.toLowerCase()];
      if (target) {
        e.preventDefault();
        window.location.href = target;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <aside
      className={`fixed left-0 top-0 h-screen z-40 transition-all duration-200 flex flex-col ${
        collapsed ? "w-14" : "w-60"
      }`}
      style={{ background: "var(--bg)", borderRight: "1px solid var(--border)" }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-3 h-12" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0" style={{ background: "var(--accent)" }}>
          <Flame size={14} className="text-white" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <span className="text-[13px] font-semibold whitespace-nowrap" style={{ color: "var(--text-primary)" }}>
              Hekla
            </span>
            <span className="block text-[10px] whitespace-nowrap font-mono" style={{ color: "var(--text-muted)" }}>
              Mission Control
            </span>
          </div>
        )}
      </div>

      {/* Search trigger */}
      {!collapsed && (
        <button
          className="mx-2 mt-2 flex items-center gap-2 px-3 py-1.5 rounded-md text-[12px] transition-colors"
          style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-muted)" }}
          onClick={() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))}
        >
          <Search size={13} />
          <span className="flex-1 text-left">Search...</span>
          <span className="kbd">⌘K</span>
        </button>
      )}

      {/* Nav */}
      <nav className="flex-1 py-2 px-1.5 space-y-3 overflow-y-auto">
        {NAV.map((section) => (
          <div key={section.label}>
            {!collapsed && (
              <div className="section-title px-2 mb-1">{section.label}</div>
            )}
            <div className="space-y-px">
              {section.items.map((item) => {
                const isActive =
                  pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-2.5 px-2 py-1.5 rounded-md text-[13px] transition-all group ${
                      isActive
                        ? "font-medium"
                        : "hover:bg-[var(--surface-hover)]"
                    }`}
                    style={{
                      color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
                      background: isActive ? "var(--surface)" : undefined,
                    }}
                    title={collapsed ? item.label : undefined}
                  >
                    <Icon
                      size={16}
                      className="shrink-0"
                      style={{ color: isActive ? "var(--accent)" : undefined }}
                    />
                    {!collapsed && (
                      <>
                        <span className="flex-1 whitespace-nowrap">{item.label}</span>
                        {item.badge !== undefined && (
                          <span className="badge-accent badge text-[10px]">{item.badge}</span>
                        )}
                        {item.shortcut && (
                          <span className="kbd opacity-0 group-hover:opacity-100 transition-opacity">
                            {item.shortcut}
                          </span>
                        )}
                      </>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer - status */}
      <div style={{ borderTop: "1px solid var(--border)" }}>
        {!collapsed && (
          <div className="px-3 py-2 space-y-1">
            {/* Brain status */}
            <div className="flex items-center gap-2">
              <div
                className={`w-1.5 h-1.5 rounded-full ${
                  brainOnline === null ? "bg-zinc-600" : brainOnline ? "bg-green-500" : "bg-zinc-600"
                }`}
              />
              <span className="text-[11px] font-mono" style={{ color: "var(--text-muted)" }}>
                {brainOnline === null ? "..." : brainOnline ? "Brain online" : "Brain offline"}
              </span>
            </div>
            {/* Agent count */}
            <div className="flex items-center gap-2">
              <div className={`w-1.5 h-1.5 rounded-full ${agentCount > 0 ? "bg-brand-500 agent-active" : "bg-zinc-600"}`} />
              <span className="text-[11px] font-mono" style={{ color: "var(--text-muted)" }}>
                {agentCount > 0 ? `${agentCount} agents active` : "All agents idle"}
              </span>
            </div>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center w-full h-8 transition-colors"
          style={{ color: "var(--text-muted)" }}
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>
    </aside>
  );
}
