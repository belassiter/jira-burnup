import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import axios from 'axios'

// --- Jira API Handling ---

interface JiraSecrets {
  host: string;
  email?: string;
  apiToken: string;
  confluenceUrl?: string;
  confluencePersonalAccessToken?: string;
}

interface ConfluenceConfig {
  confluenceUrl: string;
  personalAccessToken: string;
  pageUrl: string;
  attachmentFilename: string;
}

interface PublishConfluencePayload {
  config: ConfluenceConfig;
  imageDataUrl: string;
  graphTitle?: string;
  jql?: string;
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

function getPrimarySecretsPath(): string {
  return path.join(app.getPath('userData'), 'jira-secrets.json');
}

function getOptionalSecrets(): Partial<JiraSecrets> | null {
  try {
    return getSecrets();
  } catch {
    return null;
  }
}

function parseConfluencePageId(pageUrl: string): string | null {
  const pageIdParamMatch = pageUrl.match(/[?&]pageId=(\d+)/i);
  if (pageIdParamMatch) return pageIdParamMatch[1];

  const pagesPathMatch = pageUrl.match(/\/pages\/(\d+)(?:[/?#]|$)/i);
  if (pagesPathMatch) return pagesPathMatch[1];

  const displayPathMatch = pageUrl.match(/\/display\/[^/]+\/(\d+)(?:[/?#]|$)/i);
  if (displayPathMatch) return displayPathMatch[1];

  return null;
}

function getConfluenceBaseUrl(confluenceUrl: string): string {
  return confluenceUrl.trim().replace(/\/$/, '');
}

function getConfluenceAttachmentFilename(filename: string | undefined): string {
  const trimmed = (filename || '').trim();
  return trimmed || 'jira-burnup-latest.png';
}

function toPacificTimestamp(): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(new Date());
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function confluenceApiRequest(url: string, init: RequestInit): Promise<Response> {
  const response = await fetch(url, init);
  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Confluence API error (${response.status}): ${errorBody || response.statusText}`);
  }
  return response;
}

async function uploadOrReplaceAttachment(
  baseUrl: string,
  pageId: string,
  token: string,
  attachmentFilename: string,
  imageBytes: Buffer,
  comment: string
): Promise<void> {
  const authHeaders = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json'
  };

  const findExistingUrl = `${baseUrl}/rest/api/content/${pageId}/child/attachment?filename=${encodeURIComponent(attachmentFilename)}&expand=version`;
  const existingResp = await confluenceApiRequest(findExistingUrl, {
    method: 'GET',
    headers: authHeaders
  });
  const existingData = await existingResp.json() as { results?: Array<{ id: string }> };
  const existingAttachmentId = existingData.results?.[0]?.id;

  const form = new FormData();
  form.append('file', new Blob([imageBytes], { type: 'image/png' }), attachmentFilename);
  form.append('comment', comment);

  const uploadUrl = existingAttachmentId
    ? `${baseUrl}/rest/api/content/${pageId}/child/attachment/${existingAttachmentId}/data`
    : `${baseUrl}/rest/api/content/${pageId}/child/attachment`;

  await confluenceApiRequest(uploadUrl, {
    method: 'POST',
    headers: {
      ...authHeaders,
      'X-Atlassian-Token': 'no-check'
    },
    body: form
  });
}

async function updateConfluencePageBodyWithImage(
  baseUrl: string,
  pageId: string,
  token: string,
  attachmentFilename: string,
  graphTitle: string | undefined,
  publishedAtPacific: string,
  jql?: string,
  jiraHost?: string
): Promise<void> {
  const authHeaders = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
    'Content-Type': 'application/json'
  };

  const contentResp = await confluenceApiRequest(`${baseUrl}/rest/api/content/${pageId}?expand=body.storage,version,title`, {
    method: 'GET',
    headers: authHeaders
  });

  const content = await contentResp.json() as {
    id: string;
    title: string;
    version: { number: number };
    body?: { storage?: { value?: string } };
  };

  const existingStorage = content.body?.storage?.value || '';
  const escapedAttachmentFilename = escapeHtml(attachmentFilename);
  const escapedGraphTitle = escapeHtml(graphTitle || 'Burnup Chart');
  
  let titleBlock = `<h2>${escapedGraphTitle}</h2>`;
  if (jql && jiraHost) {
      const cleanHost = jiraHost.replace(/^https?:\/\//, '').replace(/\/$/, '');
      const jiraSearchUrl = `https://${cleanHost}/issues/?jql=${encodeURIComponent(jql)}`;
      titleBlock = `<h2><a href="${escapeHtml(jiraSearchUrl)}">${escapedGraphTitle}</a></h2>`;
  }

  const block = [
    titleBlock,
    `<p><strong>Last published:</strong> ${escapeHtml(publishedAtPacific)} PT</p>`,
    `<p><ac:image ac:alt="${escapedAttachmentFilename}"><ri:attachment ri:filename="${escapedAttachmentFilename}" /></ac:image></p>`
  ].join('');

  let updatedStorage = existingStorage;
  // Fallback: Remove old HTML comments if they exist from legacy renders
  updatedStorage = updatedStorage.replace(/<!-- jira-burnup:(?:start|end) -->/g, '');

  const regexSafeFilename = escapedAttachmentFilename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const attachmentPattern = `<ri:attachment[^>]*ri:filename="${regexSafeFilename}"[^>]*?(?:/>|></ri:attachment>)`;
  const imagePattern = `<ac:image[^>]*>\\s*${attachmentPattern}\\s*</ac:image>`;
  const pWrappedImagePattern = `(?:<p[^>]*>\\s*)?${imagePattern}(?:\\s*</p>)?`;
  const timestampPattern = `(?:<p[^>]*>\\s*<strong>Last published:</strong>(?:(?!</p>).)*?</p>\\s*)?`;
  const headingPattern = `(?:<h[1-6][^>]*>(?:(?!</h[1-6]>).)*?</h[1-6]>\\s*)?`;

  const dynamicReplacementRegex = new RegExp(
    headingPattern + timestampPattern + pWrappedImagePattern,
    'g'
  );

  if (dynamicReplacementRegex.test(updatedStorage)) {
    updatedStorage = updatedStorage.replace(dynamicReplacementRegex, block);
  } else {
    updatedStorage = `${updatedStorage}${updatedStorage ? '<p></p>' : ''}${block}`;
  }

  const payload = {
    id: content.id,
    type: 'page',
    title: content.title,
    version: {
      number: (content.version?.number || 1) + 1
    },
    body: {
      storage: {
        value: updatedStorage,
        representation: 'storage'
      }
    }
  };

  await confluenceApiRequest(`${baseUrl}/rest/api/content/${pageId}`, {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify(payload)
  });
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
    const userDataPath = getPrimarySecretsPath();
    const existing = getOptionalSecrets() || {};
    // Basic validation
    if (!secrets.host || !secrets.apiToken) {
       return { success: false, error: "Host and API Token are required" };
    }
    fs.writeFileSync(userDataPath, JSON.stringify({
      ...existing,
      host: secrets.host,
      email: secrets.email,
      apiToken: secrets.apiToken
    }));
    
    return { success: true };
  } catch (e: any) {
    console.error(e);
    return { success: false, error: e.message || 'Failed to save credentials' };
  }
});

ipcMain.handle('get-confluence-config', async () => {
  try {
    const existing = getOptionalSecrets();
    return {
      confluenceUrl: existing?.confluenceUrl || '',
      personalAccessToken: existing?.confluencePersonalAccessToken || ''
    };
  } catch (e: any) {
    console.error(e);
    return null;
  }
});

ipcMain.handle('save-confluence-config', async (_event, config: ConfluenceConfig) => {
  try {
    const userDataPath = getPrimarySecretsPath();
    const existing = getOptionalSecrets() || {};
    fs.writeFileSync(userDataPath, JSON.stringify({
      ...existing,
      confluenceUrl: config.confluenceUrl || '',
      confluencePersonalAccessToken: config.personalAccessToken || ''
    }));
    return { success: true };
  } catch (e: any) {
    console.error(e);
    return { success: false, error: e.message || 'Failed to save Confluence config' };
  }
});

ipcMain.handle('publish-confluence', async (_event, payload: PublishConfluencePayload) => {
  try {
    const config = payload.config;
    if (!config?.confluenceUrl || !config?.personalAccessToken || !config?.pageUrl || !payload?.imageDataUrl) {
      return { success: false, error: 'Missing Confluence settings or image data' };
    }

    const baseUrl = getConfluenceBaseUrl(config.confluenceUrl);
    const pageId = parseConfluencePageId(config.pageUrl);
    if (!pageId) {
      return { success: false, error: 'Could not parse page ID from Confluence page URL' };
    }

    const attachmentFilename = getConfluenceAttachmentFilename(config.attachmentFilename);
    const base64 = payload.imageDataUrl.replace(/^data:image\/png;base64,/, '');
    const imageBytes = Buffer.from(base64, 'base64');
    const publishedAtPacific = toPacificTimestamp();
    const comment = `Published by Jira Burnup Chart at ${publishedAtPacific} PT`;
    
    let jiraHost = '';
    try {
        const secrets = getSecrets();
        jiraHost = secrets.host;
    } catch {
        // ignore if we can't get secrets
    }

    await uploadOrReplaceAttachment(
      baseUrl,
      pageId,
      config.personalAccessToken,
      attachmentFilename,
      imageBytes,
      comment
    );

    await updateConfluencePageBodyWithImage(
      baseUrl,
      pageId,
      config.personalAccessToken,
      attachmentFilename,
      payload.graphTitle,
      publishedAtPacific,
      payload.jql,
      jiraHost
    );

    return { success: true, publishedAt: `${publishedAtPacific} PT` };
  } catch (e: any) {
    console.error(e);
    return { success: false, error: e.message || 'Failed to publish to Confluence' };
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


// File System and Dialog Handlers for Bulk Publish
ipcMain.handle('show-open-dialog', async (event, options) => {
  const browserWindow = BrowserWindow.fromWebContents(event.sender);
  if (!browserWindow) return { canceled: true };
  return dialog.showOpenDialog(browserWindow, options);
});

ipcMain.handle('show-save-dialog', async (event, options) => {
  const browserWindow = BrowserWindow.fromWebContents(event.sender);
  if (!browserWindow) return { canceled: true };
  return dialog.showSaveDialog(browserWindow, options);
});

ipcMain.handle('read-file-content', async (_event, filePath: string) => {
  return fs.readFileSync(filePath, 'utf-8');
});

ipcMain.handle('write-file-content', async (_event, filePath: string, content: string) => {
  fs.writeFileSync(filePath, content, 'utf-8');
  return true;
});

// --- Electron Boilerplate ---

process.env.DIST = path.join(__dirname, '../dist')
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : path.join(process.env.DIST, '../public')


let win: BrowserWindow | null
// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 900,
    icon: path.join(process.env.VITE_PUBLIC as string, 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      backgroundThrottling: false,
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
    win.loadFile(path.join(process.env.DIST as string, 'index.html'))
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
