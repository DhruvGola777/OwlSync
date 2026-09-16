const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow = null;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

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
    frame: false, // Frameless for VS Code custom titlebar styling
    titleBarStyle: 'hidden',
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

  if (isDev) {
    const devUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:3000';
    mainWindow.loadURL(devUrl).catch(() => {
      // Fallback if dev server is starting up
      setTimeout(() => mainWindow?.loadURL(devUrl), 2000);
    });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../web/dist/index.html'));
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
