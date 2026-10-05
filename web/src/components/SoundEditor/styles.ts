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
