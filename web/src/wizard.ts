// Wizard UI component: stepped navigation through demo content
import { DEMO_STEPS, DEMO_LIST, getDemoById, type DemoStep } from "./demo-content.js";
import { handleCommandAudio } from "./audio.js";
import type { TerminalController } from "./terminal.js";

export interface WizardController {
  dispose(): void;
}

export function createWizard(
  container: HTMLElement,
  getTerminal: () => TerminalController | null,
): WizardController {
  let currentStep = 0;
  let steps: DemoStep[] = DEMO_STEPS;
  let currentDemoId: string = DEMO_LIST.length > 0 ? DEMO_LIST[0].id : "";

  function switchDemo(demoId: string): void {
    const demo = getDemoById(demoId);
    if (demo) {
      steps = demo.steps;
      currentDemoId = demoId;
      currentStep = 0;
      render();
    }
  }

  function render(): void {
    container.innerHTML = "";

    // Toolbar: contains demo selector (if multiple demos) + step nav tabs
    const toolbar = document.createElement("div");
    toolbar.className = "wizard-toolbar";

    // Demo selector (only shown when multiple demos are available)
    if (DEMO_LIST.length > 1) {
      const selectorBar = document.createElement("div");
      selectorBar.className = "wizard-demo-selector";

      const label = document.createElement("label");
      label.textContent = "Demo: ";
      label.setAttribute("for", "demo-select");
      selectorBar.appendChild(label);

      const select = document.createElement("select");
      select.id = "demo-select";
      select.className = "wizard-demo-select";

      for (const demo of DEMO_LIST) {
        const option = document.createElement("option");
        option.value = demo.id;
        option.textContent = demo.title;
        if (demo.id === currentDemoId) {
          option.selected = true;
        }
        select.appendChild(option);
      }

      select.addEventListener("change", () => {
        switchDemo(select.value);
      });

      selectorBar.appendChild(select);
      toolbar.appendChild(selectorBar);
    }

    // Step indicators
    const nav = document.createElement("nav");
    nav.className = "wizard-nav";

    steps.forEach((step, i) => {
      const btn = document.createElement("button");
      btn.className = `wizard-nav-btn${i === currentStep ? " active" : ""}`;
      btn.textContent = step.label;
      btn.title = step.title;
      btn.addEventListener("click", () => {
        currentStep = i;
        render();
      });
      nav.appendChild(btn);
    });

    toolbar.appendChild(nav);
    container.appendChild(toolbar);

    // Step content
    const step = steps[currentStep];
    const content = document.createElement("div");
    content.className = "wizard-content";

    content.appendChild(renderStepContent(step));

    // Navigation buttons
    const navBar = document.createElement("div");
    navBar.className = "wizard-nav-bar";

    if (currentStep > 0) {
      const prevBtn = document.createElement("button");
      prevBtn.className = "wizard-btn wizard-btn-prev";
      prevBtn.textContent = "\u2190 Back";
      prevBtn.addEventListener("click", () => {
        currentStep--;
        render();
      });
      navBar.appendChild(prevBtn);
    }

    // Spacer
    const spacer = document.createElement("div");
    spacer.style.flex = "1";
    navBar.appendChild(spacer);

    if (currentStep < steps.length - 1) {
      const nextBtn = document.createElement("button");
      nextBtn.className = "wizard-btn wizard-btn-next";
      nextBtn.textContent = "Next \u2192";
      nextBtn.addEventListener("click", () => {
        currentStep++;
        render();
      });
      navBar.appendChild(nextBtn);
    }

    content.appendChild(navBar);
    container.appendChild(content);
  }

  function buildDescriptionElement(description: string): HTMLElement {
    const desc = document.createElement("div");
    desc.className = "wizard-description";

    // Split on double newlines to get logical blocks (paragraphs / lists)
    const blocks = description.split(/\n\n+/);
    for (const block of blocks) {
      const trimmed = block.trim();
      if (!trimmed) continue;

      // Detect ordered or unordered list blocks
      const lines = trimmed.split("\n");
      const isOrderedList = lines.every((l) => /^\d+\.\s/.test(l));
      const isUnorderedList = lines.every((l) => /^[-*]\s/.test(l));

      if (isOrderedList) {
        const ol = document.createElement("ol");
        for (const line of lines) {
          const li = document.createElement("li");
          li.textContent = line.replace(/^\d+\.\s/, "");
          ol.appendChild(li);
        }
        desc.appendChild(ol);
      } else if (isUnorderedList) {
        const ul = document.createElement("ul");
        for (const line of lines) {
          const li = document.createElement("li");
          li.textContent = line.replace(/^[-*]\s/, "");
          ul.appendChild(li);
        }
        desc.appendChild(ul);
      } else {
        const p = document.createElement("p");
        p.textContent = trimmed;
        desc.appendChild(p);
      }
    }

    return desc;
  }

  function buildCommandsElement(
    commands: string[],
    getTerminal: () => TerminalController | null,
  ): HTMLElement {
    const cmdSection = document.createElement("div");
    cmdSection.className = "wizard-commands";

    commands.forEach((cmd) => {
      const cmdLine = document.createElement("div");
      cmdLine.className = "wizard-cmd-line";

      const cmdText = document.createElement("code");
      cmdText.textContent = `$ ${cmd}`;
      cmdLine.appendChild(cmdText);

      cmdSection.appendChild(cmdLine);
    });

    const runBtn = document.createElement("button");
    runBtn.className = "wizard-btn wizard-btn-run";
    runBtn.textContent = "\u25B6 Run";
    runBtn.addEventListener("click", () => {
      const terminal = getTerminal();
      if (terminal) {
        commands.forEach((cmd, i) => {
          // Stagger multiple commands with a small delay
          setTimeout(() => {
            terminal.sendCommand(cmd);
            // Also render and play audio in the browser for generate commands
            handleCommandAudio(cmd);
          }, i * 500);
        });
      }
    });
    cmdSection.appendChild(runBtn);

    return cmdSection;
  }

  function renderStepContent(step: DemoStep): HTMLElement {
    const section = document.createElement("section");
    section.className = "wizard-step";

    const heading = document.createElement("h2");
    heading.className = "wizard-step-title";
    heading.textContent = step.title;
    section.appendChild(heading);

    if (step.problem) {
      const problemBlock = document.createElement("div");
      problemBlock.className = "wizard-block wizard-problem";
      const problemLabel = document.createElement("span");
      problemLabel.className = "wizard-block-label";
      problemLabel.textContent = "PROBLEM";
      problemBlock.appendChild(problemLabel);
      const problemText = document.createElement("p");
      problemText.textContent = step.problem;
      problemBlock.appendChild(problemText);
      section.appendChild(problemBlock);
    }

    if (step.solution) {
      const solutionBlock = document.createElement("div");
      solutionBlock.className = "wizard-block wizard-solution";
      const solutionLabel = document.createElement("span");
      solutionLabel.className = "wizard-block-label";
      solutionLabel.textContent = "SOLUTION";
      solutionBlock.appendChild(solutionLabel);
      const solutionText = document.createElement("p");
      solutionText.textContent = step.solution;
      solutionBlock.appendChild(solutionText);
      section.appendChild(solutionBlock);
    }

    // Build description element if present
    const desc = step.description ? buildDescriptionElement(step.description) : null;

    // Build commands element if present
    const cmdSection = step.commands.length > 0 ? buildCommandsElement(step.commands, getTerminal) : null;

    // When both description and commands exist, wrap them in a side-by-side layout
    if (desc && cmdSection) {
      const body = document.createElement("div");
      body.className = "wizard-body";

      const left = document.createElement("div");
      left.className = "wizard-body-left";
      left.appendChild(desc);
      body.appendChild(left);

      const right = document.createElement("div");
      right.className = "wizard-body-right";
      right.appendChild(cmdSection);
      body.appendChild(right);

      section.appendChild(body);
    } else {
      // Only one or neither -- append directly (full-width)
      if (desc) section.appendChild(desc);
      if (cmdSection) section.appendChild(cmdSection);
    }

    if (step.commentary) {
      const cmt = document.createElement("div");
      cmt.className = "wizard-commentary";
      const cmtText = document.createElement("p");
      cmtText.textContent = step.commentary;
      cmt.appendChild(cmtText);
      section.appendChild(cmt);
    }

    return section;
  }

  render();

  return {
    dispose(): void {
      container.innerHTML = "";
    },
  };
}
