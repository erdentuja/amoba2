# CLAUDE.md - AI Assistant Guide for Amőba Online

## Project Overview

**Amőba Online** is a real-time multiplayer Gomoku (Five in a Row) game built with Node.js and Socket.IO. Players compete in room-based matches on configurable board sizes (9x9, 13x13, 15x15, 19x19) with features including:
- **AI Opponents**: Three difficulty levels (easy, medium, hard) with minimax algorithm
- **AI vs AI Demo Mode**: Watch two AIs battle in real-time
- **Spectator Mode**: Watch ongoing games without playing
- **Real-time Chat**: Room-based and lobby chat systems
- **Balambér AI Chatbot**: Friendly lobby companion with personality
- **Undo/Timer/Admin**: Full game management features
- **Sound Effects**: Web Audio API-based procedural sounds

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

#### `server.js` (1393 lines)
**Core backend logic including:**
- **GomokuAI class** (lines 76-286): Minimax AI with alpha-beta pruning
  - Methods: `getBestMove()`, `minimax()`, `evaluateBoard()`, `evaluateLine()`
  - Supports three difficulty levels with configurable depth
  - Smart move filtering for performance optimization
- **GameRoom class** (lines 288-584): Manages game state, board, players, spectators, AI
  - Methods: `addPlayer()`, `addSpectator()`, `makeMove()`, `makeAIMove()`, `checkWin()`, `undoMove()`, `reset()`
  - Properties: `board`, `players`, `spectators`, `currentPlayer`, `gameOver`, `winner`, `gameMode`, `isAIGame`, `isAIVsAI`
  - Supports PvP, AI (easy/medium/hard), and AI vs AI modes
- **Socket.IO event handlers** (lines 704-1345):
  - Player: `login`, `createRoom`, `joinRoom`, `watchRoom`, `leaveSpectator`, `makeMove`, `undoMove`, `requestNewGame`, `acceptNewGame`
  - Chat: `chatMessage` (room chat), `lobbyChatMessage` (lobby chat)
  - Admin: `adminLogin`, `adminKickPlayer`, `adminCloseRoom`, `adminSetTimer`, `adminSetAISettings`
- **State management**: Rooms map, connected clients, online players, spectators
- **Global settings**: Timer settings (enabled/duration), AI settings (aiVsAiEnabled)
- **Balambér Chatbot** (lines 21-38, 1347-1392): Lobby chatbot with 15 personality messages

#### `public/game.js` (1211 lines)
**Client-side game logic:**
- **Canvas rendering** (lines 703-839): Draws board grid, star points, pieces with gradients, winning animations
- **Socket.IO client handlers** (lines 178-351): Syncs game state, spectator mode, chat messages
- **Sound system** (lines 58-141): Web Audio API-based sound effects (click, win, error, gameStart)
- **Timer display** (lines 549-587): Visual countdown with color-coded urgency
- **Spectator mode** (lines 264-305): Join/leave spectator mode, UI state management
- **Victory modal** (lines 1036-1107): Victory screen with confetti animation
- **Chat system** (lines 1109-1207): Room chat and lobby chat with message rendering
- **Admin panel** (lines 848-1033): Player/room management, timer/AI settings configuration

#### `public/index.html` (228 lines)
**UI structure with multiple views and modals:**
- Login screen (lines 100-111)
- Lobby with room creation, rooms list, online players, lobby chat (lines 114-176)
- Game area with canvas, player info, timer, room chat, spectator controls (lines 178-221)
- Admin panel (lines 55-98)
- Modals: Admin login (lines 18-25), Victory screen (lines 28-40), New game request (lines 43-52)

---

## Game Architecture

### Socket.IO Communication Flow

**Player Lifecycle:**
```
Connection → login → (createRoom | joinRoom | watchRoom) → makeMove ↔ gameState → disconnect
                                    ↓
                              Spectator mode
```

