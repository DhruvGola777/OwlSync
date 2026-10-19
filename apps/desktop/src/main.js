const { app, BrowserWindow, ipcMain, dialog, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow = null;
const isDev = !app.isPackaged;

async function scanDirectory(dirPath, rootPath = dirPath) {
  const ignored = new Set(['.git', 'node_modules', '.turbo', '.next', 'dist', 'build', '.DS_Store']);
  const results = [];

  try {
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      if (ignored.has(entry.name)) continue;

      const fullPath = path.join(dirPath, entry.name);
      const relativePath = '/' + path.relative(rootPath, fullPath).replace(/\\/g, '/');

      if (entry.isDirectory()) {
        results.push({
          id: `local-dir-${relativePath}`,
          name: entry.name,
          path: relativePath,
          type: 'folder',
          fullPath
        });
        const subResults = await scanDirectory(fullPath, rootPath);
        results.push(...subResults);
      } else {
        results.push({
          id: `local-file-${relativePath}`,
          name: entry.name,
          path: relativePath,
          type: 'file',
          fullPath
        });
      }
    }
  } catch (err) {
    console.error('Error scanning directory:', err);
  }

  return results;
}

ipcMain.handle('shell:openExternal', async (_event, url) => {
  return await shell.openExternal(url);
});

const http = require('http');

let loopbackServer = null;

ipcMain.handle('auth:startOAuth', async (_event, provider) => {
  return new Promise((resolve) => {
    if (loopbackServer) {
      try { loopbackServer.close(); } catch (e) {}
      loopbackServer = null;
    }

    const authUrl = `https://owlsync-api.onrender.com/api/auth/oauth/${provider}`;
    let isHandled = false;

    // Timeout after 2.5 minutes if the user doesn't complete browser login
    const timeoutTimer = setTimeout(() => {
      if (!isHandled) {
        isHandled = true;
        if (loopbackServer) {
          try { loopbackServer.close(); } catch (e) {}
          loopbackServer = null;
        }
        resolve({ success: false, timeout: true });
      }
    }, 150000);

    loopbackServer = http.createServer((req, res) => {
      // Support Chrome Private Network Access (PNA) preflight
      if (req.method === 'OPTIONS') {
        res.writeHead(204, {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': '*',
          'Access-Control-Allow-Private-Network': 'true',
          'Access-Control-Max-Age': '86400'
        });
        res.end();
        return;
      }

      try {
        const reqUrl = new URL(req.url, 'http://127.0.0.1:48123');
        if (reqUrl.pathname === '/callback' || reqUrl.pathname === '/token') {
          const token = reqUrl.searchParams.get('token');
          const refreshToken = reqUrl.searchParams.get('refreshToken');

          res.writeHead(200, {
            'Content-Type': 'text/html; charset=utf-8',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Private-Network': 'true'
          });
          res.end(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>OwlSync - Signed In</title><style>body{margin:0;display:flex;align-items:center;justify-content:center;height:100vh;background:#0f172a;color:#f8fafc;font-family:system-ui,-apple-system,sans-serif}.card{text-align:center;background:#1e293b;padding:40px;border-radius:16px;box-shadow:0 10px 25px rgba(0,0,0,0.5)}h1{margin:0 0 12px;font-size:24px;color:#38bdf8}p{margin:0;color:#94a3b8;font-size:15px}</style></head><body><div class="card"><h1>Authentication Successful!</h1><p>You can close this tab and return to OwlSync Desktop.</p></div></body></html>`);

          if (!isHandled && token) {
            isHandled = true;
            clearTimeout(timeoutTimer);

            setTimeout(() => {
              if (loopbackServer) {
                try { loopbackServer.close(); } catch (e) {}
                loopbackServer = null;
              }
            }, 1000);

            if (mainWindow) {
              if (mainWindow.isMinimized()) mainWindow.restore();
              mainWindow.focus();
            }

            resolve({ success: true, token, refreshToken });
          }
          return;
        }
      } catch (err) {
        console.error('Loopback request error:', err);
      }

      res.writeHead(404);
      res.end('Not found');
    });

    loopbackServer.listen(48123, '127.0.0.1', () => {
      shell.openExternal(authUrl);
    });

    loopbackServer.on('error', (err) => {
      console.error('Loopback server error:', err);
      shell.openExternal(authUrl);
    });
  });
});

function createWindow() {
  const iconPath = path.join(__dirname, '../resources/icon.png');

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'OwlSync - Collaborative Cloud IDE',
    icon: iconPath,
    backgroundColor: '#1e1e1e',
    frame: true, // Native Windows titlebar with minimize, maximize, and close buttons
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  // Remove default menu bar for clean modern appearance
  Menu.setApplicationMenu(null);

  // Send maximize change events
  mainWindow.on('maximize', () => {
    mainWindow?.webContents.send('window:maximizedChange', true);
  });

  mainWindow.on('unmaximize', () => {
    mainWindow?.webContents.send('window:maximizedChange', false);
  });

  // Allow F12 or Ctrl+Shift+I to open DevTools for troubleshooting
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12' || (input.control && input.shift && input.key.toLowerCase() === 'i')) {
      mainWindow.webContents.toggleDevTools();
      event.preventDefault();
    }
  });

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error('Failed to load:', errorCode, errorDescription, validatedURL);
  });

  const packagedPath = path.join(__dirname, '../web-dist/index.html');
  const localPath = path.join(__dirname, '../../web/dist/index.html');
  const indexPath = fs.existsSync(packagedPath) ? packagedPath : localPath;

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else if (!app.isPackaged && process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:3000').catch(() => {
      mainWindow.loadFile(indexPath);
    });
  } else {
    mainWindow.loadFile(indexPath);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Window control IPC handlers
ipcMain.handle('window:minimize', () => {
  mainWindow?.minimize();
});

ipcMain.handle('window:maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
    return false;
  } else {
    mainWindow?.maximize();
    return true;
  }
});

