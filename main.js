/**
 * UniTiles - Main Process (v2.1.0)
 * Author: A. Scharmüller
 */
const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const os = require('os');
const https = require('https');
const http = require('http');
const JSZip = require('jszip');

// Disable hardware acceleration to fix GPU cache errors
app.disableHardwareAcceleration();
// Disable caches to prevent permission errors on Windows
app.commandLine.appendSwitch('disable-http-cache');
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');

let mainWindow;
let userDataPath;
let tilesFilePath;
let imagesDirPath;
let notesDirPath;

// --- Path Management ---
const pathPlaceholders = {};

function initializePaths() {
    userDataPath = app.getPath('userData');
    tilesFilePath = path.join(userDataPath, 'tiles.json');

    // Bootstrap: Local -> AppData (Migration) -> Example
    if (!fs.existsSync(tilesFilePath) || fs.statSync(tilesFilePath).size === 0) {
        const examplePath = path.join(__dirname, 'data', 'tiles.example.json');

        if (fs.existsSync(examplePath)) {
            fs.copyFileSync(examplePath, tilesFilePath);
        }
    }

    imagesDirPath = path.join(userDataPath, 'images');
    if (!fs.existsSync(imagesDirPath)) {
        fs.mkdirSync(imagesDirPath, { recursive: true });
    }

    // Notes Path Setup
    notesDirPath = path.join(userDataPath, 'notes');
    if (!fs.existsSync(notesDirPath)) {
        fs.mkdirSync(notesDirPath, { recursive: true });
    }

    // Migrate Notes from Local to AppData
    const localNotesDir = path.join(__dirname, 'data', 'notes');
    if (fs.existsSync(localNotesDir)) {
        try {
            const items = fs.readdirSync(localNotesDir);
            for (const item of items) {
                const srcPath = path.join(localNotesDir, item);
                if (fs.lstatSync(srcPath).isDirectory()) {
                    const destPath = path.join(notesDirPath, item);
                    if (!fs.existsSync(destPath)) {
                        fs.mkdirSync(destPath, { recursive: true });
                        const files = fs.readdirSync(srcPath);
                        for (const file of files) {
                            fs.copyFileSync(path.join(srcPath, file), path.join(destPath, file));
                        }
                    }
                }
            }
        } catch (e) {
            console.error('Notes migration failed:', e);
        }
    }

    pathPlaceholders['%APPDATA%'] = userDataPath;
    pathPlaceholders['%ONEDRIVE%'] = process.env.OneDrive || path.join(os.homedir(), 'OneDrive');
    pathPlaceholders['%USERPROFILE%'] = os.homedir();
}

function compactPath(absPath) {
    if (!absPath) return absPath;
    // Don't touch URLs or data URIs
    if (absPath.startsWith('http') || absPath.startsWith('data:')) return absPath;

    let normalizedPath = absPath;
    // Clean up common shell artifacts (quotes, .\, etc.)
    normalizedPath = normalizedPath.replace(/^"|"$/g, ''); // Remove surrounding quotes
    if (normalizedPath.startsWith('.\\') || normalizedPath.startsWith('./')) {
        normalizedPath = normalizedPath.slice(2); // Remove leading .\ or ./
    }
    normalizedPath = normalizedPath.replace(/^"|"$/g, ''); // Remove quotes again if they were inside .\
    normalizedPath = path.normalize(normalizedPath);

    // Prioritize more specific paths first
    for (const [placeholder, value] of Object.entries(pathPlaceholders).sort(([, a], [, b]) => b.length - a.length)) {
        if (normalizedPath.startsWith(value)) {
            return normalizedPath.replace(value, placeholder);
        }
    }
    return normalizedPath;
}

