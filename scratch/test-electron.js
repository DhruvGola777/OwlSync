const { app, BrowserWindow } = require('electron');
const path = require('path');

app.whenReady().then(() => {
  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      preload: path.resolve(__dirname, '../apps/desktop/src/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    }
  });

  win.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log('[RENDERER CONSOLE]', level, message, 'at line', line);
  });

  win.webContents.on('did-fail-load', (e, code, desc, url) => {
    console.log('[DID FAIL LOAD]', code, desc, url);
  });

  win.loadFile(path.resolve(__dirname, '../apps/web/dist/index.html'));

  setTimeout(() => {
    console.log('[TEST FINISHED]');
    app.quit();
    process.exit(0);
  }, 4000);
});