**Key Events:**
- **Client→Server**: `login`, `createRoom`, `joinRoom`, `watchRoom`, `leaveSpectator`, `makeMove`, `undoMove`, `resetGame`, `requestNewGame`, `acceptNewGame`, `declineNewGame`
- **Server→Client**: `loginSuccess`, `roomCreated`, `gameState`, `spectatorJoined`, `leftSpectator`, `roomClosed`, `message`, `error`, `roomsList`, `lobbyPlayers`
- **Chat Events**: `chatMessage` (C→S & S→C), `lobbyChatMessage` (C→S & S→C)
- **Admin Events**:
  - Client→Server: `adminLogin`, `adminKickPlayer`, `adminCloseRoom`, `adminSetTimer`, `adminSetAISettings`
  - Server→Client: `adminLoginSuccess`, `adminLoginFailed`, `onlinePlayers`, `timerSettings`, `aiSettings`

### Game State Management

**Server-side state:**
- `rooms` Map: roomId → GameRoom instance
- `connectedClients` Map: socketId → {name, isAdmin, connectedAt, createdRoom, room}
- `loggedInPlayers` Map: socketId → {name, loggedInAt}
- `globalTimerSettings`: {enabled, duration}
- `globalAISettings`: {aiVsAiEnabled}

**Client-side state:**
- `gameState`: Received from server, contains board, players, spectators, currentPlayer, timer info, gameMode
- `myPlayerId`, `myPlayerName`, `isLoggedIn`, `isAdmin`, `isSpectator`
- `soundEnabled`: Persisted to localStorage
- `currentRoomId`: Current room ID (for spectators and players)

### Room Management

**Room Creation Flow:**
1. Player logs in → `login` event
2. Player creates room with game mode → `createRoom` event with {boardSize, gameMode}
   - Game modes: `pvp`, `ai-easy`, `ai-medium`, `ai-hard`, `ai-vs-ai`
   - Room created but player NOT joined (except AI vs AI which starts immediately)
3. Room added to rooms list → Broadcast `roomsList`
4. Player or others join → `joinRoom` event (or `watchRoom` for spectators)
5. When 2 players joined (or 1 player in AI mode) → Game starts, timer begins (if enabled)

**AI Mode Behavior:**
- **AI modes** (easy/medium/hard): When first player joins, AI player automatically added as second player
- **AI vs AI mode**: Two AI players created immediately, game starts automatically with 800ms move delay
- AI vs AI requires admin to enable via `globalAISettings.aiVsAiEnabled`

**Spectator Mode:**
- Players can watch in-progress games via `watchRoom` event
- Spectators tracked separately in `room.spectators` array
- Spectators receive `gameState` updates but cannot make moves
- Can leave via `leaveSpectator` event

**Important**: A player can only create ONE room at a time (tracked via `createdRoom` property)

### Win Detection Algorithm

**`checkWin()` method** (server.js:449-492):
- Checks 4 directions from last move: horizontal, vertical, diagonal \, diagonal /
- Counts consecutive pieces in both directions along each axis
- Requires exactly 5 in a row to win (standard Gomoku rules)
- Returns winning pieces coordinates for animation
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
- Server: `server.js:291, 750-790`
- Client: `game.js:2-4, 226-232, 726-742`

### 6. AI Opponent System

**Implementation:**
- Minimax algorithm with alpha-beta pruning for optimal move selection
- Three difficulty levels: easy (depth 1), medium (depth 2), hard (depth 3)
- Smart move filtering: only considers cells within 2 spaces of occupied cells
- Board evaluation with pattern scoring (5-in-row: 100000, 4-in-row: 10000, etc.)
- Easy mode adds 40% randomness for more human-like play
- AI makes moves with 500ms delay for natural feel

