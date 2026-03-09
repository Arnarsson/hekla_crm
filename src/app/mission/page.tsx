"use client";

import { useEffect, useState } from "react";
import AgentPanel from "@/components/AgentPanel";
import EventStream from "@/components/EventStream";
import { Radio, Cpu, Wifi, WifiOff } from "lucide-react";

export default function MissionPage() {
  const [brainStatus, setBrainStatus] = useState<{ online: boolean; url: string } | null>(null);

  useEffect(() => {
    fetch("/api/brain").then((r) => r.json()).then(setBrainStatus).catch(console.error);
  }, []);

  return (
    <div className="page-container">
      <div>
        <h1 className="page-title flex items-center gap-2">
          <Radio size={20} style={{ color: "var(--accent)" }} /> Mission Control
        </h1>
        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Agent status, events, and system health</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="surface p-5">
          <h3 className="text-sm font-semibold flex items-center gap-2 mb-3" style={{ color: "var(--text-primary)" }}>
            <Cpu size={16} style={{ color: "var(--accent)" }} /> Brain Service
          </h3>
          {brainStatus ? (
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${brainStatus.online ? "bg-green-500" : "bg-red-500"}`} />
              <div>
                <span className="text-sm" style={{ color: "var(--text-primary)" }}>{brainStatus.online ? "Online" : "Offline"}</span>
                <span className="block text-xs" style={{ color: "var(--text-muted)" }}>{brainStatus.url}</span>
              </div>
              {brainStatus.online ? <Wifi size={16} className="text-green-400 ml-auto" /> : <WifiOff size={16} className="text-red-400 ml-auto" />}
            </div>
          ) : (
            <div className="text-sm" style={{ color: "var(--text-muted)" }}>Checking...</div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <AgentPanel />
        </div>
        <div>
          <EventStream />
        </div>
      </div>
    </div>
  );
}
