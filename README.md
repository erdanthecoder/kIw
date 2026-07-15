# 🎮 CouchPlay — your free living-room console

CouchPlay turns any big screen into a game console and everyone's phone into a
controller. Like AirConsole — but free, open, and with an ultra-low-lag
peer-to-peer connection. **16 games, up to 8 players**, no downloads, no accounts.

## How it works

1. **Console (big screen)** — open `console.html` on a TV, laptop, or projector.
   It shows a 4-letter room code and a QR code.
2. **Controller (phones/tablets/laptops)** — friends open `controller.html`,
   type the code (or scan the QR), and their device becomes the gamepad.
3. The host picks a game on the console — every controller morphs into the
   right control layout automatically (joystick, buttons, quiz pad, drawing
   canvas, or a full first-person 3D view for the 3D games).

### Networking: P2P first, relay as backup

- **P2P (WebRTC via PeerJS)** — controllers connect *directly* to the console.
  Lowest possible lag. Works even on a fully static host (e.g. GitHub Pages).
- **Server relay (WebSockets)** — if P2P is blocked (strict school/office
  networks), controllers automatically fall back to the bundled Node relay.
  The console registers on **both** transports at once, so mixed rooms work.

## The 16 games

| | Game | Controls | What it is |
|---|---|---|---|
| ⛏️ | **CraftWorld 3D** | first-person 3D | Shared voxel island — build & break together, Minecraft-style |
| 🏃 | **Obby Rush 3D** | first-person 3D | Race a 3D obstacle course over lava — checkpoints & moving platforms |
| 🐦 | **Flappy Royale** | tap | Everyone flaps at once, last bird alive wins |
| 🐍 | **Snake.io** | joystick | Grow your snake, cut off your friends |
| 🛡️ | **Tank Battle** | stick + fire | Bouncing shells, walls, most kills wins |
| 💣 | **Bomber Blast** | d-pad + bomb | Classic grid bomber with power-ups |
| 🔫 | **Laser Tag** | stick + laser | Instant bouncing beams, freeze your rivals |
| 🧠 | **Trivia Show** | 4 answer buttons | Questions on the TV, answers on your phone, speed = points |
| 🎨 | **Draw & Guess** | draw / guess | Sketch on your phone, it appears on the TV live |
| ⚡ | **Reaction Duel** | tap | Wait for green… TAP! False starts punished |
| ⚽ | **Rocket Soccer** | stick + boost | 2 auto-teams, 1 ball, chaos |
| 🏎️ | **Kart Dash** | stick + nitro | Top-down oval racing, 3 laps |
| 🏓 | **Pong Royale** | joystick | Everyone guards an arc of the circle, 3 lives |
| 🧱 | **Tetris Battle** | tetris pad | Clear lines to dump garbage on rivals |
| 🟢 | **Blob Arena** | joystick | Agar-style: eat orbs, eat smaller players |
| 🔴 | **Dodgeball Panic** | joystick | The arena fills with bouncing balls — survive |

Player 1 can even browse the game menu from their phone (joystick + A).

## Run it

### Option A — full experience (P2P + relay fallback)

```bash
npm install
npm start          # http://localhost:8080
```

Open `http://<your-ip>:8080/console.html` on the big screen; phones on the same
Wi-Fi join at `http://<your-ip>:8080/controller.html` (the QR code handles this).

### Option B — 100% static, zero server (e.g. GitHub Pages)

Host the repo as static files and open `console.html`. P2P handles everything —
no backend needed. (The relay fallback simply won't be available.)

> 📱 Phone browsers need HTTPS (or localhost) for some features; GitHub Pages
> gives you HTTPS for free.

## Tech

- Vanilla JS + Canvas 2D for the 14 arcade games — zero build step.
- [three.js](https://threejs.org) for the two 3D games. The voxel world and the
  obby course are generated **deterministically from a seed**, so every device
  builds the identical map and only tiny position/edit packets travel the wire.
- [PeerJS](https://peerjs.com) for WebRTC data channels, `ws` for the relay.
- All libraries are vendored in `lib/` — CouchPlay works on an offline LAN.

## Project layout

```
index.html            landing page (choose console / controller)
console.html          the big-screen app
controller.html       the phone gamepad app
server.js             static hosting + WebSocket relay (optional)
css/style.css         PS5-inspired dark UI
js/net.js             transport layer (P2P + relay, auto-fallback)
js/console-app.js     lobby, room, game lifecycle
js/controller-app.js  gamepad schemes (stick/tap/quiz/draw/tetris/…)
js/engine3d.js        voxel engine, obby generator, physics, avatars
js/ctrl3d.js          first-person 3D client for the controllers
js/games/*.js         one file per game (host side)
lib/                  vendored peerjs / three / qrcode
```