**GomokuAI Class Methods:**
- `getBestMove(board, boardSize, aiSymbol, playerSymbol)`: Returns [row, col] for best move
- `minimax(board, depth, alpha, beta, isMaximizing)`: Recursive minimax with pruning
- `evaluateBoard(board)`: Scores entire board position
- `evaluateLine(board, row, col, dx, dy)`: Scores a single 5-cell line
- `getPossibleMoves(board)`: Returns filtered list of viable moves
- `checkWinner(board)`: Detects win condition

**Files:**
- Server: `server.js:75-286, 382-399`
- AI name generator: `server.js:60-73` (30 funny AI names)

### 7. AI vs AI Demo Mode

**Implementation:**
- Admin-toggleable feature via `globalAISettings.aiVsAiEnabled`
- Creates room with two AI players automatically
- Uses easy AI (depth 1) for faster gameplay
- Automatic move scheduling with 800ms delay between moves
- Game starts immediately without waiting for players
- Players cannot join AI vs AI rooms (spectators can watch)

**Workflow:**
1. Admin enables AI vs AI in admin panel
2. Player creates room with `ai-vs-ai` game mode
3. Server creates two AI players with funny names
4. `startAIvsAIGame()` function initiates automatic gameplay
5. Moves broadcast to all spectators in real-time

**Files:**
- Server: `server.js:16-19, 310-340, 651-701, 764-790`
- Client: `game.js:398, index.html:152`

### 8. Spectator Mode

