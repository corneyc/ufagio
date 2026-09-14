import React, { useState } from "react";
import { DeleteResultItem, JunkCategory, JunkScanResult } from "../../shared/types";
import { colors, fontFamily, formatBytes } from "../theme";
import {
  ConfirmModal,
  DangerSwitch,
  DetailsToggle,
  EmptyState,
  FailedFilesList,
  Icon,
  PrimaryButton,
  RiskBadge,
  SecondaryButton,
  Spinner,
  StatPill,
  StatusBanner,
  StatusBannerRow,
  iconForCategory,
} from "./ui";

export function JunkPanel() {
  const [result, setResult] = useState<JunkScanResult | null>(null);
  const [scanning, setScanning] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [permanent, setPermanent] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [status, setStatus] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const [failedItems, setFailedItems] = useState<DeleteResultItem[]>([]);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState<Set<string>>(new Set());
  const [reviewPicks, setReviewPicks] = useState<Record<string, Set<string>>>({});

  async function scan() {
    setScanning(true);
    const r = await window.api.scanJunk();
    setResult(r);
    setSelected(
      new Set(r.categories.filter((c) => c.entries.length > 0 && c.risk === "safe").map((c) => c.id))
    );
    setReviewOpen(new Set());
    setReviewPicks({});
    setScanning(false);
  }

  function toggleCategory(cat: JunkCategory) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(cat.id)) next.delete(cat.id);
      else next.add(cat.id);
      return next;
    });
  }

  function toggleReviewOpen(catId: string) {
    setReviewOpen((prev) => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId);
      else next.add(catId);
      return next;
    });
  }

  function toggleReviewFile(catId: string, path: string) {
    setReviewPicks((prev) => {
      const set = new Set(prev[catId] ?? []);
      if (set.has(path)) set.delete(path);
      else set.add(path);
      return { ...prev, [catId]: set };
    });
  }

  function toggleReviewCategoryAll(cat: JunkCategory) {
    setReviewPicks((prev) => {
      const current = prev[cat.id] ?? new Set<string>();
      const allPicked = cat.entries.length > 0 && current.size === cat.entries.length;
      const next = allPicked ? new Set<string>() : new Set(cat.entries.map((e) => e.path));
      return { ...prev, [cat.id]: next };
    });
  }

  const cleanable = (result?.categories ?? []).filter((c) => c.entries.length > 0);
  const safeCleanable = cleanable.filter((c) => c.risk === "safe");
  const allSelected = safeCleanable.length > 0 && safeCleanable.every((c) => selected.has(c.id));
  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(safeCleanable.map((c) => c.id)));
  }

  const selectedCategories = (result?.categories ?? []).filter(
    (c) => c.risk === "safe" && selected.has(c.id)
  );
  const reviewPickedSize = (result?.categories ?? []).reduce((sum, c) => {
    const picks = reviewPicks[c.id];
    if (!picks || picks.size === 0) return sum;
    return sum + c.entries.filter((e) => picks.has(e.path)).reduce((a, e) => a + e.size, 0);
  }, 0);
  const reviewPickedPaths = Object.values(reviewPicks).flatMap((s) => Array.from(s));
  const selectedSize = selectedCategories.reduce((a, c) => a + c.totalSize, 0) + reviewPickedSize;
  const selectedPaths = [
    ...selectedCategories.flatMap((c) => c.entries.map((e) => e.path)),
    ...reviewPickedPaths,
  ];
  const totalFound = (result?.categories ?? []).reduce((a, c) => a + c.totalSize, 0);

  async function performClean() {
    setConfirming(false);
    setCleaning(true);
    const res = await window.api.deleteJunk({ paths: selectedPaths, permanent });
    const ok = res.filter((r) => r.ok).length;
    const failures = res.filter((r) => !r.ok);
    setStatus({
      tone: failures.length ? "danger" : "success",
      text: `Cleaned ${ok} file(s)${failures.length ? `, ${failures.length} failed` : ""}.`,
    });
    setFailedItems(failures);
    setDetailsOpen(false);
    setCleaning(false);
    await scan();
  }

  return (
    <div style={{ fontFamily }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
        <div>
          <h2 style={{ margin: "0 0 6px", fontSize: 22, letterSpacing: -0.3 }}>Clean Junk</h2>
          <p style={{ color: colors.textMuted, fontSize: 13.5, lineHeight: 1.55, margin: 0, maxWidth: 480 }}>
            Scans temp, cache, and log locations for this OS. Nothing is deleted until you select
            categories and confirm.
          </p>
        </div>
        {result && (
          <div style={{ display: "flex", gap: 10 }}>
            <StatPill label="Found" value={formatBytes(totalFound)} tone="brand" />
            <StatPill label="Selected" value={formatBytes(selectedSize)} />
          </div>
        )}
      </div>

      <div
        style={{
          display: "flex",
          gap: 14,
          alignItems: "center",
          justifyContent: "space-between",
          margin: "20px 0 18px",
          padding: "14px 16px",
          background: colors.bgAlt,
          border: `1px solid ${colors.border}`,
          borderRadius: 10,
        }}
      >
        <PrimaryButton onClick={scan} disabled={scanning}>
          {scanning && <Spinner size={14} />}
          {scanning ? "Scanning…" : result ? "Rescan" : "Scan for junk"}
        </PrimaryButton>
        <DangerSwitch
          checked={permanent}
          onChange={setPermanent}
          label="Delete permanently"
          hint={permanent ? "Skips Trash — cannot be undone" : "Off: files go to Trash and can be restored"}
        />
      </div>

      {status && (
        <StatusBanner tone={status.tone}>
          <StatusBannerRow>
            <Icon.Check size={15} />
            {status.text}
            {failedItems.length > 0 && (
              <DetailsToggle
                open={detailsOpen}
                onToggle={() => setDetailsOpen((v) => !v)}
                label="View details"
              />
            )}
          </StatusBannerRow>
          {detailsOpen && failedItems.length > 0 && <FailedFilesList items={failedItems} />}
        </StatusBanner>
      )}

      {!result && !scanning && (
        <EmptyState
          icon={<Icon.Broom size={40} />}
          title="No scan yet"
          body="Run a scan to see how much space you can safely reclaim from temp files, caches, and logs."
        />
      )}

      {result && cleanable.length === 0 && (
        <EmptyState
          icon={<Icon.Check size={40} />}
          title="Nothing to clean"
          body="Every scanned location is already empty."
        />
      )}

      {result && cleanable.length > 0 && (
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              padding: "0 4px 10px",
              fontSize: 12.5,
              color: colors.textMuted,
            }}
          >
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <input type="checkbox" checked={allSelected} onChange={toggleAll} />
              Select all ({safeCleanable.length} categor{safeCleanable.length === 1 ? "y" : "ies"})
            </label>
          </div>

          {result.categories.filter((cat) => cat.risk === "safe").map((cat) => {
            const CatIcon = iconForCategory(cat.id);
            const empty = cat.entries.length === 0;
            const checked = selected.has(cat.id);
            return (
              <label
                key={cat.id}
                className="pcc-card"
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "13px 14px",
                  border: `1px solid ${checked ? colors.primary : colors.border}`,
                  background: checked ? colors.primaryLight : colors.surface,
                  borderRadius: 10,
                  marginBottom: 8,
                  cursor: empty ? "default" : "pointer",
                  opacity: empty ? 0.5 : 1,
                  transition: "border-color 0.12s ease, background 0.12s ease",
                }}
              >
                <input
                  type="checkbox"
                  disabled={empty}
                  checked={checked}
                  onChange={() => toggleCategory(cat)}
                  style={{ marginRight: 14 }}
                />
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 8,
                    background: colors.bgAlt,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginRight: 12,
                    flexShrink: 0,
                    color: colors.textMuted,
                  }}
                >
                  <CatIcon size={17} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center" }}>
                    {cat.label}
                    <RiskBadge risk={cat.risk} />
                  </div>
                  <div style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
                    {cat.entries.length} file(s){cat.error ? " · some paths were unreadable" : ""}
                  </div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: colors.text }}>{formatBytes(cat.totalSize)}</div>
              </label>
            );
          })}

          {result.categories
            .filter((cat) => cat.risk === "caution")
            .map((cat) => {
              const CatIcon = iconForCategory(cat.id);
              const empty = cat.entries.length === 0;
              const picks = reviewPicks[cat.id] ?? new Set<string>();
              const allPicked = !empty && picks.size === cat.entries.length;
              const somePicked = picks.size > 0 && !allPicked;
              const open = reviewOpen.has(cat.id);
              return (
                <div
                  key={cat.id}
                  className="pcc-card"
                  style={{
                    border: `1px solid ${allPicked || somePicked ? colors.primary : colors.border}`,
                    background: allPicked || somePicked ? colors.primaryLight : colors.surface,
                    borderRadius: 10,
                    marginBottom: 8,
                    opacity: empty ? 0.5 : 1,
                    transition: "border-color 0.12s ease, background 0.12s ease",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", padding: "13px 14px" }}>
                    <input
                      type="checkbox"
                      disabled={empty}
                      checked={allPicked}
                      ref={(el) => {
                        if (el) el.indeterminate = somePicked;
                      }}
                      onChange={() => toggleReviewCategoryAll(cat)}
                      style={{ marginRight: 14, cursor: empty ? "default" : "pointer" }}
                    />
                    <div
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 8,
                        background: colors.bgAlt,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        marginRight: 12,
                        flexShrink: 0,
                        color: colors.textMuted,
                      }}
                    >
                      <CatIcon size={17} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center" }}>
                        {cat.label}
                        <RiskBadge risk={cat.risk} />
                      </div>
                      <div style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
                        {cat.entries.length} file(s){cat.error ? " · some paths were unreadable" : ""}
                        {picks.size > 0 ? ` · ${picks.size} selected` : ""}
                      </div>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: colors.text, marginRight: empty ? 0 : 12 }}>
                      {formatBytes(cat.totalSize)}
                    </div>
                    {!empty && (
                      <DetailsToggle
                        open={open}
                        onToggle={() => toggleReviewOpen(cat.id)}
                        label="Review files"
                      />
                    )}
                  </div>
                  {open && !empty && (
                    <div style={{ padding: "0 14px 14px 60px" }}>
                      <div
                        style={{
                          maxHeight: 240,
                          overflowY: "auto",
                          background: "rgba(0,0,0,0.035)",
                          borderRadius: 8,
                          padding: "6px 10px",
                        }}
                      >
                        {cat.entries.map((entry) => {
                          const picked = picks.has(entry.path);
                          return (
                            <label
                              key={entry.path}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                padding: "4px 0",
                                fontSize: 11.5,
                                fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
                                cursor: "pointer",
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={picked}
                                onChange={() => toggleReviewFile(cat.id, entry.path)}
                              />
                              <span style={{ flex: 1, minWidth: 0, wordBreak: "break-all", opacity: 0.85 }}>
                                {entry.path}
                              </span>
                              <span style={{ flexShrink: 0, opacity: 0.65 }}>{formatBytes(entry.size)}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

          <div
            style={{
              position: "sticky",
              bottom: 0,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: 18,
              padding: "16px 18px",
              background: colors.surface,
              border: `1px solid ${colors.border}`,
              borderRadius: 10,
              boxShadow: "0 -4px 16px rgba(20,20,31,0.04)",
            }}
          >
            <div style={{ fontSize: 13.5, color: colors.textMuted }}>
              <strong style={{ color: colors.text, fontSize: 15 }}>{formatBytes(selectedSize)}</strong>{" "}
              selected · {selectedPaths.length} file(s)
            </div>
            <PrimaryButton
              tone={permanent ? "danger" : "brand"}
              disabled={selectedPaths.length === 0 || cleaning}
              onClick={() => setConfirming(true)}
            >
              {cleaning && <Spinner size={14} />}
              {cleaning ? "Cleaning…" : permanent ? "Delete permanently" : "Move to Trash"}
            </PrimaryButton>
          </div>
        </div>
      )}

      {confirming && (
        <ConfirmModal
          danger={permanent}
          title={`${permanent ? "Permanently delete" : "Move to Trash"} ${selectedPaths.length} file(s)?`}
          body={`This will free up ${formatBytes(selectedSize)}. ${
            permanent
              ? "This skips the Recycle Bin — it cannot be undone."
              : "Files go to the system Trash/Recycle Bin — you can restore them from there."
          }`}
          confirmLabel={permanent ? "Delete permanently" : "Move to Trash"}
          onConfirm={performClean}
          onCancel={() => setConfirming(false)}
        />
      )}
    </div>
  );
}
