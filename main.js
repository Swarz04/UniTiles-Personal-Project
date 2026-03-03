/**
 * UniTiles - Main Process
 * Author: A. Scharmüller
 */
const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const os = require('os'); // Import the 'os' module

let mainWindow;
let userDataPath;
let tilesFilePath;
let defaultTilesPath;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 800,
        minHeight: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

    // Open the DevTools.
    // mainWindow.webContents.openDevTools();
}

app.whenReady().then(() => {
    userDataPath = app.getPath('userData');
    tilesFilePath = path.join(userDataPath, 'tiles.json');
    defaultTilesPath = path.join(__dirname, 'data', 'tiles.json');

    createWindow();

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
});

// IPC Handlers

// New IPC handler to get the user's home directory
ipcMain.handle('app:getHomeDir', () => {
    return os.homedir();
});

ipcMain.handle('app:getOneDriveDir', () => {
    // Cerca la variabile d'ambiente OneDrive, altrimenti prova il percorso standard
    return process.env.OneDrive || path.join(os.homedir(), 'OneDrive');
});

ipcMain.handle('note:save', async (event, { date, content }) => {
    try {
        const notesDir = path.join(userDataPath, 'notes');
        if (!fs.existsSync(notesDir)) {
            fs.mkdirSync(notesDir);
        }

        // Create directory for the specific date
        const dateDir = path.join(notesDir, date);
        if (!fs.existsSync(dateDir)) {
            fs.mkdirSync(dateDir);
        }

        const metadataPath = path.join(dateDir, 'metadata.json');
        let metadata = { nextVersion: 1 };
        if (fs.existsSync(metadataPath)) {
            try {
                metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
            } catch (e) {
                // Corrupted metadata, start fresh
                metadata = { nextVersion: 1 };
            }
        }

        const versionToSave = metadata.nextVersion;
        const filePath = path.join(dateDir, `${versionToSave}.txt`);
        fs.writeFileSync(filePath, content, 'utf8');

        // Update next version, cycling 1 -> 2 -> 3 -> 1
        metadata.nextVersion = (versionToSave % 3) + 1;
        fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf8');

        return { success: true };
    } catch (error) {
        console.error('Error saving note version:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('note:get', async (event, date) => {
    try {
        const notesDir = path.join(userDataPath, 'notes');
        const dateDir = path.join(notesDir, date);

        if (!fs.existsSync(dateDir)) {
            return { success: true, content: '' };
        }

        const noteVersions = fs.readdirSync(dateDir)
            .filter(file => file.endsWith('.txt'))
            .map(file => ({
                name: file,
                time: fs.statSync(path.join(dateDir, file)).mtime.getTime()
            }))
            .sort((a, b) => b.time - a.time); // Sort by modification time, descending

        if (noteVersions.length === 0) {
            return { success: true, content: '' };
        }

        // The latest version is the first one in the sorted array
        const latestVersionPath = path.join(dateDir, noteVersions[0].name);
        const content = fs.readFileSync(latestVersionPath, 'utf8');
        return { success: true, content };
    } catch (error) {
        console.error('Error getting note version:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('notes:openFolder', async () => {
    const notesDir = path.join(userDataPath, 'notes');
    if (!fs.existsSync(notesDir)) {
        fs.mkdirSync(notesDir);
    }
    await shell.openPath(notesDir);
});

ipcMain.handle('tiles:get', async () => {
    try {
        const homeDir = os.homedir();
        const oneDriveDir = process.env.OneDrive || path.join(homeDir, 'OneDrive');
        const placeholder = 'C:\\Users\\TUO_UTENTE'; // Define the placeholder
        const oneDrivePlaceholder = '%ONEDRIVE%';

        if (!fs.existsSync(tilesFilePath)) {
            // If user's tiles.json doesn't exist, copy the default one and replace placeholder
            const defaultData = fs.readFileSync(defaultTilesPath, 'utf8');
            let processedData = defaultData.replace(new RegExp(placeholder.replace(/\\/g, '\\\\'), 'g'), homeDir.replace(/\\/g, '\\\\'));
            processedData = processedData.replace(new RegExp(oneDrivePlaceholder, 'g'), oneDriveDir.replace(/\\/g, '\\\\'));
            fs.writeFileSync(tilesFilePath, processedData, 'utf8');
        }
        console.log('[tiles:get] Reading from:', tilesFilePath);
        const data = fs.readFileSync(tilesFilePath, 'utf8');
        // Also replace placeholder in case it was manually added or not processed on first copy
        // This ensures dynamic paths are always resolved on load
        let processedLoadedData = data.replace(new RegExp(placeholder.replace(/\\/g, '\\\\'), 'g'), homeDir.replace(/\\/g, '\\\\'));
        processedLoadedData = processedLoadedData.replace(new RegExp(oneDrivePlaceholder, 'g'), oneDriveDir.replace(/\\/g, '\\\\'));
        console.log('[tiles:get] Processed data before JSON.parse:', processedLoadedData);
        return JSON.parse(processedLoadedData);
    } catch (error) {
        console.error('Failed to read or create tiles.json:', error);
        // Return an empty array if there's any issue
        return [];
    }
});

ipcMain.handle('tiles:save', async (event, tiles) => {
    try {
        fs.writeFileSync(tilesFilePath, JSON.stringify(tiles, null, 2), 'utf8');
        return { success: true };
    } catch (error) {
        console.error('Failed to save tiles.json:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('tile:run', async (event, tile) => {
    // Helper function to resolve path placeholders before execution
    const resolvePath = (p) => {
        if (!p) return p;
        const homeDir = os.homedir();
        const oneDriveDir = process.env.OneDrive || path.join(homeDir, 'OneDrive');
        const userPlaceholder = 'C:\\Users\\TUO_UTENTE';
        const oneDrivePlaceholder = '%ONEDRIVE%';

        let resolved = p.replace(oneDrivePlaceholder, oneDriveDir);
        resolved = resolved.replace(userPlaceholder, homeDir);
        return resolved;
    };

    try {
        console.log('[tile:run] Received tile object:', JSON.stringify(tile, null, 2)); // Log the full incoming tile object
        switch (tile.type) {
            case 'url':
                await shell.openExternal(tile.url);
                break;
            case 'exe': {
                const exePath = resolvePath(tile.path);
                if (exePath.toLowerCase().endsWith('.lnk')) {
                    console.log(`[tile:run] Attempting to open shortcut: ${exePath}`);
                    // Use shell.openPath for shortcut files (.lnk)
                    await shell.openPath(exePath);
                } else {
                    // For actual executables, use spawn with arguments
                    const exeArgs = tile.args ? tile.args.split(' ') : [];
                    const exeChild = spawn(exePath, exeArgs, {
                        detached: true,
                        stdio: 'ignore',
                    });
                    console.log(`[tile:run] Attempting to spawn executable: ${exePath} with args: ${exeArgs.join(' ')}`);
                    exeChild.unref(); // Allow the parent process to exit independently
                    exeChild.on('error', (err) => {
                        console.error(`Error spawning executable "${exePath}":`, err);
                    });
                }
                break;
            }
            case 'command': {
                const cmd = tile.cmd;
                const cmdArgs = tile.args ? tile.args.split(' ') : [];
                const cwd = resolvePath(tile.cwd) || process.cwd(); // Use current working directory if not specified

                console.log(`[tile:run] Attempting to execute command: "${cmd} ${cmdArgs.join(' ')}" in directory: "${cwd}"`);
                // On Windows, spawn with shell: true is often needed for commands like 'jupyter lab'
                // and to correctly resolve command paths.
                // To avoid DEP0190 DeprecationWarning and ensure correct command parsing by the shell,
                // pass the full command string as the first argument and an empty array for args.
                const fullCommand = `${cmd} ${cmdArgs.join(' ')}`.trim();
                const commandChild = spawn(fullCommand, [], {
                    cwd: cwd,
                    shell: true,
                    detached: true,
                    stdio: 'ignore',
                });
                commandChild.unref(); // Allow the parent process to exit independently
                commandChild.on('error', (err) => {
                    console.error(`Error executing command "${fullCommand}" in directory "${cwd}":`, err);
                    if (err.code === 'ENOENT') {
                        console.error(`Possible cause: Command "${cmd}" not found in system PATH or incorrect path/permissions.`);
                    }
                });
                break;
            }
            case 'file': // New type: Local File
                await shell.openPath(resolvePath(tile.path));
                break;
            default:
                throw new Error(`Tipo di tile non supportato: ${tile.type}`);
        }
        return { success: true };
    } catch (error) {
        console.error(`Errore nell'esecuzione del tile ${tile.title}:`, error);
        return { success: false, error: error.message };
    }
});

// Ensure the data directory exists and default tiles.json is present
app.on('ready', () => {
    const dataDir = path.join(__dirname, 'data');
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir);
    }
    // Create an empty tiles.json if it doesn't exist in the data folder
    // This is the default one that will be copied to userData if needed
    const defaultTilesFile = path.join(__dirname, 'data', 'tiles.json');
    if (!fs.existsSync(defaultTilesFile)) {
        fs.writeFileSync(defaultTilesFile, '[]', 'utf8');
    }
});

// Handle potential errors during spawn
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    // Optionally, log to a file or show a dialog
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // Optionally, log to a file or show a dialog
});
