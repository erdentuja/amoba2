# CLAUDE.md - AI Assistant Guide for Amőba Online

## Project Overview

**Amőba Online** is a real-time multiplayer Gomoku (Five in a Row) game built with Node.js and Socket.IO. Players compete in room-based matches on configurable board sizes (9x9, 13x13, 15x15, 19x19) with features including undo moves, turn timers, admin management, and sound effects.

### Tech Stack
- **Backend**: Node.js, Express, Socket.IO
- **Frontend**: Vanilla JavaScript, HTML5 Canvas, CSS3, Web Audio API
- **Deployment**: Docker, Docker Compose (OpenMediaVault-ready)
- **Real-time Communication**: WebSocket via Socket.IO

---

## Repository Structure

```
amoba2/
├── server.js              # Backend server, game logic, Socket.IO handlers
├── package.json           # Project dependencies and scripts
├── Dockerfile             # Docker image configuration
├── docker-compose.yml     # Docker Compose orchestration
├── .gitignore            # Git ignore patterns
├── .dockerignore         # Docker ignore patterns
├── README.md             # User documentation (Hungarian)
└── public/               # Static frontend files
    ├── index.html        # Main UI structure
    ├── style.css         # Styling and responsive design
    └── game.js           # Client-side game logic and Socket.IO client
```

### Key Files

#### `server.js` (598 lines)
**Core backend logic including:**
- **GameRoom class** (lines 30-220): Manages game state, board, players, moves, win detection, timer
  - Methods: `addPlayer()`, `makeMove()`, `checkWin()`, `undoMove()`, `reset()`, timer management
  - Properties: `board`, `players`, `currentPlayer`, `gameOver`, `winner`, `moveHistory`
- **Socket.IO event handlers** (lines 271-591):
  - Player: `login`, `createRoom`, `joinRoom`, `makeMove`, `undoMove`, `resetGame`, `disconnect`
  - Admin: `adminLogin`, `adminKickPlayer`, `adminCloseRoom`, `adminSetTimer`
- **State management**: Rooms map, connected clients tracking, online players tracking
- **Global timer settings**: Configurable turn timer (enabled/disabled, duration)

#### `public/game.js` (731 lines)
**Client-side game logic:**
- **Canvas rendering** (lines 466-549): Draws board grid, star points, pieces with gradients
- **Socket.IO client handlers** (lines 163-668): Syncs game state, handles room updates, admin functions
- **Sound system** (lines 38-131): Web Audio API-based sound effects (click, win, error, gameStart)
- **Timer display** (lines 352-389): Visual countdown with color-coded urgency
- **Admin panel** (lines 558-727): Player management, room management, timer configuration

#### `public/index.html` (142 lines)
**UI structure with three main views:**
- Login screen (lines 62-72)
- Lobby with room creation and waiting rooms list (lines 75-103)
- Game area with canvas, player info, timer, controls (lines 105-135)
- Admin panel (lines 28-59)

---

## Game Architecture

### Socket.IO Communication Flow

**Player Lifecycle:**
```
Connection → login → (createRoom | joinRoom) → makeMove ↔ gameState → disconnect
```

**Key Events:**
- **Client→Server**: `login`, `createRoom`, `joinRoom`, `makeMove`, `undoMove`, `resetGame`
- **Server→Client**: `loginSuccess`, `roomCreated`, `gameState`, `message`, `error`, `roomsList`
- **Admin Events**: `adminLogin`, `adminKickPlayer`, `adminCloseRoom`, `adminSetTimer`, `onlinePlayers`, `timerSettings`

### Game State Management

**Server-side state:**
- `rooms` Map: roomId → GameRoom instance
- `connectedClients` Map: socketId → {name, isAdmin, connectedAt, createdRoom, room}
- `loggedInPlayers` Map: socketId → {name, loggedInAt}
- `globalTimerSettings`: {enabled, duration}

**Client-side state:**
- `gameState`: Received from server, contains board, players, currentPlayer, timer info
- `myPlayerId`, `myPlayerName`, `isLoggedIn`, `isAdmin`
- `soundEnabled`: Persisted to localStorage

### Room Management

