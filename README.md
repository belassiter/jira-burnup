# Jira Burnup Chart

## Overview
A simple app to visualize burnup charts for Jira. The user specifies a JQL query, and the data is pulled via the API. It then shows a burnup chart for those issues, based on the status at 9am. It can also forecast future velocity based on the recent velocity and a monte carlo simulation.

### Instructions: Packaged version (no dependencies)
Want to use this app without having a dev environment setup? Follow this simple steps
1. Download the [latest Windows executable zip file](https://tandemdiabetesinc.sharepoint.com/sites/ProductExecution/Shared%20Documents/Forms/AllItems.aspx?id=%2Fsites%2FProductExecution%2FShared%20Documents%2FScrum%20Master%20Materials%2FJira%20Tools%20%28Brian%27s%29&viewid=ec65a3f6%2D7489%2D4b1f%2Da5b7%2Df34e18716418&FolderCTID=0x012000F1A81495343D1F4B9B577C29B54FAFB5), unzip it to a folder
1. Run JiraBurnupChart.exe
1. If this is your first time, it will ask for you to input credentials
1. Have at it!

## User Instructions: Development version

### Prerequisites
- Node.js (v18 or higher recommended)
- Access to a Jira instance

### Installation
1.  Clone the repository.
2.  Install dependencies:
    ```bash
    npm install
    ```

### Running the Application
To start the application in development mode:
```bash
npm run dev
```

## Developer Information

### Tech Stack
-   **Frontend**: React, TypeScript, Mantine (UI Library), Recharts (Charting)
-   **Backend**: Electron (Main process)
-   **Build Tool**: Vite

### Build Scripts
-   `npm run dev`: Starts the development server.
-   `npm run build`: Compiles the TypeScript and Vite build.
-   `npm run lint`: Runs ESLint checks.
-   `npm test`: Runs Vitest unit tests.
-   `npm run verify`: Runs lint, test, and build in sequence to ensure code quality.

### Building for Windows (Limited Permissions)
If you do not have Administrator privileges on your Windows machine, use the following command. It creates a portable folder containing the `.exe` (instead of an installer) in the `release-simple/` directory.

```bash
npm run pack:simple
```

**Standard Build (Requires Admin)**
If you have admin rights and want to build a proper installer:
```bash
npm run package
```
