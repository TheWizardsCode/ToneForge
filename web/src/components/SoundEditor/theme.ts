/**
 * Theme + responsive-layout contract for the SoundEditor.
 *
 * Theming is done with CSS custom properties so hosts can theme without global
 * CSS. Properties may be set on the mount container (inherited by the editor's
 * shadow host) or passed programmatically via `applyTheme`/the `theme` option.
 *
 * Layout adapts to the container width (not the window), driven by a
 * `ResizeObserver`, by toggling `toneforge-editor--compact` / `--wide` classes.
 */

/** Host-facing theme inputs. All optional; CSS defaults apply when unset. */
export interface SoundEditorTheme {
  /** Background colour → `--tfe-background`. */
  background?: string;
  /** Foreground/text colour → `--tfe-foreground`. */
  foreground?: string;
  /** Accent colour → `--tfe-accent`. */
  accent?: string;
  /** Font family → `--tfe-font`. */
  font?: string;
  /** Container width (px) below which the compact single-column layout is used. */
  compactBreakpoint?: number;
}

/** CSS custom properties used by the theme contract. */
export const THEME_PROPERTIES = {
  background: "--tfe-background",
  foreground: "--tfe-foreground",
  accent: "--tfe-accent",
  font: "--tfe-font",
} as const;

/** Default theme values (mirrored by the scoped stylesheet fallbacks). */
export const DEFAULT_THEME: Required<Omit<SoundEditorTheme, "compactBreakpoint">> = {
  background: "#16181d",
  foreground: "#f5f5f5",
  accent: "#6ea8fe",
  font: "system-ui, sans-serif",
};

/** Default width below which the editor switches to its compact layout. */
export const DEFAULT_COMPACT_BREAKPOINT = 480;

/** Class applied when the container is narrower than the breakpoint. */
export const COMPACT_CLASS = "toneforge-editor--compact";
/** Class applied when the container is at or above the breakpoint. */
export const WIDE_CLASS = "toneforge-editor--wide";

/**
 * Apply a theme object to the editor root as CSS custom properties.
 *
 * Only keys present on `theme` are written, so host-provided values set on an
 * ancestor container are not shadowed by defaults.
 */
export function applyTheme(root: HTMLElement, theme?: SoundEditorTheme): void {
  if (!theme) {
    return;
  }
  const entries: Array<[keyof typeof THEME_PROPERTIES, string | undefined]> = [
    ["background", theme.background],
    ["foreground", theme.foreground],
    ["accent", theme.accent],
    ["font", theme.font],
  ];
  for (const [key, value] of entries) {
    if (typeof value === "string" && value.length > 0) {
      root.style.setProperty(THEME_PROPERTIES[key], value);
    }
  }
}

/**
 * Update the root's responsive layout classes for a container width.
 *
 * @returns `true` when the compact layout is active.
 */
export function applyResponsiveLayout(
  root: HTMLElement,
  width: number,
  compactBreakpoint: number = DEFAULT_COMPACT_BREAKPOINT,
): boolean {
  const compact = width < compactBreakpoint;
  root.classList.toggle(COMPACT_CLASS, compact);
  root.classList.toggle(WIDE_CLASS, !compact);
  root.style.setProperty("--tf-host-width", `${Math.round(width)}px`);
  return compact;
}
