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

ipcMain.handle('auth:startOAuth', async (_event, provider) => {
  return new Promise((resolve) => {
    const authUrl = `https://owlsync-api.onrender.com/api/auth/oauth/${provider}`;
    const authWindow = new BrowserWindow({
      width: 520,
      height: 680,
      parent: mainWindow || undefined,
      modal: true,
      title: `Sign in with ${provider.charAt(0).toUpperCase() + provider.slice(1)} - OwlSync`,
      autoHideMenuBar: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    authWindow.setMenu(null);

    // Use standard Chrome browser User-Agent so Google OAuth does not block embedded Electron agent
    const chromeUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
    authWindow.webContents.setUserAgent(chromeUA);

    let isHandled = false;

    const checkUrl = (targetUrl) => {
      try {
        if (!targetUrl || isHandled) return;
        const parsed = new URL(targetUrl);
        if (parsed.searchParams.has('token')) {
          isHandled = true;
          const token = parsed.searchParams.get('token');
          const refreshToken = parsed.searchParams.get('refreshToken');
          setTimeout(() => {
            if (!authWindow.isDestroyed()) authWindow.destroy();
          }, 300);
          resolve({ success: true, token, refreshToken });
        } else if (parsed.searchParams.has('error')) {
          isHandled = true;
          const error = parsed.searchParams.get('error');
          setTimeout(() => {
            if (!authWindow.isDestroyed()) authWindow.destroy();
          }, 300);
          resolve({ success: false, error });
        }
      } catch (e) {
        // Ignore parsing errors for interim non-standard URLs
      }
    };

    authWindow.webContents.on('will-redirect', (_e, url) => checkUrl(url));
    authWindow.webContents.on('will-navigate', (_e, url) => checkUrl(url));
    authWindow.webContents.on('did-navigate', (_e, url) => checkUrl(url));

    authWindow.on('closed', () => {
      if (!isHandled) {
        resolve({ success: false, cancelled: true });
      }
    });

    authWindow.loadURL(authUrl);
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
