const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isDesktop: true,
  platform: process.platform,

  // Window Controls
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  maximizeWindow: () => ipcRenderer.invoke('window:maximize'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
  isWindowMaximized: () => ipcRenderer.invoke('window:isMaximized'),

  // Native Local File System Access
  openLocalFolder: () => ipcRenderer.invoke('fs:openFolder'),
  readLocalDirectory: (dirPath) => ipcRenderer.invoke('fs:readDirectory', dirPath),
  readLocalFile: (filePath) => ipcRenderer.invoke('fs:readFile', filePath),
  writeLocalFile: (filePath, content) => ipcRenderer.invoke('fs:writeFile', filePath, content),
  createLocalFile: (filePath, content) => ipcRenderer.invoke('fs:createFile', filePath, content),
  createLocalFolder: (folderPath) => ipcRenderer.invoke('fs:createFolder', folderPath),
  deleteLocalItem: (itemPath) => ipcRenderer.invoke('fs:deleteItem', itemPath),

  // Event Listeners
  onMaximizedChange: (callback) => {
    const handler = (_event, isMaximized) => callback(isMaximized);
    ipcRenderer.on('window:maximizedChange', handler);
    return () => ipcRenderer.removeListener('window:maximizedChange', handler);
  }
});
