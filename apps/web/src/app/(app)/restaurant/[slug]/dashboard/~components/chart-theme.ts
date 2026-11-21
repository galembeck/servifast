/**
 * Recharts paints with SVG presentation attributes (fill="…"), where CSS
 * variables aren't reliably resolved — text fell back to black in dark mode.
 * These rules target the rendered elements directly: a CSS rule beats a
 * presentation attribute, and theme tokens follow light/dark automatically.
 */
export const CHART_THEME_CLASS = [
	"[&_.recharts-cartesian-grid_line]:stroke-border",
	"[&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground",
	"[&_.recharts-label-list_text]:fill-foreground",
	"[&_.recharts-bar-rectangle_path]:fill-chart-sales",
	"[&_.recharts-line-curve]:stroke-chart-sales",
	"[&_.recharts-active-dot_circle]:fill-chart-sales",
	"[&_.recharts-active-dot_circle]:stroke-card",
].join(" ");

/** Hover cursor: a band behind bars, a hairline on line charts. */
export const BAR_CURSOR_CLASS = "[&_.recharts-tooltip-cursor]:fill-muted/60";
export const LINE_CURSOR_CLASS =
	"[&_.recharts-tooltip-cursor]:stroke-muted-foreground";
