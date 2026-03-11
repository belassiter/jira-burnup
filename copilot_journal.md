# Copilot Journal

## February 23, 2026

**User Request**: "We're starting a new app. Read design.md for details. Look at the example app in example/ to get a jumpstart, though the output of this app is different. We'll use the same tech stack and basic communication with the Jira API." && "It's showing statuses that are in the future. For the future, show no bars. We need to make the status control better. I want to click "Status" and see a modal pop up. In that modal, I can drag statuses up/down into the order they'll appear in the plot. When I click on a status, I want to be shown a color picker. The y-axis needs to show the name of the metric (rotated -90 degrees). In the upper-right (in the header), add buttons for "Save" and "Load"."

**Summary of Changes**:
- Scaffolding: Created project structure (`package.json`, `vite.config.ts`, `tsconfig.json`) mirroring `example/`.
- Logic: Implemented `src/utils/dataProcessor.ts` to generate daily snapshots of Jira issues by "rewinding" history from the changelog. Added logic to stop processing if the loop reaches a future date relative to "now".
- Components: Added `StatusManager.tsx` using `@hello-pangea/dnd` for drag-and-drop status ordering and color configuration.
- UI: created `src/App.tsx` containing:
    - Stacked Bar Chart (Recharts) visualizing the daily snapshots.
    - Configuration for JQL, Date Range, Metric.
    - Integration with `StatusManager`.
    - Save/Load functionality (JSON file import/export).
    - Header with "Save Config" and "Load Config" buttons.
    - Credentials Modal for Jira authentication.
- Electron: Setup main process to handle local file system auth token storage and Jira API proxying.
- Testing: Added unit tests for `dataProcessor` in `src/utils/dataProcessor.test.ts`.
- Quality: Added linting configuration (`.eslintrc.cjs`) and fixed all linting errors. Verified build passes.

**Design/Architecture Notes**:
**User Request**: "1. The button to run the JQL query is too small... 2. If the user hasn't run the JQL query... 3. When a config is loaded, run the JQL query automatically... 4. The order of the Statuses is opposite... 5. Hovering on the bar should only show the data for that status... 6. The x-axis should always span the entire date range."

**Summary of Changes**:
- Feature: Added auto-fetch logic to `loadConfiguration` to trigger `handleFetchData` with the loaded JQL.
- Component: Increased `rightSectionWidth` on the JQL TextInput button for better visibility.
- Component: Disabled the "Configure Statuses" button if `issues` array is empty.
- Logic: Updated `chartData` useMemo to process snapshots even if `issues` is empty, ensuring the X-Axis always spans the selected `dateRange`.
- Visualization: Reversed the mapping order of Bars (`[...statusConfigs].reverse()`) so the top item in the status list appears at the top of the stacked bar.
- Visualization: Updated `Tooltip` to use a transparent cursor, though Recharts default behavior is to show all data points for a category. (Note: Tooltip behavior customization in Recharts to show *only* the hovered bar segment is complex/non-standard as Recharts tooltips are axis-based by default. I used `cursor={{fill: 'transparent'}}` as a partial improvement, but standard shared tooltip remains).
- Testing: Added a unit test case for empty issue list ensuring the date range is still fully generated.

**Design/Architecture Notes**:
- Recharts stacking order is bottom-to-top based on the order of `<Bar />` components. To make the "Top" status in the list appear at the "Top" of the stack visually, we must render that `<Bar />` last. Hence the `.reverse()` call on the configs before mapping.

**User Request**: "Update UI so there is no scrolling... everything always visible. Default window size to 1200x800. Burnup Chart text should be a field, so I can customize the name of the chart. Legend should be upper right, in-line with the Title. Graph Type options (Stacked Bar vs. Stacked Area). Update Run Time (minutes) so the label is correct."