**Implementation:**
- Players can watch ongoing games without participating
- Spectators tracked separately in `room.spectators` array
- Only games with status `in_progress` can be spectated
- Spectators receive all `gameState` updates
- Special UI state with spectator controls
- Spectators can use chat with players
- Independent leave mechanism (doesn't close room)

**Spectator Flow:**
1. Player clicks "Megnézem" on in-progress game
2. Client sends `watchRoom` event
3. Server adds to `spectators` array if game in progress
4. Client receives `spectatorJoined` event and switches UI
5. Spectator sees live game with special 👁️ indicator
6. Can leave via "Kilépés a nézői módból" button

**Files:**
- Server: `server.js:296, 369-380, 866-940, 1308-1333`
- Client: `game.js:52, 264-305, 492-507, 636-655`
- UI: `index.html:218, 425`

### 9. Real-time Chat System

**Implementation:**
- **Room Chat**: For players and spectators in a game room
- **Lobby Chat**: For all players in lobby (not in rooms)
- Message validation: 1-200 characters, trimmed, type-checked
- Auto-scroll to latest message
- Visual distinction: own messages (right), others (left), system (center)
- Timestamps included with each message

**Room Chat:**
- Active when player/spectator in a room
- Broadcasts to all users in `socket.roomId`
- System messages for join/leave events
- Sender name and ID tracked

**Lobby Chat:**
- Active when in lobby (not in a room and not admin)
- Broadcasts only to lobby players
- Used by Balambér chatbot

**Files:**
- Server: `server.js:1047-1092` (room + lobby chat handlers)
- Client: `game.js:1109-1207` (chat rendering and sending)
- UI: `index.html:167-174` (lobby chat), `index.html:203-212` (room chat)

### 10. Balambér AI Chatbot

**Implementation:**
- Friendly lobby companion with personality
- 15 unique Hungarian messages with emojis
- Sends random message every 60-120 seconds
- Only active when players are in lobby
- Messages sent to all lobby players (not in rooms, not admins)
- Starts 30 seconds after server launch

**Message Types:**
- Greetings and introductions
- Fun facts about Gomoku
- Encouragement and humor
- Hints about features (AI vs AI mode)
- Self-aware jokes

**Technical Details:**
- Messages array: `server.js:21-38`
- Scheduling function: `server.js:1375-1381` (recursive setTimeout)
- Message broadcaster: `server.js:1348-1372`
- Displays as "🤖 Balambér" in chat with special bot styling

**Files:**
- Server: `server.js:21-38, 1347-1392`
- Client: `game.js:1173-1194` (bot message rendering with `.bot` class)

### 11. Victory Modal & New Game System

**Implementation:**
- Victory modal appears when game ends (only for players, not spectators)
- Animated confetti effect with 100 particles
- Trophy icon and winner name display
- Two options: "Új játék" (new game) or "Kilépés" (leave)
- New game request system between players

**New Game Request Flow:**
1. Winner clicks "Új játék" → sends `requestNewGame`
2. Opponent receives modal: "Accept" or "Decline"
3. If accepted → `acceptNewGame` → game resets, both players notified
4. If declined → `declineNewGame` → requester notified

**Confetti Animation:**
- 100 particles with random colors
- CSS animation with varied delays and durations
- Auto-cleared when modal closes

**Files:**
- Server: `server.js:1128-1178` (new game request handlers)
- Client: `game.js:1036-1107` (victory modal and confetti)
- UI: `index.html:28-40` (victory modal), `index.html:43-52` (request modal)

### 12. Online Players List

**Implementation:**
- Shows all logged-in players in lobby
- Real-time updates via `lobbyPlayers` event
- Displays player name and status (lobby or room name)
- Shows current user with "Te" label
- Admin can kick players from this list
- Separate from admin panel's full players list

**Files:**
- Server: `server.js:637-649` (broadcast function)
- Client: `game.js:446-475` (render players list)
- UI: `index.html:126-131` (online players card)

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
- Timer logic: `GameRoom.startTimer()`, `GameRoom.clearTimer()` (server.js:527-553)
- Admin controls: `adminSetTimer` handler (server.js:1234-1262)

**Client-side:**
- Display: `updateTimerDisplay()` (game.js:567-587)
- Countdown: `startTimer()` interval (game.js:550-558)

### Adding AI Difficulty Levels

**To add a new AI difficulty:**
1. Update `getDepthByDifficulty()` in `GomokuAI` class (server.js:82-89)
2. Add new game mode option to `gameMode` select (index.html:147-152)
3. Handle new mode in `GameRoom` constructor (server.js:309-340)
4. Add to AI name generator logic if needed (server.js:60-73)

### Implementing New Chat Features

**To add a new chat type (e.g., team chat):**
1. Add Socket.IO event handler on server (server.js:1047-1092 pattern)
2. Validate and broadcast to specific group of users
3. Add client-side event listener (game.js:254-261 pattern)
4. Create message rendering function (game.js:1119-1142 pattern)
5. Add UI elements (input, send button, messages container)

### Extending Spectator Features

**To add spectator controls (e.g., pause/rewind):**
1. Add spectator permissions check in server handlers
2. Create new Socket.IO events for spectator actions
3. Update `GameRoom.spectators` array with additional data
4. Modify client UI to show spectator-specific controls
5. Ensure spectators cannot affect game state

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
- Two players joining same room (PvP mode)
- AI opponent games (easy, medium, hard difficulties)
- AI vs AI demo mode (with spectators)
- Spectator mode (joining, watching, leaving)
- Chat systems (room chat and lobby chat)
- Balambér chatbot (verify random messages in lobby)
- Win detection (horizontal, vertical, diagonal) with animation
- Victory modal and new game requests
- Undo move
- Timer expiry
- Admin panel functionality (timer, AI settings, kick, close)
- Room creation limits (one per player)
- Disconnect handling (players vs spectators)
- Online players list updates

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
- **Check**: Game state, current player, cell availability, spectator mode
- **Debug**: Console log `gameState`, check `makeMove()` return value, verify `isSpectator` flag

**Issue**: AI not making moves
- **Check**: Game mode set correctly, AI player exists in `room.players`
- **Debug**: Console log AI move calculation, check `makeAIMove()` response

**Issue**: Chat messages not sending
- **Check**: User in correct context (room vs lobby), message length
- **Debug**: Verify `socket.roomId` for room chat, check message validation (1-200 chars)

**Issue**: Spectator can't join game
- **Check**: Game status is `in_progress`, not `waiting`
- **Fix**: Only in-progress games allow spectators

**Issue**: Balambér not chatting
- **Check**: Server running for >30 seconds, players in lobby
- **Debug**: Console log shows chatbot activation and message sends

---

## Git Workflow

### Branch Strategy

**Current branch**: `claude/claude-md-mijbve973oy3av0v-01Br2gXTH175oDv8ZorypufD`
- Develop on this branch
- Commit frequently with descriptive messages
- Push when ready using `git push -u origin <branch-name>`
- Main branch is used for merging PRs

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
1. **fe46c81**: Add lobby chat and Balambér AI chatbot
2. **bb247c0**: Fix chat message sending - remove client-side roomId check
3. **2427d53**: Add real-time chat system for players and spectators
4. **d114c6b**: Add admin toggle for AI vs AI mode and optimize AI performance
5. **6d38c1d**: Add AI vs AI demo mode and ensure admin sees all players
6. **c63e075**: Optimize game board size and layout
7. **b05414a**: Add undo and timer features
8. **20d4cf6**: Add sound effects system with toggle control
9. **ca12cad**: Add Docker support for OpenMediaVault deployment

---

## Important Considerations for AI Assistants

### When Making Changes

1. **Preserve Hungarian language**: User-facing messages are in Hungarian
2. **Test multiplayer**: Always consider 2+ player scenarios, spectators, and AI modes
3. **Maintain Socket.IO sync**: Ensure client/server events match
4. **Validate user input**: Check roomId, playerName, board coordinates, chat messages
5. **Handle edge cases**: Empty rooms, disconnects, game over states, spectator-only rooms, AI games
6. **Update both client and server**: Most features require both-side changes
7. **Test AI modes**: Verify AI opponent logic, AI vs AI mode, and spectator viewing
8. **Chat system**: Validate message length, sanitize input, check room/lobby context

### Security Considerations

1. **Change `ADMIN_CODE`** in production (currently `admin123`)
2. **Validate all Socket.IO inputs**: Never trust client data
3. **Sanitize room IDs, player names, and chat messages**: Prevent XSS
4. **Chat message validation**: 1-200 character limit, type checking, trimming
5. **AI vs AI mode**: Protected by admin-only toggle to prevent abuse
6. **Spectator permissions**: Read-only access, cannot make moves
7. **Rate limit socket events**: Prevent abuse (not currently implemented)
8. **Use environment variables**: Never hardcode secrets

### Performance Considerations

1. **Canvas rendering**: Only redraw when game state changes, use requestAnimationFrame for animations
2. **AI optimization**: Smart move filtering (only cells within 2 spaces), alpha-beta pruning, depth limits
3. **AI vs AI**: Uses easy mode (depth 1) for faster gameplay, 800ms move delay
4. **Timer updates**: Use intervals, not continuous polling
5. **Sound generation**: Reuse AudioContext, clean up oscillators
6. **Room cleanup**: Delete empty rooms on disconnect
7. **Broadcast efficiently**: Use `io.to(roomId)` for room-specific events
8. **Chat system**: Message length limits (200 chars), auto-scroll optimization
9. **Balambér chatbot**: Random 60-120s intervals to avoid spam, only sends when lobby has players

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
| `createRoom` | C→S | Create new game room with boardSize and gameMode |
| `joinRoom` | C→S | Join existing room as player |
| `watchRoom` | C→S | Join existing room as spectator |
| `leaveSpectator` | C→S | Leave spectator mode |
| `leaveRoom` | C→S | Leave room as player (closes room) |
| `makeMove` | C→S | Place piece on board |
| `undoMove` | C→S | Undo last move |
| `resetGame` | C→S | Reset game in same room |
| `requestNewGame` | C→S | Request new game from opponent |
| `acceptNewGame` | C→S | Accept opponent's new game request |
| `declineNewGame` | C→S | Decline opponent's new game request |
| `chatMessage` | C→S & S→C | Room chat message |
| `lobbyChatMessage` | C→S & S→C | Lobby chat message |
| `adminLogin` | C→S | Authenticate as admin |
| `adminKickPlayer` | C→S | Remove player from server |
| `adminCloseRoom` | C→S | Delete room and kick players |
| `adminSetTimer` | C→S | Update global timer settings |
| `adminSetAISettings` | C→S | Update global AI settings |
| `gameState` | S→C | Full game state update (board, players, spectators) |
| `roomsList` | S→C | Available rooms list with status |
| `lobbyPlayers` | S→C | Online players in lobby |
| `spectatorJoined` | S→C | Confirmation of spectator mode |
| `leftSpectator` | S→C | Confirmation of leaving spectator mode |
| `roomClosed` | S→C | Room was closed by admin or player leave |
| `newGameRequest` | S→C | Opponent requests new game |
| `newGameAccepted` | S→C | New game request accepted |
| `newGameDeclined` | S→C | New game request declined |
| `onlinePlayers` | S→C | Online players (admin only) |
| `timerSettings` | S→C | Current timer config (admin only) |
| `aiSettings` | S→C | Current AI settings (admin only) |
| `adminLoginSuccess` | S→C | Admin login successful |
| `adminLoginFailed` | S→C | Admin login failed |
| `kicked` | S→C | Player was kicked by admin |
| `error` | S→C | Error message |
| `message` | S→C | Info message |

### File Line References

**Critical game logic locations:**
- AI logic (minimax): `server.js:76-286`
- Win detection: `server.js:449-492`
- Move validation: `server.js:405-447`
- Timer management: `server.js:527-553`
- AI move execution: `server.js:382-399, 1024-1040`
- AI vs AI automation: `server.js:651-701`
- Spectator management: `server.js:369-380, 866-940`
- Chat systems: `server.js:1047-1092`
- Balambér chatbot: `server.js:21-38, 1347-1392`
- Canvas rendering: `game.js:703-839`
- Winning animation: `game.js:685-701, 765-839`
- Sound system: `game.js:58-141`
- Victory modal: `game.js:1036-1107`
- Chat UI: `game.js:1109-1207`
- Admin handlers: `server.js:1181-1283`, `game.js:848-1033`

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

Based on current architecture and potential improvements:

- [x] ~~Chat system between players~~ **✓ COMPLETED** (Room chat + Lobby chat)
- [x] ~~Spectator mode~~ **✓ COMPLETED** (Watch games without playing)
- [x] ~~AI opponent~~ **✓ COMPLETED** (Minimax with 3 difficulty levels)
- [x] ~~AI vs AI demo~~ **✓ COMPLETED** (Admin-toggleable automatic gameplay)
- [ ] Game replay/history viewer (store and playback moveHistory)
- [ ] Leaderboard/statistics (requires database: wins, losses, ratings)
- [ ] Save/load games (requires persistence layer)
- [ ] Mobile optimization (responsive CSS, touch events, mobile-friendly UI)
- [ ] Tournament bracket system (multiple games, elimination rounds)
- [ ] ELO rating system (track player skill levels)
- [ ] Friend system (send invites to specific players)
- [ ] Custom room codes (user-defined room IDs)
- [ ] Game variants (different win conditions, board patterns)
- [ ] Multi-language support (currently Hungarian-only)
- [ ] Voice chat integration (WebRTC)
- [ ] Replay sharing (export/import game records)

---

## Additional Resources

- **Socket.IO Documentation**: https://socket.io/docs/
- **HTML5 Canvas API**: https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API
- **Web Audio API**: https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API
- **Gomoku Rules**: https://en.wikipedia.org/wiki/Gomoku

---

**Last Updated**: 2025-11-28
**Project Version**: 2.0.0
**Node Version**: 20 (Alpine)
**Major Features**: AI Opponents, Spectator Mode, Real-time Chat, Balambér Chatbot
