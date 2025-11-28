# CLAUDE.md - AI Assistant Guide for Amőba Online

## Project Overview

**Amőba Online** is a real-time multiplayer Gomoku (Five in a Row) game built with Node.js and Socket.IO. Players compete in room-based matches on configurable board sizes (9x9, 13x13, 15x15, 19x19) with features including AI opponents (easy/medium/hard), AI vs AI demonstration mode, spectator mode, real-time chat, undo moves, turn timers, admin management, lobby chatbot (Balambér), and sound effects.

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

#### `server.js` (1392 lines)
**Core backend logic including:**
- **GomokuAI class** (lines 76-286): Advanced AI opponent with minimax algorithm and alpha-beta pruning
  - Difficulty levels: easy (depth 1), medium (depth 2), hard (depth 3)
  - Methods: `getBestMove()`, `minimax()`, `evaluateBoard()`, `evaluateLine()`, `checkWinner()`
  - Smart move generation with position filtering (focuses on occupied areas)
- **GameRoom class** (lines 288-584): Manages game state, board, players, moves, win detection, timer, AI, spectators
  - Methods: `addPlayer()`, `addSpectator()`, `makeMove()`, `makeAIMove()`, `checkWin()`, `undoMove()`, `reset()`, timer management
  - Properties: `board`, `players`, `spectators`, `currentPlayer`, `gameOver`, `winner`, `moveHistory`, `gameMode`, `ai`, `isAIGame`, `isAIVsAI`
  - Game modes: `pvp`, `ai-easy`, `ai-medium`, `ai-hard`, `ai-vs-ai`
- **Socket.IO event handlers** (lines 704-1345):
  - Player: `login`, `createRoom`, `joinRoom`, `watchRoom`, `leaveRoom`, `leaveSpectator`, `makeMove`, `undoMove`, `resetGame`, `chatMessage`, `lobbyChatMessage`, `requestNewGame`, `acceptNewGame`, `declineNewGame`, `disconnect`
  - Admin: `adminLogin`, `adminKickPlayer`, `adminCloseRoom`, `adminSetTimer`, `adminSetAISettings`
- **State management**: Rooms map, connected clients tracking, online players tracking
- **Global settings**: Timer settings (enabled/disabled, duration), AI settings (aiVsAiEnabled)
- **Balambér chatbot** (lines 1347-1381): Automated lobby chatbot with 15 pre-written messages, sends messages every 60-120 seconds

#### `public/game.js` (1210 lines)
**Client-side game logic:**
- **Canvas rendering** (lines 703-839): Draws board grid, star points, pieces with gradients, winning animation, last move indicator
- **Socket.IO client handlers** (lines 178-352): Syncs game state, handles room updates, spectator mode, chat messages, new game requests
- **Sound system** (lines 58-141): Web Audio API-based sound effects (click, win, error, gameStart)
- **Timer display** (lines 549-587): Visual countdown with color-coded urgency
- **Admin panel** (lines 849-1033): Player management, room management, timer configuration, AI settings
- **Spectator mode** (lines 264-328): Join/leave spectator mode, watch ongoing games, spectator-specific UI
- **Chat system** (lines 1109-1207): In-game chat for players/spectators, lobby chat, message rendering
- **Victory modal** (lines 1036-1107): Post-game modal with confetti effect, new game request, leave options
- **New game request system** (lines 1057-1081): Request/accept/decline new game after victory

#### `public/index.html` (227 lines)
**UI structure with multiple views and modals:**
- Login screen (lines 100-111)
- Lobby with room creation, waiting rooms list, online players, lobby chat (lines 113-176)
- Game area with canvas, player info, timer, controls, in-game chat (lines 178-221)
- Admin panel with timer settings, AI settings, player management, room management (lines 54-98)
- Admin login modal (lines 17-25)
- Victory modal with confetti and new game options (lines 27-40)
- New game request modal (lines 42-52)

---

## Game Architecture

### Socket.IO Communication Flow

**Player Lifecycle:**
```
Connection → login → (createRoom | joinRoom) → makeMove ↔ gameState → disconnect
```

