"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Upload, FileText, Bot, Settings, Loader2, AlertCircle, Terminal, ClipboardPaste, CheckCircle2, Zap, X, GripVertical, Plus } from "lucide-react";

interface Props {
  onExtracted: (data: Record<string, unknown>) => void;
  onBatchStart?: (total: number) => void;
  onBatchProgress?: (completed: number, total: number, filename: string) => void;
}

type ExtractionMode = "cli" | "tinyclaw" | "import";

interface EngineStatus {
  engines: {
    claude_cli: { available: boolean; version?: string; error?: string };
    tinyclaw: { available: boolean };
    manual_import: { available: boolean };
  };
}

interface UploadedFile {
  id: string;
  name: string;
  content: string;
  size: number;
  label: string; // e.g., "GROUP: Atlas chat" or "PRIVATE: Sven ↔ Hjalti"
}

export default function UploadForm({ onExtracted, onBatchStart, onBatchProgress }: Props) {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [pastedText, setPastedText] = useState("");
  const [sourceType, setSourceType] = useState("whatsapp");
  const [contextLabel, setContextLabel] = useState("");
  const [customContext, setCustomContext] = useState("");
  const [mode, setMode] = useState<ExtractionMode>("cli");
  const [agentId, setAgentId] = useState("");
  const [manualJson, setManualJson] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [engines, setEngines] = useState<EngineStatus | null>(null);
  const [batchMode, setBatchMode] = useState<"combined" | "separate">("combined");
  const [progress, setProgress] = useState({ done: 0, total: 0, current: "" });
  const fileRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    fetch("/api/extract")
      .then((r) => r.json())
      .then((data: EngineStatus) => {
        setEngines(data);
        if (data.engines.claude_cli.available) setMode("cli");
        else if (data.engines.tinyclaw.available) setMode("tinyclaw");
        else setMode("import");
      })
      .catch(() => setMode("import"));
  }, []);

  const readFile = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (ev) => resolve(ev.target?.result as string);
      reader.onerror = reject;
      reader.readAsText(file);
    });

  const addFiles = useCallback(async (fileList: FileList | File[]) => {
    const newFiles: UploadedFile[] = [];
    for (const file of Array.from(fileList)) {
      const content = await readFile(file);
      newFiles.push({
        id: crypto.randomUUID(),
        name: file.name,
        content,
        size: file.size,
        label: "",
      });
    }
    setFiles((prev) => [...prev, ...newFiles]);
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(e.target.files);
    // Reset so re-uploading same file works
    e.target.value = "";
  };

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const updateFileLabel = (id: string, label: string) => {
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, label } : f)));
  };

  // Drag and drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  };
  const handleDragLeave = () => setDragging(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  };

  // Build combined conversation from all files + pasted text
  const buildConversation = (): string => {
    const parts: string[] = [];

    for (const file of files) {
      const header = file.label
        ? `\n${"=".repeat(60)}\n${file.label.toUpperCase()}: ${file.name}\n${"=".repeat(60)}\n`
        : `\n${"=".repeat(60)}\nFILE: ${file.name}\n${"=".repeat(60)}\n`;
      parts.push(header + file.content);
    }

    if (pastedText.trim()) {
      if (files.length > 0) {
        parts.push(`\n${"=".repeat(60)}\nPASTED TEXT\n${"=".repeat(60)}\n` + pastedText);
      } else {
        parts.push(pastedText);
      }
    }

    return parts.join("\n\n");
  };

  const buildFilename = (): string => {
    if (files.length === 0) return "pasted-conversation.txt";
    if (files.length === 1) return files[0].name;
    return files.map((f) => f.name).join(" + ");
  };

  const handleSubmit = async () => {
    if (mode === "import") {
      if (!manualJson.trim()) {
        setError("Paste the extraction JSON output from your Claude conversation");
        return;
      }
    } else {
      const hasContent = files.length > 0 || pastedText.trim();
      if (!hasContent) {
        setError("Upload at least one file or paste conversation text");
        return;
      }
    }

    setLoading(true);
    setError("");

    try {
      // ── Separate mode: one extraction per file ───────────────────
      if (batchMode === "separate" && files.length > 1 && mode !== "import") {
        const total = files.length;
        setProgress({ done: 0, total, current: files[0].name });
        onBatchStart?.(total);

        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          setProgress({ done: i, total, current: file.name });
          onBatchProgress?.(i, total, file.name);

          const payload: Record<string, unknown> = {
            conversation: file.content,
            source_filename: file.name,
            source_type: sourceType,
            context_label: file.label || contextLabel || undefined,
            custom_context: customContext || undefined,
          };

          if (mode === "tinyclaw") {
            payload.use_tinyclaw = true;
            payload.agent_id = agentId || "pipeline-analyst";
          }

          const res = await fetch("/api/extract", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

          const data = await res.json();
          if (!res.ok) throw new Error(`${file.name}: ${data.error || "Failed"}`);

          onExtracted(data);
        }

        setProgress({ done: total, total, current: "Done" });
        return;
      }

      // ── Combined mode: all files merged into one extraction ──────
      const payload: Record<string, unknown> = {
        source_filename: mode === "import" ? "manual-import.json" : buildFilename(),
        source_type: sourceType,
        context_label: contextLabel || undefined,
        custom_context: customContext || undefined,
      };

      if (mode === "import") {
        payload.manual_json = manualJson;
      } else if (mode === "tinyclaw") {
        payload.conversation = buildConversation();
        payload.use_tinyclaw = true;
        payload.agent_id = agentId || "pipeline-analyst";
      } else {
        payload.conversation = buildConversation();
      }

      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.details) throw new Error(data.details.join("\n"));
        throw new Error(data.error || "Extraction failed");
      }

      onExtracted(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const totalSize = files.reduce((sum, f) => sum + f.size, 0);
  const totalLines = files.reduce((sum, f) => sum + f.content.split("\n").length, 0)
    + (pastedText ? pastedText.split("\n").length : 0);

  const modeOptions: { key: ExtractionMode; label: string; icon: React.ReactNode; desc: string; available: boolean }[] = [
    {
      key: "cli",
      label: "Claude CLI",
      icon: <Terminal size={16} />,
      desc: "Direct extraction using your claude auth",
      available: engines?.engines.claude_cli.available ?? false,
    },
    {
      key: "tinyclaw",
      label: "TinyClaw Agent",
      icon: <Bot size={16} />,
      desc: "Route to a dedicated extraction agent",
      available: engines?.engines.tinyclaw.available ?? false,
    },
    {
      key: "import",
      label: "Import JSON",
      icon: <ClipboardPaste size={16} />,
      desc: "Paste output from a Claude chat session",
      available: true,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Extraction Mode Selector */}
      <div className="glass-card p-6">
        <h3 className="text-sm font-semibold text-white mb-4">Extraction Engine</h3>
        <div className="grid grid-cols-3 gap-3">
          {modeOptions.map((opt) => (
            <button
              key={opt.key}
              onClick={() => opt.available && setMode(opt.key)}
              disabled={!opt.available}
              className={`relative p-4 rounded-lg border text-left transition-all ${
                mode === opt.key
                  ? "border-brand-500/60 bg-brand-900/20"
                  : opt.available
                  ? "border-zinc-800 hover:border-zinc-700"
                  : "border-zinc-800/50 opacity-40 cursor-not-allowed"
              }`}
            >
              {opt.available && (
                <div className={`absolute top-2 right-2 w-2 h-2 rounded-full ${
                  mode === opt.key ? "bg-brand-400" : "bg-green-500/60"
                }`} />
              )}
              {!opt.available && (
                <span className="absolute top-2 right-2 text-[9px] text-zinc-600 uppercase">offline</span>
              )}
              <div className={`mb-2 ${mode === opt.key ? "text-brand-400" : "text-zinc-500"}`}>
                {opt.icon}
              </div>
              <div className="text-sm font-medium text-white">{opt.label}</div>
              <div className="text-[11px] text-zinc-500 mt-1">{opt.desc}</div>
            </button>
          ))}
        </div>

        {engines?.engines.claude_cli.version && mode === "cli" && (
          <p className="mt-3 text-xs text-zinc-600 flex items-center gap-1">
            <CheckCircle2 size={10} className="text-green-500" />
            {engines.engines.claude_cli.version}
          </p>
        )}

        {!engines?.engines.claude_cli.available && mode !== "import" && (
          <div className="mt-3 p-3 rounded-lg bg-zinc-900/70 border border-zinc-800 text-xs text-zinc-500 space-y-1">
            <p className="text-zinc-400 font-medium">Claude CLI not detected</p>
            <p>Install: <code className="text-zinc-300 bg-zinc-800 px-1 rounded">npm install -g @anthropic-ai/claude-code</code></p>
            <p>Authenticate: <code className="text-zinc-300 bg-zinc-800 px-1 rounded">claude login</code></p>
          </div>
        )}
      </div>

      {/* Input Area */}
      {mode === "import" ? (
        <div className="glass-card p-6">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
            <ClipboardPaste size={16} className="text-brand-400" />
            Paste Extraction JSON
          </h3>
          <p className="text-xs text-zinc-500 mb-3">
            Run the extraction prompt in any Claude session, then paste the JSON output here.
          </p>
          <textarea
            value={manualJson}
            onChange={(e) => setManualJson(e.target.value)}
            placeholder={`Paste extraction JSON here...\n\n{\n  "prospects": [...],\n  "action_items": [...],\n  "executive_summary": "..."\n}`}
            className="w-full h-60 bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-sm text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-brand-500/50 resize-y font-mono"
          />
          <div className="mt-3 flex gap-2">
            <input
              value={contextLabel}
              onChange={(e) => setContextLabel(e.target.value)}
              placeholder="Source filename (optional)"
              className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-brand-500/50"
            />
            <select
              value={sourceType}
              onChange={(e) => setSourceType(e.target.value)}
              className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-300 focus:outline-none focus:border-brand-500/50"
            >
              <option value="whatsapp">WhatsApp</option>
              <option value="slack">Slack</option>
              <option value="email">Email</option>
              <option value="transcript">Transcript</option>
              <option value="manual">Manual</option>
            </select>
          </div>
        </div>
      ) : (
        <>
          {/* Multi-File Upload */}
          <div className="glass-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Upload size={16} className="text-brand-400" />
                Upload Conversations
              </h3>
              {files.length > 0 && (
                <span className="text-xs text-zinc-500">
                  {files.length} file{files.length !== 1 ? "s" : ""} &middot; {formatSize(totalSize)} &middot; ~{totalLines.toLocaleString()} lines
                </span>
              )}
            </div>

            {/* Drop zone */}
            <div
              ref={dropRef}
              onClick={() => fileRef.current?.click()}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                dragging
                  ? "border-brand-500 bg-brand-900/10"
                  : "border-zinc-700 hover:border-brand-500/50"
              }`}
            >
              <FileText size={28} className="mx-auto text-zinc-600 mb-2" />
              <p className="text-sm text-zinc-400">
                {files.length === 0
                  ? "Drop conversation exports here, or click to browse"
                  : "Drop more files to add them"}
              </p>
              <p className="text-xs text-zinc-600 mt-1">
                .txt, .csv, .json, .md &mdash; multiple files supported
              </p>
              <input
                ref={fileRef}
                type="file"
                accept=".txt,.csv,.json,.md"
                multiple
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>

            {/* File List */}
            {files.length > 0 && (
              <div className="mt-4 space-y-2">
                {files.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center gap-3 p-3 rounded-lg border border-zinc-800 bg-zinc-900/50 group"
                  >
                    <GripVertical size={14} className="text-zinc-700 shrink-0" />
                    <FileText size={16} className="text-brand-400 shrink-0" />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-zinc-300 truncate">{file.name}</span>
                        <span className="text-[10px] text-zinc-600 shrink-0">{formatSize(file.size)}</span>
                      </div>
                      <input
                        value={file.label}
                        onChange={(e) => updateFileLabel(file.id, e.target.value)}
                        placeholder="Label (e.g., GROUP: Team chat, PRIVATE: Sven ↔ Hjalti)"
                        className="mt-1 w-full bg-transparent border-none text-xs text-zinc-500 placeholder-zinc-700 focus:outline-none focus:text-zinc-300"
                      />
                    </div>

                    <button
                      onClick={() => removeFile(file.id)}
                      className="p-1 rounded hover:bg-zinc-800 text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all shrink-0"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}

                {/* Add more button */}
                <button
                  onClick={() => fileRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 p-2 rounded-lg border border-dashed border-zinc-800 text-xs text-zinc-600 hover:text-zinc-400 hover:border-zinc-700 transition-colors"
                >
                  <Plus size={12} />
                  Add more files
                </button>
              </div>
            )}

            {/* Batch mode selector (only for 2+ files) */}
            {files.length > 1 && (
              <div className="mt-4 p-3 rounded-lg bg-zinc-900/70 border border-zinc-800">
                <p className="text-xs text-zinc-500 mb-2">Multi-file processing mode:</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setBatchMode("combined")}
                    className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                      batchMode === "combined"
                        ? "bg-brand-600/20 text-brand-400 border border-brand-500/30"
                        : "bg-zinc-800/50 text-zinc-500 border border-zinc-800 hover:text-zinc-400"
                    }`}
                  >
                    Combined
                    <span className="block text-[10px] opacity-60 mt-0.5">
                      Merge all files into one extraction (cross-references)
                    </span>
                  </button>
                  <button
                    onClick={() => setBatchMode("separate")}
                    className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                      batchMode === "separate"
                        ? "bg-brand-600/20 text-brand-400 border border-brand-500/30"
                        : "bg-zinc-800/50 text-zinc-500 border border-zinc-800 hover:text-zinc-400"
                    }`}
                  >
                    Separate
                    <span className="block text-[10px] opacity-60 mt-0.5">
                      One extraction per file ({files.length} extractions)
                    </span>
                  </button>
                </div>
              </div>
            )}

            {/* Paste text area */}
            <div className="mt-4">
              <p className="text-xs text-zinc-500 mb-2">Or paste additional text:</p>
              <textarea
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                placeholder="Paste conversation text here (will be appended to uploaded files)..."
                className="w-full h-28 bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-sm text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-brand-500/50 resize-y"
              />
            </div>
          </div>

          {/* Configuration */}
          <div className="glass-card p-6">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
              <Settings size={16} className="text-brand-400" />
              Configuration
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Source Type</label>
                <select
                  value={sourceType}
                  onChange={(e) => setSourceType(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-300 focus:outline-none focus:border-brand-500/50"
                >
                  <option value="whatsapp">WhatsApp</option>
                  <option value="slack">Slack</option>
                  <option value="email">Email Thread</option>
                  <option value="transcript">Meeting Transcript</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Context Label</label>
                <input
                  value={contextLabel}
                  onChange={(e) => setContextLabel(e.target.value)}
                  placeholder="e.g., Team Chat, 1:1 Call"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-brand-500/50"
                />
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-xs text-zinc-500 mb-1">Business Context (optional)</label>
              <textarea
                value={customContext}
                onChange={(e) => setCustomContext(e.target.value)}
                placeholder="Describe your business, team roles, products, etc. for more accurate extraction..."
                className="w-full h-20 bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-sm text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-brand-500/50 resize-y"
              />
            </div>

            {mode === "tinyclaw" && (
              <div className="mt-4">
                <label className="block text-xs text-zinc-500 mb-1">Agent ID</label>
                <input
                  value={agentId}
                  onChange={(e) => setAgentId(e.target.value)}
                  placeholder="pipeline-analyst (or leave empty for default)"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-brand-500/50"
                />
              </div>
            )}
          </div>
        </>
      )}

      {/* Error */}
      {error && (
        <div className="p-4 rounded-lg bg-red-900/20 border border-red-800/30 text-red-400 text-sm">
          <div className="flex items-center gap-2 mb-1">
            <AlertCircle size={16} />
            <span className="font-medium">Error</span>
          </div>
          <pre className="text-xs whitespace-pre-wrap mt-1 text-red-400/80">{error}</pre>
        </div>
      )}

      {/* Progress (batch mode) */}
      {loading && progress.total > 1 && (
        <div className="glass-card p-4">
          <div className="flex items-center justify-between text-xs text-zinc-400 mb-2">
            <span>Processing {progress.current}...</span>
            <span>{progress.done}/{progress.total}</span>
          </div>
          <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-brand-500 rounded-full transition-all duration-500"
              style={{ width: `${(progress.done / progress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={loading}
        className="w-full py-3 rounded-lg bg-brand-600 hover:bg-brand-700 disabled:bg-zinc-800 disabled:text-zinc-600 text-white font-medium text-sm transition-colors flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            {mode === "import"
              ? "Importing..."
              : progress.total > 1
              ? `Extracting ${progress.done + 1}/${progress.total}...`
              : "Extracting Pipeline Intelligence..."}
          </>
        ) : (
          <>
            <Zap size={16} />
            {mode === "import"
              ? "Import Pipeline"
              : batchMode === "separate" && files.length > 1
              ? `Extract ${files.length} Pipelines`
              : "Extract Pipeline"}
          </>
        )}
      </button>
    </div>
  );
}
