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
*   **📝 Terminale Note & Calendario**:
    *   Un'area di testo persistente nel footer per appunti rapidi.
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

---

*Progetto realizzato da A. Scharmüller*