function resolvePath(compactedPath) {
    if (!compactedPath) return compactedPath;
    // Don't touch URLs or data URIs
    if (compactedPath.startsWith('http') || compactedPath.startsWith('data:')) return compactedPath;

    let resolved = compactedPath;
    // Clean up common shell artifacts (quotes, .\, etc.)
    resolved = resolved.replace(/^"|"$/g, ''); // Remove surrounding quotes
    if (resolved.startsWith('.\\') || resolved.startsWith('./')) {
        resolved = resolved.slice(2); // Remove leading .\ or ./
    }
    resolved = resolved.replace(/^"|"$/g, ''); // Remove quotes again if they were inside .\

    for (const [placeholder, value] of Object.entries(pathPlaceholders)) {
        resolved = resolved.replaceAll(placeholder, value);
    }
    return path.normalize(resolved);
}

// --- Image Management ---
function downloadImage(url) {
    return new Promise((resolve, reject) => {
        const protocol = url.startsWith('https') ? https : http;
        protocol.get(url, (response) => {
            if (response.statusCode !== 200) {
                response.resume();
                return reject(new Error(`Failed to download image: ${response.statusCode}`));
            }
            const ext = path.extname(url).split('?')[0] || '.jpg'; // Simple extension extraction
            const filename = `${Date.now()}_${Math.random().toString(36).substring(2, 15)}${ext}`;
            const filePath = path.join(imagesDirPath, filename);
            const fileStream = fs.createWriteStream(filePath);

            response.pipe(fileStream);

            fileStream.on('finish', () => {
                fileStream.close();
                resolve(filePath);
            });

            fileStream.on('error', (err) => {
                fs.unlink(filePath, () => {}); // Delete temp file
                reject(err);
            });
        }).on('error', reject);
    });
}

function saveDataUriImage(dataUri) {
    return new Promise((resolve, reject) => {
        try {
            // Sanitize input: remove backslashes that might have been added by path normalization
            // and ensure correct format. Also remove newlines.
            let sanitizedUri = dataUri.replace(/\\/g, '/').replace(/[\r\n]+/g, '');

            // More robust regex to capture mime type and base64 data
            const matches = sanitizedUri.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);

            if (!matches || matches.length !== 3) {
                return reject(new Error('Invalid data URI format'));
            }

            const type = matches[1];
            const data = matches[2];
            const buffer = Buffer.from(data, 'base64');

            // Map mime types to extensions
            let ext = 'jpg';
            if (type === 'image/png') ext = 'png';
            else if (type === 'image/gif') ext = 'gif';
            else if (type === 'image/svg+xml') ext = 'svg';
            else if (type === 'image/webp') ext = 'webp';

            const filename = `${Date.now()}_${Math.random().toString(36).substring(2, 15)}.${ext}`;
            const filePath = path.join(imagesDirPath, filename);

            fs.writeFile(filePath, buffer, (err) => {
                if (err) reject(err);
                else resolve(filePath);
            });
        } catch (error) {
            reject(error);
        }
    });
}

// --- Window Management ---
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 360,
        minHeight: 400,
        icon: path.join(__dirname, 'build', 'icon.ico'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });
    mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
    mainWindow.webContents.openDevTools();
}

