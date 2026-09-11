export const colors = {
  primary: "#3333cc",
  primaryDark: "#26268f",
  primaryLight: "#eeeeff",
  bg: "#ffffff",
  bgAlt: "#f7f7fb",
  surface: "#ffffff",
  border: "#e5e5f0",
  borderStrong: "#d4d4e6",
  text: "#14141f",
  textMuted: "#6b6b80",
  textFaint: "#9999ab",
  danger: "#c0362c",
  dangerLight: "#fdeeec",
  caution: "#a8660a",
  cautionLight: "#fdf3e2",
  safe: "#1f7a41",
  safeLight: "#e8f5ec",
};

export const radius = { sm: 6, md: 10, lg: 14 };

export const shadow = {
  sm: "0 1px 2px rgba(20,20,31,0.06)",
  md: "0 4px 16px rgba(20,20,31,0.08)",
  lg: "0 12px 40px rgba(20,20,31,0.18)",
};

export const fontFamily =
  "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let val = bytes / 1024;
  let i = 0;
  while (val >= 1024 && i < units.length - 1) {
    val /= 1024;
    i++;
  }
  return `${val.toFixed(val >= 10 ? 0 : 1)} ${units[i]}`;
}