**Key Events:**
- **Client→Server**: `login`, `createRoom`, `joinRoom`, `watchRoom`, `leaveRoom`, `leaveSpectator`, `makeMove`, `undoMove`, `resetGame`, `chatMessage`, `lobbyChatMessage`, `requestNewGame`, `acceptNewGame`, `declineNewGame`
- **Server→Client**: `loginSuccess`, `roomCreated`, `gameState`, `message`, `error`, `roomsList`, `lobbyPlayers`, `chatMessage`, `lobbyChatMessage`, `spectatorJoined`, `leftSpectator`, `roomClosed`, `newGameRequest`, `newGameAccepted`, `newGameDeclined`
- **Admin Events**: `adminLogin`, `adminKickPlayer`, `adminCloseRoom`, `adminSetTimer`, `adminSetAISettings`, `onlinePlayers`, `timerSettings`, `aiSettings`

### Game State Management

**Server-side state:**
- `rooms` Map: roomId → GameRoom instance
- `connectedClients` Map: socketId → {name, isAdmin, connectedAt, createdRoom, room}
- `loggedInPlayers` Map: socketId → {name, loggedInAt}
- `globalTimerSettings`: {enabled, duration}
- `globalAISettings`: {aiVsAiEnabled}
- `balamberMessages`: Array of 15 pre-written chatbot messages

**Client-side state:**
- `gameState`: Received from server, contains board, players, spectators, currentPlayer, timer info, status
- `myPlayerId`, `myPlayerName`, `currentRoomId`, `isLoggedIn`, `isAdmin`, `isSpectator`
- `soundEnabled`: Persisted to localStorage
- `timerInterval`, `winningAnimationFrame`, `animationInterval`: Animation and timer tracking

### Room Management

**Room Creation Flow:**
1. Player logs in → `login` event
2. Player selects board size and game mode (pvp, ai-easy, ai-medium, ai-hard, ai-vs-ai)
3. Player creates room → `createRoom` event → Room created with auto-generated ID (SZOBA-XXXX)
4. For AI modes: AI player automatically added when first human player joins
5. For AI vs AI mode: Two AI players created immediately, game starts automatically
6. Room added to waiting rooms list → Broadcast `roomsList`
7. Players join via `joinRoom` event or watch via `watchRoom` event
8. When 2 players joined → Game starts, timer begins (if enabled)

**Important Notes:**
- A player can only create ONE room at a time (tracked via `createdRoom` property)
- AI vs AI mode requires admin to enable `globalAISettings.aiVsAiEnabled`
- AI vs AI games start automatically and play without human intervention
- Spectators can watch in-progress games but cannot make moves

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
- Server: `server.js:289-294`
- Client: `game.js:2-4, 226-232, 727-742`

### 6. AI Opponent System

**Implementation:**
- **Algorithm**: Minimax with alpha-beta pruning for efficient move selection
- **Difficulty levels**:
  - Easy (depth 1): Basic 1-move lookahead, 40% random moves
  - Medium (depth 2): 2-move lookahead, balanced strategy
  - Hard (depth 3): 3-move lookahead, optimal play
- **Evaluation**: Scores board positions based on consecutive pieces (5=win, 4=near-win, 3=threat, etc.)
- **Smart move generation**: Focuses search on cells within 2 spaces of occupied cells (performance optimization)
- **AI move delay**: 500ms delay to feel more natural
- **AI naming**: Funny Hungarian AI names generated randomly (e.g., "Terminátor (AI)", "Szuperagy (AI)")

**Game modes:**
- `pvp`: Player vs Player (traditional multiplayer)
- `ai-easy`: Player vs Easy AI
- `ai-medium`: Player vs Medium AI
- `ai-hard`: Player vs Hard AI
- `ai-vs-ai`: AI vs AI demonstration mode (requires admin to enable)

**Files:**
- Server AI logic: `server.js:76-286` (GomokuAI class)
- Server AI integration: `server.js:309-340, 382-399` (GameRoom AI methods)
- Server AI vs AI automation: `server.js:652-701` (startAIvsAIGame function)
- Client AI mode handling: `game.js:396-406` (game mode selection)

**Key features:**
- AI automatically joins as second player in AI modes
- AI vs AI mode creates two AI players and starts game immediately
- AI makes moves via `makeAIMove()` method on server
- No human intervention needed for AI vs AI games

### 7. Spectator Mode

**Implementation:**
- Players can watch ongoing games without participating
- Spectators receive real-time game state updates
- Spectators can chat with players
- Spectators don't affect game controls or timer
- Join via "Megnézem" button on in-progress rooms
- Leave via "Kilépés a nézői módból" button

