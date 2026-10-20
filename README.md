# Jigsaw Together (jigsaw-coop)

A real-time cooperative jigsaw puzzle for 2–4 players. Rooms are separated by a 6-digit PIN.
The interface is in English with a one-click switch to Thai (EN | ไทย).

- **Web app:** Vite + React + HTML5 Canvas (`client/`)
- **Server:** Node.js + Express + Socket.IO (`server/`). State is kept in memory, so no database is needed.

## Run locally

Requires Node.js 18 or newer.

```bash
npm install        # installs server and client together (npm workspaces)
npm run dev        # starts the server (3001) and the web app (5173)
```

Open http://localhost:5173, then open a second tab (or an Incognito window) to play as the second player.
Each tab counts as a separate player.

**Testing on a phone:** join the same Wi-Fi as your computer and open `http://<your computer's IP>:5173`.
The "Use a sample image" button in the lobby lets you test quickly without hunting for a picture.

```bash
npm run test:smoke   # end-to-end server test: create room -> kick -> start -> solve
```

## Project layout

```
server/
  index.js        HTTP + Socket.IO: rooms, lobby, kick/leave, image upload, in-game events
  rooms.js        room/player model, PIN generation, data sent to clients
  game.js         piece creation, grab/move/drop, snap detection (the server is the referee)
  config.js       all tunable settings (minimum players, difficulty, snap distance, ...)
  smoke-test.mjs  automated test
client/src/
  i18n.jsx        English and Thai text, language switch (add a language by adding a dictionary)
  screens/        Home, Lobby, Game
  components/     Cropper (aspect-ratio crop), Confetti, Logo, Segmented, LangToggle
  gameStore.js    fast-changing piece state (kept outside React)
  useRoom.js      connects the socket to React, auto-rejoin
```

## How it plays

- The room creator is the **host**: sets max players (2–4) and difficulty, kicks players, and starts the game (needs at least 2 players and an image).
- Anyone in the lobby can add an image; the latest one replaces the previous. It must be cropped to an aspect ratio first (1:1, 3:4, 4:3, 5:6, 6:5, 2:3, 3:2, 9:16, 16:9).
- Players can leave a room at any time. If the host leaves, host rights pass to the next player who joined.
- Nobody can join once the game has started.
- The player name can only be set on the home page (duplicates in a room get " 2", " 3", ...).
- A piece someone is holding gets a border in that player's color plus a name tag, so everyone sees who is moving what.
- **The background picture is hidden during play.** The **Show hint** button reveals a faint copy of the picture and the cell grid behind the board; press it again to hide them. The hint is per player. The strength is `HINT_ALPHA` at the top of `client/src/screens/Game.jsx`.
- If you lose connection or refresh, you rejoin your room automatically (20 seconds of grace in the lobby, 3 minutes during a game).
- When the puzzle is complete: confetti, a summary of time and pieces placed per player, and a button back to the home page.

Change settings in `server/config.js`, for example `MIN_PLAYERS_TO_START: 1` to start solo while testing.

## Deploy

You need a host that keeps WebSocket connections open (Render, Railway, Fly.io). Serverless-style Vercel does not work.
The server also serves the built web app, so it is a single service:

```
Build command:  npm install --include=dev && npm run build
Start command:  npm start
Health check:   /healthz
```

If the web app and server are on different domains, set `VITE_SERVER_URL` at build time for the web app
and `CLIENT_ORIGIN` (comma-separated for several) on the server.

## Security measures

- The server validates every input (name, PIN, positions, file type: JPEG only, magic bytes checked, 5 MB limit).
- Host-only actions (start, kick, settings) are always checked on the server.
- PINs are generated with `crypto.randomInt`, and failed attempts are limited per IP (8 per minute) to prevent PIN guessing.
- The `clientId` used for reconnecting is a secret and is never sent to other players, who only see a public id.

## Ideas for next steps

- Real jigsaw-shaped pieces (currently squares): draw them with Path2D in `Game.jsx`; snap detection stays the same.
- Zoom and pan on phones, a sound when a piece snaps into place, "play again" without leaving the room.
- Running more than one server: move room state to Redis and add the Socket.IO Redis adapter.