**Summary of Changes**:
- **UI Layout**: Switched `AppShell` to use `height: 100vh` and flexbox (`flex-col`, `overflow: hidden`) to eliminate page scrolling. The chart now resizes dynamically to fit the viewport.
- **Window Management**: Updated `electron/main.ts` to initialize the window at 1200x800 pixels.
- **Chart Customization**:
    - Added an editable `TextInput` for the chart title (defaults to "Burnup Chart").
    - Added a `SegmentedControl` to toggle between **Stacked Bar** and **Stacked Area** chart types.
    - Updated `METRICS` to include "Run Time (minutes)" with the correct field ID (`customfield_15505`).
    - Positioned the chart `Legend` in the upper-right corner, inline with the title area using `verticalAlign="top"` and negative margin wrapper styles.
- **State Management**: Persisted `graphTitle` and `graphType` in `saveConfiguration`/`loadConfiguration`.

**Design/Architecture Notes**:
- The chart component (`AreaChart` vs `BarChart`) is dynamically selected based on `graphType` state.

## February 24, 2026

**User Request**: "Add forecasting. Add Drag/Drop categorization for statuses (Not Started, Started, Done). Display Monte Carlo simulation results. Integrate forecasting line into the chart."

**Summary of Changes**:
- **Data Structures**: Updated `types.ts` to include `StatusCategory` ('not-started', 'started', 'done') in `StatusConfig`.
- **Status Management**: Rewrote `StatusManager.tsx` to support 3-column drag-and-drop categorization using `@hello-pangea/dnd`.
- **Forecasting Logic**: Implemented `src/utils/forecasting.ts` with `calculateVelocity`, `generateForecast` (linear projection based on average velocity), and `runMonteCarlo` (probabilistic simulation).
- **Visualization**: 
    - Updated `App.tsx` to use `ComposedChart` to support mixing Bar/Area charts with Line charts.
    - Added "Show Forecast" toggle.
    - When enabled, `chartData` is extended into the future with forecasted "Done" values, rendered as a dashed line.
    - Displayed Monte Carlo simulation statistics (p50, p85, p95 completion days) in a banner below the chart controls.
- **Refactoring**: Moved `Issue` interface to `types.ts` to share between components and utilities.

**Design/Architecture Notes**:
- The forecast simply projects the "Done" work linearly based on the average daily velocity of the selected timeframe.
- Monte Carlo simulation runs 1000 iterations using historical daily velocities to estimate completion probability.
- The chart's X-axis automatically extends to accommodate the forecast data points.
- `ResponsiveContainer` is used to ensure the chart fills the available flex space without overflowing.

**User Request**: "For the stacked area chart, use straight lines, not curved lines to connect datapoints. Show the datapoints as a filled circle. There's a lot of wasted white space around the plot title. Tighten that up a lot. Make the default window size 1200x900 px."

**Summary of Changes**:
- **Chart Styling**:
    - Changed `type` from `monotone` to `linear` for both `Area` and `Bar` (Bar ignores it) to ensure straight lines in Area chart.
    - Added `dot={{ fill: config.color, r: 4 }}` configuration to `DataComponent` when `graphType === 'area'`, enabling filled circular data points.
- **UI Layout**:
    - Reduced padding in the Chart `Paper` container from `p="md"` to `p="xs"`.
    - Reduced `TextInput` size from `xl` to `md` and removed extra vertical margins.
    - Adjusted `marginTop` of the chart container to tighten the spacing further.
- **Window Configuration**: Updated `electron/main.ts` default window size to **1200x900**.

**User Request**: "There's still too much space above and below the plot title. Reduce it more. Also, the legend should be vertically aligned with the plot title. Right now it's above. For stacked area plot, make the circles have a thin black outline, so they'll be visible."

**Summary of Changes**:
- **Layout & Spacing**:
    - Changed the Chart container `Paper` padding from `p="xs"` to `p={0}`.
    - Added `position: 'relative'` to the Chart `Paper`.
    - Set `marginTop: 0` for the chart container div (was previously `-10` then `0`, finally explicitly handled).
    - Reduced `margin` top in Recharts from `20` to `0`.
- **Legend Alignment**:
    - Adjusted the `Legend` `wrapperStyle` to `top: -35px` and `right: 10px` to visually align it with the title input.