**Room Creation Flow:**
1. Player logs in → `login` event
2. Player creates room → `createRoom` event → Room created but player NOT joined
3. Room added to waiting rooms list → Broadcast `roomsList`
4. Player or others join → `joinRoom` event
5. When 2 players joined → Game starts, timer begins (if enabled)

**Important**: A player can only create ONE room at a time (tracked via `createdRoom` property)

### Win Detection Algorithm

**`checkWin()` method** (server.js:97-134):
- Checks 4 directions from last move: horizontal, vertical, diagonal \, diagonal /
- Counts consecutive pieces in both directions along each axis
- Requires exactly 5 in a row to win (standard Gomoku rules)
- Only checks after a move is made, not the entire board

---

## Development Workflows

### Local Development

```bash
# Install dependencies
npm install

# Start development server (with auto-reload)
npm run dev

# Start production server
npm start

# Access application
http://localhost:3000
```

**Development server**: Uses nodemon for automatic reload on file changes

### Docker Deployment

```bash
# Build and run with Docker Compose
docker-compose up -d

# View logs
docker logs -f amoba-online

# Stop container
docker-compose down
```

**Docker configuration:**
- Node.js 20 Alpine base image (minimal size)
- Health checks every 30s
- Exposes port 3000
- Restart policy: unless-stopped
- Production mode with `NODE_ENV=production`

### Environment Variables

Set via `.env` file or Docker environment:
- `PORT`: Server port (default: 3000)
- `ADMIN_CODE`: Admin panel access code (default: `admin123` - **CHANGE IN PRODUCTION**)
- `NODE_ENV`: Environment mode (production/development)

---

## Coding Conventions & Patterns

### Code Style

**Server-side (server.js):**
- Class-based game logic (`GameRoom` class)
- Functional helpers for state management
- Event-driven Socket.IO handlers
- Hungarian-language error messages for users

**Client-side (game.js):**
- Procedural style with clear function separation
- Global state variables at top
- Event listeners setup in dedicated functions
- Canvas rendering with HTML5 Canvas API

### Naming Conventions

- **Variables**: camelCase (e.g., `gameState`, `currentPlayer`)
- **Functions**: camelCase verbs (e.g., `handleLogin`, `drawBoard`, `updateGameDisplay`)
- **Classes**: PascalCase (e.g., `GameRoom`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `BOARD_SIZE`, `CELL_SIZE`)
- **Socket events**: camelCase (e.g., `makeMove`, `adminKickPlayer`)

### Error Handling

**Server-side:**
```javascript
// Always return error objects from game logic
{ success: false, error: 'Error message' }

// Emit errors to client
socket.emit('error', 'User-friendly error message');
```

**Client-side:**
```javascript
// Show errors via alert and sound effect
socket.on('error', (error) => {
  sounds.error();
  alert(error);
});
```

### State Updates

**Critical pattern:** Always emit `gameState` after state changes:
```javascript
// Server
const result = room.makeMove(socket.id, row, col);
if (result.success) {
  io.to(socket.roomId).emit('gameState', room.getState());
}

// Client automatically updates on receiving gameState
socket.on('gameState', (state) => {
  gameState = state;
  updateGameDisplay();
});
```

---

## Key Features & Implementation Details

### 1. Timer System

**Implementation:**
- Global settings in `globalTimerSettings` (enabled, duration)
- Per-room timer tracking with `timerEndTime` and `timer` timeout
- Timer starts after each move, auto-skips turn on expiry
- Client displays countdown with color coding (green → orange → red)

**Files:**
- Server: `server.js:10-14, 169-195`
- Client: `game.js:352-389, 452-460`

### 2. Undo Move

**Implementation:**
- Move history stored in `room.moveHistory` array
- Undo pops last move, reverts board, switches player back
- Disabled after game over
- Button enabled/disabled based on `gameState.canUndo`

**Files:**
- Server: `server.js:145-167, 435-455`
- Client: `game.js:339-343, 447-449`

### 3. Sound Effects

**Implementation:**
- Web Audio API with procedural sound generation (no audio files)
- Four sound types: click (move), win (victory melody), gameStart, error
- Toggle persisted to localStorage
- Auto-resume AudioContext on user interaction (browser policy)

