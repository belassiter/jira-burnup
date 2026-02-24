import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import axios from 'axios'

// --- Jira API Handling ---

interface JiraSecrets {
  host: string;
  email?: string;
  apiToken: string;
}

function getSecrets(): JiraSecrets {
  const userDataPath = path.join(app.getPath('userData'), 'jira-secrets.json');
  // Fallback 1: Relative to __dirname (useful for some builds)
  const localSecretsPath = path.join(__dirname, '../../jira-secrets.json');
  // Fallback 2: Relative to CWD (useful for dev: npm run dev)
  const cwdSecretsPath = path.join(process.cwd(), 'jira-secrets.json');
      
  if (fs.existsSync(userDataPath)) {
    return JSON.parse(fs.readFileSync(userDataPath, 'utf-8'));
  }
  if (fs.existsSync(cwdSecretsPath)) {
    return JSON.parse(fs.readFileSync(cwdSecretsPath, 'utf-8'));
  }
  if (fs.existsSync(localSecretsPath)) {
    return JSON.parse(fs.readFileSync(localSecretsPath, 'utf-8'));
  }

  throw new Error(`Secrets file not found. Checked: \n1. ${userDataPath}\n2. ${cwdSecretsPath}`);
}


async function searchJiraIssues(jql: string, secrets: JiraSecrets) {
    const authHeader = secrets.email 
      ? `Basic ${Buffer.from(`${secrets.email}:${secrets.apiToken}`).toString('base64')}`
      : `Bearer ${secrets.apiToken}`;
    const host = secrets.host.replace(/^https?:\/\//, '');
  
    // We need to fetch enough fields to reconstruct the hierarchy
    // history is in 'changelog'
    console.log(`JIRA-SEARCH: ${jql}`);

    const response = await axios.get(`https://${host}/rest/api/2/search`, {
      params: { 
        jql, 
        expand: 'changelog',
        maxResults: 1000, 
        fields: ['summary', 'status', 'issuetype', 'parent', 'created', '*all'] // *all to ensure we get custom fields
      },
      headers: {
        'Authorization': authHeader,
        'Accept': 'application/json'
      }
    });

    // TODO: Handle pagination if total > maxResults
    return response.data.issues;
}

// Check if we have valid credentials saved
ipcMain.handle('has-credentials', async () => {
  try {
    getSecrets();
    return true;
  } catch {
    return false;
  }
});

// Save credentials to userData/jira-secrets.json
ipcMain.handle('save-credentials', async (_event, secrets: JiraSecrets) => {
  try {
    const userDataPath = path.join(app.getPath('userData'), 'jira-secrets.json');
    fs.writeFileSync(userDataPath, JSON.stringify(secrets));
    return true;
  } catch (e) {
    console.error(e);
    return false;
  }
});

// Get Issues
ipcMain.handle('get-issues', async (_event, jql: string) => {
    try {
        const secrets = getSecrets();
        const issues = await searchJiraIssues(jql, secrets);
        return issues;
    } catch (e: any) {
        console.error(e);
        throw new Error(`Failed to fetch issues: ${e.message}`);
    }
});


// --- Electron Boilerplate ---

process.env.DIST = path.join(__dirname, '../dist')
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : path.join(process.env.DIST, '../public')


let win: BrowserWindow | null
// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']

function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  })

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    // win.loadFile('dist/index.html')
    win.loadFile(path.join(process.env.DIST, 'index.html'))
  }
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(createWindow)