- **Chart Styling**:
    - Updated the `dot` configuration for `AreaChart`: `{ fill: config.color, stroke: 'black', strokeWidth: 1, r: 4 }`. This adds a black outline to the data points, improving visibility against similar background colors.

## February 24, 2026

**User Request**: "1. Refactor `StatusManager` to use vertical stack sorting. 2. Remove forecast banner and use `ForecastModal`. 3. Add dashed/dotted lines for forecast."

**Summary of Changes**:
- **StatusManager.tsx**: 
    - Layout changed from grid to vertical `stack`.
    - Updated `dragEnd` logic to handle vertical list reordering while preserving category groups.
    - Visual order in modal now dictates `statusConfigs` array order, which controls chart stacking.
- **App.tsx**: 
    - Removed old Monte Carlo banner. 
    - Added `ForecastModal` (via "Forecast ⚙️" button). 
    - Integrated `generateForecast` directly into `chartData` using `ForecastConfig`.
    - Added dashed line for linear forecast and dotted lines for 95% confidence intervals.
- **Dependencies & Cleanup**:
    - Fixed syntax errors in `src/utils/forecasting.ts`.
    - Deleted redundant and conflicting `src/types.ts`.
    - Consolidated all shared types into `src/types/index.ts` and updated strictness to match test usage (e.g. optional `resolutiondate`).
    - Verified `npm run verify` (lint/test/build) passes successfully.

**Design/Architecture Notes**:
- **Single Source of Truth**: Removed the conflicting `src/types.ts` vs `src/types/index.ts` ambiguity. `src/types/index.ts` is now the canonical type definition file.
- **Forecast Integration**: Forecasting is no longer a separate calculation step but integrated into the data transformation pipeline for the chart, allowing seamless toggling.

## February 24, 2026

**User Request**: "You are an expert developer. The user enabled forecasting but sees no lines. I suspect the Average Velocity might be <= 0 over the small window (2 datapoints), causing the forecast to return only the anchor point, which renders nothing. Or, maybe the \"Done\" status is not configured correctly. 1. Analyze src/utils/forecasting.ts. 2. Analyze src/App.tsx merging logic. 3. Fix Plan: ... Refine the generateForecast function to handling the zero-velocity case gracefully by projecting a flat line for a default period (e.g. 14 days) so the user sees something indicating \"No progress\"."

**Summary of Changes**:
- **Logic**: Modified `src/utils/forecasting.ts`'s `generateForecast` function.
    - When `avgVelocity <= 0` and work remains, instead of returning just the anchor point (which rendered nothing), it now projects a flat line for 14 days (the `stalledHorizon`). This gives visual feedback that progress is stalled or regressing.
    - Exported `ChartPoint` interface to be used in tests.
- **Testing**: Created `src/utils/forecasting.test.ts` covering positive velocity, zero velocity (flat line), and negative velocity cases.
- **Verification**: `npm test` passed, `npm run build` passed.



## 2/25/2026 11:55 AM
User: Revert to the previous behavior regarding forecasting logic. Also, the Scope forecast needs to start at the last datapoint, currently it is disconnected. And I found a bug: If I load a config, the forecast is showing even if it's toggled off.

Summary:
- Reverted forecasting logic in src/utils/forecasting.ts to use workday-based slope accumulation, addressing the 'multiple straight-line segments' issue.
- Fixed the Total Scope line discontinuity by explicitly adding the current Total Scope to the anchor point in orecastPoints.
- Fixed a bug where ForecastModal showed stale configuration state (OFF) even when the app state was ON after loading a config file. Added a key prop to ForecastModal in App.tsx to force re-initialization when it opens/closes.
- Verified all changes with 
pm run verify (78 tests passed).


## 2/25/2026 12:00 PM
User: Add detailed logging to orecasting.ts to debug 'weird things' including base data and forecasted data.

