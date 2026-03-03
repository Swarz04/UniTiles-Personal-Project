/**
 * UniTiles - Renderer Process
 * Author: A. Scharmüller
 */
document.addEventListener('DOMContentLoaded', async () => {
    // Get DOM elements
    const tilesGrid = document.getElementById('tiles-grid');
    const addTileBtn = document.getElementById('add-tile-btn');
    const addTileDialog = document.getElementById('add-tile-dialog');
    const searchInput = document.getElementById('search-input');
    const cancelAddTileBtn = document.getElementById('cancel-add-tile-btn');
    const tileForm = document.getElementById('tile-form');
    const tileTypeSelect = document.getElementById('tile-type');
    const dynamicFieldsDiv = document.getElementById('dynamic-fields');

    let homeDir = ''; // Will store the user's home directory
    let tiles = [];
    let editingTileId = null; // New: To keep track of the tile being edited
    let draggedTileId = null; // Per tracciare il tile che si sta trascinando

    // Function to render tiles
    async function renderTiles() {
        tilesGrid.innerHTML = ''; // Clear existing tiles
        console.log('[app.js] Rendering tiles. Current tiles array:', tiles); // Log the tiles array

        const searchTerm = searchInput.value.trim().toLowerCase();
        const filteredTiles = tiles.filter(tile => tile.title.toLowerCase().includes(searchTerm));

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
                    const fromIndex = tiles.findIndex(t => t.id === draggedTileId);
                    const toIndex = tiles.findIndex(t => t.id === tile.id);

                    if (fromIndex > -1 && toIndex > -1) {
                        // Sposta l'elemento nell'array
                        const [movedTile] = tiles.splice(fromIndex, 1);
                        tiles.splice(toIndex, 0, movedTile);

                        // Salva e renderizza di nuovo
                        await saveTiles();
                        renderTiles();
                    }
                }
            });
            // --- Fine Logica Drag & Drop ---

            // Apply background style
            if (tile.style && tile.style.image) {
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
                const result = await window.api.runTile(tile);
                if (!result.success) {
                    alert(`Errore nell'esecuzione di "${tile.title}":\n${result.error}`);
                }
            });

            tilesGrid.appendChild(tileCard);
        });
    }

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
            tiles = tiles.filter(tile => tile.id !== id);
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
        switch (tile.type) {
            case 'url':
                console.log('[app.js] Pre-filling URL:', tile.url);
                document.getElementById('tile-url').value = tile.url;
                break;
            case 'exe':
                // Replace homeDir back to placeholder for display in form
                const exePathForDisplay = tile.path.replace(new RegExp(homeDir.replace(/\\/g, '\\\\'), 'g'), placeholder);
                console.log('[app.js] Pre-filling EXE Path:', exePathForDisplay, 'Args:', tile.args);
                document.getElementById('tile-path').value = exePathForDisplay;
                document.getElementById('tile-args').value = tile.args || '';
                break;
            case 'command':
                const cwdForDisplay = tile.cwd ? tile.cwd.replace(new RegExp(homeDir.replace(/\\/g, '\\\\'), 'g'), placeholder) : '';
                console.log('[app.js] Pre-filling Command:', tile.cmd, 'Args:', tile.args, 'CWD:', cwdForDisplay);
                document.getElementById('tile-cmd').value = tile.cmd;
                document.getElementById('tile-cmd-args').value = tile.args || '';
                if (tile.cwd) {
                    document.getElementById('tile-cwd').value = cwdForDisplay;
                }
                break;
            case 'file':
                const filePathForDisplay = tile.path.replace(new RegExp(homeDir.replace(/\\/g, '\\\\'), 'g'), placeholder);
                console.log('[app.js] Pre-filling File Path:', filePathForDisplay);
                document.getElementById('tile-file-path').value = filePathForDisplay;
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
            targetTile = tiles.find(t => t.id === editingTileId);
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
            targetTile.style.image = image;
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
                targetTile.path = path.replace(new RegExp(placeholder, 'g'), homeDir);
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
                    targetTile.cwd = cwd.replace(new RegExp(placeholder, 'g'), homeDir);
                }
                break;
            case 'file':
                const filePath = document.getElementById('tile-file-path').value.trim();
                console.log('[app.js] Saving File type. Path:', filePath);
                if (!filePath) { alert('Il percorso del file è obbligatorio per il tipo File Locale.'); return; }
                targetTile.path = filePath.replace(new RegExp(placeholder, 'g'), homeDir);
                break;
        }

        if (!editingTileId) {
            tiles.push(targetTile); // Only push if it's a new tile
        }
        await saveTiles();
        renderTiles();
        addTileDialog.close();
        editingTileId = null; // Reset after saving
    });

    // Initial load of tiles
    homeDir = await window.api.getHomeDir(); // Get home directory once at startup
    loadTiles();
});
