// @vitest-environment happy-dom
/**
 * SoundEditor DOM harness smoke test.
 *
 * AC (TF-0MUV11IXS007W29J): Vitest must run `src/components/SoundEditor/**`
 * component tests under the `happy-dom` environment, opted in per file via the
 * `// @vitest-environment happy-dom` directive, without changing the default
 * Node environment used by the existing web tests.
 *
 * This test asserts the DOM capabilities the editor widgets rely on: element
 * creation/querying, event dispatch, and a usable `window`.
 */
import { describe, it, expect } from "vitest";

describe("SoundEditor happy-dom harness", () => {
  it("exposes a DOM and a window to component tests", () => {
    expect(typeof document).toBe("object");
    expect(typeof window).toBe("object");
    expect(document.defaultView).toBe(window);
  });

  it("creates, mounts and queries elements", () => {
    const container = document.createElement("div");
    container.className = "editor-host";
    container.textContent = "editor";
    document.body.appendChild(container);

    expect(document.querySelector(".editor-host")?.textContent).toBe("editor");

    container.remove();
    expect(document.querySelector(".editor-host")).toBeNull();
  });

  it("dispatches the interaction events the widgets depend on", () => {
    const button = document.createElement("button");
    const seen: string[] = [];
    button.addEventListener("click", () => seen.push("click"));
    button.addEventListener("keydown", () => seen.push("keydown"));

    button.dispatchEvent(new MouseEvent("click"));
    button.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp" }));

    expect(seen).toEqual(["click", "keydown"]);
  });
});
