/**
 * UniTiles - Renderer Process (v2.1.0)
 * Author: A. Scharmüller
 */
document.addEventListener('DOMContentLoaded', async () => {
    // --- DOM Elements ---
    const tilesGrid = document.getElementById('tiles-grid');
    const addTileBtn = document.getElementById('add-tile-btn');
    const backBtn = document.getElementById('back-btn');
    const settingsBtn = document.getElementById('settings-btn');
    const searchInput = document.getElementById('search-input');
    const breadcrumbContainer = document.getElementById('breadcrumb-container');
    // Dialog
    const addTileDialog = document.getElementById('add-tile-dialog');
    const tileForm = document.getElementById('tile-form');
    const tileKindSelect = document.getElementById('tile-kind');
    const dynamicFieldsDiv = document.getElementById('dynamic-fields');
    const cancelAddTileBtn = document.getElementById('cancel-add-tile-btn');
    // Settings Dialog
    const settingsDialog = document.getElementById('settings-dialog');
    const closeSettingsBtn = document.getElementById('close-settings-btn');
    // Footer
    const clockDisplay = document.getElementById('clock-display');
    const dateDisplay = document.getElementById('date-display');
    const terminalInput = document.getElementById('terminal-input');
    const saveNoteBtn = document.getElementById('save-note-btn');
    const openNotesBtn = document.getElementById('open-notes-btn');
    // Calendar
    const calendarPopup = document.getElementById('calendar-popup');
    const calendarMonthYear = document.getElementById('calendar-month-year');
    const calendarGrid = document.getElementById('calendar-grid');
    const prevMonthBtn = document.getElementById('prev-month');
    const nextMonthBtn = document.getElementById('next-month');

    // --- State ---
    let allTiles = [];
    let currentFolderId = null;
    let editingTileId = null;
    let draggedTileId = null;
    let currentCalendarDate = new Date();
    let selectedNoteDate = new Date();
    let noteSaveTimeout;
    let isNoteDirty = false;

    // --- Initialization ---
    const paths = await window.api.getPaths();
    document.getElementById('app-version').textContent = await window.api.getAppVersion();
    await loadTiles();
    await loadNoteForSelectedDate();
    initializeClock();
    initializeEventListeners();

    // --- Helper Functions ---
    function resolvePathForDisplay(compactedPath) {
        if (!compactedPath) return compactedPath;
        if (compactedPath.startsWith('http') || compactedPath.startsWith('https') || compactedPath.startsWith('data:')) return compactedPath;


        let resolved = compactedPath;
        for (const [placeholder, value] of Object.entries(paths)) {
            resolved = resolved.replace(placeholder, value);
        }
        // Convert to file URL for CSS to handle local paths correctly
        return `file:///${resolved.replace(/\\/g, '/')}`;
    }

    function parseArgs(input) {
        if (!input) return [];
        const args = [];
        let current = "";
        let inQuote = false;

        for (let i = 0; i < input.length; i++) {
            const char = input[i];
            if (char === '"') {
                inQuote = !inQuote;
                current += char;
            } else if (char === ' ' && !inQuote) {
                if (current.length > 0) {
                    args.push(current);
                    current = "";
                }
            } else {
                current += char;
            }
        }
        if (current.length > 0) {
            args.push(current);
        }
        return args;
    }

    // --- Tile Management ---
    async function loadTiles() {
        allTiles = await window.api.getTiles();
        if (!Array.isArray(allTiles)) allTiles = [];
        // First-time migration from nested to flat structure
        if (allTiles.some(t => t.items && Array.isArray(t.items))) {
            allTiles = migrateToFlatStructure(allTiles);
            await saveTiles();
        }
        await renderTiles();
    }

    async function saveTiles() {
        const result = await window.api.saveTiles(allTiles);
        if (!result.success) {
            alert('Error saving tiles: ' + result.error);
        }
    }

    function migrateToFlatStructure(nestedTiles, parentId = null) {
        let flatList = [];
        nestedTiles.forEach((tile, index) => {
            const newTile = { ...tile, parentId, order: (index + 1) * 10 };
            if (tile.items && Array.isArray(tile.items)) {
                const children = migrateToFlatStructure(tile.items, tile.id);
                flatList = flatList.concat(children);
                delete newTile.items; // Remove nested array
            }
            // Map old properties to new schema
            if (newTile.type) {
                newTile.kind = newTile.type;
                delete newTile.type;
            }
            newTile.data = {};
            if (newTile.url) { newTile.data.url = newTile.url; delete newTile.url; }
            if (newTile.path) { newTile.data.path = newTile.path; delete newTile.path; }
            if (newTile.cmd) { newTile.data.command = newTile.cmd; delete newTile.cmd; }
            if (newTile.args) {
                newTile.data.args = typeof newTile.args === 'string' ? parseArgs(newTile.args) : newTile.args;
                delete newTile.args;
            }
            if (newTile.cwd) { newTile.data.cwd = newTile.cwd; delete newTile.cwd; }

            flatList.push(newTile);
        });
        return flatList;
    }

    async function renderTiles() {
        tilesGrid.innerHTML = '';
        updateBreadcrumb();

        const searchTerm = searchInput.value.trim().toLowerCase();
        let tilesToRender;

        if (searchTerm) {
            tilesToRender = searchRecursive(allTiles, searchTerm);
        } else {
            tilesToRender = allTiles.filter(t => t.parentId === currentFolderId);
        }

        tilesToRender.sort((a, b) => a.order - b.order);

        if (tilesToRender.length === 0) {
            tilesGrid.innerHTML = `<p style="text-align: center; color: #ccc;">${searchTerm ? 'Nessun risultato trovato.' : 'Cartella vuota.'}</p>`;
            return;
        }

        for (const tile of tilesToRender) {
            const tileCard = await createTileCard(tile);
            tilesGrid.appendChild(tileCard);
        }
    }

    async function createTileCard(tile) {
        tile.data = tile.data || {};
        const tileCard = document.createElement('div');
        tileCard.className = 'tile-card';
        tileCard.dataset.id = tile.id;
        tileCard.setAttribute('draggable', 'true');

        // Ghost Tile Check
        if ((tile.kind === 'exe' || tile.kind === 'file') && tile.data.path) {
            // Non blocchiamo il rendering con await. Usiamo .then() per aggiornare la UI quando pronto.
            window.api.checkPath(tile.data.path).then(pathExists => {
                if (!pathExists) {
                    tileCard.classList.add('ghost');
                    const badge = document.createElement('span');
                    badge.className = 'ghost-badge';
                    badge.textContent = '⚠️';
                    tileCard.appendChild(badge);
                }
            });
        }

        // --- Drag & Drop Logic ---
        tileCard.addEventListener('dragstart', e => {
            draggedTileId = tile.id;
            e.dataTransfer.effectAllowed = 'move';
            setTimeout(() => tileCard.classList.add('dragging'), 0);
        });
        tileCard.addEventListener('dragend', () => {
            draggedTileId = null;
            document.querySelectorAll('.tile-card.drag-over').forEach(c => c.classList.remove('drag-over'));
            tileCard.classList.remove('dragging');
        });
        tileCard.addEventListener('dragover', e => {
            e.preventDefault();
            if (draggedTileId !== tile.id) e.dataTransfer.dropEffect = 'move';
        });
        tileCard.addEventListener('dragenter', e => {
            e.preventDefault();
            if (draggedTileId !== tile.id) tileCard.classList.add('drag-over');
        });
        tileCard.addEventListener('dragleave', e => {
            if (!tileCard.contains(e.relatedTarget)) tileCard.classList.remove('drag-over');
        });
        tileCard.addEventListener('drop', async e => {
            e.preventDefault();
            tileCard.classList.remove('drag-over');
            if (!draggedTileId || draggedTileId === tile.id) return;

            const draggedTile = allTiles.find(t => t.id === draggedTileId);
            const targetTile = tile;

            // Move to folder
            if (targetTile.kind === 'folder') {
                draggedTile.parentId = targetTile.id;
                draggedTile.order = (allTiles.filter(t => t.parentId === targetTile.id).length + 1) * 10;
            } else { // Reorder (insert between)
                const contextTiles = allTiles.filter(t => t.parentId === targetTile.parentId).sort((a, b) => a.order - b.order);
                const toIndex = contextTiles.findIndex(t => t.id === targetTile.id);

                // Calculate new order to insert "in between"
                // If dropping on a tile, we place it before that tile
                let newOrder;
                if (toIndex === 0) {
                    newOrder = targetTile.order / 2;
                } else {
                    const prevTile = contextTiles[toIndex - 1];
                    // If the previous tile is the dragged tile itself, we are moving it down, so look at the one before that
                    if (prevTile.id === draggedTile.id && toIndex > 1) {
                         newOrder = (contextTiles[toIndex - 2].order + targetTile.order) / 2;
                    } else {
                         newOrder = (prevTile.order + targetTile.order) / 2;
                    }
                }
                draggedTile.order = newOrder;
            }

            // Normalizzazione: Reimposta gli ordini a numeri interi (10, 20, 30...)
            // per evitare problemi con i decimali dopo molti spostamenti.
            const siblings = allTiles.filter(t => t.parentId === targetTile.parentId);
            siblings.sort((a, b) => a.order - b.order);
            siblings.forEach((t, index) => {
                t.order = (index + 1) * 10;
            });

            await saveTiles();
            await renderTiles();
        });

        // --- Visuals ---
        if (tile.kind === 'folder') {
            const previewDiv = document.createElement('div');
            previewDiv.className = 'folder-preview';
            const children = allTiles.filter(t => t.parentId === tile.id).slice(0, 4);
            children.forEach(child => {
                const miniTile = document.createElement('div');
                miniTile.className = 'mini-tile';
                if (child.style?.image) {
                    miniTile.style.backgroundImage = `url('${resolvePathForDisplay(child.style.image)}')`;
                } else if (child.style?.color) {
                    miniTile.style.backgroundColor = child.style.color;
                }
                previewDiv.appendChild(miniTile);
            });
            tileCard.appendChild(previewDiv);
        } else if (tile.style?.image) {
            tileCard.style.backgroundImage = `url('${resolvePathForDisplay(tile.style.image)}')`;
            tileCard.style.backgroundSize = 'cover';
            tileCard.style.backgroundPosition = 'center';
            const overlay = document.createElement('div');
            overlay.className = 'tile-card-image-overlay';
            tileCard.appendChild(overlay);
        } else if (tile.style?.color) {
            tileCard.style.backgroundColor = tile.style.color;
        } else {
            tileCard.style.backgroundColor = '#333';
        }

        const content = document.createElement('div');
        content.className = 'tile-card-content';
        const titleEl = document.createElement('h3');
        titleEl.className = 'tile-card-title';
        titleEl.textContent = tile.title;
        const subtitleEl = document.createElement('p');
        subtitleEl.className = 'tile-card-subtitle';
        subtitleEl.textContent = tile.subtitle;
        content.appendChild(titleEl);
        content.appendChild(subtitleEl);
        tileCard.appendChild(content);

        // --- Buttons ---
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'tile-delete-btn';
        deleteBtn.innerHTML = '🗑️';
        deleteBtn.title = 'Elimina';
        deleteBtn.addEventListener('click', e => {
            e.stopPropagation();
            if (confirm(`Sei sicuro di voler eliminare "${tile.title}"?`)) {
                allTiles = allTiles.filter(t => t.id !== tile.id);
                // Also delete children if it's a folder
                if (tile.kind === 'folder') {
                    // This needs a recursive delete function for nested folders
                    allTiles = allTiles.filter(t => t.parentId !== tile.id);
                }
                saveTiles();
                renderTiles();
            }
        });

        const editBtn = document.createElement('button');
        editBtn.className = 'tile-edit-btn';
        editBtn.innerHTML = '✏️';
        editBtn.title = 'Modifica';
        editBtn.addEventListener('click', e => {
            e.stopPropagation();
            openEditDialog(tile);
        });

        tileCard.appendChild(deleteBtn);
        tileCard.appendChild(editBtn);

        // --- Click Action ---
        tileCard.addEventListener('click', () => {
            if (tileCard.classList.contains('ghost')) {
                alert(`File non trovato per il tile "${tile.title}".`);
                return;
            }
            if (tile.kind === 'folder') {
                currentFolderId = tile.id;
                searchInput.value = '';
                renderTiles();
            } else {
                window.api.runTile(tile);
            }
        });

        return tileCard;
    }

    // --- UI Navigation & Search ---
    function updateBreadcrumb() {
        breadcrumbContainer.innerHTML = '';
        backBtn.style.display = currentFolderId ? 'flex' : 'none';

        if (!currentFolderId) {
            document.getElementById('app-title').style.display = 'block';
            return;
        }

        document.getElementById('app-title').style.display = 'none';
        let path = [];
        let current = allTiles.find(t => t.id === currentFolderId);
        while (current) {
            path.unshift(current);
            current = allTiles.find(t => t.id === current.parentId);
        }

        path.forEach((folder, index) => {
            const span = document.createElement('span');
            span.textContent = folder.title;
            breadcrumbContainer.appendChild(span);
            if (index < path.length - 1) {
                const separator = document.createElement('span');
                separator.className = 'breadcrumb-separator';
                separator.textContent = '>';
                breadcrumbContainer.appendChild(separator);
            }
        });
    }

    function searchRecursive(items, term) {
        let results = [];
        const searchIn = (item) => (item.title.toLowerCase().includes(term) || item.subtitle.toLowerCase().includes(term));

        for (const item of items) {
            if (searchIn(item)) {
                results.push(item);
            }
            if (item.kind === 'folder') {
                // For simplicity, we are not searching recursively in this implementation
                // but showing the folder if its name matches.
            }
        }
        return results;
    }

    // --- Dialog Management ---
    function openEditDialog(tile = null) {
        editingTileId = tile ? tile.id : null;
        tileForm.reset();
        dynamicFieldsDiv.innerHTML = '';

        if (tile) {
            document.getElementById('tile-title').value = tile.title;
            document.getElementById('tile-subtitle').value = tile.subtitle;
            document.getElementById('tile-kind').value = tile.kind;
            document.getElementById('tile-color').value = tile.style?.color || '';
            document.getElementById('tile-image').value = tile.style?.image || '';
        } else {
            tileKindSelect.value = 'url';
        }

        tileKindSelect.dispatchEvent(new Event('change'));

        if (tile) {
            // Pre-fill dynamic fields
            const data = tile.data || {};
            switch (tile.kind) {
                case 'url': document.getElementById('tile-data-url').value = data.url || ''; break;
                case 'exe':
                case 'file':
                    document.getElementById('tile-data-path').value = data.path || '';
                    if(document.getElementById('tile-data-args'))
                        document.getElementById('tile-data-args').value = (data.args || []).join(' ');
                    break;
                case 'command':
                    document.getElementById('tile-data-command').value = data.command || '';
                    document.getElementById('tile-data-args').value = (data.args || []).join(' ');
                    document.getElementById('tile-data-cwd').value = data.cwd || '';
                    break;
            }
        }
        addTileDialog.showModal();
    }

    tileKindSelect.addEventListener('change', () => {
        dynamicFieldsDiv.innerHTML = '';
        const kind = tileKindSelect.value;
        let fieldsHtml = '';
        switch (kind) {
            case 'url':
                fieldsHtml = `<div class="form-group"><label for="tile-data-url">URL:</label><input type="url" id="tile-data-url" required></div>`;
                break;
            case 'exe':
            case 'file':
                fieldsHtml = `
                    <div class="form-group"><label for="tile-data-path">Percorso:</label><input type="text" id="tile-data-path" required></div>
                    <div class="form-group"><label for="tile-data-args">Argomenti (opzionale):</label><input type="text" id="tile-data-args"></div>
                `;
                break;
            case 'command':
                fieldsHtml = `
                    <div class="form-group"><label for="tile-data-command">Comando:</label><input type="text" id="tile-data-command" required></div>
                    <div class="form-group"><label for="tile-data-args">Argomenti (separati da spazio):</label><input type="text" id="tile-data-args"></div>
                    <div class="form-group"><label for="tile-data-cwd">Directory di lavoro (opz.):</label><input type="text" id="tile-data-cwd"></div>
                `;
                break;
        }
        dynamicFieldsDiv.innerHTML = fieldsHtml;

        // Add listener for path input to auto-set folder image
        if (kind === 'exe' || kind === 'file') {
            const pathInput = document.getElementById('tile-data-path');
            pathInput.addEventListener('blur', async () => {
                const isDir = await window.api.isDirectory(pathInput.value);
                const imageInput = document.getElementById('tile-image');
                if (isDir && !imageInput.value) {
                    imageInput.value = 'https://www.pcprofessionale.it/wp-content/uploads/2018/12/Cartella.jpg';
                }
            });
        }
    });

    tileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = editingTileId || Date.now().toString();
        const kind = tileKindSelect.value;
        let data = {};

        switch (kind) {
            case 'url': data.url = document.getElementById('tile-data-url').value; break;
            case 'exe':
            case 'file':
                data.path = document.getElementById('tile-data-path').value;
                data.args = parseArgs(document.getElementById('tile-data-args').value);
                break;
            case 'command':
                data.command = document.getElementById('tile-data-command').value;
                data.args = parseArgs(document.getElementById('tile-data-args').value);
                data.cwd = document.getElementById('tile-data-cwd').value;
                data.shell = true;
                break;
        }

        const newOrUpdatedTile = {
            id,
            title: document.getElementById('tile-title').value,
            subtitle: document.getElementById('tile-subtitle').value,
            kind,
            parentId: currentFolderId,
            order: 0, // Will be recalculated
            style: {
                color: document.getElementById('tile-color').value || null,
                image: document.getElementById('tile-image').value || null,
            },
            data,
        };

        if (editingTileId) {
            const index = allTiles.findIndex(t => t.id === editingTileId);
            if (index > -1) {
                newOrUpdatedTile.parentId = allTiles[index].parentId; // Preserve parent
                newOrUpdatedTile.order = allTiles[index].order; // Preserve order
                allTiles[index] = newOrUpdatedTile;
            }
        } else {
            const siblings = allTiles.filter(t => t.parentId === currentFolderId);
            newOrUpdatedTile.order = (siblings.length > 0 ? Math.max(...siblings.map(s => s.order)) : 0) + 10;
            allTiles.push(newOrUpdatedTile);
        }

        await saveTiles();
        await renderTiles();
        addTileDialog.close();
    });

    // --- Notes & Calendar ---
    function initializeClock() {
        const update = () => {
            const now = new Date();
            clockDisplay.textContent = now.toLocaleTimeString('it-IT');
            const dateString = selectedNoteDate.toLocaleDateString('it-IT', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
            dateDisplay.textContent = dateString.charAt(0).toUpperCase() + dateString.slice(1);
        };
        setInterval(update, 1000);
        update();
    }

    function formatDateId(date) {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    }

    async function saveCurrentNote() {
        if (!isNoteDirty) return;
        const dateId = formatDateId(selectedNoteDate);
        const content = terminalInput.value;
        const result = await window.api.saveNote(dateId, content);
        if (result.success) {
            isNoteDirty = false;
            saveNoteBtn.classList.add('saved');
            setTimeout(() => saveNoteBtn.classList.remove('saved'), 1000);
        }
    }

    async function loadNoteForSelectedDate() {
        const dateId = formatDateId(selectedNoteDate);
        const result = await window.api.getNote(dateId);
        terminalInput.value = result.success ? result.content : '';
        isNoteDirty = false;
    }

    function renderCalendar(date) {
        const year = date.getFullYear();
        const month = date.getMonth();
        const monthName = date.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
        calendarMonthYear.textContent = monthName.charAt(0).toUpperCase() + monthName.slice(1);
        calendarGrid.innerHTML = '';

        const daysHeader = document.querySelector('.calendar-days-header');
        if (!daysHeader.innerHTML) {
            ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'].forEach(day => {
                daysHeader.innerHTML += `<div>${day}</div>`;
            });
        }

        const firstDay = (new Date(year, month, 1).getDay() + 6) % 7;
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        for (let i = 0; i < firstDay; i++) {
            calendarGrid.innerHTML += `<div class="calendar-day empty"></div>`;
        }

        const today = new Date();
        for (let i = 1; i <= daysInMonth; i++) {
            const dayCell = document.createElement('div');
            dayCell.className = 'calendar-day';
            dayCell.textContent = i;
            const thisDate = new Date(year, month, i);

            if (i === today.getDate() && month === today.getMonth() && year === today.getFullYear()) {
                dayCell.classList.add('today');
            }
            if (i === selectedNoteDate.getDate() && month === selectedNoteDate.getMonth() && year === selectedNoteDate.getFullYear()) {
                dayCell.classList.add('selected');
            }

            dayCell.addEventListener('click', async () => {
                await saveCurrentNote();
                selectedNoteDate = thisDate;
                await loadNoteForSelectedDate();
                renderCalendar(currentCalendarDate);
                initializeClock(); // Update footer date display
            });
            calendarGrid.appendChild(dayCell);
        }
    }

    // --- Event Listeners ---
    function initializeEventListeners() {
        addTileBtn.addEventListener('click', () => openEditDialog());
        cancelAddTileBtn.addEventListener('click', () => addTileDialog.close());
        searchInput.addEventListener('input', renderTiles);

        settingsBtn.addEventListener('click', () => {
            settingsDialog.showModal();
        });

        closeSettingsBtn.addEventListener('click', () => {
            settingsDialog.close();
        });

        // Export & Import Buttons
        const exportBtn = document.getElementById('export-data-btn');
        const importBtn = document.getElementById('import-data-btn');

        if (exportBtn) {
            exportBtn.addEventListener('click', async () => {
                const result = await window.api.exportData(allTiles);
                if (result.success) {
                    alert('Backup esportato con successo!');
                }
            });
        }

        if (importBtn) {
            importBtn.addEventListener('click', async () => {
                if (confirm('Attenzione: Importando un backup, tutti i riquadri attuali verranno sostituiti. Continuare?')) {
                    await window.api.importData();
                }
            });
        }

        backBtn.addEventListener('click', () => {
            const currentFolder = allTiles.find(t => t.id === currentFolderId);
            currentFolderId = currentFolder ? currentFolder.parentId : null;
            searchInput.value = '';
            renderTiles();
        });

        // Drag & Drop on Back Button (Move to parent/root)
        backBtn.addEventListener('dragover', e => {
            e.preventDefault();
            if (draggedTileId && currentFolderId) {
                e.dataTransfer.dropEffect = 'move';
                backBtn.classList.add('drag-over');
            }
        });

        backBtn.addEventListener('dragleave', () => {
            backBtn.classList.remove('drag-over');
        });

        backBtn.addEventListener('drop', async e => {
            e.preventDefault();
            backBtn.classList.remove('drag-over');
            if (draggedTileId && currentFolderId) {
                const tile = allTiles.find(t => t.id === draggedTileId);
                if (tile) {
                    // Move to parent of current folder (which is null if current folder is in root)
                    // But since we only support 1 level nesting effectively or flat structure with parentId,
                    // we need to find the parent of the current folder.
                    const currentFolder = currentFolderId ? allTiles.find(t => t.id === currentFolderId) : null;
                    tile.parentId = currentFolder ? currentFolder.parentId : null;

                    // Recalculate order to be at the end of the new list
                    const siblings = allTiles.filter(t => t.parentId === tile.parentId);
                    tile.order = (siblings.length > 0 ? Math.max(...siblings.map(s => s.order)) : 0) + 10;

                    await saveTiles();
                    await renderTiles();
                }
            }
        });

        // Notes & Calendar
        dateDisplay.addEventListener('click', () => {
            calendarPopup.style.display = calendarPopup.style.display === 'none' ? 'block' : 'none';
            if (calendarPopup.style.display === 'block') {
                renderCalendar(currentCalendarDate);
            }
        });
        prevMonthBtn.addEventListener('click', () => {
            currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
            renderCalendar(currentCalendarDate);
        });
        nextMonthBtn.addEventListener('click', () => {
            currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
            renderCalendar(currentCalendarDate);
        });
        terminalInput.addEventListener('input', () => {
            isNoteDirty = true;
            clearTimeout(noteSaveTimeout);
            noteSaveTimeout = setTimeout(saveCurrentNote, 2000); // 2s debounce
        });
        terminalInput.addEventListener('blur', saveCurrentNote);
        saveNoteBtn.addEventListener('click', saveCurrentNote);
        openNotesBtn.addEventListener('click', () => window.api.openNotesFolder());

        window.addEventListener('beforeunload', (e) => {
            if (isNoteDirty) {
                // Attempt to save synchronously. This is not guaranteed to work.
                saveCurrentNote();
            }
        });
    }
});