**Files:**
- Client: `game.js:38-131, 304-313`

### 4. Admin Panel

**Features:**
- Password-protected access (uses `ADMIN_CODE`)
- View online players with room assignments
- Kick players (disconnects socket)
- Close rooms (kicks all players, deletes room)
- Configure global timer settings
- Real-time updates via Socket.IO

**Files:**
- Server: `server.js:337-550`
- Client: `game.js:558-727`
- UI: `index.html:17-59`

### 5. Dynamic Board Sizes

**Supported sizes:** 9x9, 13x13, 15x15 (default), 19x19

**Implementation:**
- Board size set during room creation
- Canvas dynamically resized based on `BOARD_SIZE * CELL_SIZE`
- Star points positioned differently per board size (traditional Go board style)

**Files:**
- Server: `server.js:31, 303-324`
- Client: `game.js:2-4, 296-301, 490-505`

---

## Common Development Tasks

### Adding a New Socket.IO Event

**Server-side (server.js):**
```javascript
socket.on('eventName', (data) => {
  // Validate data
  // Perform logic
  // Emit response or broadcast
  io.to(roomId).emit('response', result);
});
```

**Client-side (game.js):**
```javascript
// Send event
socket.emit('eventName', { data });

// Handle response
socket.on('response', (result) => {
  // Update UI
});
```

### Modifying Game Rules

**Win condition**: Edit `checkWin()` method in server.js:97-134
**Board logic**: Edit `GameRoom` class methods in server.js:30-220
**UI rendering**: Edit `drawBoard()` and `drawPiece()` in game.js:466-549

### Adding UI Features

1. Add HTML structure to `public/index.html`
2. Add styles to `public/style.css`
3. Add client logic to `public/game.js`
4. Add server handling to `server.js` if needed
5. Test with 2+ browser windows

### Modifying Timer Behavior

**Server-side:**
- Global settings: `server.js:10-14`
- Timer logic: `GameRoom.startTimer()`, `GameRoom.clearTimer()` (server.js:169-195)
- Admin controls: `adminSetTimer` handler (server.js:522-550)

**Client-side:**
- Display: `updateTimerDisplay()` (game.js:369-389)
- Countdown: `startTimer()` interval (game.js:352-360)

---

## Testing & Debugging

### Local Testing

**Multi-player testing:**
```bash
# Terminal 1: Start server
npm run dev

# Browser: Open multiple tabs/windows
http://localhost:3000
```

**Test scenarios:**
- Two players joining same room
- Win detection (horizontal, vertical, diagonal)
- Undo move
- Timer expiry
- Admin panel functionality
- Room creation limits (one per player)
- Disconnect handling

### Common Issues

**Issue**: Canvas not rendering properly
- **Check**: `BOARD_SIZE`, `CELL_SIZE`, `CANVAS_SIZE` consistency
- **Fix**: Ensure canvas dimensions match board size after resize

**Issue**: Socket connection fails
- **Check**: Server running, port 3000 available
- **Fix**: Verify `PORT` environment variable, check firewall

**Issue**: Timer not displaying
- **Check**: `globalTimerSettings.enabled`, game has 2 players
- **Fix**: Admin panel → Enable timer, join game with 2 players

**Issue**: Moves not working
- **Check**: Game state, current player, cell availability
- **Debug**: Console log `gameState`, check `makeMove()` return value

---

## Git Workflow

### Branch Strategy

**Current branch**: `claude/claude-md-migulttjzcrzku7e-015YGT8yzGgkEoF3ULuDPUN6`
- Develop on this branch
- Commit frequently with descriptive messages
- Push when ready using `git push -u origin <branch-name>`

### Commit Message Style

Based on recent commits:
```
Add [feature] - New functionality
Fix [issue] - Bug fixes
Refactor [component] - Code restructuring
Optimize [aspect] - Performance improvements
```

**Examples:**
- `Add undo and timer features`
- `Fix canvas sizing for dynamic board sizes`
- `Refactor game flow: separate login, room creation, and joining`

### Recent Development History

