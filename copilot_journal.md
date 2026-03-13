# January 22, 2025 (Approximate)

## User Prompt (1)
Monte carlo modal: I want "Range: 2026-04-08 - 2026-07-13" to rather be the 95% confidence range (not the entire range). Do this for both the Rate and Date modes.

## User Prompt (2)
On the plot, upper right corner, right-justified. add the text: "Forecasted Completion: [date]  [whole number] weeks". The [whole number] comes from the 95% confidence span.

## Summary
Implemented 95% confidence ranges for Monte Carlo outputs and updated forecast text display logic to use the same confidence-window span.

## Verification
Ran npm run verify successfully at the time of that change.

---

# March 12, 2026 15:40 PT

## User Prompt
Let's build it!
1. In the header, add a button "Confluence [gear icon]" to the left of "Reset". The button is blue. This opens a modal where the user enters the necessary information (Confluence URL, PAT, page URL, Attachment filename (default jira-burnup-latest.png)). Closing the modal saves the information. Save/Load Config buttons includes this information.
2. In the header, add a blue button "Publish". This starts a spinner, that starts as soon as the button is pressed and continues until the operation is done. It publishes the burnup to the Confluence page from the Confluence settings modal, and it also includes on the page the date-time the upload happened. When it's done, a snackbar message appears confirming.

## Summary of Changes
- Added Confluence settings modal and publish button UX.
- Added Confluence publish flow (attachment upload and page timestamp update).
- Added config and test coverage for Confluence URL parsing and filename defaults.

## Architecture / Design Notes
- Confluence publish logic runs in Electron main process IPC handlers.
- Renderer captures chart PNG and sends it to backend for publish.

## Verification
Ran npm run verify successfully.

---

# March 12, 2026 15:49 PT

## User Prompt
Actually, it seems like we should store the Confluence base URL and the Confluence PAT in the same file that the equivalent Jira info is stored (rather than storing them in the burnup config file). Let's update that.
Also, the copilot_journal.md has problems. Make sure that's a valid md file.

## Summary of Changes
- Updated Confluence credential persistence so confluenceUrl and Confluence PAT are stored in the same secrets file as Jira credentials (jira-secrets.json).
- Updated app config save and load behavior to exclude Confluence credentials from exported and imported burnup config files.
- Kept Confluence page URL and attachment filename as burnup config settings.
- Fixed copilot_journal.md to be clean UTF-8 Markdown text.
- Stabilized app render test mock behavior to avoid timeout regression.

## Architecture / Design Notes
- save-credentials now preserves existing Confluence credential fields when updating Jira credentials.
- save-confluence-config now merges Confluence credentials into the Jira secrets JSON instead of writing a separate Confluence config file.
- get-confluence-config reads Confluence credentials from Jira secrets JSON.

## Verification
Ran npm run verify successfully (lint, tests, build all passing).

---

# March 12, 2026 15:57 PT

## User Prompt
The app is crashing when I'm trying to paste things into the Confluence modal

## Summary of Changes
- Hardened Confluence modal paste handling in src/components/ConfluenceSettingsModal.tsx.
- Added input sanitization to remove non-printable control characters from pasted and typed text before storing in state.
- Added explicit onPaste handlers for Confluence URL, PAT, page URL, and attachment filename fields.
- Disabled close-on-outside-click and close-on-escape for this modal to avoid accidental close and save interactions during paste operations.

## Architecture / Design Notes
- Paste sanitization is implemented in the renderer component before any save IPC occurs.
- Save behavior remains aligned with prior UX (close persists settings), but modal dismissal is now intentional via close controls.

## Verification
Ran npm run verify successfully (lint, tests, build all passing).

---

# March 12, 2026 16:22 PT

## User Prompt
1) If I load a config that does not specify Page URL, the value should be cleared upon loading.
2) When I Load Config, it should immediately show a spinner over the plot until all of the actions are completed. It's a poor UX to see all the things changing one by one.
3) look at the copilot_journal.md. It's currently not a valid md file. Fix it.

## Summary of Changes
- Updated config loading logic so Confluence page URL is always reset from config input, and clears to empty when missing.
- Added immediate load-config spinner state and chart overlay spinner while config load actions execute.
- Load Config now keeps spinner visible through config parsing and any triggered data pull completion.
- Rewrote copilot_journal.md as clean UTF-8 Markdown text.

## Architecture / Design Notes
- Introduced loadingConfig state in App for coordinated load UX.
- Added file dialog cancel-safe handling by clearing spinner when no file is selected.

## Verification
Ran npm run verify successfully (lint, tests, build all passing).

## 2026-03-13 10:05:17

**User Prompt:**
First, let's make some more small improvements.
Right now, when it publishes to Confluence it just appends a new entry. Can we make it so if there is an existing PNG of the same name, it overwrites the image and the related text on the page?

**Summary of Changes:**
- Updated the Confluence \updateConfluencePageBodyWithImage\ IPC handler in \electron/main.ts\.
- Replaced the simple append strategy with a dynamic RegEx replacement pattern that safely targets the exact \<ac:image>\ node matching the attachment filename.
- The regex intelligently consumes the preceding \<h2>\ graph title and \<p>\ timestamp block (if present) and overrides the whole cluster in place.
- Added regex to purge legacy HTML \<!-- jira-burnup -->\ comment blocks if they existed in the storage format from earlier versions.

## 2026-03-13 10:14:40

**User Prompt:**
Here's the behavior I see.
1. publish with filename1. filename1 appears
2. publish with filename2. filename2 is appended below filename1
3. publish filename2 again. filename1 is gone. new version of filename2 is present.
Is it feasible to retain filename1 when replacing filename2?

