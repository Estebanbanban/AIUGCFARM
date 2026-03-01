---
name: qa-browser
description: "Visual QA testing of localhost web app against PRD functional requirements. Use this skill when the user says 'QA', 'QA epic X', 'test the app', 'check localhost', or 'visual QA'. Reads build_signal.json to know what to test, browses localhost via Claude in Chrome, verifies FRs from the PRD checklist, takes screenshots of issues, and writes structured feedback to qa_feedback.json for Claude Code to pick up."
---

# QA Browser Skill  -  Visual QA for AIUGC

## Trigger
User says: "QA", "QA epic X story Y", "test the build", "check localhost"

## Prerequisites
- Build signal file exists at `{project}/.qa/build_signal.json` with `status: "ready_for_qa"`
- Dev server running on specified port (default: localhost:3000)
- QA checklist at `{project}/.qa/qa_checklist.md`

## Workflow

### Step 1: Read the Signal
1. Read `.qa/build_signal.json`
2. Extract: epic, story, routes_to_test, frs_to_verify, port, build_notes
3. If status is not `ready_for_qa`, tell user "No build ready for QA. Ask Claude Code to run /qa-signal first."

### Step 2: Load the Checklist
1. Read `.qa/qa_checklist.md`
2. Filter to only the FRs listed in `frs_to_verify`
3. These are the specific checkpoints to verify

### Step 3: Browse and Test
For each route in `routes_to_test`:
1. Navigate to `http://localhost:{port}{route}` using Claude in Chrome
2. Take a screenshot of the initial state
3. For each FR checkpoint:
   a. Perform the UI action described (click button, fill form, check layout)
   b. Verify the expected behavior occurs
   c. If FAIL: take screenshot, save to `.qa/screenshots/{fr}-{description}.png`
   d. Record pass/fail with details

### Step 4: Test Interactions
Beyond static checks, test these interaction patterns where applicable:
- **Forms**: Fill inputs, submit, verify response
- **Navigation**: Click links/buttons, verify route changes
- **Loading states**: Trigger async actions, verify loading indicators
- **Error states**: Submit invalid data, verify error messages
- **Empty states**: Check pages with no data
- **Responsive**: Check at desktop width (1280px) minimum

### Step 5: Write Feedback
Write `.qa/qa_feedback.json`:
```json
{
  "status": "qa_complete",
  "epic": <from signal>,
  "story": "<from signal>",
  "overall_pass": <true if no critical/major issues>,
  "issues": [
    {
      "severity": "critical|major|minor|cosmetic",
      "fr": "FRx",
      "description": "Clear description of the problem",
      "expected": "What should happen per PRD",
      "actual": "What actually happened",
      "screenshot": ".qa/screenshots/frX-description.png",
      "suggested_fix": "Actionable suggestion for Claude Code"
    }
  ],
  "passed_frs": ["FR1", "FR2"],
  "failed_frs": ["FR3"],
  "ux_observations": "General UX notes  -  load times, visual polish, usability",
  "next_action": "fix_and_continue|proceed_to_next_story|re-qa",
  "timestamp": "<ISO timestamp>"
}
```

### Step 6: Report to User
- Summary: "QA complete for Epic X Story Y.Z  -  N/M FRs passed"
- List critical/major issues
- State recommended next_action
- Tell user: "Paste this to Claude Code: **/qa-feedback**"

## Severity Definitions
- **critical**: Feature doesn't work at all, blocks user journey
- **major**: Feature partially works but key behavior is wrong
- **minor**: Works but with rough edges (alignment, wording, minor UX)
- **cosmetic**: Visual-only issues (spacing, colors, fonts)

## next_action Logic
- Any critical issue → `re-qa` (must fix and re-test)
- Major issues only → `fix_and_continue` (fix then move on)
- Minor/cosmetic only → `proceed_to_next_story`
- All pass → `proceed_to_next_story`
