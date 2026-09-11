import React from "react";
import { colors, fontFamily, radius, shadow } from "../theme";

// One small stylesheet for the few things inline styles can't express
// (hover/focus states, keyframes). Everything else stays inline per
// project convention. Mount once, at the app root.
export function GlobalStyles() {
  return (
    <style>{`
      * { box-sizing: border-box; }
      .pcc-btn-primary:hover:not(:disabled) { filter: brightness(1.08); }
      .pcc-btn-primary:active:not(:disabled) { filter: brightness(0.94); }
      .pcc-btn-secondary:hover:not(:disabled) { background: ${colors.bgAlt}; border-color: ${colors.borderStrong}; }
      .pcc-btn-danger:hover:not(:disabled) { filter: brightness(1.08); }
      .pcc-card:hover { border-color: ${colors.borderStrong}; box-shadow: ${shadow.sm}; }
      .pcc-nav-item:hover { background: ${colors.bgAlt}; }
      .pcc-spin { animation: pcc-spin 0.8s linear infinite; }
      @keyframes pcc-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      @keyframes pcc-fade-in { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
      .pcc-fade-in { animation: pcc-fade-in 0.18s ease-out; }
    `}</style>
  );
}

export function PrimaryButton(
  props: React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: "brand" | "danger" }
) {
  const { style, disabled, tone = "brand", className, ...rest } = props;
  const bg = disabled ? colors.border : tone === "danger" ? colors.danger : colors.primary;
  return (
    <button
      {...rest}
      disabled={disabled}
      className={`${tone === "danger" ? "pcc-btn-danger" : "pcc-btn-primary"} ${className ?? ""}`}
      style={{
        background: bg,
        color: disabled ? colors.textFaint : "#fff",
        border: "none",
        borderRadius: radius.sm,
        padding: "10px 18px",
        fontSize: 14,
        fontWeight: 600,
        fontFamily,
        cursor: disabled ? "default" : "pointer",
        transition: "filter 0.12s ease",
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        ...style,
      }}
    />
  );
}

export function SecondaryButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { style, disabled, className, ...rest } = props;
  return (
    <button
      {...rest}
      disabled={disabled}
      className={`pcc-btn-secondary ${className ?? ""}`}
      style={{
        background: "transparent",
        color: disabled ? colors.textFaint : colors.text,
        border: `1px solid ${colors.border}`,
        borderRadius: radius.sm,
        padding: "10px 18px",
        fontSize: 14,
        fontWeight: 500,
        fontFamily,
        cursor: disabled ? "default" : "pointer",
        transition: "background 0.12s ease, border-color 0.12s ease",
        ...style,
      }}
    />
  );
}

export function RiskBadge({ risk }: { risk: "safe" | "caution" }) {
  const isSafe = risk === "safe";
  return (
    <span
      style={{
        fontSize: 10.5,
        fontWeight: 700,
        letterSpacing: 0.3,
        padding: "3px 8px",
        borderRadius: 20,
        background: isSafe ? colors.safeLight : colors.cautionLight,
        color: isSafe ? colors.safe : colors.caution,
        marginLeft: 8,
        textTransform: "uppercase",
      }}
    >
      {isSafe ? "Safe" : "Review first"}
    </span>
  );
}

// A visible, deliberate switch for anything irreversible — bigger target,
// clear on/off state, danger colouring when armed. Replaces a bare
// checkbox for the "delete permanently" toggle.
export function DangerSwitch(props: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
}) {
  const { checked, onChange, label, hint } = props;
  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        cursor: "pointer",
        userSelect: "none",
      }}
    >
      <span
        onClick={() => onChange(!checked)}
        style={{
          width: 36,
          height: 20,
          borderRadius: 999,
          background: checked ? colors.danger : colors.border,
          position: "relative",
          transition: "background 0.15s ease",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 2,
            left: checked ? 18 : 2,
            width: 16,
            height: 16,
            borderRadius: "50%",
            background: "#fff",
            boxShadow: shadow.sm,
            transition: "left 0.15s ease",
          }}
        />
      </span>
      <span>
        <div style={{ fontSize: 13, fontWeight: 600, color: checked ? colors.danger : colors.text }}>
          {label}
        </div>
        {hint && <div style={{ fontSize: 11.5, color: colors.textMuted, marginTop: 1 }}>{hint}</div>}
      </span>
    </label>
  );
}

export function StatPill(props: { label: string; value: string; tone?: "neutral" | "brand" }) {
  const brand = props.tone === "brand";
  return (
    <div
      style={{
        padding: "10px 16px",
        borderRadius: radius.md,
        background: brand ? colors.primaryLight : colors.bgAlt,
        border: `1px solid ${brand ? colors.primary + "22" : colors.border}`,
        minWidth: 120,
      }}
    >
      <div style={{ fontSize: 11, color: colors.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.3 }}>
        {props.label}
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, color: brand ? colors.primary : colors.text, marginTop: 2 }}>
        {props.value}
      </div>
    </div>
  );
}

export function Spinner({ size = 16, color = "#fff" }: { size?: number; color?: string }) {
  return (
    <svg
      className="pcc-spin"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      style={{ flexShrink: 0 }}
    >
      <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="3" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke={color} strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function EmptyState(props: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        padding: "56px 24px",
        color: colors.textMuted,
      }}
    >
      <div style={{ marginBottom: 14, color: colors.textFaint }}>{props.icon}</div>
      <div style={{ fontSize: 15, fontWeight: 600, color: colors.text, marginBottom: 6 }}>{props.title}</div>
      <div style={{ fontSize: 13, maxWidth: 340, lineHeight: 1.5 }}>{props.body}</div>
    </div>
  );
}

