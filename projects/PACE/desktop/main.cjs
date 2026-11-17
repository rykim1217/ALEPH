const { app, BrowserWindow, protocol, net, shell, dialog, Menu, screen } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { writeFile, mkdir } = require('node:fs/promises');
const { readFileSync, writeFileSync, mkdirSync } = require('node:fs');
const { assetPath } = require('./paths.cjs');

const persistWrite = process.argv.includes('--pace-session-check-write');
const persistRead = process.argv.includes('--pace-session-check-read');
const smoke = process.argv.includes('--pace-smoke-test') || persistWrite || persistRead;
const smokeDir = path.resolve(__dirname, '../desktop-check');
if (smoke) app.setPath('userData', path.join(smokeDir, 'profile'));
protocol.registerSchemesAsPrivileged([
  { scheme: 'pace', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }
]);
let window;

function openExternal(url) {
  try {
    if (['https:', 'http:'].includes(new URL(url).protocol)) shell.openExternal(url);
  } catch { /* Ignore malformed external links. */ }
}

async function createWindow() {
  const mac = process.platform === 'darwin';
  const area = mac ? screen.getPrimaryDisplay().workAreaSize : null;
  const stateFile = path.join(app.getPath('userData'), 'window-state.json');
  let saved;
  if (!smoke) {
    try {
      const state = JSON.parse(readFileSync(stateFile, 'utf8'));
      if ([state.x, state.y, state.width, state.height].every(Number.isFinite) && state.width > 0 && state.height > 0) saved = state;
    } catch { /* First launch or invalid saved state: use the default size. */ }
  }
  let bounds = {
    width: mac ? Math.min(1920, area.width - 40) : 1920,
    height: mac ? Math.min(1200, area.height - 40) : 1200
  };
  if (saved) {
    const workArea = screen.getDisplayMatching(saved).workArea;
    const width = Math.min(Math.round(saved.width), workArea.width);
    const height = Math.min(Math.round(saved.height), workArea.height);
    bounds = {
      width, height,
      x: Math.max(workArea.x, Math.min(Math.round(saved.x), workArea.x + workArea.width - width)),
      y: Math.max(workArea.y, Math.min(Math.round(saved.y), workArea.y + workArea.height - height))
    };
  }
  window = new BrowserWindow({
    ...bounds,
    title: 'PACE', show: !smoke,
    ...(mac ? {} : {icon:path.join(__dirname,'assets','pace.ico')}),
    backgroundColor: '#F1F0F2', autoHideMenuBar: true,
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true,
      partition: smoke ? 'persist:pace-check' : 'persist:pace' }
  });
  window.webContents.setWindowOpenHandler(({ url }) => { openExternal(url); return { action: 'deny' }; });
  window.webContents.on('will-navigate', (event, url) => {
    const target = new URL(url);
    if (target.protocol !== 'pace:' || target.host !== 'app') { event.preventDefault(); openExternal(url); }
  });
  window.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  const root = path.join(app.getAppPath(), 'dist');
  window.webContents.session.protocol.handle('pace', request => {
    const file = assetPath(root, request.url);
    return file ? net.fetch(pathToFileURL(file).href) : new Response('Not found', { status: 404 });
  });
  if (saved?.maximized) window.maximize();
  if (saved?.fullscreen) window.setFullScreen(true);
  window.on('close', () => {
    if (smoke) return;
    try {
      const state = {
        ...window.getNormalBounds(),
        maximized: window.isMaximized(),
        fullscreen: window.isFullScreen()
      };
      mkdirSync(path.dirname(stateFile), { recursive: true });
      writeFileSync(stateFile, JSON.stringify(state));
    } catch (error) { console.warn('PACE window state could not be saved:', error.message); }
  });
  window.on('closed', () => { window = null; });
  const domReady = new Promise(resolve => window.webContents.once('dom-ready', resolve));
  const loaded = window.loadURL('pace://app/');
  if (smoke) {
    await Promise.race([domReady, new Promise((_, reject) => setTimeout(() => reject(Error('Window did not load within 30 seconds')), 30000))]);
    await new Promise(resolve => setTimeout(resolve, 8000));
    if (persistWrite) await window.webContents.executeJavaScript("localStorage.setItem('pace-desktop-persistence-check','retained')");
    const result = await window.webContents.executeJavaScript(`({
      title: document.title, origin: location.origin,
      main: !!document.querySelector('main'),
      calendar: !!document.querySelector('#calendar')?.children.length,
      nodeExposed: typeof require !== 'undefined',
      persistence: localStorage.getItem('pace-desktop-persistence-check'),
      text: document.body.innerText.slice(-1200)
    })`);
    result.bounds = window.getBounds();
    await mkdir(smokeDir, { recursive: true });
    await writeFile(path.join(smokeDir, 'result.json'), JSON.stringify(result, null, 2));
    await writeFile(path.join(smokeDir, 'window.png'), (await window.webContents.capturePage()).toPNG());
    await window.webContents.session.flushStorageData();
    app.exit(result.main && result.calendar && !result.nodeExposed && (!persistRead || result.persistence === 'retained') ? 0 : 1);
  }
  await loaded;
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => {
    if (window) { if (window.isMinimized()) window.restore(); window.focus(); }
  });
  app.whenReady().then(async () => {
    if(process.platform!=='darwin')Menu.setApplicationMenu(null);
    await createWindow();
  }).catch(async error => {
    if (smoke) { await mkdir(smokeDir, { recursive: true }); await writeFile(path.join(smokeDir, 'error.txt'), error.stack); }
    else dialog.showErrorBox('PACE 실행 오류', error.message);
    app.exit(1);
  });
  app.on('window-all-closed', () => app.quit());
}
