"use client";

import { useState, useRef, useEffect } from "react";
import { ISSUE_LABELS, type IssueLabel } from "@/lib/team";
import { Plus, X, Tag } from "lucide-react";

interface LabelPickerProps {
  value: string[];
  onChange: (value: string[]) => void;
  size?: "xs" | "sm";
}

export default function LabelPicker({ value, onChange, size = "xs" }: LabelPickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const toggle = (id: string) => {
    if (value.includes(id)) {
      onChange(value.filter((v) => v !== id));
    } else {
      onChange([...value, id]);
    }
  };

  const textSize = size === "xs" ? "text-[10px]" : "text-xs";

  return (
    <div ref={ref} className="relative">
      {/* Selected labels */}
      <div className="flex flex-wrap gap-1 mb-1">
        {value.map((id) => {
          const label = ISSUE_LABELS.find((l) => l.id === id);
          if (!label) return null;
          return (
            <span key={id} className={`${label.color} ${textSize} px-1.5 py-0.5 rounded flex items-center gap-1`}>
              {label.name}
              <button onClick={() => toggle(id)} className="hover:opacity-70">
                <X size={8} />
              </button>
            </span>
          );
        })}
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-1 px-1.5 py-0.5 rounded border border-dashed hover:bg-white/[0.03] transition-colors"
          style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
          type="button"
        >
          <Plus size={8} />
          <span className={textSize}>Label</span>
        </button>
      </div>

      {open && (
        <div className="absolute z-50 mt-1 w-48 rounded-lg border shadow-lg overflow-hidden" style={{ backgroundColor: "var(--bg-secondary)", borderColor: "var(--border)" }}>
          {ISSUE_LABELS.map((label) => {
            const isSelected = value.includes(label.id);
            return (
              <button
                key={label.id}
                onClick={() => toggle(label.id)}
                className={`w-full flex items-center gap-2 px-3 py-1.5 hover:bg-white/[0.05] transition-colors ${isSelected ? "bg-white/[0.03]" : ""}`}
              >
                <Tag size={10} style={{ color: "var(--text-muted)" }} />
                <span className={`${label.color} text-[10px] px-1.5 py-0.5 rounded`}>{label.name}</span>
                {isSelected && <span className="text-[10px] ml-auto" style={{ color: "var(--accent)" }}>✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