export function StatusBanner(props: { tone: "success" | "danger"; children: React.ReactNode }) {
  const success = props.tone === "success";
  return (
    <div
      className="pcc-fade-in"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        fontSize: 13,
        fontWeight: 500,
        padding: "10px 14px",
        borderRadius: radius.sm,
        background: success ? colors.safeLight : colors.dangerLight,
        color: success ? colors.safe : colors.danger,
        marginBottom: 14,
      }}
    >
      {props.children}
    </div>
  );
}

export function ConfirmModal(props: {
  title: string;
  body: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(20,20,31,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
      }}
      onClick={props.onCancel}
    >
      <div
        className="pcc-fade-in"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: colors.bg,
          borderRadius: radius.lg,
          padding: 26,
          width: 440,
          boxShadow: shadow.lg,
          fontFamily,
        }}
      >
        {props.danger && (
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              background: colors.dangerLight,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 14,
            }}
          >
            <Icon.Warning color={colors.danger} />
          </div>
        )}
        <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 10 }}>{props.title}</div>
        <div style={{ fontSize: 13.5, color: colors.textMuted, lineHeight: 1.55, marginBottom: 22 }}>
          {props.body}
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <SecondaryButton onClick={props.onCancel}>Cancel</SecondaryButton>
          <PrimaryButton tone={props.danger ? "danger" : "brand"} onClick={props.onConfirm}>
            {props.confirmLabel}
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}

// Minimal inline icon set — no icon-font/SVG-lib dependency.
function svg(children: React.ReactNode, props: { size?: number; color?: string } = {}) {
  const { size = 18, color = "currentColor" } = props;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

export const Icon = {
  Trash: (p: { size?: number; color?: string } = {}) =>
    svg(<><path d="M4 7h16" /><path d="M9 7V4h6v3" /><path d="M6 7l1 13h10l1-13" /><path d="M10 11v6M14 11v6" /></>, p),
  Broom: (p: { size?: number; color?: string } = {}) =>
    svg(<><path d="M19 5 9 15" /><path d="M8 16l-4 4" /><path d="M6 18l-1 1" /><path d="M14 4l6 6-3 3-6-6z" /></>, p),
  Rocket: (p: { size?: number; color?: string } = {}) =>
    svg(<><path d="M5 15s-1-5 4-9c4-3 8-2 8-2s1 4-2 8c-4 5-9 4-9 4z" /><circle cx="14" cy="9" r="1.5" /><path d="M7 15c-2 1-2 5-2 5s4 0 5-2" /></>, p),
  Shield: (p: { size?: number; color?: string } = {}) =>
    svg(<path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" />, p),
  Cache: (p: { size?: number; color?: string } = {}) =>
    svg(<><ellipse cx="12" cy="6" rx="7" ry="2.5" /><path d="M5 6v12c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V6" /><path d="M5 12c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5" /></>, p),
  Clock: (p: { size?: number; color?: string } = {}) =>
    svg(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></>, p),
  Image: (p: { size?: number; color?: string } = {}) =>
    svg(<><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="1.5" /><path d="M21 16l-5-5-9 9" /></>, p),
  Globe: (p: { size?: number; color?: string } = {}) =>
    svg(<><circle cx="12" cy="12" r="9" /><path d="M3 12h18" /><path d="M12 3c2.5 2.7 4 6 4 9s-1.5 6.3-4 9c-2.5-2.7-4-6-4-9s1.5-6.3 4-9z" /></>, p),
  Cog: (p: { size?: number; color?: string } = {}) =>
    svg(<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9c.2.6.7 1 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></>, p),
  Document: (p: { size?: number; color?: string } = {}) =>
    svg(<><path d="M8 3h6l4 4v13a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" /><path d="M14 3v4h4" /></>, p),
  Folder: (p: { size?: number; color?: string } = {}) =>
    svg(<path d="M4 6a1 1 0 0 1 1-1h4l2 2h8a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6z" />, p),
  Warning: (p: { size?: number; color?: string } = {}) =>
    svg(<><path d="M12 3 2 20h20L12 3z" /><path d="M12 10v4" /><path d="M12 17h.01" /></>, p),
  Check: (p: { size?: number; color?: string } = {}) =>
    svg(<path d="M20 6 9 17l-5-5" />, p),
};

// Best-effort mapping from a scan category id to an icon — falls back to
// a generic folder icon for anything unrecognised (new OS categories etc).
export function iconForCategory(id: string): (p?: { size?: number; color?: string }) => JSX.Element {
  const s = id.toLowerCase();
  if (s.includes("trash") || s.includes("recycle")) return Icon.Trash;
  if (s.includes("thumb") || s.includes("image")) return Icon.Image;
  if (s.includes("chrome") || s.includes("edge") || s.includes("firefox") || s.includes("safari"))
    return Icon.Globe;
  if (s.includes("cache")) return Icon.Cache;
  if (s.includes("update")) return Icon.Shield;
  if (s.includes("prefetch") || s.includes("derived")) return Icon.Cog;
  if (s.includes("recent") || s.includes("log")) return Icon.Clock;
  if (s.includes("temp") || s.includes("tmp")) return Icon.Broom;
  return Icon.Folder;
}
