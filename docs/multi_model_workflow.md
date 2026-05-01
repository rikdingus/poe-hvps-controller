# Multi-Model Orchestration Plan

This guide defines the workflow for switching between AI models to ensure the highest code quality and most efficient credit usage.

## 🔄 Model Roles & Triggers

### Phase 1: The Architect (Gemini Flash)
*   **When to use**: Project kickoff, major architectural changes, writing documentation, and scaffolding.
*   **Focus**: Speed, breadth, and broad system design.
*   **Switch Trigger**: When the "blueprint" is done and you need to write more than 100 lines of complex, interconnected logic.

### Phase 2: The Craftsman (Claude Opus)
*   **When to use**: Core implementation of the Proxy Backend, React UI components, and complex firmware state machines.
*   **Focus**: Precision, logic depth, and beautiful UI code.
*   **Switch Trigger**: When the code is functional but needs "destructive" testing or a security audit.

### Phase 3: The Auditor (Gemini Pro)
*   **When to use**: Final bug hunting, security verification of WireGuard/Auth logic, and stress-testing edge cases.
*   **Focus**: Correctness, security, and final "gold" documentation.
*   **Switch Trigger**: When the project is ready for production deployment.

---

## 🛰️ Handoff Protocol

Always ensure the following are updated before switching models:
1.  **`docs/walkthrough.md`**: Summarizes the very last physical/software state.
2.  **`docs/system_integration_plan.md`**: Shows what is left to build.
3.  **GitHub Push**: All local changes must be in the repo so the next model can "see" them via GitHub search if needed.

## ⛽ Fuel Monitoring
Check the **AI Fuel Gauge** on the Master Dashboard. 
- **Green**: Proceed with Opus for complex tasks.
- **Orange**: Move documentation and simple fixes to Flash.
- **Red**: Finish all current tasks with Flash; wait for credit reset for Pro/Opus review.
