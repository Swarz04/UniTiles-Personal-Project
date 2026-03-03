const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    getTiles: () => ipcRenderer.invoke('tiles:get'),
    saveTiles: (tiles) => ipcRenderer.invoke('tiles:save', tiles),
    runTile: (tile) => ipcRenderer.invoke('tile:run', tile), // Existing API
    getHomeDir: () => ipcRenderer.invoke('app:getHomeDir'), // New API to get user's home directory
    getOneDriveDir: () => ipcRenderer.invoke('app:getOneDriveDir'), // New API for OneDrive
    saveNote: (date, content) => ipcRenderer.invoke('note:save', { date, content }),
    getNote: (date) => ipcRenderer.invoke('note:get', date),
    openNotesFolder: () => ipcRenderer.invoke('notes:openFolder'),
});
