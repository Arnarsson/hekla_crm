"use client";

import { useState } from "react";
import { Activity, ExternalLink, Check, X, Settings, Webhook } from "lucide-react";

interface Integration {
  id: string;
  name: string;
  desc: string;
  category: "communication" | "project" | "productivity" | "automation";
  status: "available" | "connected" | "coming_soon";
  webhookConfigurable: boolean;
}

const INTEGRATIONS: Integration[] = [
  { id: "slack", name: "Slack", desc: "Import conversations and threads for extraction", category: "communication", status: "available", webhookConfigurable: true },
  { id: "gmail", name: "Gmail", desc: "Extract insights from email threads", category: "communication", status: "available", webhookConfigurable: true },
  { id: "linear", name: "Linear", desc: "Sync issues and track progress", category: "project", status: "available", webhookConfigurable: true },
  { id: "github", name: "GitHub", desc: "Track issues, PRs, and discussions", category: "project", status: "available", webhookConfigurable: true },
  { id: "notion", name: "Notion", desc: "Sync meeting notes and documents", category: "productivity", status: "available", webhookConfigurable: true },
  { id: "gcal", name: "Google Calendar", desc: "Calendar events and scheduling context", category: "productivity", status: "coming_soon", webhookConfigurable: false },
  { id: "zapier", name: "Zapier", desc: "Multi-step automations and workflows", category: "automation", status: "coming_soon", webhookConfigurable: false },
  { id: "whatsapp", name: "WhatsApp", desc: "Business conversation extraction", category: "communication", status: "available", webhookConfigurable: true },
];

const CATEGORY_LABELS: Record<string, string> = {
  communication: "Communication",
  project: "Project Management",
  productivity: "Productivity",
  automation: "Automation",
};

export default function IntegrationsPage() {
  const [webhooks, setWebhooks] = useState<Record<string, string>>({});
  const [configuring, setConfiguring] = useState<string | null>(null);
  const [webhookInput, setWebhookInput] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  const saveWebhook = (id: string) => {
    setWebhooks((w) => ({ ...w, [id]: webhookInput }));
    setConfiguring(null);
    setWebhookInput("");
    setToast(`${INTEGRATIONS.find((i) => i.id === id)?.name} webhook saved`);
    setTimeout(() => setToast(null), 2000);
  };

  const removeWebhook = (id: string) => {
    setWebhooks((w) => {
      const next = { ...w };
      delete next[id];
      return next;
    });
    setToast("Webhook removed");
    setTimeout(() => setToast(null), 2000);
  };

  const categories = Array.from(new Set(INTEGRATIONS.map((i) => i.category)));

  return (
    <div className="page-container">
      <div>
        <h1 className="page-title flex items-center gap-2">
          <Activity size={20} style={{ color: "var(--accent)" }} />
          Integrations
        </h1>
        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
          Connect your tools to enrich Mission Control intelligence
        </p>
      </div>

      {/* Webhook info */}
      <div className="surface p-3 mt-3 flex items-start gap-2">
        <Webhook size={14} className="shrink-0 mt-0.5" style={{ color: "var(--accent)" }} />
        <div>
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
            Configure webhook URLs to receive data from external services. Webhooks push conversation data to Hekla for automatic extraction and CRM updates.
          </p>
          <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>
            Incoming webhook endpoint: <code className="px-1 py-0.5 rounded bg-zinc-800 text-[10px]">{typeof window !== "undefined" ? window.location.origin : ""}/api/extract</code>
          </p>
        </div>
      </div>

      {/* Integration grid by category */}
      {categories.map((cat) => (
        <div key={cat} className="mt-5">
          <h2 className="text-[10px] uppercase tracking-wider font-medium mb-2 px-1" style={{ color: "var(--text-muted)" }}>
            {CATEGORY_LABELS[cat]}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {INTEGRATIONS.filter((i) => i.category === cat).map((integration) => {
              const isConnected = !!webhooks[integration.id];
              const isConfiguring = configuring === integration.id;

              return (
                <div key={integration.id} className="surface p-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>
                          {integration.name}
                        </span>
                        {isConnected && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-green-900/20 text-green-400 flex items-center gap-0.5">
                            <Check size={8} /> Connected
                          </span>
                        )}
                        {integration.status === "coming_soon" && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-800/50" style={{ color: "var(--text-muted)" }}>
                            Coming soon
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                        {integration.desc}
                      </p>
                    </div>
                    <div className="flex gap-1 shrink-0 ml-2">
                      {isConnected ? (
                        <>
                          <button
                            onClick={() => { setConfiguring(integration.id); setWebhookInput(webhooks[integration.id]); }}
                            className="btn btn-surface btn-xs"
                            title="Configure"
                          >
                            <Settings size={10} />
                          </button>
                          <button onClick={() => removeWebhook(integration.id)} className="btn btn-xs bg-red-900/20 text-red-400 hover:bg-red-900/30">
                            <X size={10} />
                          </button>
                        </>
                      ) : integration.webhookConfigurable ? (
                        <button
                          onClick={() => { setConfiguring(integration.id); setWebhookInput(""); }}
                          className="btn btn-primary btn-xs"
                        >
                          Connect
                        </button>
                      ) : null}
                    </div>
                  </div>

                  {/* Configure webhook form */}
                  {isConfiguring && (
                    <div className="mt-2 flex gap-2">
                      <input
                        value={webhookInput}
                        onChange={(e) => setWebhookInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && saveWebhook(integration.id)}
                        placeholder={`${integration.name} webhook URL...`}
                        className="input flex-1 text-[10px]"
                        autoFocus
                      />
                      <button onClick={() => saveWebhook(integration.id)} className="btn btn-primary btn-xs">Save</button>
                      <button onClick={() => setConfiguring(null)} className="btn btn-surface btn-xs">Cancel</button>
                    </div>
                  )}

                  {/* Show saved webhook */}
                  {isConnected && !isConfiguring && (
                    <div className="mt-1.5 text-[10px] font-mono truncate" style={{ color: "var(--text-muted)" }}>
                      {webhooks[integration.id]}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
