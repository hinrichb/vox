"use client";

import { useState, useEffect, useCallback } from "react";
import { Settings, Mode, AVAILABLE_MODELS, LANGUAGES, DEFAULT_SETTINGS, HotkeyConfig } from "@/types/settings";
import { getSettings, saveSettings } from "@/lib/storage";

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [editingMode, setEditingMode] = useState<Mode | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [newModeName, setNewModeName] = useState("");
  const [newModePrompt, setNewModePrompt] = useState("");
  const [showAddMode, setShowAddMode] = useState(false);
  const [recordingShortcut, setRecordingShortcut] = useState(false);

  useEffect(() => {
    setSettings(getSettings());
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setSettings(getSettings());
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!recordingShortcut) return;
    e.preventDefault();
    e.stopPropagation();

    if (['Alt', 'Control', 'Shift', 'Meta'].includes(e.key)) return;

    const modifiers: string[] = [];
    if (e.altKey) modifiers.push('Alt');
    if (e.ctrlKey) modifiers.push('Ctrl');
    if (e.shiftKey) modifiers.push('Shift');
    if (e.metaKey) modifiers.push('Cmd');

    if (modifiers.length === 0) return;

    let key = e.key.toUpperCase();
    if (e.code.startsWith('Key')) key = e.code.replace('Key', '');
    else if (e.code.startsWith('Digit')) key = e.code.replace('Digit', '');
    else if (e.code === 'Space') key = 'Space';

    const labelParts = [...modifiers.map(m => m === 'Alt' ? 'Option' : m), key];
    const label = labelParts.join(' + ');

    const newHotkey: HotkeyConfig = { modifiers, key, label };
    updateSettings({ hotkey: newHotkey });
    setRecordingShortcut(false);
  }, [recordingShortcut]);

  useEffect(() => {
    if (recordingShortcut) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [recordingShortcut, handleKeyDown]);

  const updateSettings = async (updates: Partial<Settings>) => {
    const newSettings = { ...settings, ...updates };
    setSettings(newSettings);
    saveSettings(newSettings);

    if (updates.hotkey && updates.hotkey !== settings.hotkey) {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("change_hotkey", { hotkey: updates.hotkey });
      } catch (e) {
        console.error("Failed to change hotkey:", e);
      }
    }
  };

  const updateMode = (modeId: string, updates: Partial<Mode>) => {
    const newModes = settings.modes.map(m => m.id === modeId ? { ...m, ...updates } : m);
    updateSettings({ modes: newModes });
  };

  const deleteMode = (modeId: string) => {
    if (modeId === "normal") return;
    const newModes = settings.modes.filter(m => m.id !== modeId);
    const newSelectedId = settings.selectedModeId === modeId ? "normal" : settings.selectedModeId;
    updateSettings({ modes: newModes, selectedModeId: newSelectedId });
    setEditingMode(null);
  };

  const addMode = () => {
    if (!newModeName.trim()) return;
    const id = `custom-${Date.now()}`;
    const newMode: Mode = { id, name: newModeName.trim(), prompt: newModePrompt.trim() };
    updateSettings({ modes: [...settings.modes, newMode] });
    setNewModeName("");
    setNewModePrompt("");
    setShowAddMode(false);
  };

  const selectedMode = settings.modes.find(m => m.id === settings.selectedModeId) || settings.modes[0];

  return (
    <div style={{
      height: "100vh",
      background: "linear-gradient(180deg, #fafafa 0%, #f5f5f5 100%)",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, sans-serif",
      padding: "40px",
      overflow: "auto",
      boxSizing: "border-box",
    }}>
      <div style={{ maxWidth: "640px", margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: "40px", textAlign: "center" }}>
          <h1 style={{
            fontSize: "42px",
            fontWeight: "800",
            color: "#0a0a0a",
            margin: "0 0 8px 0",
            letterSpacing: "-1.5px",
          }}>Vox</h1>
          <p style={{ fontSize: "14px", color: "#888", margin: "0 0 16px 0" }}>Voice to text, reimagined</p>
          <p style={{
            fontSize: "13px",
            color: "#666",
            margin: 0,
            lineHeight: "1.6",
            maxWidth: "400px",
            marginLeft: "auto",
            marginRight: "auto",
          }}>
            Press the shortcut to start recording. Press again to transcribe and copy to clipboard. Press <strong>ESC</strong> to cancel.
          </p>
        </div>

        {/* Shortcut Hero Card */}
        <div
          onClick={() => setRecordingShortcut(true)}
          style={{
            background: recordingShortcut
              ? "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)"
              : "linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)",
            borderRadius: "24px",
            padding: "32px",
            marginBottom: "32px",
            cursor: "pointer",
            transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
            boxShadow: recordingShortcut
              ? "0 20px 40px -12px rgba(99, 102, 241, 0.4)"
              : "0 20px 40px -12px rgba(0, 0, 0, 0.25)",
            transform: recordingShortcut ? "scale(1.02)" : "scale(1)",
          }}
        >
          <div style={{
            color: "rgba(255,255,255,0.6)",
            fontSize: "13px",
            fontWeight: "500",
            marginBottom: "16px",
            textTransform: "uppercase",
            letterSpacing: "1px",
          }}>
            {recordingShortcut ? "Press new shortcut..." : "Recording Shortcut"}
          </div>
          <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
            {!recordingShortcut && settings.hotkey.label.split(' + ').map((key, i, arr) => (
              <span key={i} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{
                  background: "rgba(255,255,255,0.15)",
                  backdropFilter: "blur(10px)",
                  padding: "12px 24px",
                  borderRadius: "14px",
                  color: "#fff",
                  fontSize: "18px",
                  fontWeight: "600",
                  border: "1px solid rgba(255,255,255,0.1)",
                }}>
                  {key}
                </span>
                {i < arr.length - 1 && <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "18px" }}>+</span>}
              </span>
            ))}
            {recordingShortcut && (
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  background: "#fff",
                  animation: "pulse 1.5s infinite",
                }} />
                <span style={{ color: "rgba(255,255,255,0.9)", fontSize: "16px", fontWeight: "500" }}>
                  Listening...
                </span>
              </div>
            )}
          </div>
          <p style={{
            color: "rgba(255,255,255,0.4)",
            fontSize: "12px",
            margin: "16px 0 0 0",
          }}>
            Click to change
          </p>
        </div>

        {/* Stats Row */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "16px",
          marginBottom: "32px"
        }}>
          {[
            { value: settings.stats?.totalRecordings || 0, label: "Recordings", color: "#3b82f6" },
            { value: settings.stats?.totalWords || 0, label: "Words", color: "#10b981" },
            { value: settings.stats?.totalCharacters || 0, label: "Characters", color: "#8b5cf6" },
          ].map((stat, i) => (
            <div key={i} style={{
              background: "white",
              borderRadius: "20px",
              padding: "24px",
              textAlign: "center",
              boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
              border: "1px solid rgba(0,0,0,0.04)",
            }}>
              <div style={{
                fontSize: "28px",
                fontWeight: "700",
                color: "#1a1a1a",
                marginBottom: "4px",
              }}>
                {stat.value.toLocaleString()}
              </div>
              <div style={{
                fontSize: "12px",
                color: "#888",
                fontWeight: "500",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        {/* Mode Selection */}
        <div style={{
          background: "white",
          borderRadius: "24px",
          padding: "28px",
          marginBottom: "24px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
          border: "1px solid rgba(0,0,0,0.04)",
        }}>
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "20px",
          }}>
            <h2 style={{
              fontSize: "13px",
              fontWeight: "600",
              color: "#888",
              margin: 0,
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}>
              Mode
            </h2>
            <button
              onClick={() => setShowAddMode(true)}
              style={{
                background: "linear-gradient(135deg, #1a1a1a 0%, #333 100%)",
                border: "none",
                color: "white",
                fontSize: "12px",
                fontWeight: "600",
                padding: "10px 20px",
                borderRadius: "100px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                transition: "all 0.2s",
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              New Mode
            </button>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
            {settings.modes.map(mode => {
              const isActive = settings.selectedModeId === mode.id;
              return (
                <button
                  key={mode.id}
                  onClick={() => updateSettings({ selectedModeId: mode.id })}
                  style={{
                    padding: "12px 24px",
                    borderRadius: "100px",
                    border: "none",
                    background: isActive
                      ? "linear-gradient(135deg, #1a1a1a 0%, #333 100%)"
                      : "#f5f5f5",
                    color: isActive ? "white" : "#666",
                    cursor: "pointer",
                    fontSize: "14px",
                    fontWeight: "500",
                    transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  {mode.name}
                  {mode.id !== "normal" && (
                    <span
                      onClick={(e) => { e.stopPropagation(); setEditingMode(mode); }}
                      style={{
                        width: "20px",
                        height: "20px",
                        borderRadius: "50%",
                        background: isActive ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.08)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        marginLeft: "4px",
                      }}
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {selectedMode.prompt && (
            <div style={{
              marginTop: "20px",
              padding: "16px 20px",
              background: "#f8f8f8",
              borderRadius: "16px",
              fontSize: "13px",
              color: "#666",
              lineHeight: "1.5",
            }}>
              {selectedMode.prompt}
            </div>
          )}
        </div>

        {/* Settings Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "24px" }}>
          {/* Language Card */}
          <div style={{
            background: "white",
            borderRadius: "24px",
            padding: "24px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
            border: "1px solid rgba(0,0,0,0.04)",
          }}>
            <label style={{
              fontSize: "13px",
              fontWeight: "600",
              color: "#888",
              display: "block",
              marginBottom: "12px",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}>
              Language
            </label>
            <select
              value={settings.language}
              onChange={(e) => updateSettings({ language: e.target.value })}
              style={{
                width: "100%",
                padding: "14px 18px",
                fontSize: "14px",
                fontWeight: "500",
                border: "none",
                borderRadius: "14px",
                outline: "none",
                backgroundColor: "#f5f5f5",
                cursor: "pointer",
                color: "#1a1a1a",
              }}
            >
              {LANGUAGES.map(lang => (
                <option key={lang.code} value={lang.code}>{lang.name}</option>
              ))}
            </select>
          </div>

          {/* Model Card */}
          <div style={{
            background: "white",
            borderRadius: "24px",
            padding: "24px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
            border: "1px solid rgba(0,0,0,0.04)",
          }}>
            <label style={{
              fontSize: "13px",
              fontWeight: "600",
              color: "#888",
              display: "block",
              marginBottom: "12px",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}>
              AI Model
            </label>
            <select
              value={settings.selectedModel}
              onChange={(e) => updateSettings({ selectedModel: e.target.value })}
              style={{
                width: "100%",
                padding: "14px 18px",
                fontSize: "14px",
                fontWeight: "500",
                border: "none",
                borderRadius: "14px",
                outline: "none",
                backgroundColor: "#f5f5f5",
                cursor: "pointer",
                color: "#1a1a1a",
              }}
            >
              {AVAILABLE_MODELS.map(model => (
                <option key={model.id} value={model.id}>{model.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* API Key Card */}
        <div style={{
          background: "white",
          borderRadius: "24px",
          padding: "28px",
          marginBottom: "24px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
          border: "1px solid rgba(0,0,0,0.04)",
        }}>
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "16px",
          }}>
            <label style={{
              fontSize: "13px",
              fontWeight: "600",
              color: "#888",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}>
              OpenRouter API Key
            </label>
            <button
              onClick={() => setShowApiKey(!showApiKey)}
              style={{
                background: "#f5f5f5",
                border: "none",
                color: "#666",
                fontSize: "12px",
                fontWeight: "500",
                cursor: "pointer",
                padding: "8px 16px",
                borderRadius: "100px",
                transition: "all 0.2s",
              }}
            >
              {showApiKey ? "Hide" : "Show"}
            </button>
          </div>
          <input
            type={showApiKey ? "text" : "password"}
            value={settings.openRouterApiKey}
            onChange={(e) => updateSettings({ openRouterApiKey: e.target.value })}
            placeholder="sk-or-v1-..."
            style={{
              width: "100%",
              padding: "16px 20px",
              fontSize: "14px",
              border: "none",
              borderRadius: "14px",
              outline: "none",
              backgroundColor: "#f5f5f5",
              fontFamily: "monospace",
              boxSizing: "border-box",
            }}
          />
          <p style={{
            fontSize: "12px",
            color: "#888",
            margin: "16px 0 0 0",
            lineHeight: "1.5",
          }}>
            Get your API key from{" "}
            <a
              href="https://openrouter.ai/keys"
              target="_blank"
              rel="noopener"
              style={{
                color: "#6366f1",
                textDecoration: "none",
                fontWeight: "500",
              }}
            >
              openrouter.ai/keys
            </a>
          </p>
        </div>

        {/* Footer */}
        <div style={{ textAlign: "center", padding: "20px 0" }}>
          <p style={{ fontSize: "12px", color: "#bbb", margin: 0 }}>
            Vox v0.1.0
          </p>
        </div>
      </div>

      {/* Add Mode Modal */}
      {showAddMode && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
            zIndex: 100
          }}
          onClick={() => { setShowAddMode(false); setNewModeName(""); setNewModePrompt(""); }}
        >
          <div
            style={{
              background: "white",
              borderRadius: "28px",
              padding: "32px",
              width: "100%",
              maxWidth: "440px",
              boxShadow: "0 24px 48px -12px rgba(0, 0, 0, 0.25)",
            }}
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{
              fontSize: "22px",
              fontWeight: "700",
              margin: "0 0 28px 0",
              letterSpacing: "-0.3px",
            }}>
              New Mode
            </h3>
            <div style={{ marginBottom: "20px" }}>
              <label style={{
                fontSize: "13px",
                fontWeight: "600",
                color: "#888",
                display: "block",
                marginBottom: "10px",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}>
                Name
              </label>
              <input
                type="text"
                value={newModeName}
                onChange={e => setNewModeName(e.target.value)}
                placeholder="e.g., Summarize"
                style={{
                  width: "100%",
                  padding: "16px 20px",
                  fontSize: "15px",
                  border: "none",
                  borderRadius: "14px",
                  outline: "none",
                  backgroundColor: "#f5f5f5",
                  boxSizing: "border-box",
                }}
                autoFocus
              />
            </div>
            <div style={{ marginBottom: "28px" }}>
              <label style={{
                fontSize: "13px",
                fontWeight: "600",
                color: "#888",
                display: "block",
                marginBottom: "10px",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}>
                AI Prompt
              </label>
              <textarea
                value={newModePrompt}
                onChange={e => setNewModePrompt(e.target.value)}
                placeholder="e.g., Summarize the following text in 2-3 sentences..."
                style={{
                  width: "100%",
                  padding: "16px 20px",
                  fontSize: "15px",
                  border: "none",
                  borderRadius: "14px",
                  outline: "none",
                  backgroundColor: "#f5f5f5",
                  minHeight: "120px",
                  resize: "vertical",
                  fontFamily: "inherit",
                  boxSizing: "border-box",
                  lineHeight: "1.5",
                }}
              />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
              <button
                onClick={() => { setShowAddMode(false); setNewModeName(""); setNewModePrompt(""); }}
                style={{
                  padding: "14px 28px",
                  borderRadius: "100px",
                  border: "none",
                  background: "#f5f5f5",
                  color: "#666",
                  fontSize: "14px",
                  fontWeight: "600",
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
              >
                Cancel
              </button>
              <button
                onClick={addMode}
                disabled={!newModeName.trim()}
                style={{
                  padding: "14px 32px",
                  borderRadius: "100px",
                  border: "none",
                  background: newModeName.trim()
                    ? "linear-gradient(135deg, #1a1a1a 0%, #333 100%)"
                    : "#e5e5e5",
                  color: newModeName.trim() ? "white" : "#999",
                  fontSize: "14px",
                  fontWeight: "600",
                  cursor: newModeName.trim() ? "pointer" : "default",
                  transition: "all 0.2s",
                }}
              >
                Create Mode
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Mode Modal */}
      {editingMode && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
            zIndex: 100
          }}
          onClick={() => setEditingMode(null)}
        >
          <div
            style={{
              background: "white",
              borderRadius: "28px",
              padding: "32px",
              width: "100%",
              maxWidth: "440px",
              boxShadow: "0 24px 48px -12px rgba(0, 0, 0, 0.25)",
            }}
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{
              fontSize: "22px",
              fontWeight: "700",
              margin: "0 0 28px 0",
              letterSpacing: "-0.3px",
            }}>
              Edit Mode
            </h3>
            <div style={{ marginBottom: "20px" }}>
              <label style={{
                fontSize: "13px",
                fontWeight: "600",
                color: "#888",
                display: "block",
                marginBottom: "10px",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}>
                Name
              </label>
              <input
                type="text"
                value={editingMode.name}
                onChange={e => {
                  setEditingMode({ ...editingMode, name: e.target.value });
                  updateMode(editingMode.id, { name: e.target.value });
                }}
                style={{
                  width: "100%",
                  padding: "16px 20px",
                  fontSize: "15px",
                  border: "none",
                  borderRadius: "14px",
                  outline: "none",
                  backgroundColor: "#f5f5f5",
                  boxSizing: "border-box",
                }}
              />
            </div>
            <div style={{ marginBottom: "28px" }}>
              <label style={{
                fontSize: "13px",
                fontWeight: "600",
                color: "#888",
                display: "block",
                marginBottom: "10px",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}>
                Prompt
              </label>
              <textarea
                value={editingMode.prompt}
                onChange={e => {
                  setEditingMode({ ...editingMode, prompt: e.target.value });
                  updateMode(editingMode.id, { prompt: e.target.value });
                }}
                style={{
                  width: "100%",
                  padding: "16px 20px",
                  fontSize: "15px",
                  border: "none",
                  borderRadius: "14px",
                  outline: "none",
                  backgroundColor: "#f5f5f5",
                  minHeight: "120px",
                  resize: "vertical",
                  fontFamily: "inherit",
                  boxSizing: "border-box",
                  lineHeight: "1.5",
                }}
              />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <button
                onClick={() => deleteMode(editingMode.id)}
                style={{
                  padding: "14px 24px",
                  borderRadius: "100px",
                  border: "none",
                  background: "#fef2f2",
                  color: "#ef4444",
                  fontSize: "14px",
                  fontWeight: "600",
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
              >
                Delete
              </button>
              <button
                onClick={() => setEditingMode(null)}
                style={{
                  padding: "14px 32px",
                  borderRadius: "100px",
                  border: "none",
                  background: "linear-gradient(135deg, #1a1a1a 0%, #333 100%)",
                  color: "white",
                  fontSize: "14px",
                  fontWeight: "600",
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
