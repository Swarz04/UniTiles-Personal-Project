# UniTiles 🎓

Ciao! Questo è **UniTiles**, il mio progetto personale per gestire link, programmi e file utili per l'università (e il tempo libero) in un'unica interfaccia comoda e veloce.

È un'applicazione desktop costruita con **Electron**, pensata per essere semplice, funzionale e personalizzabile.

## ✨ Funzionalità

*   **🔗 Collegamenti Web**: Salva i link ai portali universitari, GitHub, Google, ecc.
*   **🚀 Programmi (.exe)**: Lancia le tue applicazioni preferite (VS Code, Steam, ecc.) direttamente dalla griglia.
*   **💻 Comandi**: Esegui comandi da terminale (utile per avviare server locali, Jupyter Lab, script Python, ecc.).
*   **📂 File Locali**: Tieni a portata di mano PDF, appunti e documenti importanti.
*   **🎨 Personalizzazione**: Cambia titoli, sottotitoli, colori e immagini di sfondo per ogni riquadro.
*   **🖱️ Drag & Drop**: Tieni premuto e trascina per riordinare i riquadri come sul telefono!

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

*   I dati dei tuoi riquadri vengono salvati automaticamente in un file `tiles.json` nella cartella dei dati utente del tuo sistema operativo (su Windows è in `%AppData%\UniTiles`), quindi le tue modifiche rimangono salvate anche se chiudi l'app.
*   Se sposti l'applicazione su un altro PC, ricordati di reinstallare le dipendenze con `npm install`.

---

*Progetto realizzato da A. Scharmüller*