Key features added (most recent first):
1. **c63e075**: Optimize game board size and layout
2. **b05414a**: Add undo and timer features
3. **20d4cf6**: Add sound effects system with toggle control
4. **ca12cad**: Add Docker support for OpenMediaVault deployment
5. **32359c0**: Refactor game flow: separate login, room creation, and joining
6. **c4fa95c**: Add comprehensive admin system with player management

---

## Important Considerations for AI Assistants

### When Making Changes

1. **Preserve Hungarian language**: User-facing messages are in Hungarian
2. **Test multiplayer**: Always consider 2+ player scenarios
3. **Maintain Socket.IO sync**: Ensure client/server events match
4. **Validate user input**: Check roomId, playerName, board coordinates
5. **Handle edge cases**: Empty rooms, disconnects, game over states
6. **Update both client and server**: Most features require both-side changes

### Security Considerations

1. **Change `ADMIN_CODE`** in production (currently `admin123`)
2. **Validate all Socket.IO inputs**: Never trust client data
3. **Sanitize room IDs and player names**: Prevent XSS
4. **Rate limit socket events**: Prevent abuse (not currently implemented)
5. **Use environment variables**: Never hardcode secrets

### Performance Considerations

1. **Canvas rendering**: Only redraw when game state changes
2. **Timer updates**: Use intervals, not continuous polling
3. **Sound generation**: Reuse AudioContext, clean up oscillators
4. **Room cleanup**: Delete empty rooms on disconnect
5. **Broadcast efficiently**: Use `io.to(roomId)` for room-specific events

### Code Quality

1. **No inline styles**: Use CSS classes (already followed)
2. **No magic numbers**: Use constants like `BOARD_SIZE`, `CELL_SIZE`
3. **Consistent error handling**: Use same pattern throughout
4. **Comment complex logic**: Especially win detection algorithm
5. **Keep functions focused**: Single responsibility principle

---

## Quick Reference

### Server-side Socket.IO Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `login` | C→S | Register player name |
| `createRoom` | C→S | Create new game room |
| `joinRoom` | C→S | Join existing room |
| `makeMove` | C→S | Place piece on board |
| `undoMove` | C→S | Undo last move |
| `resetGame` | C→S | Start new game in same room |
| `adminLogin` | C→S | Authenticate as admin |
| `adminKickPlayer` | C→S | Remove player from server |
| `adminCloseRoom` | C→S | Delete room and kick players |
| `adminSetTimer` | C→S | Update global timer settings |
| `gameState` | S→C | Full game state update |
| `roomsList` | S→C | Available rooms list |
| `onlinePlayers` | S→C | Online players (admin only) |
| `timerSettings` | S→C | Current timer config (admin only) |
| `error` | S→C | Error message |
| `message` | S→C | Info message |

### File Line References

**Critical game logic locations:**
- Win detection: `server.js:97-134`
- Move validation: `server.js:58-95`
- Timer management: `server.js:169-195`
- Canvas rendering: `game.js:466-549`
- Sound system: `game.js:38-131`
- Admin handlers: `server.js:468-550`, `game.js:622-727`

### Dependencies

```json
{
  "dependencies": {
    "express": "^4.18.2",
    "socket.io": "^4.6.1"
  },
  "devDependencies": {
    "nodemon": "^3.0.1"
  }
}
```

---

## Future Enhancement Ideas

Based on README.md wishlist and current architecture:

- [ ] Chat system between players (Socket.IO events)
- [ ] Game replay/history viewer (store moveHistory)
- [ ] Leaderboard/statistics (requires database)
- [ ] Save/load games (requires persistence)
- [ ] Mobile optimization (responsive CSS, touch events)
- [ ] Multiple board size options in same room
- [ ] Spectator mode (join room without playing)
- [ ] AI opponent (minimax algorithm)
- [ ] Tournament bracket system

---

## Additional Resources

- **Socket.IO Documentation**: https://socket.io/docs/
- **HTML5 Canvas API**: https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API
- **Web Audio API**: https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API
- **Gomoku Rules**: https://en.wikipedia.org/wiki/Gomoku

---

**Last Updated**: 2025-11-27
**Project Version**: 1.0.0
**Node Version**: 20 (Alpine)
