// @vitest-environment happy-dom
/**
 * Plain-DOM adapter smoke test.
 *
 * AC (TF-0MUV125DM0076YZ3): the Enemy-Gym-style adapter mounts/disposes the
 * editor without console errors and forwards `onChange(preset)`.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { mountEnemyGymEditor } from "../adapters/enemy-gym.js";

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("mountEnemyGymEditor", () => {
  it("mounts, forwards changes and disposes cleanly", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const onChange = vi.fn();

    const handle = mountEnemyGymEditor(container, {
      preset: {
        version: 1,
        recipe: "weapon-laser-zap",
        seed: 1234,
        overrides: {},
      },
      onChange,
      label: "Enemy sound",
    });

    expect(container.childElementCount).toBe(1);
    const root = container.firstElementChild as HTMLElement;
    expect(root.getAttribute("aria-label")).toBe("Enemy sound");
    expect(handle.getPreset().recipe).toBe("weapon-laser-zap");

    const shadow = root.shadowRoot!;
    const control = shadow.querySelector<HTMLElement>('[data-parameter="noiseBurstLevel"]');
    expect(control).not.toBeNull();
    control!.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));

    expect(onChange).toHaveBeenCalledTimes(1);
    const next = onChange.mock.calls[0][0];
    expect(next.overrides.noiseBurstLevel).toBeTypeOf("number");
    expect(handle.getPreset().overrides.noiseBurstLevel).toBeTypeOf("number");

    handle.setPreset({
      version: 1,
      recipe: "footstep-stone",
      seed: 7,
      overrides: {},
    });
    expect(handle.getPreset().recipe).toBe("footstep-stone");

    handle.dispose();
    expect(container.childElementCount).toBe(0);
    handle.dispose(); // idempotent
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
