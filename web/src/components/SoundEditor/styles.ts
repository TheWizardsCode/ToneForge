/**
 * Scoped styles for the SoundEditor.
 *
 * Styles are injected into the editor's shadow root — never into
 * `document.head` or the host page — so embedding cannot leak CSS into the
 * host application.
 */

/** Scoped stylesheet for the editor shadow root. */
export const EDITOR_STYLES = `
  :host {
    display: block;
    box-sizing: border-box;
    color: var(--tf-editor-foreground, #f5f5f5);
    background: var(--tf-editor-background, #16181d);
    font-family: var(--tf-editor-font, system-ui, sans-serif);
  }

  *, *::before, *::after {
    box-sizing: inherit;
  }

  .toneforge-editor__body {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 0.75rem;
    width: 100%;
    height: 100%;
  }

  .toneforge-editor__header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .toneforge-editor__title {
    margin: 0;
    font-size: 0.95rem;
    font-weight: 600;
  }

  .toneforge-editor__recipe {
    font-size: 0.8rem;
    opacity: 0.8;
    font-variant-numeric: tabular-nums;
  }

  .toneforge-editor__controls {
    display: grid;
    gap: 0.75rem;
  }

  .tf-audition {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
  }

  .tf-audition__controls {
    display: inline-flex;
    gap: 0.4rem;
  }

  .tf-audition button {
    font: inherit;
    padding: 0.3rem 0.7rem;
    border-radius: 0.35rem;
    border: 1px solid var(--tf-editor-accent, #6ea8fe);
    background: transparent;
    color: inherit;
    cursor: pointer;
  }

  .tf-audition__loop[aria-pressed="true"] {
    background: var(--tf-editor-accent, #6ea8fe);
    color: var(--tf-editor-background, #16181d);
  }

  .tf-audition__status {
    margin: 0;
    font-size: 0.8rem;
    opacity: 0.85;
    flex-basis: 100%;
  }

  /* ── Widget kit ─────────────────────────────────────────── */

  .tf-widget {
    position: relative;
  }

  .tf-slider {
    display: flex;
    align-items: center;
    min-height: 1.5rem;
  }

  .tf-slider__track {
    position: relative;
    width: 100%;
    height: 0.35rem;
    border-radius: 0.2rem;
    background: color-mix(in srgb, var(--tf-editor-foreground, #f5f5f5) 20%, transparent);
  }

  .tf-slider__fill {
    position: absolute;
    inset: 0 auto 0 0;
    border-radius: inherit;
    background: var(--tf-editor-accent, #6ea8fe);
  }

  .tf-slider__thumb {
    position: absolute;
    top: 50%;
    width: 1rem;
    height: 1rem;
    border-radius: 50%;
    background: var(--tf-editor-accent, #6ea8fe);
    transform: translate(-50%, -50%);
  }

  .tf-rotary {
    width: 3rem;
    height: 3rem;
  }

  .tf-rotary__dial {
    position: relative;
    width: 100%;
    height: 100%;
    border-radius: 50%;
    border: 2px solid var(--tf-editor-accent, #6ea8fe);
  }

  .tf-rotary__indicator {
    position: absolute;
    left: 50%;
    top: 25%;
    width: 2px;
    height: 50%;
    background: var(--tf-editor-foreground, #f5f5f5);
    transform-origin: bottom center;
    transform: translate(-50%, 0);
  }

  .tf-xy-pad__pad {
    position: relative;
    width: 8rem;
    height: 8rem;
    border: 1px solid var(--tf-editor-accent, #6ea8fe);
    border-radius: 0.35rem;
  }

  .tf-xy-pad__thumb {
    position: absolute;
    width: 0.75rem;
    height: 0.75rem;
    border-radius: 50%;
    background: var(--tf-editor-accent, #6ea8fe);
    transform: translate(-50%, -50%);
  }

  .tf-toggle-select {
    display: flex;
    gap: 0.35rem;
  }

  .tf-toggle-select__option {
    padding: 0.25rem 0.5rem;
    border: 1px solid var(--tf-editor-accent, #6ea8fe);
    border-radius: 0.25rem;
    cursor: pointer;
  }

  .tf-toggle-select__option.is-selected {
    background: var(--tf-editor-accent, #6ea8fe);
    color: var(--tf-editor-background, #16181d);
  }

  .tf-widget:focus-visible {
    outline: 2px solid var(--tf-editor-accent, #6ea8fe);
    outline-offset: 2px;
  }
`;

/**
 * Inject the scoped stylesheet into a shadow root.
 *
 * @returns The created `<style>` element.
 */
export function applyStyles(shadow: ShadowRoot): HTMLStyleElement {
  const style = shadow.ownerDocument.createElement("style");
  style.setAttribute("data-toneforge-editor", "styles");
  style.textContent = EDITOR_STYLES;
  shadow.appendChild(style);
  return style;
}
