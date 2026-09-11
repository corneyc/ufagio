import React, { useState } from "react";
import { PrivacyCategory, PrivacyScanResult } from "../../shared/types";
import { colors, fontFamily, formatBytes } from "../theme";
import { ConfirmModal, PrimaryButton } from "./ui";

export function PrivacyPanel() {
  const [result, setResult] = useState<PrivacyScanResult | null>(null);
  const [scanning, setScanning] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function scan() {
    setScanning(true);
    setStatus(null);
    const r = await window.api.scanPrivacy();
    setResult(r);
    setSelected(new Set());
    setScanning(false);
  }

  function toggleCategory(cat: PrivacyCategory) {
    if (cat.processRunning) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(cat.id)) next.delete(cat.id);
      else next.add(cat.id);
      return next;
    });
  }

  const selectedCategories = (result?.categories ?? []).filter((c) => selected.has(c.id));
  const selectedSize = selectedCategories.reduce((a, c) => a + c.totalSize, 0);
  const selectedPaths = selectedCategories.flatMap((c) => c.entries.map((e) => e.path));

  async function performClean() {
    setConfirming(false);
    setCleaning(true);
    const res = await window.api.cleanPrivacy({ paths: selectedPaths, permanent: false });
    const ok = res.filter((r) => r.ok).length;
    const failed = res.filter((r) => !r.ok).length;
    setStatus(`Cleared ${ok} file(s)${failed ? `, ${failed} failed` : ""}.`);
    setCleaning(false);
    await scan();
  }

  return (
    <div style={{ fontFamily, maxWidth: 760 }}>
      <h2 style={{ marginTop: 0 }}>Privacy Cleaner</h2>
      <p style={{ color: colors.textMuted, fontSize: 13.5, lineHeight: 1.5 }}>
        Clears browser cache, cookies, and history per profile. Close a browser before clearing
        its data — categories are locked while that browser is running to avoid corrupting an
        open profile.
      </p>

      <PrimaryButton onClick={scan} disabled={scanning} style={{ margin: "16px 0" }}>
        {scanning ? "Scanning..." : "Scan for privacy files"}
      </PrimaryButton>

      {status && <div style={{ fontSize: 13, color: colors.safe, marginBottom: 12 }}>{status}</div>}

      {result && (
        <div>
          {result.categories.map((cat) => (
            <label
              key={cat.id}
              style={{
                display: "flex",
                alignItems: "center",
                padding: "10px 12px",
                border: `1px solid ${colors.border}`,
                borderRadius: 8,
                marginBottom: 8,
                cursor: cat.entries.length && !cat.processRunning ? "pointer" : "default",
                opacity: cat.entries.length ? 1 : 0.5,
              }}
            >
              <input
                type="checkbox"
                disabled={cat.entries.length === 0 || cat.processRunning}
                checked={selected.has(cat.id)}
                onChange={() => toggleCategory(cat)}
                style={{ marginRight: 12 }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>
                  {cat.label}
                  {cat.processRunning && (
                    <span style={{ fontSize: 11, fontWeight: 600, color: colors.caution, marginLeft: 8 }}>
                      {cat.browser} is running — close it first
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
                  {cat.entries.length} file(s)
                </div>
              </div>
              <div style={{ fontSize: 13.5, fontWeight: 600 }}>{formatBytes(cat.totalSize)}</div>
            </label>
          ))}

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: 16,
              paddingTop: 16,
              borderTop: `1px solid ${colors.border}`,
            }}
          >
            <div style={{ fontSize: 14 }}>
              Selected: <strong>{formatBytes(selectedSize)}</strong> ({selectedPaths.length} files)
            </div>
            <PrimaryButton disabled={selectedPaths.length === 0 || cleaning} onClick={() => setConfirming(true)}>
              {cleaning ? "Clearing..." : "Clear selected"}
            </PrimaryButton>
          </div>
        </div>
      )}

      {confirming && (
        <ConfirmModal
          title={`Clear ${selectedPaths.length} file(s)?`}
          body="This removes cache, cookies, and history for the selected browser profile(s). You'll be signed out of sites that relied on those cookies."
          confirmLabel="Clear data"
          onConfirm={performClean}
          onCancel={() => setConfirming(false)}
        />
      )}
    </div>
  );
}