**Spectator lifecycle:**
1. Player in lobby clicks "Megnézem" on in-progress game
2. `watchRoom` event sent to server
3. Server adds player to room's `spectators` array
4. Server emits `spectatorJoined` event to client
5. Client switches to game view with spectator UI
6. Spectator receives `gameState` updates and `chatMessage` events
7. Spectator clicks leave button → `leaveSpectator` event
8. Server removes from spectators, client returns to lobby

**Restrictions:**
- Can only watch games that are `in_progress`
- Cannot make moves or use undo/reset buttons
- UI shows "👁️" icon and "Nézői mód aktív" indicator
- If a player disconnects, spectators are kicked back to lobby

**Files:**
- Server: `server.js:369-380, 867-910, 912-940` (spectator handlers)
- Client: `server.js:264-328, 492-507` (spectator mode UI)

### 8. Real-time Chat System

**Two chat systems:**

**A. In-game Chat (for players and spectators in a room):**
- Available in game view
- Messages broadcast to all players and spectators in the room
- System messages for join/leave events
- Message validation: max 200 characters, trimmed, non-empty
- Auto-scroll to latest message
- Visual distinction between own messages, others' messages, and system messages

**B. Lobby Chat (for players in lobby only):**
- Available in lobby view
- Messages broadcast to all players not in a room (excluding admins)
- Includes Balambér chatbot messages
- Same message validation as in-game chat
- Visual distinction between own messages, others' messages, and bot messages

**Message structure:**
```javascript
{
  senderId: socketId | 'system' | 'bot',
  senderName: string,
  message: string,
  timestamp: number
}
```

**Files:**
- Server in-game chat: `server.js:1047-1069`
- Server lobby chat: `server.js:1071-1092`
- Client chat UI: `game.js:1109-1207, index.html:203-212, 167-174`

### 9. Balambér Chatbot

**Implementation:**
- Automated chatbot that sends messages to lobby chat
- 15 pre-written Hungarian messages with emojis and personality
- Messages sent every 60-120 seconds (randomized interval)
- Only sends when there are players in lobby
- Activates 30 seconds after server starts
- Messages include game tips, humor, and fun facts

**Message topics:**
- Introduction and greetings
- Game strategy hints
- Fun facts about Gomoku/Amőba
- Encouragement and humor
- References to AI vs AI mode

**Files:**
- Server: `server.js:21-38` (message array), `server.js:1347-1391` (chatbot logic)
- Client: `game.js:1173-1194` (lobby chat message rendering with bot styling)

### 10. Victory System & New Game Requests

**Victory Modal:**
- Appears after game ends (only for players, not spectators)
- Shows winner's name with trophy icon
- Confetti animation (100 colored particles)
- Two options: Request new game or leave
- Closing modal doesn't leave game

**New Game Request Flow:**
1. Winner or loser clicks "Új játék" button
2. `requestNewGame` event sent to opponent
3. Opponent receives modal: "Accept" or "Decline"
4. If accepted: `acceptNewGame` event → game resets, both players notified
5. If declined: `declineNewGame` event → requester notified
6. Only works with human opponents (not AI)

**Files:**
- Server: `server.js:1127-1178` (new game request handlers)
- Client victory modal: `game.js:1036-1107, index.html:27-40`
- Client request system: `game.js:330-348, 1057-1081`

### 11. Leave Room System

**Implementation:**
- Players can leave game at any time via "Kilépés" button
- When a player leaves, entire room is closed and deleted
- All other players and spectators are kicked back to lobby
- Prevents orphaned rooms or unfinished games
- Chat is cleared when leaving

**Leave flow:**
1. Player clicks "Kilépés" button
2. `leaveRoom` event sent to server
3. Server broadcasts `roomClosed` event to all room members
4. Server removes room from rooms map
5. All clients return to lobby, room disappears from rooms list

**Disconnect handling:**
- If player disconnects without leaving, same flow occurs
- Empty rooms (created but not joined) are deleted on creator disconnect
- Spectators removed from spectator list, don't trigger room deletion

**Files:**
- Server: `server.js:942-991, 1285-1344` (leave and disconnect handlers)
- Client: `game.js:523-535, 308-328` (leave game function)

---

## Common Development Tasks

### Adding AI Opponent Features

**Modifying AI difficulty:**
- Edit `getDepthByDifficulty()` method in GomokuAI class (server.js:82-89)
- Adjust depth values (higher = smarter but slower)
- Modify randomness in `getBestMove()` for easy mode (server.js:269-271)

