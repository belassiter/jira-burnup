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


