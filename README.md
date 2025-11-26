# Amőba Online (Gomoku)

Online multiplayer amőba játék valós idejű kapcsolattal.

## Funkciók

- 15x15-ös játéktábla
- Valós idejű multiplayer Socket.IO használatával
- Szoba-alapú játék (több játékos különböző szobákban)
- Automatikus győzelem detektálás (5 egy sorban)
- Döntetlen kezelés
- Reszponzív design
- Szép, modern felhasználói felület

## Telepítés

1. Telepítsd a függőségeket:
```bash
npm install
```

## Futtatás

### Fejlesztői mód (automatikus újraindítással):
```bash
npm run dev
```

### Produkciós mód:
```bash
npm start
```

A szerver alapértelmezetten a `http://localhost:3000` címen indul el.

## Hogyan játsszunk?

1. Nyisd meg a böngészőt és látogasd meg a `http://localhost:3000` címet
2. Add meg a neved
3. Adj meg egy szoba azonosítót (pl: "room1")
4. Oszd meg a szoba azonosítót egy baráttal
5. A barátod ugyanazzal a szoba azonosítóval csatlakozzon
6. A játék automatikusan elindul, amikor mindkét játékos csatlakozott
7. X (fekete) kezd
8. Kattints a táblára egy bábu elhelyezéséhez
9. Az nyer, aki először tesz 5-öt egy sorba (vízszintesen, függőlegesen vagy átlósan)

## Technológiák

- **Backend**: Node.js, Express, Socket.IO
- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Kommunikáció**: WebSocket (Socket.IO)

## Projekt struktúra

```
amoba2/
├── server.js           # Backend szerver és játék logika
├── package.json        # Projekt konfiguráció
├── public/
│   ├── index.html     # Főoldal
│   ├── style.css      # Stílusok
│   └── game.js        # Client-side játék logika
└── README.md          # Dokumentáció
```

## Játékszabályok

- A játékosok felváltva tesznek bábut a táblára
- X (fekete) mindig kezd
- Az nyer, aki először tesz 5 egymás melletti bábut egy sorba
- A 5 bábu lehet vízszintes, függőleges vagy átlós sorban
- Ha a tábla megtelik győztes nélkül, a játék döntetlennel ér véget

## Fejlesztési lehetőségek

- [ ] Chat funkció a játékosok között
- [ ] Játék történet (replay)
- [ ] Időlimit a lépésekhez
- [ ] Ranglétra/statisztika
- [ ] Több táblméret opció
- [ ] Mobilos optimalizálás
- [ ] Játék mentés és betöltés