**Improving AI evaluation:**
- Edit `evaluateBoard()` and `evaluateLine()` methods (server.js:92-142)
- Adjust scoring weights for different patterns
- Add new pattern recognition (e.g., detect forks, threats)

**Adding new AI personalities:**
- Create new AI name arrays in `generateFunnyAIName()` (server.js:61-72)
- Add new difficulty levels in game mode select (index.html:147-152)
- Implement new evaluation strategies in AI class

**Performance optimization:**
- Adjust move filtering distance in `getPossibleMoves()` (server.js:167)
- Implement move ordering for better alpha-beta pruning
- Add transposition table for caching evaluated positions

### Adding Spectator Features

**Adding spectator chat:**
- Already implemented! Spectators can chat using existing chat system
- Spectators see all chat messages in the room

**Adding spectator-specific UI:**
- Check `isSpectator` flag in client (game.js:52)
- Conditionally render UI elements based on spectator status
- Example: Hide game controls for spectators (game.js:278-280)

**Limiting spectator count:**
- Add `maxSpectators` property to GameRoom class
- Check spectator count in `addSpectator()` method
- Emit error if spectator limit reached

### Adding Chat Features

**Adding chat commands:**
- Intercept chat messages starting with `/` in chat handlers
- Parse command and arguments
- Execute command logic (e.g., `/help`, `/stats`, `/mute`)

**Adding chat moderation:**
- Implement profanity filter in message validation
- Add mute/ban system with Map of muted players
- Admin command to mute/unmute players

**Adding chat history:**
- Store messages in room's chat history array
- Send last N messages to new joiners/spectators
- Implement chat persistence to database

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
- **AI opponent testing:**
  - Player vs AI (easy/medium/hard)
  - AI move generation
  - AI vs AI automatic game
- **Spectator mode testing:**
  - Join ongoing game as spectator
  - Receive game state updates
  - Chat as spectator
  - Leave spectator mode
- **Chat system testing:**
  - In-game chat between players
  - In-game chat with spectators
  - Lobby chat between lobby players
  - Balambér chatbot messages
- **New game request testing:**
  - Request new game after victory
  - Accept/decline new game
  - Game reset on acceptance

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
1. **4e2a6e6/fe46c81**: Add lobby chat and Balambér AI chatbot
2. **bb247c0**: Fix chat message sending - remove client-side roomId check
3. **2427d53**: Add real-time chat system for players and spectators
4. **c63e075**: Optimize game board size and layout
5. **b05414a**: Add undo and timer features
6. **20d4cf6**: Add sound effects system with toggle control
7. **ca12cad**: Add Docker support for OpenMediaVault deployment
8. **32359c0**: Refactor game flow: separate login, room creation, and joining
9. **c4fa95c**: Add comprehensive admin system with player management

**Major features in current version:**
- AI opponent with 3 difficulty levels (minimax algorithm)
- AI vs AI demonstration mode
- Spectator mode for watching games
- Real-time chat (in-game and lobby)
- Balambér chatbot in lobby
- Victory modal with new game requests
- Leave room system with automatic room cleanup

---

## Important Considerations for AI Assistants

### When Making Changes

