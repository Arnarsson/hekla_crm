"use client";

import { useState, useRef, useEffect } from "react";
import { TEAM_MEMBERS, type TeamMember } from "@/lib/team";
import { X, ChevronDown } from "lucide-react";

interface MemberPickerProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  size?: "xs" | "sm";
}

export default function MemberPicker({ value, onChange, placeholder = "Assign...", size = "xs" }: MemberPickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const member = TEAM_MEMBERS.find((m) => m.name.toLowerCase() === value.toLowerCase() || m.id === value.toLowerCase());

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const textSize = size === "xs" ? "text-xs" : "text-sm";

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`input w-full ${textSize} flex items-center gap-2 text-left`}
        type="button"
      >
        {member ? (
          <>
            <div className={`w-5 h-5 rounded-full ${member.color} flex items-center justify-center shrink-0`}>
              <span className="text-[8px] text-white font-bold">{member.initials}</span>
            </div>
            <span style={{ color: "var(--text-primary)" }}>{member.name}</span>
            <span className="text-[10px] ml-auto" style={{ color: "var(--text-muted)" }}>{member.role}</span>
          </>
        ) : value ? (
          <>
            <div className="w-5 h-5 rounded-full bg-zinc-600 flex items-center justify-center shrink-0">
              <span className="text-[8px] text-white font-bold">{value.slice(0, 2).toUpperCase()}</span>
            </div>
            <span style={{ color: "var(--text-primary)" }}>{value}</span>
          </>
        ) : (
          <span style={{ color: "var(--text-muted)" }}>{placeholder}</span>
        )}
        <ChevronDown size={10} className="ml-auto shrink-0" style={{ color: "var(--text-muted)" }} />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border shadow-lg overflow-hidden" style={{ backgroundColor: "var(--bg-secondary)", borderColor: "var(--border)" }}>
          {/* Unassign */}
          {value && (
            <button
              onClick={() => { onChange(""); setOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/[0.05] transition-colors"
            >
              <X size={12} style={{ color: "var(--text-muted)" }} />
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>Unassign</span>
            </button>
          )}
          {TEAM_MEMBERS.map((m) => (
            <button
              key={m.id}
              onClick={() => { onChange(m.name); setOpen(false); }}
              className={`w-full flex items-center gap-2 px-3 py-2 hover:bg-white/[0.05] transition-colors ${member?.id === m.id ? "bg-white/[0.03]" : ""}`}
            >
              <div className={`w-5 h-5 rounded-full ${m.color} flex items-center justify-center shrink-0`}>
                <span className="text-[8px] text-white font-bold">{m.initials}</span>
              </div>
              <span className="text-xs" style={{ color: "var(--text-primary)" }}>{m.name}</span>
              <span className="text-[10px] ml-auto" style={{ color: "var(--text-muted)" }}>{m.role}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
