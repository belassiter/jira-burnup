Goal: Create an app for users to visual Jira burnup data

Overview
* I've made a similar app before that we can use as a basis. The UI portion will be different, but the basics of (1) using the Jira API, and (2) making an electron app will be similar. That app can be found in example/ (note: it's .gitignor-ed)
* Users should be able to use this both as a webpage with a local server, or as a self-contained electron app

General workflow
1. User provides credentials, system saves them (same as the example app)
1. User logs in
1. The user specifies the JQL to pull issues via the Jira API
1. The user clicks "pull data" and the system pulls the data via the Jira API
1. Bar chart
    1. The user is shown a stacked bar chart
    1. Dates are on the x-axis
    1. A metric is on the y-axis (default = Story Points)
    1. The stacking is based on the status, with each status getting a different color
    1. There is a legend showing the definition of each status/color
    1. When hovering over a bar chart segment, it shows the name of the status and the value of the metric
    1. The value displayed is based on the sum across all issues specified by the JQL of the metric, as of 9am Pacific Time on that day.
    1. The x-axis quantization is one day, and only shows weekdays. 
    1. The x-axis and y-axis should have labels
1. The user specifies input parameters
    1. Start date, End Date (for timeline), via a standard date picker. This defines the bounds of the x-axis
    1. Metric: Which field to use as the metric ("Story Points" is default, but user can type in the name of other fields)
    1. Statuses
        1. User clicks on a "Statuses" button
        1. The user is shown a list of Statuses that are possible for the issues pulled from Jira
        1. The user can drag and order the statuses
        1. The order of statuses is reflected in the stacking order on the bar chart. 
    1. After any of these parameters is updated, the plot updates



