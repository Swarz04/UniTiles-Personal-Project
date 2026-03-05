# UniTiles 🎓

Ciao! Questo è **UniTiles**, il mio progetto personale per gestire link, programmi e file utili per l'università (e il tempo libero) in un'unica interfaccia comoda e veloce.

È un'applicazione desktop costruita con **Electron**, pensata per essere semplice, funzionale e personalizzabile.

## ✨ Funzionalità

*   **🔗 Collegamenti Web**: Salva i link ai portali universitari, GitHub, Google, ecc.
*   **🚀 Programmi (.exe)**: Lancia le tue applicazioni preferite (VS Code, Steam, ecc.) direttamente dalla griglia.
*   **💻 Comandi**: Esegui comandi da terminale complessi (utile per avviare server locali, Jupyter Lab, script Python, ecc.) con supporto per argomenti e variabili d'ambiente.
*   ** File Locali**: Tieni a portata di mano PDF, appunti e documenti importanti.
*   **☁️ Integrazione OneDrive**: I percorsi dei file su OneDrive vengono rilevati automaticamente su diversi dispositivi.
*   **🎨 Personalizzazione**: Cambia titoli, sottotitoli, colori e immagini di sfondo per ogni riquadro.
*   **🖱️ Drag & Drop Avanzato**:
    *   Riordina i riquadri trascinandoli (inserimento tra tile).
    *   Crea **Cartelle** trascinando un riquadro sopra un altro.
    *   Sposta elementi fuori dalle cartelle trascinandoli sul pulsante "Indietro".
*   **⚙️ Impostazioni**: Visualizza le informazioni sulla versione e sull'autore.
*   **📦 Importa / Esporta**: Crea backup completi (.zip) della tua configurazione, incluse le immagini personalizzate, per trasferirle facilmente su altri dispositivi.
*   ** Terminale Note & Calendario**:
    *   **Sidebar Dedicata**: Un'area di testo persistente nella colonna laterale per appunti rapidi.
    *   **Calendario Interattivo**: Clicca sulla data per cambiare giorno e vedere le note passate.
    *   **Versioning & Salvataggio**: Il sistema mantiene fino a 3 versioni storiche per ogni nota giornaliera (sovrascrittura ciclica). Il salvataggio avviene manualmente o al cambio data.
    *   **Accesso Rapido**: Pulsante per aprire direttamente la cartella contenente i file di testo delle note.

## 🛠️ Installazione

Assicurati di avere [Node.js](https://nodejs.org/) installato sul tuo computer.

1.  Clona questo repository o scarica i file.
2.  Apri il terminale (PowerShell, CMD, ecc.) nella cartella del progetto.
3.  Installa le dipendenze necessarie (principalmente Electron):

```bash
npm install
```

## ▶️ Utilizzo

Per avviare l'applicazione:

```bash
npm start
```



## 📝 Note

*   **Salvataggio Dati**: I dati dei tuoi riquadri (`tiles.json`) e le tue **note** vengono salvati automaticamente nella cartella dei dati utente del tuo sistema operativo (su Windows è in `%AppData%\UniTiles`). Questo assicura che i tuoi dati siano al sicuro anche se aggiorni o sposti la cartella del programma.
*   Se scarichi l'applicazione da Git su un altro PC, ricordati di entrare nella cartella e lanciare `npm install` per scaricare le dipendenze necessarie.

## 📦 Creare l'eseguibile (.exe)

Se vuoi creare un file di installazione per Windows:

1.  Installa lo strumento di build (se non lo hai già fatto):
    ```bash
    npm install electron-builder --save-dev
    ```

2.  Assicurati che il tuo `package.json` abbia lo script di build:
    ```json
    "scripts": {
      "dist": "electron-builder"
    },
    "build": {
      "nsis": {
        "artifactName": "${productName} Setup.${ext}"
      }
    }
    ```
    > **Nota:** La configurazione `artifactName` dentro `nsis` serve a generare un file di installazione con nome fisso (es. `UniTiles Setup.exe`) invece di includere la versione. In questo modo, ogni nuova build sovrascriverà la precedente senza lasciare vecchi file.

3.  Genera l'eseguibile:
    ```bash
    npm run dist
    ```
    Troverai il file `.exe` nella cartella `dist` che verrà creata.

## 📜 Changelog

### v2.1.0
*   **Nuova Sidebar Note**: Spostata l'area note in una colonna laterale ridimensionabile a sinistra per una migliore organizzazione.
*   **Layout Responsive**: L'interfaccia ora si adatta fluidamente a finestre di qualsiasi dimensione.
*   **Footer Migliorato**: Barra di stato fissa in basso con orologio e data sempre visibili.
*   **Miglioramenti UI**: Font e colori aggiornati per una migliore leggibilità.

---

*Progetto realizzato da A. Scharmüller*