app.whenReady().then(() => {
    initializePaths();
    createWindow();
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

// --- IPC Handlers ---

ipcMain.handle('app:getPaths', () => {
    return pathPlaceholders;
});

ipcMain.handle('app:getVersion', () => {
    return app.getVersion();
});

// --- Tile Management ---
ipcMain.handle('tiles:get', async () => {
    try {
        if (!fs.existsSync(tilesFilePath)) {
            const defaultTilesPath = path.join(__dirname, 'data', 'tiles.example.json');
            if (fs.existsSync(defaultTilesPath)) {
                fs.copyFileSync(defaultTilesPath, tilesFilePath);
            } else {
                fs.writeFileSync(tilesFilePath, '[]', 'utf8');
            }
        }
        const data = fs.readFileSync(tilesFilePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Failed to read tiles.json (corrupt), resetting:', error);
        const defaultTilesPath = path.join(__dirname, 'data', 'tiles.example.json');
        if (fs.existsSync(defaultTilesPath)) {
            fs.copyFileSync(defaultTilesPath, tilesFilePath);
            return JSON.parse(fs.readFileSync(tilesFilePath, 'utf8'));
        }
        return [];
    }
});

ipcMain.handle('tiles:save', async (event, tiles) => {
    try {
        const tilesToSave = JSON.parse(JSON.stringify(tiles)); // Deep copy

        // Process tiles: compact paths and download images
        for (const tile of tilesToSave) {
            tile.data = tile.data || {};
            if (tile.kind === 'exe' || tile.kind === 'file') {
                if (tile.data.path) tile.data.path = compactPath(tile.data.path);
            }
            if (tile.kind === 'command' && tile.data.cwd) {
                tile.data.cwd = compactPath(tile.data.cwd);
            }

            // Download remote images and save locally
            if (tile.style && tile.style.image) {
                if (tile.style.image.startsWith('data:')) {
                     try {
                        const localImagePath = await saveDataUriImage(tile.style.image);
                        tile.style.image = compactPath(localImagePath);
                    } catch (err) {
                        console.error(`Failed to save data URI image for tile "${tile.title}":`, err);
                    }
                } else if (tile.style.image.startsWith('http')) {
                    try {
                        const localImagePath = await downloadImage(tile.style.image);
                        tile.style.image = compactPath(localImagePath);
                    } catch (err) {
                        console.error(`Failed to download image for tile "${tile.title}":`, err);
                        // Keep the remote URL if download fails, or handle as needed
                    }
                } else {
                    tile.style.image = compactPath(tile.style.image);
                }
            }
        }

        fs.writeFileSync(tilesFilePath, JSON.stringify(tilesToSave, null, 2), 'utf8');
        return { success: true };
    } catch (error) {
        console.error('Failed to save tiles.json:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('tile:run', async (event, tile) => {
    try {
        const { kind, data } = tile;
        const safeData = data || {};
        switch (kind) {
            case 'url':
                await shell.openExternal(safeData.url);
                break;
            case 'file':
                await shell.openPath(resolvePath(safeData.path));
                break;
            case 'exe': {
                if (!safeData.path) throw new Error('Path is missing');
                const resolvedPath = resolvePath(safeData.path);
                const ext = path.extname(resolvedPath).toLowerCase();
                const isDirectory = fs.existsSync(resolvedPath) && fs.lstatSync(resolvedPath).isDirectory();

                if (['.lnk', '.url', '.pdf', '.docx'].includes(ext) || isDirectory) {
                    await shell.openPath(resolvedPath);
                } else if (ext === '.exe') {
                    if (!fs.existsSync(resolvedPath)) {
                        dialog.showErrorBox('File Not Found', `The file ${resolvedPath} does not exist.`);
                        return { success: false, error: 'File not found' };
                    }

                    // Ensure args is an array of strings
                    const args = Array.isArray(safeData.args)
                        ? safeData.args.map(String)
                        : (typeof safeData.args === 'string' ? [safeData.args] : []);

                    const child = spawn(resolvedPath, args, { detached: true, stdio: 'ignore', shell: false });
                    child.on('error', (err) => {
                        dialog.showErrorBox('Execution Error', `Failed to start application:\n${err.message}`);
                    });
                    child.unref();
                } else {
                    await shell.openPath(resolvedPath); // Fallback for other file types
                }
                break;
            }
            case 'command': {
                const resolvedCwd = safeData.cwd ? resolvePath(safeData.cwd) : process.cwd();
                if (safeData.cwd && !fs.existsSync(resolvedCwd)) {
                    dialog.showErrorBox('Execution Error', `Working directory does not exist:\n${resolvedCwd}`);
                    return { success: false, error: 'Working directory not found' };
                }

                // For complex commands with shell: true, it's often safer to join the command and args
                // and let the shell parse the entire string, especially on Windows.
                const commandString = [safeData.command, ...(safeData.args || [])].join(' ');

                const child = spawn(commandString, [], {
                    shell: safeData.shell !== undefined ? safeData.shell : true,
                    cwd: resolvedCwd,
                    detached: true,
                    stdio: 'ignore'
                });
                child.unref();
                break;
            }
            case 'folder':
                // Handled by renderer
                break;
            default:
                throw new Error(`Unsupported tile kind: ${kind}`);
        }
        return { success: true };
    } catch (error) {
        console.error(`Error running tile ${tile.title}:`, error);
        dialog.showErrorBox('Execution Error', `Could not run tile "${tile.title}".\n\n${error.message}`);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('tile:checkPath', async (event, p) => {
    if (!p) return false;
    const resolvedPath = resolvePath(p);
    return fs.existsSync(resolvedPath);
});

ipcMain.handle('tile:isDirectory', async (event, p) => {
    if (!p) return false;
    const resolvedPath = resolvePath(p);
    return fs.existsSync(resolvedPath) && fs.lstatSync(resolvedPath).isDirectory();
});

// --- Data Import/Export ---
ipcMain.handle('data:export', async (event, tiles) => {
    try {
        // 1. Ask user where to save the file
        const { filePath } = await dialog.showSaveDialog(mainWindow, {
            title: 'Esporta Dati UniTiles',
            defaultPath: `unitiles_backup_${Date.now()}.zip`,
            filters: [{ name: 'UniTiles Backup', extensions: ['zip'] }]
        });

        if (!filePath) {
            return { success: false, reason: 'cancelled' };
        }

        const zip = new JSZip();
        const tilesToExport = JSON.parse(JSON.stringify(tiles)); // Deep copy
        const iconsToPack = new Map(); // Use a map to avoid duplicate icon processing

        // 2. Process tiles and find local images
        for (const tile of tilesToExport) {
            if (tile.style && tile.style.image) {
                const imagePath = tile.style.image;
                // We only care about local, non-URL paths. Placeholders are local.
                if (!imagePath.startsWith('http') && !imagePath.startsWith('data:')) {
                    const resolvedPath = resolvePath(imagePath);
                    if (fs.existsSync(resolvedPath) && !iconsToPack.has(resolvedPath)) {
                        const iconFileName = path.basename(resolvedPath);
                        // Store the resolved path and the new relative path for the zip
                        iconsToPack.set(resolvedPath, `icons/${iconFileName}`);
                    }
                }
            }
        }

        // 3. Read icon files and add them to the zip
        for (const [resolvedPath, zipPath] of iconsToPack.entries()) {
            try {
                const iconData = fs.readFileSync(resolvedPath);
                zip.file(zipPath, iconData);
            } catch (err) {
                console.warn(`Could not read icon file for export: ${resolvedPath}`, err);
                // If we can't read an icon, we can decide to either fail the export
                // or just skip this icon. For robustness, we'll skip it.
                // We also need to remove it from our map so we don't change the path in the JSON
                iconsToPack.delete(resolvedPath);
            }
        }

        // 4. Update tile data to use relative icon paths
        const reverseIconMap = new Map(Array.from(iconsToPack.entries()).map(([k, v]) => [k,v]));
        for (const tile of tilesToExport) {
             if (tile.style && tile.style.image) {
                const resolvedPath = resolvePath(tile.style.image);
                if (reverseIconMap.has(resolvedPath)) {
                    tile.style.image = reverseIconMap.get(resolvedPath);
                }
            }
        }

        // 5. Add the JSON data to the zip
        zip.file('data.json', JSON.stringify(tilesToExport, null, 2));

        // 6. Generate and save the zip file
        const zipContent = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
        fs.writeFileSync(filePath, zipContent);

        return { success: true, path: filePath };

    } catch (error) {
        console.error('Failed to export data:', error);
        dialog.showErrorBox('Export Fallito', `Si è verificato un errore durante l'esportazione dei dati:\n\n${error.message}`);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('data:import', async () => {
    try {
        const { filePaths, canceled } = await dialog.showOpenDialog(mainWindow, {
            title: 'Importa Backup UniTiles',
            filters: [{ name: 'UniTiles Backup', extensions: ['zip'] }],
            properties: ['openFile']
        });

        if (canceled || filePaths.length === 0) return { success: false, reason: 'cancelled' };

        const zipContent = fs.readFileSync(filePaths[0]);
        const zip = await JSZip.loadAsync(zipContent);

        if (!zip.file('data.json')) {
            throw new Error('Backup non valido: data.json mancante.');
        }

        const tilesData = JSON.parse(await zip.file('data.json').async('string'));

        // Restore images
        for (const tile of tilesData) {
            if (tile.style && tile.style.image) {
                // Check if image is relative (packed in zip) e.g. "icons/foo.png"
                if (!tile.style.image.startsWith('http') && !tile.style.image.startsWith('data:') && !path.isAbsolute(tile.style.image)) {
                    const zipImage = zip.file(tile.style.image);
                    if (zipImage) {
                        const ext = path.extname(tile.style.image);
                        const newFilename = `${Date.now()}_imp_${Math.random().toString(36).substring(2, 10)}${ext}`;
                        const destPath = path.join(imagesDirPath, newFilename);
                        const content = await zipImage.async('nodebuffer');
                        fs.writeFileSync(destPath, content);
                        tile.style.image = compactPath(destPath);
                    }
                }
            }
        }

        fs.writeFileSync(tilesFilePath, JSON.stringify(tilesData, null, 2), 'utf8');

        // Reload window to apply changes
        mainWindow.reload();
        return { success: true };

    } catch (error) {
        console.error('Import failed:', error);
        dialog.showErrorBox('Errore Importazione', `Impossibile importare il backup:\n${error.message}`);
        return { success: false, error: error.message };
    }
});

// --- Notes Management ---
function getNotePaths(date) {
    const dateDir = path.join(notesDirPath, date);
    const metadataPath = path.join(dateDir, 'metadata.json');
    return { notesDir: notesDirPath, dateDir, metadataPath };
}

ipcMain.handle('note:save', async (event, { date, content }) => {
    try {
        const { dateDir, metadataPath } = getNotePaths(date);
        if (!fs.existsSync(dateDir)) {
            fs.mkdirSync(dateDir, { recursive: true });
        }

        let metadata = { nextVersion: 1 };
        if (fs.existsSync(metadataPath)) {
            try {
                metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
            } catch (e) { /* Corrupted, will be overwritten */ }
        }

        const versionToSave = metadata.nextVersion;
        const tempPath = path.join(dateDir, `${versionToSave}.tmp`);
        const finalPath = path.join(dateDir, `${versionToSave}.txt`);

        // Atomic write
        fs.writeFileSync(tempPath, content, 'utf8');
        fs.renameSync(tempPath, finalPath);

        metadata.nextVersion = (versionToSave % 3) + 1;
        fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf8');

        return { success: true };
    } catch (error) {
        console.error('Error saving note:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('note:get', async (event, date) => {
    try {
        const { dateDir } = getNotePaths(date);
        if (!fs.existsSync(dateDir)) {
            return { success: true, content: '' };
        }

        const noteVersions = fs.readdirSync(dateDir)
            .filter(file => /^[1-3]\.txt$/.test(file))
            .map(file => ({
                name: file,
                time: fs.statSync(path.join(dateDir, file)).mtime.getTime()
            }))
            .sort((a, b) => b.time - a.time);

        if (noteVersions.length === 0) {
            return { success: true, content: '' };
        }

        const latestVersionPath = path.join(dateDir, noteVersions[0].name);
        const content = fs.readFileSync(latestVersionPath, 'utf8');
        return { success: true, content };
    } catch (error) {
        console.error('Error getting note:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('notes:openFolder', async () => {
    if (!fs.existsSync(notesDirPath)) {
        fs.mkdirSync(notesDirPath, { recursive: true });
    }
    await shell.openPath(notesDirPath);
});
