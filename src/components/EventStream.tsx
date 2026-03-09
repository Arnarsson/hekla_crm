"use client";

import { useEffect, useState, useRef } from "react";
import { Radio, Zap } from "lucide-react";

interface StreamEvent {
  type: string;
  data: Record<string, unknown>;
  timestamp: string;
}

export default function EventStream() {
  const [events, setEvents] = useState<StreamEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const tinyClawUrl = "http://localhost:3777";
    let eventSource: EventSource | null = null;

    try {
      eventSource = new EventSource(`${tinyClawUrl}/api/events/stream`);

      eventSource.onopen = () => setConnected(true);

      eventSource.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          setEvents((prev) => [...prev.slice(-49), { ...data, timestamp: data.timestamp || new Date().toISOString() }]);
        } catch {}
      };

      eventSource.onerror = () => {
        setConnected(false);
      };
    } catch {
      setConnected(false);
    }

    return () => {
      eventSource?.close();
    };
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events]);

  return (
    <div className="surface p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
          <Radio size={16} style={{ color: "var(--accent)" }} /> Event Stream
        </h3>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${connected ? "bg-green-500" : "bg-red-500"}`} />
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>{connected ? "Live" : "Disconnected"}</span>
        </div>
      </div>

      <div ref={scrollRef} className="h-80 overflow-y-auto space-y-1 font-mono text-xs">
        {events.length === 0 ? (
          <div className="text-center py-8" style={{ color: "var(--text-muted)" }}>
            {connected ? "Waiting for events..." : "Connect TinyClaw at :3777 to see events"}
          </div>
        ) : (
          events.map((e, i) => (
            <div key={i} className="flex items-start gap-2 py-1 border-b" style={{ borderColor: "var(--border)" }}>
              <Zap size={10} className="mt-1 shrink-0" style={{ color: "var(--accent)" }} />
              <span style={{ color: "var(--text-muted)" }}>{new Date(e.timestamp).toLocaleTimeString()}</span>
              <span style={{ color: "var(--accent)" }}>{e.type}</span>
              <span className="truncate" style={{ color: "var(--text-secondary)" }}>{JSON.stringify(e.data).slice(0, 80)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
