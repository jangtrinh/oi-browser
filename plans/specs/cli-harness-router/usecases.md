# Use Cases & Acceptance Criteria: Multi-CLI Shell Harness Core

## UC-1: Auto-Discovery of Installed AI CLI Binaries (`/api/cli/status`)
```gherkin
Feature: Local AI CLI Harness Discovery
  Scenario: Server probes installed CLI binaries on startup and on status request
    Given the Ổi Browser server is running on 127.0.0.1:4104
    When the client requests GET /api/cli/status
    Then the response status is 200
    And the JSON payload lists harnesses ["auto", "claude", "agy", "codex", "grok", "gemini", "orca", "local"]
    And each binary harness reports its resolved executable path and installed boolean
    And companionAffinities maps all 9 companions to their default CLI harness
```

## UC-2: Executing Direct CLI Harness Commands (`/api/cli/exec`)
```gherkin
Feature: Interactive & Headless CLI Harness Execution
  Scenario: Executing a CLI harness command or prompt from the Terminal Dock
    Given the user selects a harness (e.g., "orca", "claude", "agy", "codex", "grok", "gemini", or "local")
    When the client sends POST /api/cli/exec with { harnessId, prompt, companionId, mode }
    Then CliHarnessRouter executes the selected harness with workspace context (.berry-data/karpathy-wiki and skills-extracted)
    And returns { ok, harnessId, resolvedHarness, commandLine, stdout, stderr, durationMs, exitCode }
    And appends the run to the recent CLI execution log
```

## UC-3: Companion Chat Turn with CLI Harness Routing (`POST /api/chat`)
```gherkin
Feature: Companion Chat Orchestrator with Multi-CLI Harness Support
  Scenario: Sending a Companion message with a selected CLI Harness
    Given an active companion (e.g., "consulting-cora" / Ổi Đào)
    When the client sends POST /api/chat with { companionId, message, harnessId }
    Then CompanionChatOrchestrator inspects the target URL via AgentDOMBrowserService
    And records the "cli_harness_dispatch" tool call showing the resolved CLI harness and companion skill bundle
    And creates the visual artifact in SQLite and logs the observation in Karpathy-Wiki Memory
```

## UC-4: Interactive `>_ CLI Harness` Terminal Dock in Browser UI
```gherkin
Feature: Orca ADE-style Terminal Dock UI
  Scenario: Switching AI CLI core and running a command from the Browser UI
    Given the user opens Ổi Browser at http://127.0.0.1:4104/newtab
    Then the ">_ CLI Core" launcher pill is visible in the bottom-right workspace bar
    When the user clicks the ">_ CLI Core" pill
    Then the Orca ADE-style CLI Harness Terminal Dock opens showing detected CLIs (Claude, Agy, Codex, Grok, Gemini, Orca, Local)
    And the user can switch the active harness and run a live command with output rendered in the terminal viewport
```