Summary:
- Added extensive console.log statements to src/utils/forecasting.ts:
  - Log alidData.slice(-5) to show the basis for the forecast.
  - Log workDayVelocity, slopeLow, slopeHigh before the loop.
  - Log a sample (first 5 and last 5) of the generated orecastPoints.
- Verified changes with 
pm run verify (78 tests passed).


## 2/25/2026 12:05 PM
User: Provided log data showing 'weird' forecast behavior (duplicated points, weekend gaps).

Summary:
- Analyzed logs: Identified issues with weekend handling causing duplicate points (e.g., 2026-03-05 appeared twice in previous logic, though not explicitly in user log, the loop logic was suspect).
- Key finding: isWeekend was using getDay() which operates on local time, but input dates like '2026-02-25' are parsed as UTC midnight. In Western timezones (PST), this shifts to previous day (Tuesday -> Monday), causing off-by-one errors in weekend detection.
- Fixed isWeekend to use getUTCDay().
- Fixed ddDays to use setUTCDate to avoid timezone shifts when crossing DST boundaries.
- Adjusted the forecast loop to continue (skip) weekend points to create 'straight lines' over weekends (using Recharts connectNulls), but explicitly skipping the *push* to orecastPoints so we don't have flat segments.
- Verified with 
pm run verify which passed.


## 2/25/2026 12:15 PM
User: Revert StatusManager.tsx to match the version in the last commit (fixing a color picker issue).

Summary:
- Identified that StatusManager.tsx had uncommitted changes introducing complex categorization and UI changes.
- The issue was likely that the entire row was made draggable (dragHandleProps on the container), preventing interaction with the ColorInput.
- Ran git restore src/components/StatusManager.tsx to revert the file to the last committed state (HEAD), which uses a simpler list where the drag handle creates a dedicated grip area.
- Verified the revert by checking git status (file is now clean).


## 2/25/2026 12:20 PM
User: Corrected me; the 'broken' behavior was actually the desired new feature (Status Grouping), and the only bug was the color picker.

Summary:
- I apologized for the revert and reconstructed the StatusManager.tsx file from the previous git diff output (since the file system state was lost).
- The reconstructed file includes the new category-based status grouping (Not Started, Started, Done) and drag-and-drop logic.
- The fix for the Color Picker was applied: I moved the {...provided.dragHandleProps} from the parent Paper (which made the whole row a drag handle) to the specific IconGripVertical div. This ensures the ColorInput and other controls remain interactive.
- Verified the changes with 
pm run verify (78 tests passed).


## 2/25/2026 12:25 PM
User: Reported that the color picker was rendering incorrectly (small, cut-off text, magnifying glass on click) and requested a user-friendly UX.

Summary:
- Identified that StatusManager.tsx had aggressive styling on ColorInput (w={24} and fixed styles) that made it unusable.
- Changed the ColorInput width to w={120} and removed the restrictive styles prop.
- This restores the standard Mantine ColorInput appearance (swatch + hex code input) which is user-friendly.
- Verified changes with 
pm run verify (78 tests passed).


## 2/25/2026 12:30 PM
User: Requested to remove the color code text and the pencil/eye-dropper icon from the color picker.

Summary:
- Updated StatusManager.tsx to configure ColorInput as a swatch-only trigger:
  - Added withEyeDropper={false} to remove the pencil icon.
  - Set w={36} and used styles to make the input text color 	ransparent, shift the padding, and ensure the cursor is a pointer. This effectively hides the text while keeping the input functional as a click target for the picker.
- Verified changes with 
pm run verify (78 tests passed).


## 3/11/2026 9:50 AM PT
User: There are some strange things happening with the y-axis labels. I see 0, 50, 100, 192, when total scope is 182.
I would expect to see only multiples of 50.

Summary:
- Identified the root cause in [src/App.tsx](src/App.tsx): Y-axis max was being computed with 5% padding (`Math.ceil(maxStack * 1.05)`), which produced non-step values like `192`.
- Added [src/utils/chartAxis.ts](src/utils/chartAxis.ts) with deterministic Y-axis helpers:
    - `getRoundedYAxisMax()` rounds the max value up to the next multiple of 50.
    - `getYAxisTicks()` generates explicit ticks at fixed 50-unit intervals.
