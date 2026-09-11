import React, { useState } from "react";
import { colors, fontFamily } from "./theme";
import { GlobalStyles, Icon } from "./components/ui";
import { JunkPanel } from "./components/JunkPanel";
import { StartupPanel } from "./components/StartupPanel";
import { PrivacyPanel } from "./components/PrivacyPanel";

type Tab = "junk" | "startup" | "privacy";

const TABS: { id: Tab; label: string; icon: (p?: { size?: number; color?: string }) => JSX.Element }[] = [
  { id: "junk", label: "Clean Junk", icon: Icon.Broom },
  { id: "startup", label: "Startup Manager", icon: Icon.Rocket },
  { id: "privacy", label: "Privacy Cleaner", icon: Icon.Shield },
];

export function App() {
  const [tab, setTab] = useState<Tab>("junk");

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        width: "100vw",
        fontFamily,
        color: colors.text,
        background: colors.bg,
      }}
    >
      <GlobalStyles />

      <div
        style={{
          width: 224,
          borderRight: `1px solid ${colors.border}`,
          padding: "18px 12px",
          boxSizing: "border-box",
          background: colors.bgAlt,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "4px 8px 22px" }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              background: `linear-gradient(135deg, ${colors.primary}, ${colors.primaryDark})`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Icon.Broom size={15} color="#fff" />
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: colors.text, letterSpacing: -0.3, textTransform: "uppercase" }}>
            Ufagio
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className="pcc-nav-item"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  width: "100%",
                  textAlign: "left",
                  padding: "9px 12px",
                  borderRadius: 8,
                  border: "none",
                  cursor: "pointer",
                  fontSize: 13.5,
                  fontFamily,
                  background: active ? colors.primary : "transparent",
                  color: active ? "#fff" : colors.text,
                  fontWeight: active ? 600 : 500,
                  transition: "background 0.12s ease",
                }}
              >
                <t.icon size={16} color={active ? "#fff" : colors.textMuted} />
                {t.label}
              </button>
            );
          })}
        </div>

        <div style={{ flex: 1 }} />

        <div
          style={{
            fontSize: 11,
            color: colors.textFaint,
            padding: "10px 8px 4px",
            borderTop: `1px solid ${colors.border}`,
          }}
        >
          Ufagio · v0.1.0
        </div>
      </div>

      <div style={{ flex: 1, overflow: "auto" }}>
        <div style={{ padding: 32, boxSizing: "border-box", maxWidth: 820 }}>
          {tab === "junk" && <JunkPanel />}
          {tab === "startup" && <StartupPanel />}
          {tab === "privacy" && <PrivacyPanel />}
        </div>
      </div>
    </div>
  );
}
