/**
 * UniTiles - Preload Script (v2.0)
 * Author: A. Scharmüller
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    // App
    getPaths: () => ipcRenderer.invoke('app:getPaths'),
    getAppVersion: () => ipcRenderer.invoke('app:getVersion'),

    // Tiles
    getTiles: () => ipcRenderer.invoke('tiles:get'),
    saveTiles: (tiles) => ipcRenderer.invoke('tiles:save', tiles),
    runTile: (tile) => ipcRenderer.invoke('tile:run', tile),
    checkPath: (path) => ipcRenderer.invoke('tile:checkPath', path),
    isDirectory: (path) => ipcRenderer.invoke('tile:isDirectory', path),

    // Notes
    saveNote: (date, content) => ipcRenderer.invoke('note:save', { date, content }),
    getNote: (date) => ipcRenderer.invoke('note:get', date),
    openNotesFolder: () => ipcRenderer.invoke('notes:openFolder'),

    // Window events
    onBeforeUnload: (callback) => ipcRenderer.on('before-unload', callback),
});
