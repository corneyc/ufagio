import React, { useEffect, useState } from "react";
import { DeleteResultItem, SpaceChild, SpaceOverview, SpaceRisk } from "../../shared/types";
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
} from "./ui";

function worstRisk(items: SpaceChild[]): SpaceRisk {
  if (items.some((c) => c.risk === "danger")) return "danger";
  if (items.some((c) => c.risk === "caution")) return "caution";
  return "safe";
}

export function SpacePanel() {
  const [overview, setOverview] = useState<SpaceOverview | null>(null);

  const [pathStack, setPathStack] = useState<string[]>([]);
  const [children, setChildren] = useState<SpaceChild[] | null>(null);
  const [listing, setListing] = useState(false);

  const [permanent, setPermanent] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [status, setStatus] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const [failedItems, setFailedItems] = useState<DeleteResultItem[]>([]);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const currentPath = pathStack[pathStack.length - 1] ?? null;

  async function openPath(p: string) {
    setListing(true);
    setSelected(new Set());
    const r = await window.api.listSpaceChildren(p);
    setChildren(r.children);
    setListing(false);
  }

  useEffect(() => {
    (async () => {
      const [root, o] = await Promise.all([window.api.defaultSpaceRoot(), window.api.getSpaceOverview()]);
      setOverview(o);
      setPathStack([root]);
      await openPath(root);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function drillInto(child: SpaceChild) {
    if (!child.isDir) return;
    const next = [...pathStack, child.path];
    setPathStack(next);
    openPath(child.path);
  }

  function goUp(index: number) {
    const next = pathStack.slice(0, index + 1);
    setPathStack(next);
    openPath(next[next.length - 1]);
  }

  function toggleChild(child: SpaceChild) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(child.path)) next.delete(child.path);
      else next.add(child.path);
      return next;
    });
  }

  const selectedChildren = (children ?? []).filter((c) => selected.has(c.path));
  const selectedSize = selectedChildren.reduce((a, c) => a + c.sizeBytes, 0);
  const selectedDanger = selectedChildren.filter((c) => c.risk === "danger");
  const volumesUsed = overview?.volumes.reduce((a, v) => a + v.usedBytes, 0) ?? 0;

  async function performDelete() {
    setConfirming(false);
    setDeleting(true);
    const res = await window.api.deleteSpaceItem({ paths: [...selected], permanent });
    const ok = res.filter((r) => r.ok).length;
    const failures = res.filter((r) => !r.ok);
    setStatus({
      tone: failures.length ? "danger" : "success",
      text: `Removed ${ok} item(s)${failures.length ? `, ${failures.length} failed (often: in use by another app)` : ""}.`,
    });
    setFailedItems(failures);
    setDetailsOpen(false);
    setDeleting(false);
    if (currentPath) await openPath(currentPath);
  }

  return (
    <div style={{ fontFamily }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
        <div>
          <h2 style={{ margin: "0 0 6px", fontSize: 22, letterSpacing: -0.3 }}>Space Explorer</h2>
          <p style={{ color: colors.textMuted, fontSize: 13.5, lineHeight: 1.55, margin: 0, maxWidth: 480 }}>
            Drill into any folder to see what&apos;s actually using the space. Unlike Clean Junk,
            this can reach anywhere on disk — review each item before removing it.
          </p>
        </div>
        {overview && (
          <StatPill label="Used (all drives)" value={formatBytes(volumesUsed)} tone="brand" />
        )}
      </div>

      {overview && overview.volumes.length > 0 && (
        <div style={{ display: "flex", gap: 10, margin: "18px 0" }}>
          {overview.volumes.map((v) => (
            <div
              key={v.mount}
              style={{
                flex: 1,
                padding: "12px 14px",
                background: colors.bgAlt,
                border: `1px solid ${colors.border}`,
                borderRadius: 10,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 600 }}>
                <span>{v.mount}</span>
                <span style={{ color: v.pctFree < 15 ? colors.danger : colors.textMuted }}>{v.pctFree}% free</span>
              </div>
              <div style={{ marginTop: 8, height: 6, borderRadius: 3, background: colors.border, overflow: "hidden" }}>
                <div
                  style={{
                    width: `${100 - v.pctFree}%`,
                    height: "100%",
                    background: v.pctFree < 15 ? colors.danger : colors.primary,
                  }}
                />
              </div>
              <div style={{ marginTop: 6, fontSize: 11.5, color: colors.textMuted }}>
                {formatBytes(v.freeBytes)} free of {formatBytes(v.totalBytes)}
              </div>
            </div>
          ))}
        </div>
      )}

      {overview && overview.installedPrograms.length > 0 && (
        <div
          style={{
            marginBottom: 18,
            padding: "14px 16px",
            background: colors.surface,
            border: `1px solid ${colors.border}`,
            borderRadius: 10,
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>Largest installed programs</div>
          {overview.installedPrograms.slice(0, 10).map((p) => (
            <div
              key={p.name}
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 12.5,
                padding: "5px 0",
                borderBottom: `1px solid ${colors.border}`,
              }}
            >
              <span style={{ color: colors.text }}>{p.name}</span>
              <span style={{ color: colors.textMuted, fontWeight: 600 }}>{formatBytes(p.sizeBytes)}</span>
            </div>
          ))}
          <div style={{ fontSize: 11.5, color: colors.textFaint, marginTop: 10 }}>
            Read-only — uninstall {window.api.platform() === "darwin" ? "by dragging it to Trash" : "from Settings > Apps"}.
          </div>
        </div>
      )}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          flexWrap: "wrap",
          fontSize: 12.5,
          color: colors.textMuted,
          marginBottom: 10,
          padding: "0 2px",
        }}
      >
        {pathStack.map((p, i) => (
          <React.Fragment key={p}>
            {i > 0 && <span style={{ opacity: 0.5 }}>/</span>}
            <button
              onClick={() => goUp(i)}
              style={{
                background: "transparent",
                border: "none",
                padding: "2px 4px",
                cursor: "pointer",
                color: i === pathStack.length - 1 ? colors.text : colors.primary,
                fontWeight: i === pathStack.length - 1 ? 600 : 500,
                fontFamily,
                fontSize: 12.5,
              }}
            >
              {p.split(/[\\/]/).filter(Boolean).pop() ?? p}
            </button>
          </React.Fragment>
        ))}
      </div>

      {listing && (
        <div style={{ padding: "24px 0", display: "flex", justifyContent: "center" }}>
          <Spinner size={20} color={colors.primary} />
        </div>
      )}

      {status && (
        <StatusBanner tone={status.tone}>
          <StatusBannerRow>
            <Icon.Check size={15} />
            {status.text}
            {failedItems.length > 0 && (
              <DetailsToggle open={detailsOpen} onToggle={() => setDetailsOpen((v) => !v)} label="View details" />
            )}
          </StatusBannerRow>
          {detailsOpen && failedItems.length > 0 && <FailedFilesList items={failedItems} />}
        </StatusBanner>
      )}

      {!listing && children && children.length === 0 && (
        <EmptyState icon={<Icon.Folder size={40} />} title="Empty" body="Nothing in this folder." />
      )}

      {!listing && children && children.length > 0 && (
        <div>
          {children.map((c) => {
            const checked = selected.has(c.path);
            const borderColor = checked
              ? colors.primary
              : c.risk === "danger"
              ? colors.danger + "55"
              : colors.border;
            return (
              <div
                key={c.path}
                className="pcc-card"
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "11px 14px",
                  border: `1px solid ${borderColor}`,
                  background: checked ? colors.primaryLight : colors.surface,
                  borderRadius: 10,
                  marginBottom: 6,
                }}
              >
                <input type="checkbox" checked={checked} onChange={() => toggleChild(c)} style={{ marginRight: 12 }} />
                <div
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 8,
                    background: colors.bgAlt,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginRight: 12,
                    flexShrink: 0,
                    color: colors.textMuted,
                    cursor: c.isDir ? "pointer" : "default",
                  }}
                  onClick={() => drillInto(c)}
                >
                  {c.isDir ? <Icon.Folder size={15} /> : <Icon.Document size={15} />}
                </div>
                <div
                  style={{ flex: 1, minWidth: 0, cursor: c.isDir ? "pointer" : "default" }}
                  onClick={() => drillInto(c)}
                >
                  <div style={{ fontSize: 13.5, display: "flex", alignItems: "center" }}>
                    {c.name}
                    <RiskBadge risk={c.risk} />
                    {c.error && <span style={{ color: colors.danger, fontSize: 11, marginLeft: 8 }}>unreadable</span>}
                  </div>
                  <div style={{ fontSize: 11.5, color: colors.textMuted, marginTop: 2 }}>{c.reason}</div>
                </div>
                <div
                  style={{ fontSize: 13.5, fontWeight: 700, color: colors.text, marginRight: c.isDir ? 10 : 0, marginLeft: 10 }}
                >
                  {formatBytes(c.sizeBytes)}
                </div>
                {c.isDir && (
                  <SecondaryButton onClick={() => drillInto(c)} style={{ padding: "6px 10px", fontSize: 12 }}>
                    Open
                  </SecondaryButton>
                )}
              </div>
            );
          })}
        </div>
      )}

      {selected.size > 0 && (
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
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ fontSize: 13.5, color: colors.textMuted }}>
              <strong style={{ color: colors.text, fontSize: 15 }}>{formatBytes(selectedSize)}</strong> selected ·{" "}
              {selected.size} item(s)
            </div>
            <RiskBadge risk={worstRisk(selectedChildren)} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <DangerSwitch
              checked={permanent}
              onChange={setPermanent}
              label="Delete permanently"
              hint={permanent ? "Skips Trash" : "Goes to Trash"}
            />
            <PrimaryButton tone={permanent ? "danger" : "brand"} disabled={deleting} onClick={() => setConfirming(true)}>
              {deleting && <Spinner size={14} />}
              {deleting ? "Removing…" : permanent ? "Delete permanently" : "Move to Trash"}
            </PrimaryButton>
          </div>
        </div>
      )}

      {confirming && (
        <ConfirmModal
          danger={permanent || selectedDanger.length > 0}
          title={`${permanent ? "Permanently delete" : "Move to Trash"} ${selected.size} item(s)?`}
          body={`${
            selectedDanger.length > 0
              ? `${selectedDanger.length} of these is flagged Danger: ${selectedDanger
                  .map((c) => `"${c.name}" (${c.reason})`)
                  .join("; ")}. `
              : ""
          }This will free up ${formatBytes(selectedSize)}. If another app has one of these files open, that item's delete will fail rather than corrupt it — quit the app first if needed. ${
            permanent ? "This skips the Recycle Bin — it cannot be undone." : "Items go to the system Trash/Recycle Bin."
          }`}
          confirmLabel={permanent ? "Delete permanently" : "Move to Trash"}
          onConfirm={performDelete}
          onCancel={() => setConfirming(false)}
        />
      )}
    </div>
  );
}
