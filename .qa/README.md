# QA Handoff Protocol — AIUGC

## Overview

This folder enables a build → QA → feedback loop between Claude Code (builder) and Cowork (visual QA tester).

## Flow

```
Claude Code builds story → writes build_signal.json → STOP
User says "QA" in Cowork → Cowork reads signal, browses localhost, tests FRs
Cowork writes qa_feedback.json → User pastes feedback summary to Claude Code
Claude Code reads feedback, fixes issues, continues to next story → repeat
```

## Files

| File | Written By | Read By | Purpose |
|------|-----------|---------|---------|
| `build_signal.json` | Claude Code | Cowork | "I finished building, here's what to test" |
| `qa_feedback.json` | Cowork | Claude Code | "Here's what passed/failed with details" |
| `qa_checklist.md` | Setup (once) | Both | Master FR checklist derived from PRD |
| `screenshots/` | Cowork | Claude Code | Visual evidence of issues |

## Signal Schema

### build_signal.json
```json
{
  "status": "ready_for_qa",
  "epic": 1,
  "story": "1.1",
  "story_title": "Landing Page with URL Input CTA",
  "port": 3000,
  "base_url": "http://localhost:3000",
  "routes_to_test": ["/"],
  "frs_to_verify": ["FR1"],
  "build_notes": "Implemented hero section with URL input...",
  "timestamp": "2026-02-26T23:00:00Z"
}
```

### qa_feedback.json
```json
{
  "status": "qa_complete",
  "epic": 1,
  "story": "1.1",
  "overall_pass": false,
  "issues": [
    {
      "severity": "critical|major|minor|cosmetic",
      "fr": "FR1",
      "description": "URL input field not visible on mobile viewport",
      "expected": "URL input prominently displayed",
      "actual": "Hidden behind fold on 375px width",
      "screenshot": ".qa/screenshots/fr1-mobile-issue.png",
      "suggested_fix": "Add responsive classes to hero section"
    }
  ],
  "passed_frs": ["FR1"],
  "failed_frs": [],
  "ux_observations": "Page loads fast, clear CTA, good contrast",
  "next_action": "fix_and_continue|proceed_to_next_story|re-qa",
  "timestamp": "2026-02-26T23:15:00Z"
}
```
