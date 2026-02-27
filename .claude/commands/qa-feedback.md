---
name: 'qa-feedback'
description: 'Read QA feedback from Cowork visual testing and act on it. Use when Cowork has completed QA testing and written feedback. Usage: /qa-feedback'
---

# QA Feedback — Process Cowork Visual QA Results

Read the `.qa/qa_feedback.json` file written by Cowork after visual QA testing, and take appropriate action.

## Steps

1. **Read the feedback:**
   - Load `.qa/qa_feedback.json`
   - If `status` is `idle` or `null`, inform user that no QA feedback is available yet

2. **Analyze results:**
   - Check `overall_pass` — if `true`, proceed to next story
   - If `false`, review each issue in `issues` array
   - Group issues by severity: critical > major > minor > cosmetic

3. **For each issue:**
   - Read the `description`, `expected`, `actual`, and `suggested_fix`
   - If a `screenshot` path is provided, note it for reference
   - Map the `fr` field back to the specific FR in the PRD to understand the requirement

4. **Take action based on `next_action`:**
   - `fix_and_continue`: Fix all critical and major issues, then continue to the next story. Log minor/cosmetic issues in a TODO comment for later.
   - `proceed_to_next_story`: All issues are minor/cosmetic. Continue building. Note issues for later cleanup.
   - `re-qa`: Critical fixes were requested. Fix them, then run `/qa-signal` again for another QA round.

5. **Fix issues:**
   - Address critical issues first, then major
   - For each fix, reference the FR and the specific feedback
   - Test fixes locally if possible (check the route renders, API returns expected data)

6. **After fixes, reset for next cycle:**
   - Update `.qa/build_signal.json` status to `idle`
   - Do NOT modify `qa_feedback.json` (Cowork manages that)
   - If `next_action` was `re-qa`, run `/qa-signal` to trigger another QA round
   - If `next_action` was `fix_and_continue` or `proceed_to_next_story`, proceed to implementing the next story

7. **Output to user:**
   - Summarize: X issues found, Y critical, Z fixed
   - State next action: "Proceeding to Story X.Y" or "Re-signaling for another QA round"

## Important
- Always fix critical issues before moving on
- The `ux_observations` field contains subjective feedback — consider but don't block on it
- Screenshots in `.qa/screenshots/` provide visual evidence — reference them when debugging layout/rendering issues