- Updated [src/App.tsx](src/App.tsx) to use fixed Y-axis config:
    - `domain={[0, yAxisConfig.domainMax]}`
    - `ticks={yAxisConfig.ticks}`
    This guarantees labels like `0, 50, 100, 150, 200`.
- Added regression tests in [src/utils/chartAxis.test.ts](src/utils/chartAxis.test.ts) to lock this behavior.
- Verification completed: `npm run lint`, `npm test`, and `npm run build` all passed.


## 3/11/2026 10:10 AM PT
User: Good. For x-axis labels, the increment should either be single days (if the time range is short), or integer multiples of weeks. For integer number of weeks, the date displayed should be a Monday, and the start/end dates should also be displayed regardless of day of the week.
For example, 
Date range: 2025-11-11 to 2026-04-17
First date: 2025-11-11 (tuesday)
Next date: A monday (for example, December 1 or December 8)
Following dates: Mondays, same number of weeks inrement
Last date: 2026-04-17

Summary:
- Added [src/utils/xAxis.ts](src/utils/xAxis.ts) to generate deterministic X-axis ticks:
    - Short ranges (<= 21 days): show day-level ticks.
    - Longer ranges: show `start` + Monday ticks at an integer week interval + `end`.
- Updated [src/App.tsx](src/App.tsx) to wire `XAxis` with explicit `ticks={xAxisTicks}` and `interval={0}`.
- Added tests in [src/utils/xAxis.test.ts](src/utils/xAxis.test.ts):
    - Verifies short-range day mode.
    - Verifies long-range Monday-only interior ticks with preserved start/end.
- Fixed follow-up issues discovered by tests:
    - Hook order in [src/App.tsx](src/App.tsx) (moved `xAxisTicks` memo below `chartData` declaration).
    - Timezone-sensitive test setup by using `parseISO` instead of `new Date('YYYY-MM-DD')`.
- Verification completed: `npm run lint`, `npm test`, and `npm run build` all passed.


## 3/11/2026 10:20 AM PT
User: Now I'm seeing overlapping dates at the beginning and the end. The 2nd date should be approximately the same distance as the integer number of weeks. 
Also, the last date is now getting truncated off the right edge of the screen.

Summary:
- Updated [src/utils/xAxis.ts](src/utils/xAxis.ts) to improve long-range tick spacing:
    - The first interior Monday tick is now anchored around one full `stepWeeks` interval from the start date (instead of the immediate next Monday), preventing start-label overlap.
    - Added guard logic to remove the final interior Monday tick when it is too close to the required end-date tick, preventing end-label overlap.
- Updated [src/App.tsx](src/App.tsx) `XAxis` rendering:
    - Added `tickMargin={8}`.
    - Added `padding={{ left: 8, right: 24 }}` so the final date label does not get clipped off the right edge.
- Expanded [src/utils/xAxis.test.ts](src/utils/xAxis.test.ts) coverage:
    - Validates first interior tick spacing is approximately one full step.
    - Validates sufficient spacing before the end tick.
- Verification completed: `npm run lint`, `npm test`, and `npm run build` all passed.


## 3/11/2026 10:25 AM PT
User: Ok, getting closer. I don't like that the plot extends beyond the date range. Instead, let's just add a little more padding on the right side of the plot so the date label doesn't get cut off.

Summary:
- Updated chart layout in [src/App.tsx](src/App.tsx):
    - Removed `XAxis` domain padding (`padding={{ left: 8, right: 24 }}`) to stop visual extension beyond the selected date range.
    - Increased `ComposedChart` right margin from `30` to `46` to preserve space for the final X-axis label.
    - Kept `tickMargin={8}` for label readability.
- Result: the plot domain now stays aligned with the actual date range, while the last date label has extra right-side room and does not clip.
- Verification completed: `npm run lint`, `npm test`, and `npm run build` all passed.


