---
name: 'qa-signal'
description: 'Signal that a story is ready for visual QA testing by Cowork. Use after completing a story implementation to write the build signal file. Usage: /qa-signal'
---

# QA Signal — Notify Cowork That Build Is Ready

After completing a story implementation, run this command to write the `.qa/build_signal.json` file so the Cowork visual QA agent can test the build.

## Steps

1. **Identify what was just built:**
   - Read the current sprint status or determine the most recently completed story
   - Identify which epic and story number was implemented
   - Identify which FRs from the PRD are covered by this story (reference `.qa/qa_checklist.md` and `_bmad-output/planning-artifacts/epics.md`)

2. **Determine routes to test:**
   - Based on the story, list all frontend routes that were created or modified
   - Include the base URL and port the dev server runs on

3. **Check for previous QA feedback:**
   - Read `.qa/qa_feedback.json`
   - If `status` is not `idle` and `next_action` is `fix_and_continue`, note which issues from the previous round were addressed in build_notes

4. **Write the signal file:**
   - Update `.qa/build_signal.json` with:
     ```json
     {
       "status": "ready_for_qa",
       "epic": <epic_number>,
       "story": "<story_id>",
       "story_title": "<story_title>",
       "port": 3000,
       "base_url": "http://localhost:3000",
       "routes_to_test": ["<route1>", "<route2>"],
       "frs_to_verify": ["FR1", "FR2"],
       "build_notes": "<summary of what was built and any caveats>",
       "timestamp": "<ISO timestamp>"
     }
     ```

5. **Ensure dev server is running:**
   - Check if `npm run dev` or `bun dev` is running
   - If not, start it in background
   - Confirm the server is accessible on the specified port

6. **Output to user:**
   - Print: "QA signal written. Tell Cowork: **QA epic X story Y.Z**"
   - List the FRs that should be tested
   - List the routes Cowork should visit

## Important
- Do NOT reset `qa_feedback.json` — Cowork manages that file
- Always verify the dev server is actually running before signaling
- If the story involved backend-only changes (Edge Functions, DB), note this in build_notes so Cowork knows to test via the UI flows that exercise those endpoints