ipcMain.handle('window:close', () => {
  mainWindow?.close();
});

ipcMain.handle('window:isMaximized', () => {
  return mainWindow?.isMaximized() || false;
});

// File System IPC handlers
ipcMain.handle('fs:openFolder', async () => {
  if (!mainWindow) return null;

  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Open Project Folder in OwlSync'
  });

  if (canceled || filePaths.length === 0) {
    return null;
  }

  const selectedPath = filePaths[0];
  const folderName = path.basename(selectedPath);
  const files = await scanDirectory(selectedPath);

  return {
    folderPath: selectedPath,
    folderName,
    files
  };
});

ipcMain.handle('fs:readFile', async (_event, filePath) => {
  try {
    return await fs.promises.readFile(filePath, 'utf-8');
  } catch (err) {
    console.error('Error reading file:', err);
    throw err;
  }
});

ipcMain.handle('fs:writeFile', async (_event, filePath, content) => {
  try {
    await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
    await fs.promises.writeFile(filePath, content, 'utf-8');
    return { success: true };
  } catch (err) {
    console.error('Error writing file:', err);
    throw err;
  }
});

ipcMain.handle('fs:createFile', async (_event, filePath, content = '') => {
  try {
    await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
    await fs.promises.writeFile(filePath, content, 'utf-8');
    return { success: true };
  } catch (err) {
    console.error('Error creating file:', err);
    throw err;
  }
});

ipcMain.handle('fs:createFolder', async (_event, folderPath) => {
  try {
    await fs.promises.mkdir(folderPath, { recursive: true });
    return { success: true };
  } catch (err) {
    console.error('Error creating folder:', err);
    throw err;
  }
});

ipcMain.handle('fs:deleteItem', async (_event, itemPath) => {
  try {
    await fs.promises.rm(itemPath, { recursive: true, force: true });
    return { success: true };
  } catch (err) {
    console.error('Error deleting item:', err);
    throw err;
  }
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
