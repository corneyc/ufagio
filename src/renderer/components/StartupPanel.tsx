import React, { useEffect, useState } from "react";
import { StartupItem } from "../../shared/types";
import { colors, fontFamily } from "../theme";
import { SecondaryButton } from "./ui";

const SOURCE_LABEL: Record<StartupItem["source"], string> = {
  "registry-run": "Registry (Run key)",
  "startup-folder": "Startup folder",
  "login-item": "Login item",
  "launch-agent": "Launch agent",
};

export function StartupPanel() {
  const [items, setItems] = useState<StartupItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setItems(await window.api.listStartupItems());
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function toggle(item: StartupItem) {
    setBusyId(item.id);
    setError(null);
    const res = await window.api.toggleStartupItem(item.id, !item.enabled);
    if (!res.ok) setError(res.error ?? "Failed to update this item.");
    await load();
    setBusyId(null);
  }

  return (
    <div style={{ fontFamily, maxWidth: 760 }}>
      <h2 style={{ marginTop: 0 }}>Startup Manager</h2>
      <p style={{ color: colors.textMuted, fontSize: 13.5, lineHeight: 1.5 }}>
        Toggle what launches at login. Disabling an item backs up its original command so you can
        re-enable it later — nothing is deleted, only turned off.
      </p>

      <SecondaryButton onClick={load} disabled={loading} style={{ margin: "16px 0" }}>
        {loading ? "Refreshing..." : "Refresh"}
      </SecondaryButton>

      {error && <div style={{ fontSize: 13, color: colors.danger, marginBottom: 12 }}>{error}</div>}

      {items && items.length === 0 && (
        <div style={{ fontSize: 13.5, color: colors.textMuted }}>No startup items found.</div>
      )}

      {items?.map((item) => (
        <div
          key={item.id}
          style={{
            display: "flex",
            alignItems: "center",
            padding: "10px 12px",
            border: `1px solid ${colors.border}`,
            borderRadius: 8,
            marginBottom: 8,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{item.name}</div>
            <div
              style={{
                fontSize: 12,
                color: colors.textMuted,
                marginTop: 2,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
              title={item.command}
            >
              {SOURCE_LABEL[item.source]} · {item.command}
            </div>
          </div>
          <button
            onClick={() => toggle(item)}
            disabled={!item.editable || busyId === item.id}
            style={{
              width: 44,
              height: 24,
              borderRadius: 12,
              border: "none",
              background: item.enabled ? colors.primary : colors.border,
              position: "relative",
              cursor: item.editable ? "pointer" : "default",
              opacity: item.editable ? 1 : 0.5,
              flexShrink: 0,
            }}
            title={item.editable ? (item.enabled ? "Disable at login" : "Enable at login") : "Not editable"}
          >
            <span
              style={{
                position: "absolute",
                top: 2,
                left: item.enabled ? 22 : 2,
                width: 20,
                height: 20,
                borderRadius: "50%",
                background: "#fff",
                transition: "left 0.15s ease",
              }}
            />
          </button>
        </div>
      ))}
    </div>
  );
}
