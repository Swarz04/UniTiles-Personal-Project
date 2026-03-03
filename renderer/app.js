/**
 * UniTiles - Renderer Process
 * Author: A. Scharmüller
 */
document.addEventListener('DOMContentLoaded', async () => {
    // Get DOM elements
    const tilesGrid = document.getElementById('tiles-grid');
    const addTileBtn = document.getElementById('add-tile-btn');
    const backBtn = document.getElementById('back-btn');
    const addTileDialog = document.getElementById('add-tile-dialog');
    const searchInput = document.getElementById('search-input');
    const cancelAddTileBtn = document.getElementById('cancel-add-tile-btn');
    const tileForm = document.getElementById('tile-form');
    const tileTypeSelect = document.getElementById('tile-type');
    const dynamicFieldsDiv = document.getElementById('dynamic-fields');
    const clockDisplay = document.getElementById('clock-display');
    const dateDisplay = document.getElementById('date-display');
    const terminalInput = document.getElementById('terminal-input');
    const saveNoteBtn = document.getElementById('save-note-btn');
    const openNotesBtn = document.getElementById('open-notes-btn');
    const calendarPopup = document.getElementById('calendar-popup');
    const calendarMonthYear = document.getElementById('calendar-month-year');
    const calendarGrid = document.getElementById('calendar-grid');
    const prevMonthBtn = document.getElementById('prev-month');
    const nextMonthBtn = document.getElementById('next-month');

    let homeDir = ''; // Will store the user's home directory
    let oneDriveDir = ''; // Will store the user's OneDrive directory
    let tiles = [];
    let currentFolderId = null; // ID della cartella corrente (null = root)
    let editingTileId = null; // New: To keep track of the tile being edited
    let draggedTileId = null; // Per tracciare il tile che si sta trascinando
    let currentCalendarDate = new Date(); // Data corrente visualizzata nel calendario
    let selectedNoteDate = new Date(); // Data selezionata per la nota (default oggi)

    // Helper: Trova una cartella per ID ricorsivamente
    function findFolderById(items, id) {
        for (const item of items) {
            if (item.id === id) return item;
            if (item.type === 'folder' && item.items) {
                const found = findFolderById(item.items, id);
                if (found) return found;
            }
        }
        return null;
    }

    // Helper: Ottieni l'array di tile corrente (root o contenuto cartella)
    function getCurrentContext() {
        if (!currentFolderId) return tiles;
        const folder = findFolderById(tiles, currentFolderId);
        return folder ? folder.items : tiles;
    }

    // Helper: Processa il percorso per il salvataggio (converte in segnaposto)
    function processPathForSave(path) {
        if (!path) return '';
        // 1. Risolvi input in assoluto (nel caso l'utente abbia scritto manualmente i placeholder)
        let absPath = path.replace(/%ONEDRIVE%/g, oneDriveDir).replace(/C:\\Users\\TUO_UTENTE/g, homeDir);

        // 2. Tokenizza in placeholder (OneDrive ha priorità perché è più specifico)
        if (oneDriveDir && absPath.startsWith(oneDriveDir)) {
            return absPath.replace(oneDriveDir, '%ONEDRIVE%');
        }
        if (absPath.startsWith(homeDir)) {
            return absPath.replace(homeDir, 'C:\\Users\\TUO_UTENTE');
        }
        return absPath;
    }

    // Function to render tiles
    async function renderTiles() {
        const currentTiles = getCurrentContext();
        tilesGrid.innerHTML = ''; // Clear existing tiles
        console.log('[app.js] Rendering tiles. Context:', currentFolderId || 'ROOT', currentTiles);

        // Gestione visibilità pulsante Indietro
        backBtn.style.display = currentFolderId ? 'flex' : 'none';

        // Se stiamo cercando, vogliamo cercare in tutto l'albero, non solo nel contesto corrente.
        const searchTerm = searchInput.value.trim().toLowerCase();
        let filteredTiles;

        if (searchTerm) {
            // Funzione di ricerca ricorsiva
            const searchRecursive = (items, term) => {
                let results = [];
                for (const item of items) {
                    if (item.title.toLowerCase().includes(term)) results.push(item);
                    if (item.type === 'folder' && item.items) results = results.concat(searchRecursive(item.items, term));
                }
                return results;
            };
            filteredTiles = searchRecursive(tiles, searchTerm);
        } else {
            // Se non c'è un termine di ricerca, mostra solo il contesto corrente
            filteredTiles = currentTiles;
        }

        if (filteredTiles.length === 0) {
            if (searchTerm) {
                tilesGrid.innerHTML = '<p style="text-align: center; color: #ccc;">Nessun risultato trovato.</p>';
            } else {
                tilesGrid.innerHTML = '<p style="text-align: center; color: #ccc;">Nessun tile aggiunto. Clicca "+" per iniziare!</p>';
            }
            return;
        }

        filteredTiles.forEach(tile => {
            const tileCard = document.createElement('div');
            tileCard.className = 'tile-card';
            tileCard.dataset.id = tile.id;
            tileCard.setAttribute('draggable', 'true'); // Rende il tile trascinabile

            // --- Inizio Logica Drag & Drop ---
            tileCard.addEventListener('dragstart', (e) => {
                draggedTileId = tile.id;
                e.dataTransfer.effectAllowed = 'move';
                // Timeout per applicare la classe dopo che l'immagine di trascinamento è stata creata dal browser
                setTimeout(() => tileCard.classList.add('dragging'), 0);
            });

            tileCard.addEventListener('dragend', () => {
                draggedTileId = null;
                tileCard.classList.remove('dragging');
                // Rimuovi lo stile drag-over da tutte le card
                document.querySelectorAll('.tile-card').forEach(card => card.classList.remove('drag-over'));
            });

            tileCard.addEventListener('dragover', (e) => {
                e.preventDefault(); // Necessario per permettere il drop
                if (draggedTileId === tile.id) return; // Non fare nulla se siamo sopra noi stessi
                e.dataTransfer.dropEffect = 'move';
            });

            tileCard.addEventListener('dragenter', (e) => {
                e.preventDefault();
                if (draggedTileId !== tile.id) {
                    tileCard.classList.add('drag-over');
                }
            });

            tileCard.addEventListener('dragleave', (e) => {
                // Rimuovi la classe solo se stiamo uscendo dalla card e non entrando in un suo figlio
                if (!tileCard.contains(e.relatedTarget)) {
                    tileCard.classList.remove('drag-over');
                }
            });

            tileCard.addEventListener('drop', async (e) => {
                e.preventDefault();
                tileCard.classList.remove('drag-over');

                if (draggedTileId && draggedTileId !== tile.id) {
                    const context = getCurrentContext();
                    const fromIndex = context.findIndex(t => t.id === draggedTileId);

                    if (fromIndex > -1) {
                        // Se il target è una cartella, sposta l'elemento al suo interno
                        if (tile.type === 'folder') {
                            const [movedTile] = context.splice(fromIndex, 1);
                            if (!tile.items) tile.items = [];
                            tile.items.push(movedTile);
                            await saveTiles();
                            renderTiles();
                            return;
                        }

                        const toIndex = context.findIndex(t => t.id === tile.id);
                        if (toIndex > -1) {
                            // Sposta l'elemento nell'array
                            const [movedTile] = context.splice(fromIndex, 1);
                            context.splice(toIndex, 0, movedTile);

                            // Salva e renderizza di nuovo
                            await saveTiles();
                            renderTiles();
                        }
                    }
                }
            });
            // --- Fine Logica Drag & Drop ---

            // Apply background style
            if (tile.type === 'folder') {
                // Render Folder Preview (2x2 Grid)
                const previewDiv = document.createElement('div');
                previewDiv.className = 'folder-preview';

                // Prendi i primi 4 elementi della cartella per la preview
                const previewItems = (tile.items || []).slice(0, 4);

                previewItems.forEach(item => {
                    const miniTile = document.createElement('div');
                    miniTile.className = 'mini-tile';
                    if (item.style && item.style.image) {
                        const processedImagePath = item.style.image.replace(/C:\\Users\\TUO_UTENTE/g, homeDir).replace(/\\/g, '/');
                        miniTile.style.backgroundImage = `url('${processedImagePath}')`;
                    } else if (item.style && item.style.color) {
                        miniTile.style.backgroundColor = item.style.color;
                    }
                    previewDiv.appendChild(miniTile);
                });
                tileCard.appendChild(previewDiv);
            } else if (tile.style && tile.style.image) {
                // Replace backslashes with forward slashes for CSS background-image URL compatibility on Windows
                // Also replace the dynamic placeholder if present
                const processedImagePath = tile.style.image.replace(/C:\\Users\\TUO_UTENTE/g, homeDir).replace(/\\/g, '/');
                tileCard.style.backgroundImage = `url('${processedImagePath}')`;
                tileCard.style.backgroundSize = 'cover';
                tileCard.style.backgroundPosition = 'center';
                tileCard.style.position = 'relative'; // Needed for overlay

                // Add dark overlay for text readability
                const overlay = document.createElement('div');
                overlay.className = 'tile-card-image-overlay';
                tileCard.appendChild(overlay);
            } else if (tile.style && tile.style.color) {
                tileCard.style.backgroundColor = tile.style.color;
            } else {
                tileCard.style.backgroundColor = '#333'; // Default fallback color
            }

            const content = document.createElement('div');
            content.className = 'tile-card-content';

            const title = document.createElement('h3');
            title.className = 'tile-card-title';
            title.textContent = tile.title; // Ripristinato

            const subtitle = document.createElement('p');
            subtitle.className = 'tile-card-subtitle';
            subtitle.textContent = tile.subtitle;

            content.appendChild(title);
            content.appendChild(subtitle);
            tileCard.appendChild(content);

            // Delete button
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'tile-delete-btn';
            deleteBtn.innerHTML = '🗑';
            deleteBtn.title = 'Elimina tile';
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent tile click event from triggering
                deleteTile(tile.id);
            });
            tileCard.appendChild(deleteBtn);

            // New: Edit button
            const editBtn = document.createElement('button');
            editBtn.className = 'tile-edit-btn'; // You'll need to add CSS for this
            editBtn.innerHTML = '✏️'; // Pencil icon
            editBtn.title = 'Modifica tile';
            editBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent tile click event from triggering
                console.log(`[app.js] Edit button clicked for tile ID: ${tile.id}, title: ${tile.title}`); // Log when edit button is clicked
                openEditTileDialog(tile); // New function to handle editing
            });
            tileCard.appendChild(editBtn);

            // Existing tile click event
            tileCard.addEventListener('click', async () => {
                if (tile.type === 'folder') {
                    // Entra nella cartella
                    currentFolderId = tile.id;
                    searchInput.value = ''; // Resetta ricerca
                    renderTiles();
                } else {
                    const result = await window.api.runTile(tile);
                    if (!result.success) {
                        alert(`Errore nell'esecuzione di "${tile.title}":\n${result.error}`);
                    }
                }
            });

            tilesGrid.appendChild(tileCard);
        });
    }

    // Back button functionality
    backBtn.addEventListener('click', () => {
        // Per ora supportiamo solo 1 livello di profondità o torniamo alla root
        // Se volessimo profondità infinita, dovremmo tracciare la history dei folderId
        if (currentFolderId) {
            // Trova il genitore? Per semplicità ora torniamo alla root.
            // In un sistema a più livelli, qui dovremmo trovare il parentId.
            // Dato che getCurrentContext usa currentFolderId, settarlo a null ci porta alla home.
            currentFolderId = null;
            searchInput.value = '';
            renderTiles();
        }
    });

    // Allow dropping a tile on the back button to move it to the parent folder (root)
    backBtn.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (currentFolderId && draggedTileId) {
            e.dataTransfer.dropEffect = 'move';
            backBtn.classList.add('drag-over');
        }
    });

    backBtn.addEventListener('dragleave', () => {
        backBtn.classList.remove('drag-over');
    });

    backBtn.addEventListener('drop', async (e) => {
        e.preventDefault();
        backBtn.classList.remove('drag-over');

        if (currentFolderId && draggedTileId) {
            const context = getCurrentContext();
            const index = context.findIndex(t => t.id === draggedTileId);

            if (index > -1) {
                // Remove from current folder
                const [movedTile] = context.splice(index, 1);

                // Add to root (tiles array)
                // Since we currently only support 1 level of nesting, the parent is always the root 'tiles' array.
                tiles.push(movedTile);

                await saveTiles();
                renderTiles();
            }
        }
    });

    // Search functionality
    searchInput.addEventListener('input', renderTiles);

    // Function to load tiles from main process
    async function loadTiles() {
        tiles = await window.api.getTiles();
        renderTiles();
    }

    // Function to save tiles to main process
    async function saveTiles() {
        const result = await window.api.saveTiles(tiles);
        if (!result.success) {
            alert('Errore nel salvataggio dei tile: ' + result.error);
        }
    }

    // Function to delete a tile
    async function deleteTile(id) {
        if (confirm('Sei sicuro di voler eliminare questo tile?')) {
            const context = getCurrentContext();
            const index = context.findIndex(t => t.id === id);
            if (index > -1) context.splice(index, 1);
            await saveTiles();
            renderTiles();
        }
    }

    // New: Function to open the dialog and pre-fill for editing
    function openEditTileDialog(tile) {
        console.log('[app.js] openEditTileDialog called for tile:', JSON.stringify(tile, null, 2));
        editingTileId = tile.id;
        addTileDialog.showModal();

        // Pre-fill common fields
        document.getElementById('tile-title').value = tile.title;
        document.getElementById('tile-subtitle').value = tile.subtitle;
        document.getElementById('tile-type').value = tile.type;

        // Trigger change event to render dynamic fields for the selected type
        const event = new Event('change');
        tileTypeSelect.dispatchEvent(event);

        // Pre-fill dynamic fields based on type
        const placeholder = 'C:\\Users\\TUO_UTENTE'; // Re-use placeholder for display

        // Helper per visualizzare il percorso nel form
        const formatPathForDisplay = (p) => {
            if (!p) return '';
            if (oneDriveDir && p.startsWith(oneDriveDir)) return p.replace(oneDriveDir, '%ONEDRIVE%');
            return p.replace(homeDir, placeholder);
        };

        switch (tile.type) {
            case 'url':
                console.log('[app.js] Pre-filling URL:', tile.url);
                document.getElementById('tile-url').value = tile.url;
                break;
            case 'exe':
                // Replace homeDir back to placeholder for display in form
                const exePathForDisplay = formatPathForDisplay(tile.path);
                console.log('[app.js] Pre-filling EXE Path:', exePathForDisplay, 'Args:', tile.args);
                document.getElementById('tile-path').value = exePathForDisplay;
                document.getElementById('tile-args').value = tile.args || '';
                break;
            case 'command':
                const cwdForDisplay = tile.cwd ? formatPathForDisplay(tile.cwd) : '';
                console.log('[app.js] Pre-filling Command:', tile.cmd, 'Args:', tile.args, 'CWD:', cwdForDisplay);
                document.getElementById('tile-cmd').value = tile.cmd;
                document.getElementById('tile-cmd-args').value = tile.args || '';
                if (tile.cwd) {
                    document.getElementById('tile-cwd').value = cwdForDisplay;
                }
                break;
            case 'file':
                const filePathForDisplay = formatPathForDisplay(tile.path);
                console.log('[app.js] Pre-filling File Path:', filePathForDisplay);
                document.getElementById('tile-file-path').value = filePathForDisplay;
                break;
            case 'folder':
                break;
        }

        // Pre-fill style fields
        document.getElementById('tile-color').value = (tile.style && tile.style.color) || '';
        document.getElementById('tile-image').value = (tile.style && tile.style.image) || '';
    }

    // Dynamic form fields based on tile type
    tileTypeSelect.addEventListener('change', () => {
        dynamicFieldsDiv.innerHTML = ''; // Clear previous fields
        const selectedType = tileTypeSelect.value;

        if (selectedType === 'file') {
            document.getElementById('tile-image').value = 'https://www.pcprofessionale.it/wp-content/uploads/2018/12/Cartella.jpg';
        }

        let fieldsHtml = '';
        switch (selectedType) {
            case 'url':
                fieldsHtml = `
                    <div class="form-group">
                        <label for="tile-url">URL:</label>
                        <input type="url" id="tile-url" required placeholder="https://example.com">
                    </div>
                `;
                break;
            case 'exe':
                fieldsHtml = `
                    <div class="form-group">
                        <label for="tile-path">Percorso Eseguibile (.exe):</label>
                        <input type="text" id="tile-path" required placeholder="C:\\Program Files\\App\\app.exe">
                    </div>
                    <div class="form-group">
                        <label for="tile-args">Argomenti (opzionale, separati da spazi):</label>
                        <input type="text" id="tile-args" placeholder="--arg1 value --arg2">
                    </div>
                `;
                break;
            case 'command':
                fieldsHtml = `
                    <div class="form-group">
                        <label for="tile-cmd">Comando:</label>
                        <input type="text" id="tile-cmd" required placeholder="jupyter lab">
                    </div>
                    <div class="form-group">
                        <label for="tile-cmd-args">Argomenti (opzionale, separati da spazi):</label>
                        <input type="text" id="tile-cmd-args" placeholder="--port 8888">
                    </div>
                    <div class="form-group">
                        <label for="tile-cwd">Directory di Lavoro (CWD, opzionale):</label>
                        <input type="text" id="tile-cwd" placeholder="C:\\Users\\TUO_UTENTE\\Projects">
                    </div>
                `;
                break;
            case 'file': // Nuovo tipo: File Locale
                fieldsHtml = `
                    <div class="form-group">
                        <label for="tile-file-path">Percorso File Locale:</label>
                        <input type="text" id="tile-file-path" required placeholder="C:\\path\\to\\document.pdf">
                    </div>
                `;
                break;
            case 'folder':
                fieldsHtml = `<p style="color: #ccc; font-size: 0.9em;">Crea una cartella per raggruppare i tuoi tile. Potrai aggiungere elementi entrando nella cartella.</p>`;
                break;
        }
        dynamicFieldsDiv.innerHTML = fieldsHtml;
    });

    // Open add tile dialog
    addTileBtn.addEventListener('click', () => {
        console.log('[app.js] Add new tile button clicked. Resetting form.');
        editingTileId = null; // Reset for new tile
        tileForm.reset(); // Clear form fields
        dynamicFieldsDiv.innerHTML = ''; // Clear dynamic fields
        addTileDialog.showModal();
        // Set default type to 'url' and trigger change to show its fields
        tileTypeSelect.value = 'url';
        tileTypeSelect.dispatchEvent(new Event('change'));
    });

    // Close add tile dialog
    cancelAddTileBtn.addEventListener('click', () => {
        addTileDialog.close();
    });

    // Handle form submission
    tileForm.addEventListener('submit', async (e) => {
        console.log('[app.js] Form submitted. editingTileId:', editingTileId);
        e.preventDefault();

        const title = document.getElementById('tile-title').value.trim();
        const subtitle = document.getElementById('tile-subtitle').value.trim();
        const type = tileTypeSelect.value;
        // Style fields are optional
        const color = document.getElementById('tile-color').value.trim();
        const image = document.getElementById('tile-image').value.trim();

        const placeholder = 'C:\\Users\\TUO_UTENTE';

        if (!title || !type) {
            alert('Titolo e Tipo sono campi obbligatori.');
            return;
        }

        let targetTile;
        if (editingTileId) {
            // Editing existing tile
            console.log('[app.js] Attempting to edit existing tile with ID:', editingTileId);
            const context = getCurrentContext();
            targetTile = context.find(t => t.id === editingTileId);
            if (!targetTile) {
                alert('Errore: Tile da modificare non trovato.');
                addTileDialog.close();
                return;
            }
            // Update existing tile properties
            targetTile.title = title;
            targetTile.subtitle = subtitle;
            targetTile.type = type;
            // Ensure style object exists, but don't reset it completely
            // to avoid losing data if form fields are empty.
            targetTile.style = targetTile.style || {};
        } else {
            console.log('[app.js] Creating new tile.');
            // Adding new tile
            targetTile = {
                id: Date.now().toString(), // Unique ID using timestamp
                title,
                subtitle,
                type,
                style: {}
            };
        }

        // Rebuild style object based on form input.
        // If a field is empty, remove the property.
        if (color) {
            targetTile.style.color = color;
        } else {
            delete targetTile.style.color;
        }
        if (image) {
            targetTile.style.image = processPathForSave(image);
        } else {
            delete targetTile.style.image;
        }

        // Clear previous type-specific fields if type changed during edit
        delete targetTile.url;
        delete targetTile.path;
        delete targetTile.args;
        delete targetTile.cmd;
        delete targetTile.cwd;

        // Add/update type-specific fields
        switch (type) {
            case 'url':
                const url = document.getElementById('tile-url').value.trim();
                console.log('[app.js] Saving URL type. URL:', url);
                if (!url) { alert('L\'URL è obbligatorio per il tipo URL.'); return; }
                targetTile.url = url;
                break;
            case 'exe':
                const path = document.getElementById('tile-path').value.trim();
                const args = document.getElementById('tile-args').value.trim();
                if (!path) { alert('Il percorso eseguibile è obbligatorio per il tipo Eseguibile.'); return; }
                console.log('[app.js] Saving EXE type. Path:', path, 'Args:', args);
                targetTile.path = processPathForSave(path);
                targetTile.args = args;
                break;
            case 'command':
                const cmd = document.getElementById('tile-cmd').value.trim();
                const cmdArgs = document.getElementById('tile-cmd-args').value.trim();
                const cwd = document.getElementById('tile-cwd').value.trim();
                console.log('[app.js] Saving Command type. Cmd:', cmd, 'Args:', cmdArgs, 'CWD:', cwd);
                if (!cmd) { alert('Il comando è obbligatorio per il tipo Comando.'); return; }
                targetTile.cmd = cmd;
                targetTile.args = cmdArgs;
                if (cwd) {
                    targetTile.cwd = processPathForSave(cwd);
                }
                break;
            case 'file':
                const filePath = document.getElementById('tile-file-path').value.trim();
                console.log('[app.js] Saving File type. Path:', filePath);
                if (!filePath) { alert('Il percorso del file è obbligatorio per il tipo File Locale.'); return; }
                targetTile.path = processPathForSave(filePath);
                break;
            case 'folder':
                // Se è una nuova cartella, inizializza l'array items
                if (!targetTile.items) targetTile.items = [];
                break;
        }

        if (!editingTileId) {
            getCurrentContext().push(targetTile); // Push to current folder or root
        }
        await saveTiles();
        renderTiles();
        addTileDialog.close();
        editingTileId = null; // Reset after saving
    });

    // Initial load of tiles
    homeDir = await window.api.getHomeDir(); // Get home directory once at startup
    oneDriveDir = await window.api.getOneDriveDir(); // Get OneDrive directory

    // Helper per formattare la data ID (YYYY-MM-DD)
    function formatDateId(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    // --- Clock and Date ---
    function updateClockAndDate() {
        const now = new Date();

        // Clock (HH:MM:SS)
        const timeString = now.toLocaleTimeString('it-IT', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        clockDisplay.textContent = timeString;

        // Date (Giorno, GG Mese AAAA)
        // Mostra la data selezionata per la nota, non necessariamente oggi
        const displayDate = selectedNoteDate;
        const dateString = displayDate.toLocaleDateString('it-IT', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        dateDisplay.textContent = dateString.charAt(0).toUpperCase() + dateString.slice(1);
    }
    setInterval(updateClockAndDate, 1000); // Update every second
    updateClockAndDate(); // Initial call

    // --- Calendar Popup Logic ---
    function renderCalendar(date) {
        const year = date.getFullYear();
        const month = date.getMonth();

        // Imposta header mese/anno
        const monthName = date.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
        calendarMonthYear.textContent = monthName.charAt(0).toUpperCase() + monthName.slice(1);

        calendarGrid.innerHTML = '';

        // Giorni della settimana header
        const daysHeader = document.querySelector('.calendar-days-header');
        daysHeader.innerHTML = '';
        ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'].forEach(day => {
            const dayEl = document.createElement('div');
            dayEl.textContent = day;
            daysHeader.appendChild(dayEl);
        });

        // Primo giorno del mese
        const firstDay = new Date(year, month, 1).getDay(); // 0 = Dom, 1 = Lun...
        // Aggiusta per Lunedì come primo giorno (0 = Lun, 6 = Dom)
        const startDay = firstDay === 0 ? 6 : firstDay - 1;

        // Giorni nel mese
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        // Celle vuote prima del primo giorno
        for (let i = 0; i < startDay; i++) {
            const emptyCell = document.createElement('div');
            emptyCell.className = 'calendar-day empty';
            calendarGrid.appendChild(emptyCell);
        }

        // Giorni del mese
        const today = new Date();
        for (let i = 1; i <= daysInMonth; i++) {
            const dayCell = document.createElement('div');
            dayCell.className = 'calendar-day';
            dayCell.textContent = i;

            if (i === today.getDate() && month === today.getMonth() && year === today.getFullYear()) {
                dayCell.classList.add('today');
            }

            // Evidenzia la data selezionata
            if (i === selectedNoteDate.getDate() && month === selectedNoteDate.getMonth() && year === selectedNoteDate.getFullYear()) {
                dayCell.classList.add('selected');
            }

            // Click su un giorno
            dayCell.addEventListener('click', async () => {
                await saveCurrentNote(); // Salva la nota corrente prima di cambiare data
                selectedNoteDate = new Date(year, month, i);
                updateClockAndDate(); // Aggiorna la data visualizzata nel footer
                renderCalendar(currentCalendarDate); // Rerender per aggiornare la selezione
                await loadNoteForSelectedDate(); // Carica la nota
            });

            calendarGrid.appendChild(dayCell);
        }
    }

    dateDisplay.addEventListener('click', () => {
        calendarPopup.style.display = calendarPopup.style.display === 'none' ? 'block' : 'none';
        renderCalendar(currentCalendarDate);
    });

    prevMonthBtn.addEventListener('click', () => {
        currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
        renderCalendar(currentCalendarDate);
    });

    nextMonthBtn.addEventListener('click', () => {
        currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
        renderCalendar(currentCalendarDate);
    });

    // --- Notes Logic ---
    async function saveCurrentNote() {
        const dateId = formatDateId(selectedNoteDate);
        const content = terminalInput.value;
        const result = await window.api.saveNote(dateId, content);
        if (!result.success) {
            console.error('Error saving note:', result.error);
        }
        return result;
    }

    async function loadNoteForSelectedDate() {
        const dateId = formatDateId(selectedNoteDate);
        const result = await window.api.getNote(dateId);
        if (result.success) {
            terminalInput.value = result.content;
        } else {
            terminalInput.value = '';
            console.error('Error loading note:', result.error);
        }
    }

    saveNoteBtn.addEventListener('click', async () => {
        const result = await saveCurrentNote();
        if (result.success) {
            // Feedback visivo opzionale (es. cambio colore bordo momentaneo)
            const originalColor = saveNoteBtn.style.backgroundColor;
            saveNoteBtn.style.backgroundColor = '#0f0';
            setTimeout(() => saveNoteBtn.style.backgroundColor = originalColor, 500);
        } else {
            alert('Errore nel salvataggio della nota: ' + result.error);
        }
    });

    openNotesBtn.addEventListener('click', () => {
        window.api.openNotesFolder();
    });

    // Carica la nota di oggi all'avvio
    await loadNoteForSelectedDate();
    loadTiles();
});