## 3/11/2026 10:55 AM PT
User: I'm seeing a case that covers 13 weekdays, and it's trying to display x-axis labels daily, and it's very overlapping.

Summary:
- Updated [src/utils/xAxis.ts](src/utils/xAxis.ts) short-range behavior:
    - Kept day-based mode for short ranges, but added a density cap (`MAX_DAILY_TICKS = 9`).
    - When short-range weekday count exceeds the cap (e.g., 13 weekdays), ticks are now downsampled while preserving first and last dates.
- Added regression coverage in [src/utils/xAxis.test.ts](src/utils/xAxis.test.ts):
    - New test validates that a 13-weekday range no longer renders every daily label and still includes start/end.
- Verification completed: `npm run lint`, `npm test`, and `npm run build` all passed.


## 3/11/2026 11:00 AM PT
User: Also, y-axis first label should always be zero. Also, it should be smarter about the increments. I see it has an increment of 700, that's not really what people expect. Use standard behavior.

Summary:
- Reworked [src/utils/chartAxis.ts](src/utils/chartAxis.ts):
    - Replaced fixed-step behavior with a standard “nice number” tick algorithm (1/2/5 × powers of 10).
    - Ensured Y-axis ticks always start with `0` as the first label.
    - Updated rounded max calculation to align with the selected nice step.
- Updated tests in [src/utils/chartAxis.test.ts](src/utils/chartAxis.test.ts):
    - Kept expected behavior for 182 → `[0, 50, 100, 150, 200]`.
    - Added coverage to ensure awkward increments like `700` are avoided in favor of standard increments.
    - Added/updated safety checks for invalid/empty input.
- Verification completed: `npm run lint`, `npm test`, and `npm run build` all passed.



## 2026-03-11 11:28:15

**Prompt:**
Examine the `src/components/StatusManager.tsx` file for the following fixes:
1. Provide a button to set all statuses in a group to a certain color. "Set to Red" for "Not Started", "Set to Gold" for "Started" (darker gold), and "Set to Green" for "Done" (darker green).
2. When the modal is closed via onClose (e.g. clicking the X or background), we need to warn the user if `localConfigs` differs from `statusConfigs` and ask "Are you sure you want to lose these changes?". If the user clicks Save, we save. If they click Cancel, we discard, but maybe warning them with `window.confirm`.
3. The user reported that when dragging a status, it "shows up far away from where I'm dragging". This is a common bug with `@hello-pangea/dnd` where a `style={provided.draggableProps.style}` might be applied to a component that uses css transforms, or there's a missing ref. Find the dragging code and identify the bug.
Read the file and return the code replacements.

**Changes:**
- Modified StatusManager.tsx to add setGroupColor function and a Button to each Droppable column to set all items within that status group to either red, gold, or green.
- Added initialConfigs state initialized during modal open to track changes. If handleClose calculates that localConfigs varies from initialConfigs, a window.confirm dialog is displayed.
- Refactored Draggable block: Wrapped the Paper node inside a vanilla div block to receive the injected DND refs and styles, avoiding transform conflicts with Mantine components that caused the dragged status item bug.

