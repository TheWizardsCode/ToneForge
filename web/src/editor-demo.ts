/**
 * Standalone Sound Editor demo entry.
 *
 * Mounts the embeddable editor, lets the user pick a recipe + seed, auditions
 * the sound and exports a WAV — all in the browser, without a host framework.
 */

import { initializeRecipeRegistry, registry } from "@toneforge/recipes/index.js";
import { initializeBrowserRecipeRegistry } from "./browser-recipe-registry.js";
import {
  createSoundEditor,
  createWavDownload,
  type SoundPreset,
} from "./components/SoundEditor/index.js";

const recipeSelect = document.querySelector<HTMLSelectElement>("#recipe")!;
const seedInput = document.querySelector<HTMLInputElement>("#seed")!;
const loadButton = document.querySelector<HTMLButtonElement>("#load")!;
const exportButton = document.querySelector<HTMLButtonElement>("#export")!;
const disposeButton = document.querySelector<HTMLButtonElement>("#dispose")!;
const container = document.querySelector<HTMLElement>("#editor")!;
const output = document.querySelector<HTMLElement>("#preset-out")!;

function populateRecipes(): void {
  for (const name of registry.list()) {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    recipeSelect.appendChild(option);
  }
}

async function main(): Promise<void> {
  // File-backed recipes are a Node-only discovery path; in the browser it is
  // a no-op, so register the inlined recipe bundle instead. Both calls are
  // idempotent.
  await initializeRecipeRegistry();
  await initializeBrowserRecipeRegistry();
  populateRecipes();

  let preset: SoundPreset = {
    version: 1,
    recipe: recipeSelect.value || "ui-scifi-confirm",
    seed: Number(seedInput.value) || 42,
    overrides: {},
  };
  recipeSelect.value = preset.recipe;

  const editor = createSoundEditor({ preset });
  editor.mount(container);

  const renderOutput = (): void => {
    output.textContent = JSON.stringify(editor.getPreset(), null, 2);
  };
  renderOutput();

  editor.onChange(() => renderOutput());

  loadButton.addEventListener("click", () => {
    preset = {
      version: 1,
      recipe: recipeSelect.value,
      seed: Number(seedInput.value) || 0,
      overrides: {},
    };
    editor.setPreset(preset);
    renderOutput();
  });

  exportButton.addEventListener("click", () => {
    void createWavDownload(editor.getPreset()).then((wav) => wav.download());
  });

  disposeButton.addEventListener("click", () => {
    editor.dispose();
    output.textContent = "";
  });
}

void main();