**Summary of Changes:**
- Fixed a regex bug in \updateConfluencePageBodyWithImage\ (Catastrophic Backtracking) where the non-greedy wildcard \.*?\ in the \	imestampPattern\ allowed the regex engine to span multiple HTML nodes (consuming \ilename1\'s timestamp block and stretching all the way to \ilename2\'s image).
- Updated the \headingPattern\ and \	imestampPattern\ to use strict negative lookaheads \(?:(?!</p>).)*?\ and \(?:(?!</h[1-6]>).)*?\ respectively. This enforces that the parsing is tightly bound to exactly the preceding sibling tag to the target attachment, securely ignoring other images on the same Confluence page.

## 2026-03-13 10:47:22

**User Prompt:**
There used to be a spinner that would be active from when I press \Load Config\ until when all operations are done. Fix it.

**Summary of Changes:**
- Fixed an issue in App.tsx where the full-screen \loadingConfig\ spinner was prematurely terminating. 
- Removed the flaky \window.addEventListener('focus', ...)\ timeout hack which incorrectly dismissed the spinner while the system file picker dialog was still open.
- Replaced it with the native HTML5 \input.oncancel\ event listener to cleanly dismiss the spinner only if the user explicitly cancels out of the OS File Dialog. Wait operations correctly block until rendering finishes.

## 2026-03-13 10:54:49

**User Prompt:**
When publishing to Confluence, I would like the title text to be a hyperlink to a Jira search of the JQL.
Example
JQL: (fixversion = "Mobi 7.9.2"  OR "Proposed Fix Version(s)" = "Mobi 7.9.2") and type in (Story, Task, Ticket, Spike) and project not in (RUN)
URL: https://.../issues/?jql=...

**Summary of Changes:**
- Modified the Confluence publishing payload in both \electron/main.ts\ and \src/App.tsx\ to transport the current raw \jql\ string block out to the Node process.
- Updated the \updateConfluencePageBodyWithImage\ generator to conditionally transform the raw <h2> graph text title into an HTML hyperlink <a href=...> that parses against Jira's \/issues/?jql=\ filter interface when both JQL and Jira valid hosts are captured from local credentials.

## 2026-03-13 11:24:11

**User Prompt:**
Let's take a step towards scheduled publishing: bulk publishing. This will allow a user to set up a list of configs, and then click a button to publish each of them.
1. New button in the header bar (left of "Publish"): "Bulk Publish"...

**Summary of Changes:**
- Added 4 new IPC Handlers in \electron/main.ts\ mapping native OS \dialog.showOpenDialog\, \dialog.showSaveDialog\, and raw \s\ reads/writes securely to the Electron renderer so configuration files can be selected strictly by absolute path.
- Created \BulkPublishModal.tsx\, utilizing Mantine's \<Modal keepMounted={true}>\ to persist the configuration list between open/close toggles. Implemented strictly internal save/load operations for these lists targeting default filename \jira-burnup-bulk-publish-config.json\.
- Implemented \handleBulkPublishSequence\ in \App.tsx\ to sequentially orchestrate the app state: parsing each loaded config into the main UI React state hooks, awaiting Jira JQL fetches, delaying \1500\ms to natively permit React's event loop to render new charts, exporting the canvas logic, and utilizing the existing backend Confluence API to publish the batch array continuously underneath a persistent blocking view spinner.

## 2026-03-13 11:58:00
**Prompt:** For configurations:
1. Show just the filename (not the path). Show the full path\filename as a hover tooltip
2. While it's performing the bulk publish, show an overlay list in the bottom-right of the screen. It should have a list of each filename. The active one should have a spinner on the left. Successful ones should get a green check on the left. Failures get a red X.
3. Bulk publishing is including the spinner on the PNG. Make sure that doesn't happen.

**Summary:** 
- In BulkPublishModal.tsx, truncated paths to show only filenames while exposing the full path via Mantine tooltips.
- Implemented global App state [bulkJobs, setBulkJobs] containing arrays of items mapped sequentially during bulk execution. 
- Integrated a Paper overlay block situated bottom-right capturing the dynamically changing arrays (pending -> active -> success/failed), complete with specific Mantine components (Loader, IconCheck, IconX). Disappears slowly at the end.
- Addressed html-to-image rendering bugs capturing loading animations by appending className="no-capture" to the specific loading overlay instance whilst also ensuring it exists within exclusionClasses.

## 2026-03-13 11:58:00
**Prompt:** For configurations:
1. Show just the filename (not the path). Show the full path\filename as a hover tooltip
2. While it's performing the bulk publish, show an overlay list in the bottom-right of the screen. It should have a list of each filename. The active one should have a spinner on the left. Successful ones should get a green check on the left. Failures get a red X.
3. Bulk publishing is including the spinner on the PNG. Make sure that doesn't happen.

**Summary:** 
- In BulkPublishModal.tsx, truncated paths to show only filenames while exposing the full path via Mantine tooltips.
- Implemented global App state [bulkJobs, setBulkJobs] containing arrays of items mapped sequentially during bulk execution. 
- Integrated a Paper overlay block situated bottom-right capturing the dynamically changing arrays (pending -> active -> success/failed), complete with specific Mantine components (Loader, IconCheck, IconX). Disappears slowly at the end.
- Addressed html-to-image rendering bugs capturing loading animations by appending className="no-capture" to the specific loading overlay instance whilst also ensuring it exists within exclusionClasses.