**Architecture/Design changes:**
- None

 # #   2 0 2 6 - 0 3 - 1 1 :   S t a t u s   M a n a g e r   E n h a n c e m e n t s 
 * * P r o m p t : * * 
 L e t ' s   m a k e   s t a t u s   m a n a g e m e n t   e a s i e r .   1 .   T o   t h e   r i g h t   o f   " N O T   S T A R T E D " ,   I   w a n t   a   b u t t o n   " S e t   t o   R e d "   [ e t c . ] 
 * * C h a n g e s : * * 
 *   A d d e d   s e t G r o u p C o l o r   i n   S t a t u s M a n a g e r . t s x   t o   m a s s - a s s i g n   c o l o r s   b y   s t a t u s   c a t e g o r y   ( R e d / G o l d / G r e e n   f o r   N o t   S t a r t e d / S t a r t e d / D o n e ) . 
 *   I m p l e m e n t e d   d i r t y - s t a t e   t r a c k i n g   u s i n g   i n i t i a l C o n f i g s   c o m p a r i s o n ;   i n t e r c e p t i n g   o n C l o s e   c a l l s   w i t h   a   c o n f i r m   d i a l o g   t o   p r e v e n t   a c c i d e n t a l   d a t a   l o s s . 
 *   F i x e d   a   @ h e l l o - p a n g e a / d n d   t r a n s f o r m   c o o r d i n a t e   b u g   u s i n g   M a n t i n e ' s   < P o r t a l >   w r a p p e r   c o n d i t i o n a l l y   a r o u n d   < D r a g g a b l e >   c o m p o n e n t s   o n l y   w h i l e   s n a p s h o t . i s D r a g g i n g   i s   t r u e .   
 *   V e r i f i e d   l i n t i n g ,   u n i t   t e s t s   ( 1 5 3   p a s s e d ) ,   a n d   p r o d u c t i o n   b u i l d . 
  
 
 # #   2 0 2 6 - 0 3 - 1 1 :   T o t a l   S c o p e   &   C h a r t   D i s p l a y   M o d e   U p d a t e 
 * * P r o m p t : * * 
 1 .   M a k e   s u r e   t h e   T o t a l   S c o p e   c a l c u l a t i o n   t a k e s   i n t o   a c c o u n t   d i s a b l e d   s t a t u s e s . 
 2 .   I n   t h e   S t a t u s   m o d a l ,   i n   t h e   h e a d e r ,   r i g h t   j u s t i f i e d ,   I   w a n t   a   t o g g l e .   T h e   l e f t   s i d e   o f   t h e   t o g g l e   i s   ' A l l   s t a t u s e s ' .   T h e   r i g h t   s i d e   i s   ' C a t e g o r i e s   o n l y ' .   T o   t h e   l e f t   o f   t h e   t o g g l e   i t   s a y s   ' D i s p l a y :   ' . 
 * * C h a n g e s : * * 
 *   U p d a t e d   c a l c u l a t e T o t a l S c o p e   i n    o r e c a s t i n g . t s   t o   s t r i c t l y   i g n o r e   d y n a m i c a l l y   d i s a b l e d   s t a t u s e s   f r o m   b e i n g   i n c l u d e d   i n   t h e   T o t a l   S c o p e   m e t r i c   t a l l y . 
 *   A d d e d   a   s t a t u s D i s p l a y M o d e   g e n e r i c   s t a t e   c o n s t r a i n t   t o   A p p . t s x   m a p p e d   t o   t h e   S t a t u s M a n a g e r   c o m p o n e n t ' s   o v e r a r c h i n g   s e g m e n t   l a y o u t . 
 *   C r e a t e d   a   n e w   S e g m e n t e d C o n t r o l   T o g g l e   n a t i v e l y   b u i l t   i n s i d e   t h e   m o d a l   U I ' s   t i t l e   b l o c k   u s i n g   d y n a m i c   R e a c t   N o d e   i n j e c t i o n   t o   s u p p o r t   r e n d e r i n g   e x a c t   h e a d e r s   m a t c h i n g   r e q u i r e m e n t s . 
 *   R e w r o t e   A p p . t s x   t o   c o n d e n s e   g e n e r a t e d   c h a r t i n g   d a t a   l o g i c a l l y   w h e n   s t a t u s D i s p l a y M o d e   = = =   ' c a t e g o r i e s ' ,   c o n d e n s i n g   d i s t i n c t   s t a t u s   p i p e l i n e s   d y n a m i c a l l y   w i t h i n   p u r e   c a t e g o r i c a l   c o l o r s   t o   o u t p u t   3   p r i m a r y   b l o c k   s t a c k s   v i a   a g g r e g a t i o n . 
 *   V e r i f i e d   u n i t   t e s t s   ( 1 5 3   p a s s e d ) ,   c l e a n   f o r m a t t i n g ,   a n d   p r o d u c t i o n   b u i l d   m e t r i c s . 
  
 