1. **Preserve Hungarian language**: User-facing messages are in Hungarian
2. **Test multiplayer**: Always consider 2+ player scenarios
3. **Maintain Socket.IO sync**: Ensure client/server events match
4. **Validate user input**: Check roomId, playerName, board coordinates, chat messages
5. **Handle edge cases**: Empty rooms, disconnects, game over states, spectator scenarios, AI game modes
6. **Update both client and server**: Most features require both-side changes
7. **Test with AI modes**: Ensure AI moves work correctly, test AI vs AI mode
8. **Test spectator mode**: Verify spectators receive updates but can't make moves
9. **Test chat system**: Verify messages broadcast correctly, check message validation

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
6. **AI move generation**: Limit search depth, use alpha-beta pruning, filter moves smartly
7. **AI vs AI mode**: Use lower depth (easy AI) for faster games
8. **Chat message validation**: Limit message length (200 chars), validate before broadcast
9. **Spectator updates**: Spectators receive same game state as players (no separate updates needed)
10. **Animation performance**: Use requestAnimationFrame for smooth animations, clean up intervals

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
| **Player Events** | | |
| `login` | C→S | Register player name |
| `createRoom` | C→S | Create new game room (with board size and game mode) |
| `joinRoom` | C→S | Join existing room as player |
| `watchRoom` | C→S | Join room as spectator |
| `leaveRoom` | C→S | Leave current room (closes room if player) |
| `leaveSpectator` | C→S | Leave spectator mode |
| `makeMove` | C→S | Place piece on board |
| `undoMove` | C→S | Undo last move |
| `resetGame` | C→S | Start new game in same room |
| `chatMessage` | C→S | Send chat message in game room |
| `lobbyChatMessage` | C→S | Send chat message in lobby |
| `requestNewGame` | C→S | Request new game from opponent after victory |
| `acceptNewGame` | C→S | Accept new game request |
| `declineNewGame` | C→S | Decline new game request |
| **Server Responses** | | |
| `loginSuccess` | S→C | Login confirmed with player name |
| `roomCreated` | S→C | Room created successfully with room ID |
| `gameState` | S→C | Full game state update (board, players, spectators, etc.) |
| `roomsList` | S→C | List of all available rooms |
| `lobbyPlayers` | S→C | List of players currently in lobby |
| `spectatorJoined` | S→C | Spectator successfully joined room |
| `leftSpectator` | S→C | Successfully left spectator mode |
| `roomClosed` | S→C | Room was closed (player left or kicked) |
| `chatMessage` | S→C | Chat message from player/spectator/system |
| `lobbyChatMessage` | S→C | Chat message in lobby (includes Balambér) |
| `newGameRequest` | S→C | Opponent requests new game |
| `newGameAccepted` | S→C | New game request was accepted |
| `newGameDeclined` | S→C | New game request was declined |
| `kicked` | S→C | Player was kicked by admin |
| `error` | S→C | Error message |
| `message` | S→C | Info message |
| **Admin Events** | | |
| `adminLogin` | C→S | Authenticate as admin |
| `adminKickPlayer` | C→S | Remove player from server |
| `adminCloseRoom` | C→S | Delete room and kick all players |
| `adminSetTimer` | C→S | Update global timer settings |
| `adminGetTimerSettings` | C→S | Request current timer settings |
| `adminSetAISettings` | C→S | Update global AI settings (AI vs AI mode) |
| `adminLoginSuccess` | S→C | Admin login successful |
| `adminLoginFailed` | S→C | Admin login failed |
| `onlinePlayers` | S→C | List of all online players (admin only) |
| `timerSettings` | S→C | Current timer configuration |
| `aiSettings` | S→C | Current AI configuration |

### File Line References

**Critical game logic locations:**
- AI minimax algorithm: `server.js:199-234`
- AI board evaluation: `server.js:92-142`
- Win detection: `server.js:449-492`
- Move validation: `server.js:405-447`
- Timer management: `server.js:535-547`
- Canvas rendering: `game.js:703-839`
- Winning animation: `game.js:685-701, 765-825`
- Sound system: `game.js:58-141`
- Admin handlers: `server.js:1180-1283`, `game.js:849-1033`
- Chat system: `server.js:1047-1092`, `game.js:1109-1207`
- Spectator mode: `server.js:369-380, 867-940`, `game.js:264-328, 492-507`
- Balambér chatbot: `server.js:1347-1391`

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

- [x] Chat system between players (Socket.IO events) ✅ **IMPLEMENTED**
- [x] Spectator mode (join room without playing) ✅ **IMPLEMENTED**
- [x] AI opponent (minimax algorithm) ✅ **IMPLEMENTED**
- [ ] Game replay/history viewer (store moveHistory)
- [ ] Leaderboard/statistics (requires database)
- [ ] Save/load games (requires persistence)
- [ ] Mobile optimization (responsive CSS, touch events)
- [ ] Multiple board size options in same room
- [ ] Tournament bracket system
- [ ] Private rooms with password protection
- [ ] Friend system and invitations
- [ ] Rating/ELO system for players
- [ ] Achievements and badges
- [ ] Game analysis mode (review past games)
- [ ] Customizable AI personalities
- [ ] Voice chat integration

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

**Version 2.0.0 Changes:**
- Added AI opponent system with minimax algorithm (easy/medium/hard)
- Added AI vs AI demonstration mode
- Added spectator mode for watching games
- Added real-time chat system (in-game and lobby)
- Added Balambér chatbot for lobby entertainment
- Added victory modal with confetti and new game requests
- Added leave room system with automatic cleanup
- Enhanced UI with multiple modals and improved UX
- Improved disconnect handling and room management
