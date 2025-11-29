const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');
const fs = require('fs').promises;

const PORT = process.env.PORT || 3000;
const ADMIN_CODE = process.env.ADMIN_CODE || 'admin123'; // Change this in production!

// Data file paths
const STATS_FILE = path.join(__dirname, 'data', 'stats.json');
const CHAT_HISTORY_FILE = path.join(__dirname, 'data', 'chat-history.json');

// Global timer settings (admin configurable)
let globalTimerSettings = {
  enabled: false,
  duration: 60 // seconds
};

// Global AI settings (admin configurable)
let globalAISettings = {
  aiVsAiEnabled: false // AI vs AI mode toggle
};

// Game statistics tracking
let gameStats = {
  totalGames: 0,
  totalGamesCompleted: 0,
  activeGames: 0,
  peakTimes: Array(24).fill(0), // Hourly game count
  boardSizes: { '9': 0, '13': 0, '15': 0, '19': 0 },
  gameModes: { 'pvp': 0, 'ai-easy': 0, 'ai-medium': 0, 'ai-hard': 0, 'ai-vs-ai': 0 },
  aiWins: 0,
  playerWins: 0,
  draws: 0
};

// Balambér chatbot messages
const balamberMessages = [
  'Sziasztok! Balambér vagyok, a ti virtuális játékmesteretek! 🎮',
  'Ki mer velem megmérkőzni? Én aztán nem ismerek kegyelmet! 😎',
  'Tudtátok, hogy az öt egy sorban a harmadik legjobb dolog a világon? Az első kettő titkos. 🤫',
  'Néha csak ülök itt és gondolkodom... Mit is csinálok én itt? 🤔',
  'A legjobb játékosok mindig a lobbyban kezdik! És itt vagyok én is! 😄',
  'Psszt... Próbáltátok már az AI vs AI módot? Lenyűgöző! 🤖⚔️🤖',
  'Mindig tanulok új stratégiákat. Ti is így csináljátok? 📚',
  'Ígérem, nem spiccelem ki a játékokat... Vagy mégis? 😈',
  'Halló? Van itt valaki? Vagy csak én beszélek magamban megint? 👻',
  'Fun fact: Az amőba neve a latin "amoeba"-ból származik. Most mindannyian okosabbak lettünk! 🧠',
  'Szerintem ma mindenkinek szerencséje lesz! Főleg nekem! 🍀',
  'Emlékeztek még mikor először játszottatok amőbát? Én igen, tegnap volt. 😅',
  'A győzelem kulcsa: stratégia, türelem, és egy csipet szerencse! ✨',
  'Néha csak nézem a játékokat és tanulok belőlük. Ti is így csináljátok? 👀',
  'Ki szereti a 15x15-ös táblát? Én azt mondom, minél nagyobb, annál jobb! 🎯'
];

// Lobby chat history (last 10 messages)
let lobbyChatHistory = [];

// Track connected clients
const connectedClients = new Map(); // socketId -> {name, isAdmin, connectedAt, createdRoom}
const loggedInPlayers = new Map(); // socketId -> {name, loggedInAt}

// Serve static files
app.use(express.static('public'));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Game state management
const rooms = new Map();
let roomIdCounter = 1000; // Start from 1000 for nicer room IDs

// Generate unique room ID
function generateRoomId() {
  return `SZOBA-${roomIdCounter++}`;
}

// Funny AI name generator
function generateFunnyAIName(difficulty) {
  const funnyNames = [
    'Terminátor', 'SzuperAgy', 'Géniusz', 'Mesterlövész', 'Bajnok',
    'Robotkommandó', 'Stratéga', 'Taktikus', 'Nagymester', 'Professzor',
    'Kódoló', 'Számológép', 'Kvantum', 'Neuron', 'Algoritmus',
    'Bináris Zseni', 'Logikai Ász', 'Következtető', 'Sakkóriás', 'Gondolkodó',
    'Digitális Mester', 'Elektronagy', 'Megamind', 'Brainiac', 'Szuperkomputer',
    'Kalkulátor', 'Problémamegoldó', 'Tervező', 'Kiborg', 'Neo'
  ];

  const randomName = funnyNames[Math.floor(Math.random() * funnyNames.length)];
  return `${randomName} (AI)`;
}

// AI Logic - Minimax with Alpha-Beta Pruning
class GomokuAI {
  constructor(difficulty = 'medium') {
    this.difficulty = difficulty;
    this.maxDepth = this.getDepthByDifficulty(difficulty);
  }

  getDepthByDifficulty(difficulty) {
    switch(difficulty) {
      case 'easy': return 1;
      case 'medium': return 2;
      case 'hard': return 2;  // Reduced from 3 to 2 to prevent freezing
      default: return 2;
    }
  }

  // Evaluate board position
  evaluateBoard(board, boardSize, aiSymbol, playerSymbol) {
    let score = 0;

    // Check all lines (horizontal, vertical, diagonals)
    const directions = [[1, 0], [0, 1], [1, 1], [1, -1]];

    for (let row = 0; row < boardSize; row++) {
      for (let col = 0; col < boardSize; col++) {
        for (const [dx, dy] of directions) {
          const lineScore = this.evaluateLine(board, boardSize, row, col, dx, dy, aiSymbol, playerSymbol);
          score += lineScore;
        }
      }
    }

    return score;
  }

  // Evaluate a single line
  evaluateLine(board, boardSize, row, col, dx, dy, aiSymbol, playerSymbol) {
    let aiCount = 0;
    let playerCount = 0;
    let empty = 0;

    for (let i = 0; i < 5; i++) {
      const r = row + i * dx;
      const c = col + i * dy;

      if (r < 0 || r >= boardSize || c < 0 || c >= boardSize) return 0;

      const cell = board[r][c];
      if (cell === aiSymbol) aiCount++;
      else if (cell === playerSymbol) playerCount++;
      else empty++;
    }

    // Can't make 5 in a row here
    if (aiCount > 0 && playerCount > 0) return 0;

    // Score based on pattern
    if (aiCount === 5) return 100000;  // Win
    if (playerCount === 5) return -100000;  // Loss
    if (aiCount === 4 && empty === 1) return 10000;  // 4 in a row (almost win)
    if (playerCount === 4 && empty === 1) return -9000;  // Block opponent's 4
    if (aiCount === 3 && empty === 2) return 1000;  // 3 in a row
    if (playerCount === 3 && empty === 2) return -900;  // Block opponent's 3
    if (aiCount === 2 && empty === 3) return 100;  // 2 in a row
    if (playerCount === 2 && empty === 3) return -90;  // Block opponent's 2

    return 0;
  }

  // Get all possible moves (with smart filtering)
  getPossibleMoves(board, boardSize) {
    const moves = [];
    const occupied = [];

    // Find all occupied cells
    for (let row = 0; row < boardSize; row++) {
      for (let col = 0; col < boardSize; col++) {
        if (board[row][col] !== null) {
          occupied.push([row, col]);
        }
      }
    }

    // If board is empty, start in center
    if (occupied.length === 0) {
      const center = Math.floor(boardSize / 2);
      return [[center, center]];
    }

    // Get cells near occupied ones - use smaller radius for better performance
    const radius = this.difficulty === 'hard' ? 1 : 2;  // Smaller search area for hard mode
    const nearbyMoves = new Set();
    for (const [row, col] of occupied) {
      for (let dr = -radius; dr <= radius; dr++) {
        for (let dc = -radius; dc <= radius; dc++) {
          const r = row + dr;
          const c = col + dc;
          if (r >= 0 && r < boardSize && c >= 0 && c < boardSize && board[r][c] === null) {
            nearbyMoves.add(`${r},${c}`);
          }
        }
      }
    }

    nearbyMoves.forEach(key => {
      const [r, c] = key.split(',').map(Number);
      moves.push([r, c]);
    });

    // Limit number of moves to consider (for performance)
    if (moves.length > 25) {
      // Sort moves by importance and take top 25
      moves.sort(() => Math.random() - 0.5);  // Simple randomization
      return moves.slice(0, 25);
    }

    return moves.length > 0 ? moves : this.getAllEmptyCells(board, boardSize);
  }

  getAllEmptyCells(board, boardSize) {
    const moves = [];
    for (let row = 0; row < boardSize; row++) {
      for (let col = 0; col < boardSize; col++) {
        if (board[row][col] === null) {
          moves.push([row, col]);
        }
      }
    }
    return moves;
  }

  // Minimax with Alpha-Beta Pruning
  minimax(board, boardSize, depth, alpha, beta, isMaximizing, aiSymbol, playerSymbol) {
    // Check terminal states
    const winner = this.checkWinner(board, boardSize);
    if (winner === aiSymbol) return 100000;
    if (winner === playerSymbol) return -100000;
    if (depth === 0) {
      return this.evaluateBoard(board, boardSize, aiSymbol, playerSymbol);
    }

    const moves = this.getPossibleMoves(board, boardSize);
    if (moves.length === 0) return 0;  // Draw

    if (isMaximizing) {
      let maxEval = -Infinity;
      for (const [row, col] of moves) {
        board[row][col] = aiSymbol;
        const evaluation = this.minimax(board, boardSize, depth - 1, alpha, beta, false, aiSymbol, playerSymbol);
        board[row][col] = null;
        maxEval = Math.max(maxEval, evaluation);
        alpha = Math.max(alpha, evaluation);
        if (beta <= alpha) break;  // Beta cutoff
      }
      return maxEval;
    } else {
      let minEval = Infinity;
      for (const [row, col] of moves) {
        board[row][col] = playerSymbol;
        const evaluation = this.minimax(board, boardSize, depth - 1, alpha, beta, true, aiSymbol, playerSymbol);
        board[row][col] = null;
        minEval = Math.min(minEval, evaluation);
        beta = Math.min(beta, evaluation);
        if (beta <= alpha) break;  // Alpha cutoff
      }
      return minEval;
    }
  }

  // Check if there's a winner
  checkWinner(board, boardSize) {
    const directions = [[1, 0], [0, 1], [1, 1], [1, -1]];

    for (let row = 0; row < boardSize; row++) {
      for (let col = 0; col < boardSize; col++) {
        const symbol = board[row][col];
        if (symbol === null) continue;

        for (const [dx, dy] of directions) {
          let count = 1;
          for (let i = 1; i < 5; i++) {
            const r = row + i * dx;
            const c = col + i * dy;
            if (r < 0 || r >= boardSize || c < 0 || c >= boardSize || board[r][c] !== symbol) break;
            count++;
          }
          if (count >= 5) return symbol;
        }
      }
    }
    return null;
  }

  // Evaluate immediate value of a move (for move ordering)
  evaluateMove(board, boardSize, row, col, symbol) {
    board[row][col] = symbol;
    const score = this.evaluateBoard(board, boardSize, symbol, symbol === 'X' ? 'O' : 'X');
    board[row][col] = null;
    return score;
  }

  // Get best move
  getBestMove(board, boardSize, aiSymbol, playerSymbol) {
    const moves = this.getPossibleMoves(board, boardSize);
    if (moves.length === 0) return null;

    let bestMove = moves[0];
    let bestValue = -Infinity;

    // For easy mode, add some randomness
    if (this.difficulty === 'easy' && Math.random() < 0.4) {
      return moves[Math.floor(Math.random() * moves.length)];
    }

    // Sort moves by immediate value for better alpha-beta pruning
    const scoredMoves = moves.map(move => ({
      move,
      score: this.evaluateMove(board, boardSize, move[0], move[1], aiSymbol)
    }));
    scoredMoves.sort((a, b) => b.score - a.score);

    for (const { move } of scoredMoves) {
      const [row, col] = move;
      board[row][col] = aiSymbol;
      const moveValue = this.minimax(board, boardSize, this.maxDepth, -Infinity, Infinity, false, aiSymbol, playerSymbol);
      board[row][col] = null;

      if (moveValue > bestValue) {
        bestValue = moveValue;
        bestMove = [row, col];
      }
    }

    return bestMove;
  }
}

class GameRoom {
  constructor(roomId, boardSize = 15, creatorId = null, creatorName = null, gameMode = 'pvp') {
    this.roomId = roomId;
    this.boardSize = boardSize;
    this.creatorId = creatorId;
    this.creatorName = creatorName;
    this.gameMode = gameMode;  // 'pvp', 'ai-easy', 'ai-medium', 'ai-hard'
    this.players = [];
    this.spectators = []; // {id, name}
    this.status = 'waiting'; // 'waiting' or 'in_progress'
    this.board = Array(boardSize).fill(null).map(() => Array(boardSize).fill(null));
    this.currentPlayer = 0; // 0 or 1
    this.gameOver = false;
    this.winner = null;
    this.winningPieces = null;
    this.lastMove = null; // {row, col} - track last move
    this.moveHistory = []; // [{row, col, symbol, player}, ...]
    this.timer = null;
    this.timerEndTime = null;

    // AI setup
    if (gameMode.startsWith('ai-')) {
      if (gameMode === 'ai-vs-ai') {
        // AI vs AI mode: create two AI players immediately
        this.isAIVsAI = true;
        this.isAIGame = false;
        this.ai = new GomokuAI('easy'); // Use easy AI for speed in AI vs AI
        this.status = 'in_progress'; // Start immediately

        // Add two AI players
        this.players.push({
          id: 'AI1',
          name: `${generateFunnyAIName('easy')} #1`,
          symbol: 'X',
          isAI: true
        });
        this.players.push({
          id: 'AI2',
          name: `${generateFunnyAIName('easy')} #2`,
          symbol: 'O',
          isAI: true
        });
      } else {
        const difficulty = gameMode.replace('ai-', '');
        this.ai = new GomokuAI(difficulty);
        this.isAIGame = true;
        this.isAIVsAI = false;
      }
    } else {
      this.ai = null;
      this.isAIGame = false;
      this.isAIVsAI = false;
    }
  }

  addPlayer(playerId, playerName) {
    // Don't allow players to join AI vs AI games
    if (this.isAIVsAI) {
      return false;
    }

    if (this.players.length < 2) {
      this.players.push({ id: playerId, name: playerName, symbol: this.players.length === 0 ? 'X' : 'O', isAI: false });

      // If this is an AI game and we just added the first player, add AI as second player
      if (this.isAIGame && this.players.length === 1) {
        const aiDifficulty = this.gameMode.replace('ai-', '');
        const aiName = generateFunnyAIName(aiDifficulty);
        this.players.push({ id: 'AI', name: aiName, symbol: 'O', isAI: true });
      }

      // Update status to in_progress when 2 players are in the room
      if (this.players.length === 2) {
        this.status = 'in_progress';
      }

      return true;
    }
    return false;
  }

  addSpectator(spectatorId, spectatorName) {
    // Only allow spectators if game is in progress
    if (this.status === 'in_progress') {
      this.spectators.push({ id: spectatorId, name: spectatorName });
      return true;
    }
    return false;
  }

  removeSpectator(spectatorId) {
    this.spectators = this.spectators.filter(s => s.id !== spectatorId);
  }

  // Make AI move
  makeAIMove() {
    if (!this.isAIGame || this.gameOver || this.players.length < 2) return null;

    const aiPlayer = this.players.find(p => p.isAI);
    if (!aiPlayer) return null;

    const aiPlayerIndex = this.players.indexOf(aiPlayer);
    if (aiPlayerIndex !== this.currentPlayer) return null;

    const aiSymbol = aiPlayer.symbol;
    const playerSymbol = this.players.find(p => !p.isAI).symbol;

    const [row, col] = this.ai.getBestMove(this.board, this.boardSize, aiSymbol, playerSymbol);

    // Use the AI player's ID
    return this.makeMove('AI', row, col);
  }

  removePlayer(playerId) {
    this.players = this.players.filter(p => p.id !== playerId);
  }

  makeMove(playerId, row, col) {
    if (this.gameOver) return { success: false, error: 'Game is over' };
    if (this.players.length < 2) return { success: false, error: 'Waiting for opponent' };
    if (this.players[this.currentPlayer].id !== playerId) return { success: false, error: 'Not your turn' };
    if (row < 0 || row >= this.boardSize || col < 0 || col >= this.boardSize) return { success: false, error: 'Invalid position' };
    if (this.board[row][col] !== null) return { success: false, error: 'Cell already occupied' };

    const symbol = this.players[this.currentPlayer].symbol;
    this.board[row][col] = symbol;

    // Track last move
    this.lastMove = { row, col };

    // Save move to history for undo
    this.moveHistory.push({
      row: row,
      col: col,
      symbol: symbol,
      player: this.currentPlayer
    });

    // Clear any existing timer
    this.clearTimer();

    // Check for win
    const winningPieces = this.checkWin(row, col, symbol);
    if (winningPieces) {
      this.gameOver = true;
      this.winner = this.players[this.currentPlayer];
      this.winningPieces = winningPieces;
      return { success: true, gameOver: true, winner: this.winner, winningPieces: winningPieces };
    }

    // Check for draw
    if (this.isBoardFull()) {
      this.gameOver = true;
      return { success: true, gameOver: true, draw: true };
    }

    // Switch player
    this.currentPlayer = 1 - this.currentPlayer;
    return { success: true, gameOver: false };
  }

  checkWin(row, col, symbol) {
    const directions = [
      [0, 1],   // horizontal
      [1, 0],   // vertical
      [1, 1],   // diagonal \
      [1, -1]   // diagonal /
    ];

    for (const [dx, dy] of directions) {
      let count = 1;
      const winningPieces = [[row, col]]; // Start with the current piece

      // Check positive direction
      for (let i = 1; i < 5; i++) {
        const newRow = row + dx * i;
        const newCol = col + dy * i;
        if (newRow >= 0 && newRow < this.boardSize && newCol >= 0 && newCol < this.boardSize && this.board[newRow][newCol] === symbol) {
          count++;
          winningPieces.push([newRow, newCol]);
        } else {
          break;
        }
      }

      // Check negative direction
      for (let i = 1; i < 5; i++) {
        const newRow = row - dx * i;
        const newCol = col - dy * i;
        if (newRow >= 0 && newRow < this.boardSize && newCol >= 0 && newCol < this.boardSize && this.board[newRow][newCol] === symbol) {
          count++;
          winningPieces.push([newRow, newCol]);
        } else {
          break;
        }
      }

      if (count >= 5) {
        // Return only the first 5 pieces (in case there are more than 5 in a row)
        return winningPieces.slice(0, 5);
      }
    }

    return null;
  }

  isBoardFull() {
    for (let i = 0; i < this.boardSize; i++) {
      for (let j = 0; j < this.boardSize; j++) {
        if (this.board[i][j] === null) return false;
      }
    }
    return true;
  }

  undoMove() {
    if (this.moveHistory.length === 0) {
      return { success: false, error: 'No moves to undo' };
    }

    if (this.gameOver) {
      return { success: false, error: 'Cannot undo after game is over' };
    }

    // Get the last move
    const lastMove = this.moveHistory.pop();

    // Remove from board
    this.board[lastMove.row][lastMove.col] = null;

    // Switch back to previous player
    this.currentPlayer = lastMove.player;

    // Clear timer
    this.clearTimer();

    return { success: true };
  }

  clearTimer() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
      this.timerEndTime = null;
    }
  }

  startTimer(callback) {
    this.clearTimer();

    if (globalTimerSettings.enabled && this.players.length === 2 && !this.gameOver) {
      this.timerEndTime = Date.now() + (globalTimerSettings.duration * 1000);

      this.timer = setTimeout(() => {
        // Time's up! Skip turn
        this.currentPlayer = 1 - this.currentPlayer;
        callback();
      }, globalTimerSettings.duration * 1000);
    }
  }

  getTimerRemaining() {
    if (!this.timerEndTime) return null;
    const remaining = Math.max(0, Math.ceil((this.timerEndTime - Date.now()) / 1000));
    return remaining;
  }

  reset() {
    this.board = Array(this.boardSize).fill(null).map(() => Array(this.boardSize).fill(null));
    this.currentPlayer = 0;
    this.gameOver = false;
    this.winner = null;
    this.winningPieces = null;
    this.lastMove = null;
    this.moveHistory = [];
    this.clearTimer();
  }

  getState() {
    return {
      board: this.board,
      boardSize: this.boardSize,
      players: this.players,
      spectators: this.spectators,
      status: this.status,
      currentPlayer: this.currentPlayer,
      gameOver: this.gameOver,
      winner: this.winner,
      winningPieces: this.winningPieces,
      lastMove: this.lastMove,
      canUndo: this.moveHistory.length > 0 && !this.gameOver,
      timerEnabled: globalTimerSettings.enabled,
      timerDuration: globalTimerSettings.duration,
      timerRemaining: this.getTimerRemaining()
    };
  }
}

// Helper function to get rooms list
function getRoomsList() {
  const roomsList = [];
  rooms.forEach((room, roomId) => {
    roomsList.push({
      roomId: roomId,
      playerCount: room.players.length,
      spectatorCount: room.spectators.length,
      boardSize: room.boardSize,
      players: room.players.map(p => p.name),
      creatorName: room.creatorName,
      status: room.status, // 'waiting' or 'in_progress'
      isWaiting: room.status === 'waiting',
      isFull: room.players.length === 2,
      gameStarted: room.status === 'in_progress'
    });
  });
  return roomsList;
}

// Broadcast rooms list to all connected clients
function broadcastRoomsList() {
  io.emit('roomsList', getRoomsList());
}

// Get online players list
function getOnlinePlayersList() {
  const players = [];
  connectedClients.forEach((client, socketId) => {
    players.push({
      socketId: socketId,
      name: client.name,
      isAdmin: client.isAdmin,
      connectedAt: client.connectedAt,
      room: client.room || null
    });
  });
  return players;
}

// Broadcast online players list to admins
function broadcastOnlinePlayers() {
  const playersList = getOnlinePlayersList();
  connectedClients.forEach((client, socketId) => {
    if (client.isAdmin) {
      io.to(socketId).emit('onlinePlayers', playersList);
    }
  });
}

// Broadcast online players list to all users (for lobby)
function broadcastLobbyPlayers() {
  const playersList = [];
  connectedClients.forEach((client, socketId) => {
    if (!client.isAdmin) {
      playersList.push({
        socketId: socketId,
        name: client.name,
        room: client.room || null
      });
    }
  });
  io.emit('lobbyPlayers', playersList);
}

// Broadcast game statistics to all admins
function broadcastStatsToAdmins() {
  connectedClients.forEach((client, sid) => {
    if (client.isAdmin) {
      io.to(sid).emit('gameStats', gameStats);
    }
  });
}

// Start AI vs AI automatic game
function startAIvsAIGame(roomId) {
  const room = rooms.get(roomId);
  if (!room || !room.isAIVsAI) return;

  console.log(`Starting AI vs AI game in room ${roomId}`);

  // Broadcast initial game state
  io.to(roomId).emit('gameState', room.getState());
  io.to(roomId).emit('message', '🤖 AI vs AI játék kezdődik!');

  // Function to make next AI move
  function makeNextAIMove() {
    if (room.gameOver) {
      console.log(`AI vs AI game in room ${roomId} finished`);
      return;
    }

    const currentPlayer = room.players[room.currentPlayer];
    const otherPlayer = room.players[1 - room.currentPlayer];

    // Make AI move
    const [row, col] = room.ai.getBestMove(
      room.board,
      room.boardSize,
      currentPlayer.symbol,
      otherPlayer.symbol
    );

    const result = room.makeMove(currentPlayer.id, row, col);

    if (result.success) {
      // Broadcast updated state
      io.to(roomId).emit('gameState', room.getState());

      if (result.gameOver) {
        // Track statistics - AI vs AI game ended
        gameStats.activeGames = Math.max(0, gameStats.activeGames - 1);
        gameStats.totalGamesCompleted++;

        if (result.draw) {
          gameStats.draws++;
          io.to(roomId).emit('message', '🤝 Döntetlen!');
          // Announce AI vs AI draw to lobby
          announceGameResult(currentPlayer.name, otherPlayer.name, true);
        } else {
          gameStats.aiWins++; // Both players are AI
          io.to(roomId).emit('message', `🏆 ${result.winner.name} nyert!`);
          // Announce AI vs AI winner to lobby
          const loser = room.players.find(p => p.id !== result.winner.id);
          announceGameResult(result.winner.name, loser?.name || 'AI Ellenfél');
        }

        // Save stats to file
        saveStats().catch(err => console.error('Failed to save stats:', err));

        // Broadcast updated stats to admins
        broadcastStatsToAdmins();
      } else {
        // Schedule next move
        setTimeout(makeNextAIMove, 800); // 800ms delay between moves
      }
    }
  }

  // Start the first move after a short delay
  setTimeout(makeNextAIMove, 1000);
}

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Send current rooms list and online players to newly connected client
  socket.emit('roomsList', getRoomsList());
  socket.emit('lobbyPlayers', (function() {
    const playersList = [];
    connectedClients.forEach((client, socketId) => {
      if (!client.isAdmin) {
        playersList.push({
          socketId: socketId,
          name: client.name,
          room: client.room || null
        });
      }
    });
    return playersList;
  })());

  // Player login (just registers the player)
  socket.on('login', ({ playerName }) => {
    const name = playerName || `Player_${socket.id.substring(0, 4)}`;

    // Check if name is already taken
    let nameTaken = false;
    connectedClients.forEach((client, socketId) => {
      if (client.name === name && socketId !== socket.id) {
        nameTaken = true;
      }
    });

    if (nameTaken) {
      socket.emit('error', `A "${name}" név már foglalt! Kérlek válassz másik nevet.`);
      return;
    }

    // Add to connected clients
    connectedClients.set(socket.id, {
      name: name,
      isAdmin: false,
      connectedAt: new Date(),
      createdRoom: null,
      room: null
    });

    // Add to logged in players
    loggedInPlayers.set(socket.id, {
      name: name,
      loggedInAt: new Date()
    });

    socket.emit('loginSuccess', { playerName: name });
    console.log('Player logged in:', name, socket.id);

    // Send lobby chat history to the newly logged-in player
    setTimeout(() => {
      lobbyChatHistory.forEach(msg => {
        socket.emit('lobbyChatMessage', msg);
      });
    }, 100);

    // Announce login to lobby (with slight delay to ensure client is ready)
    setTimeout(() => {
      const loginMessages = [
        `👋 ${name} belépett a lobbiba! Üdv! 🎮`,
        `🎉 ${name} csatlakozott! Hajrá! 💪`,
        `✨ ${name} érkezett! Sok sikert! 🍀`,
        `🚀 ${name} itt van! Rajta! ⚡`
      ];
      announceLobbyEvent(loginMessages[Math.floor(Math.random() * loginMessages.length)]);
    }, 200);

    // Broadcast updated players list to admins and lobby
    broadcastOnlinePlayers();
    broadcastLobbyPlayers();
  });

  // Create room (without joining) - auto-generates room ID
  socket.on('createRoom', ({ boardSize, gameMode }) => {
    const client = connectedClients.get(socket.id);

    if (!client) {
      socket.emit('error', 'Kérlek először jelentkezz be!');
      return;
    }

    // Check if player already created a room
    if (client.createdRoom) {
      socket.emit('error', 'Már hoztál létre egy szobát! Csak egy szobát hozhatsz létre egyszerre.');
      return;
    }

    // Check if AI vs AI mode is allowed (admin must enable it)
    if (gameMode === 'ai-vs-ai' && !globalAISettings.aiVsAiEnabled) {
      socket.emit('error', 'AI vs AI mód jelenleg nem elérhető. Az admin engedélyezheti az admin panelben.');
      return;
    }

    // Auto-generate unique room ID
    const roomId = generateRoomId();

    const size = boardSize || 15;
    const mode = gameMode || 'pvp';
    const newRoom = new GameRoom(roomId, size, socket.id, client.name, mode);
    rooms.set(roomId, newRoom);

    // Track statistics
    gameStats.totalGames++;
    gameStats.boardSizes[size] = (gameStats.boardSizes[size] || 0) + 1;
    gameStats.gameModes[mode] = (gameStats.gameModes[mode] || 0) + 1;
    saveStats(); // Save stats after room creation

    // Track that this player created this room
    client.createdRoom = roomId;

    socket.emit('roomCreated', { roomId, boardSize: size, gameMode: mode });
    console.log(`Room ${roomId} created by ${client.name} (mode: ${mode})`);

    // Announce room creation to lobby
    const gameModeText = mode === 'pvp' ? 'PvP' : mode === 'ai-vs-ai' ? 'AI vs AI' : `AI ${mode.split('-')[1]}`;
    const roomMessages = [
      `🎮 ${client.name} létrehozott egy ${size}x${size} szobát (${gameModeText})! 🆕`,
      `🏗️ ${client.name} új szobát nyitott: ${size}x${size} (${gameModeText})! ✨`,
      `🎯 ${client.name} szobát készített: ${size}x${size} (${gameModeText})! 🚀`
    ];
    announceLobbyEvent(roomMessages[Math.floor(Math.random() * roomMessages.length)]);

    // Broadcast updated rooms list
    broadcastRoomsList();

    // If AI vs AI mode, start the automatic game
    if (mode === 'ai-vs-ai') {
      startAIvsAIGame(roomId);
    }
  });

  // Admin login
  socket.on('adminLogin', ({ adminCode }) => {
    if (adminCode === ADMIN_CODE) {
      const client = connectedClients.get(socket.id);
      if (client) {
        client.isAdmin = true;
        client.name = 'Admin';
        socket.emit('adminLoginSuccess', { isAdmin: true });
        socket.emit('onlinePlayers', getOnlinePlayersList());
        socket.emit('timerSettings', globalTimerSettings);
        socket.emit('aiSettings', globalAISettings);
        socket.emit('gameStats', gameStats);
        console.log('Admin logged in:', socket.id);
      }
    } else {
      socket.emit('adminLoginFailed', { error: 'Invalid admin code' });
    }
  });

  socket.on('joinRoom', ({ roomId }) => {
    const client = connectedClients.get(socket.id);

    if (!client) {
      socket.emit('error', 'Kérlek először jelentkezz be!');
      return;
    }

    if (!rooms.has(roomId)) {
      socket.emit('error', 'Ez a szoba nem létezik!');
      return;
    }

    const room = rooms.get(roomId);
    const joined = room.addPlayer(socket.id, client.name);

    if (joined) {
      socket.join(roomId);
      socket.roomId = roomId;

      // Update connected client info
      client.room = roomId;

      // Clear createdRoom flag since player actually joined
      if (client.createdRoom === roomId) {
        client.createdRoom = null;
      }

      io.to(roomId).emit('gameState', room.getState());
      io.to(roomId).emit('message', `${client.name} csatlakozott a játékhoz`);

      // Send chat system message
      io.to(roomId).emit('chatMessage', {
        senderId: 'system',
        senderName: 'Rendszer',
        message: `${client.name} csatlakozott a szobához`,
        timestamp: Date.now()
      });

      if (room.players.length === 2) {
        io.to(roomId).emit('message', 'Játék elindult! X kezd.');

        // Track statistics - game started
        gameStats.activeGames++;
        const currentHour = new Date().getHours();
        gameStats.peakTimes[currentHour]++;
        saveStats(); // Save stats after game start

        // Announce game start to lobby
        const player1 = room.players[0]?.name || 'Játékos 1';
        const player2 = room.players[1]?.name || 'Játékos 2';
        const gameStartMessages = [
          `⚔️ Játék indult! ${player1} vs ${player2}! Ki fog nyerni? 🎮`,
          `🔥 Harc kezdődött: ${player1} vs ${player2}! Hajrá! 💪`,
          `🎯 ${player1} és ${player2} csatáznak! Izgalmas lesz! ⚡`,
          `🏁 START! ${player1} vs ${player2}! Győzzön a jobb! 🏆`
        ];
        announceLobbyEvent(gameStartMessages[Math.floor(Math.random() * gameStartMessages.length)]);

        // Start timer for first player
        room.startTimer(() => {
          io.to(roomId).emit('message', 'Idő lejárt! Kör átugrva.');
          io.to(roomId).emit('gameState', room.getState());
        });
      }

      // Broadcast updated rooms list
      broadcastRoomsList();
      broadcastOnlinePlayers();
      broadcastLobbyPlayers();

      console.log(`${client.name} joined room ${roomId}`);
    } else {
      socket.emit('error', 'A szoba tele van!');
    }
  });

  // Watch a game as spectator
  socket.on('watchRoom', ({ roomId }) => {
    const client = connectedClients.get(socket.id);

    if (!client) {
      socket.emit('error', 'Kérlek először jelentkezz be!');
      return;
    }

    if (!rooms.has(roomId)) {
      socket.emit('error', 'Ez a szoba nem létezik!');
      return;
    }

    const room = rooms.get(roomId);

    // Prevent room creator from spectating their own room if not a player
    if (room.creatorId === socket.id && !room.players.find(p => p.id === socket.id)) {
      socket.emit('error', 'Nem nézheted meg a saját szobádat nézőként! Csatlakozz játékosként.');
      return;
    }

    const added = room.addSpectator(socket.id, client.name);

    if (added) {
      socket.join(roomId);
      socket.roomId = roomId;
      socket.isSpectator = true;

      // Update connected client info
      client.room = roomId;

      socket.emit('spectatorJoined', { roomId });
      socket.emit('gameState', room.getState());
      io.to(roomId).emit('message', `${client.name} nézi a játékot`);

      // Send chat system message
      io.to(roomId).emit('chatMessage', {
        senderId: 'system',
        senderName: 'Rendszer',
        message: `👁️ ${client.name} nézi a játékot`,
        timestamp: Date.now()
      });

      // Broadcast updated rooms list
      broadcastRoomsList();

      console.log(`${client.name} watching room ${roomId}`);
    } else {
      socket.emit('error', 'Nem lehet nézni ezt a játékot! (Még nem kezdődött el)');
    }
  });

  // Leave spectator mode
  socket.on('leaveSpectator', () => {
    if (!socket.roomId || !socket.isSpectator) {
      return;
    }

    const room = rooms.get(socket.roomId);
    if (room) {
      const client = connectedClients.get(socket.id);
      room.removeSpectator(socket.id);
      io.to(socket.roomId).emit('message', `${client?.name || 'Néző'} kilépett a nézői módból`);

      // Broadcast updated room state to remaining users
      io.to(socket.roomId).emit('gameState', room.getState());
    }

    socket.leave(socket.roomId);
    const client = connectedClients.get(socket.id);
    if (client) {
      client.room = null;
    }
    socket.roomId = null;
    socket.isSpectator = false;

    socket.emit('leftSpectator');

    // Broadcast updated rooms list
    broadcastRoomsList();
  });

  // Leave room (player leaving game)
  socket.on('leaveRoom', () => {
    if (!socket.roomId) {
      return;
    }

    const room = rooms.get(socket.roomId);
    if (!room) {
      socket.roomId = null;
      return;
    }

    const client = connectedClients.get(socket.id);
    const player = room.players.find(p => p.id === socket.id);

    if (player) {
      // If a player leaves, delete the entire room and kick everyone
      io.to(socket.roomId).emit('roomClosed', { message: 'Játékos kilépett, szoba bezárva' });

      // Clear all players and spectators
      room.players.forEach(p => {
        if (p.id !== socket.id && !p.isAI) {
          const playerSocket = io.sockets.sockets.get(p.id);
          if (playerSocket) {
            playerSocket.leave(socket.roomId);
            playerSocket.roomId = null;
            const playerClient = connectedClients.get(p.id);
            if (playerClient) {
              playerClient.room = null;
            }
          }
        }
      });

      room.spectators.forEach(spectator => {
        const spectatorSocket = io.sockets.sockets.get(spectator.id);
        if (spectatorSocket) {
          spectatorSocket.leave(socket.roomId);
          spectatorSocket.roomId = null;
          spectatorSocket.isSpectator = false;
          const spectatorClient = connectedClients.get(spectator.id);
          if (spectatorClient) {
            spectatorClient.room = null;
          }
        }
      });

      rooms.delete(socket.roomId);
    }

    socket.leave(socket.roomId);
    if (client) {
      client.room = null;
    }
    socket.roomId = null;

    // Broadcast updated rooms list
    broadcastRoomsList();
    broadcastOnlinePlayers();
    broadcastLobbyPlayers();
  });

  socket.on('makeMove', ({ row, col }) => {
    if (!socket.roomId) return;

    const room = rooms.get(socket.roomId);
    if (!room) return;

    const result = room.makeMove(socket.id, row, col);

    if (result.success) {
      io.to(socket.roomId).emit('gameState', room.getState());

      if (result.gameOver) {
        // Track statistics - game ended
        gameStats.activeGames = Math.max(0, gameStats.activeGames - 1);
        gameStats.totalGamesCompleted++;

        if (result.draw) {
          gameStats.draws++;
          io.to(socket.roomId).emit('message', "It's a draw!");
          // Announce draw to lobby
          const player1 = room.players[0]?.name || 'Játékos 1';
          const player2 = room.players[1]?.name || 'Játékos 2';
          announceGameResult(player1, player2, true);
        } else {
          // Track AI wins vs player wins
          if (result.winner.isAI) {
            gameStats.aiWins++;
          } else {
            gameStats.playerWins++;
          }
          saveStats(); // Save stats after game end

          io.to(socket.roomId).emit('message', `${result.winner.name} wins!`);
          // Announce winner to lobby
          const loser = room.players.find(p => p.id !== result.winner.id);
          announceGameResult(result.winner.name, loser?.name || 'Ellenfél');
        }

        // Broadcast updated stats to admins
        broadcastStatsToAdmins();
      } else {
        // Start timer for next player
        room.startTimer(() => {
          // Timer expired callback
          io.to(socket.roomId).emit('message', 'Idő lejárt! Kör átugrva.');
          io.to(socket.roomId).emit('gameState', room.getState());

          // Start timer for the next player
          room.startTimer(() => {
            io.to(socket.roomId).emit('message', 'Idő lejárt! Kör átugrva.');
            io.to(socket.roomId).emit('gameState', room.getState());
          });
        });

        // If it's an AI game and AI's turn, make AI move after a short delay
        if (room.isAIGame && !room.gameOver) {
          setTimeout(() => {
            const aiResult = room.makeAIMove();
            if (aiResult && aiResult.success) {
              io.to(socket.roomId).emit('gameState', room.getState());

              if (aiResult.gameOver) {
                // Track statistics - AI game ended
                gameStats.activeGames = Math.max(0, gameStats.activeGames - 1);
                gameStats.totalGamesCompleted++;

                if (aiResult.draw) {
                  gameStats.draws++;
                  io.to(socket.roomId).emit('message', "It's a draw!");
                  // Announce draw to lobby
                  const player1 = room.players[0]?.name || 'Játékos 1';
                  const player2 = room.players[1]?.name || 'Játékos 2';
                  announceGameResult(player1, player2, true);
                } else {
                  // Track AI wins vs player wins
                  if (aiResult.winner.isAI) {
                    gameStats.aiWins++;
                  } else {
                    gameStats.playerWins++;
                  }

                  io.to(socket.roomId).emit('message', `${aiResult.winner.name} wins!`);
                  // Announce winner to lobby
                  const loser = room.players.find(p => p.id !== aiResult.winner.id);
                  announceGameResult(aiResult.winner.name, loser?.name || 'Ellenfél');
                }

                // Broadcast updated stats to admins
                broadcastStatsToAdmins();
              }
            }
          }, 500);  // 500ms delay to make AI feel more natural
        }
      }
    } else {
      socket.emit('error', result.error);
    }
  });

  socket.on('chatMessage', ({ message }) => {
    if (!socket.roomId) return;

    const room = rooms.get(socket.roomId);
    if (!room) return;

    const client = connectedClients.get(socket.id);
    if (!client) return;

    // Validate message
    if (!message || typeof message !== 'string') return;

    const trimmedMessage = message.trim();
    if (trimmedMessage.length === 0 || trimmedMessage.length > 200) return;

    // Broadcast message to everyone in the room
    io.to(socket.roomId).emit('chatMessage', {
      senderId: socket.id,
      senderName: client.name,
      message: trimmedMessage,
      timestamp: Date.now()
    });
  });

  socket.on('lobbyChatMessage', ({ message }) => {
    const client = connectedClients.get(socket.id);
    if (!client) return;

    // Validate message
    if (!message || typeof message !== 'string') return;

    const trimmedMessage = message.trim();
    if (trimmedMessage.length === 0 || trimmedMessage.length > 200) return;

    // Create message object
    const chatMessage = {
      senderId: socket.id,
      senderName: client.name,
      message: trimmedMessage,
      timestamp: Date.now()
    };

    // Add to chat history
    addToLobbyChatHistory(chatMessage);

    // Broadcast message to everyone in lobby (not in a room)
    connectedClients.forEach((c, sid) => {
      if (!c.room && !c.isAdmin) {
        io.to(sid).emit('lobbyChatMessage', chatMessage);
      }
    });
  });

  socket.on('undoMove', () => {
    if (!socket.roomId) return;

    const room = rooms.get(socket.roomId);
    if (!room) return;

    const result = room.undoMove();

    if (result.success) {
      io.to(socket.roomId).emit('message', 'Lépés visszavonva!');
      io.to(socket.roomId).emit('gameState', room.getState());

      // Restart timer for current player
      room.startTimer(() => {
        io.to(socket.roomId).emit('message', 'Idő lejárt! Kör átugrva.');
        io.to(socket.roomId).emit('gameState', room.getState());
      });
    } else {
      socket.emit('error', result.error);
    }
  });

  socket.on('resetGame', () => {
    if (!socket.roomId) return;

    const room = rooms.get(socket.roomId);
    if (!room) return;

    room.reset();
    io.to(socket.roomId).emit('gameState', room.getState());
    io.to(socket.roomId).emit('message', 'Game reset! X goes first.');
  });

  // Request new game
  socket.on('requestNewGame', () => {
    if (!socket.roomId) return;

    const room = rooms.get(socket.roomId);
    if (!room) return;

    const client = connectedClients.get(socket.id);
    if (!client) return;

    // Find the opponent (not spectators, only players)
    const opponent = room.players.find(p => p.id !== socket.id && !p.isAI);
    if (opponent) {
      io.to(opponent.id).emit('newGameRequest', { requesterName: client.name });
    }
  });

  // Accept new game
  socket.on('acceptNewGame', () => {
    if (!socket.roomId) return;

    const room = rooms.get(socket.roomId);
    if (!room) return;

    // Reset the game
    room.reset();

    // Notify both players
    io.to(socket.roomId).emit('newGameAccepted');
    io.to(socket.roomId).emit('gameState', room.getState());
    io.to(socket.roomId).emit('message', '🎮 Új játék kezdődik! X kezd.');

    // Start timer if enabled
    room.startTimer(() => {
      io.to(socket.roomId).emit('message', 'Idő lejárt! Kör átugrva.');
      io.to(socket.roomId).emit('gameState', room.getState());
    });
  });

  // Decline new game
  socket.on('declineNewGame', () => {
    if (!socket.roomId) return;

    const room = rooms.get(socket.roomId);
    if (!room) return;

    // Find the requester (opponent)
    const opponent = room.players.find(p => p.id !== socket.id && !p.isAI);
    if (opponent) {
      io.to(opponent.id).emit('newGameDeclined');
    }
  });

  // Admin: Kick player
  socket.on('adminKickPlayer', ({ targetSocketId }) => {
    const client = connectedClients.get(socket.id);
    if (!client || !client.isAdmin) {
      socket.emit('error', 'Unauthorized');
      return;
    }

    const targetSocket = io.sockets.sockets.get(targetSocketId);
    if (targetSocket) {
      targetSocket.emit('kicked', { message: 'You have been kicked by an admin' });
      targetSocket.disconnect(true);
      console.log(`Admin ${socket.id} kicked player ${targetSocketId}`);
    }
  });

  // Admin: Close room
  socket.on('adminCloseRoom', ({ roomId }) => {
    const client = connectedClients.get(socket.id);
    if (!client || !client.isAdmin) {
      socket.emit('error', 'Unauthorized');
      return;
    }

    const room = rooms.get(roomId);
    if (room) {
      // Kick all players from the room
      room.players.forEach(player => {
        const playerSocket = io.sockets.sockets.get(player.id);
        if (playerSocket) {
          playerSocket.emit('roomClosed', { message: 'Room has been closed by an admin' });
          playerSocket.leave(roomId);
        }
      });

      rooms.delete(roomId);
      broadcastRoomsList();
      broadcastOnlinePlayers();
      console.log(`Admin ${socket.id} closed room ${roomId}`);
    }
  });

  // Admin: Get timer settings
  socket.on('adminGetTimerSettings', () => {
    const client = connectedClients.get(socket.id);
    if (!client || !client.isAdmin) {
      socket.emit('error', 'Unauthorized');
      return;
    }

    socket.emit('timerSettings', globalTimerSettings);
  });

  // Admin: Set timer settings
  socket.on('adminSetTimer', ({ enabled, duration }) => {
    const client = connectedClients.get(socket.id);
    if (!client || !client.isAdmin) {
      socket.emit('error', 'Unauthorized');
      return;
    }

    if (typeof enabled === 'boolean') {
      globalTimerSettings.enabled = enabled;
    }

    if (typeof duration === 'number' && duration > 0 && duration <= 300) {
      globalTimerSettings.duration = duration;
    }

    // Broadcast to all admins
    connectedClients.forEach((c, sid) => {
      if (c.isAdmin) {
        io.to(sid).emit('timerSettings', globalTimerSettings);
      }
    });

    // Update all active rooms
    rooms.forEach(room => {
      io.to(room.roomId).emit('gameState', room.getState());
    });

    console.log('Timer settings updated:', globalTimerSettings);
  });

  socket.on('adminSetAISettings', ({ aiVsAiEnabled }) => {
    const client = connectedClients.get(socket.id);
    if (!client || !client.isAdmin) {
      socket.emit('error', 'Unauthorized');
      return;
    }

    if (typeof aiVsAiEnabled === 'boolean') {
      globalAISettings.aiVsAiEnabled = aiVsAiEnabled;
    }

    // Broadcast to all admins
    connectedClients.forEach((c, sid) => {
      if (c.isAdmin) {
        io.to(sid).emit('aiSettings', globalAISettings);
      }
    });

    console.log('AI settings updated:', globalAISettings);
  });

  // Handle stats request (for public statistics view)
  socket.on('requestStats', () => {
    socket.emit('gameStats', gameStats);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);

    const client = connectedClients.get(socket.id);

    // Announce disconnect to lobby (if not admin and has name)
    if (client && !client.isAdmin && client.name) {
      const disconnectMessages = [
        `👋 ${client.name} kilépett... Szia! 😢`,
        `🚪 ${client.name} távozott... Viszlát! 👋`,
        `💨 ${client.name} elment... Gyere vissza! 🙏`,
        `😔 ${client.name} otthagyta a lobbyt... 💔`
      ];
      announceLobbyEvent(disconnectMessages[Math.floor(Math.random() * disconnectMessages.length)]);
    }

    // Remove from connected clients and logged in players
    connectedClients.delete(socket.id);
    loggedInPlayers.delete(socket.id);

    // If player created a room, delete it if they never joined as a player
    if (client && client.createdRoom) {
      const createdRoom = rooms.get(client.createdRoom);
      if (createdRoom) {
        // Check if the creator is actually a player in the room
        const isPlayerInRoom = createdRoom.players.find(p => p.id === socket.id && !p.isAI);

        // Delete room if creator never joined, OR if it's an AI vs AI room (creator is not a player)
        if (!isPlayerInRoom) {
          // Notify anyone watching (spectators or AI vs AI watchers)
          io.to(client.createdRoom).emit('roomClosed', { message: 'A szoba létrehozója kilépett, szoba bezárva' });

          rooms.delete(client.createdRoom);
          console.log(`Deleted room ${client.createdRoom} created by ${client.name} (creator left without joining)`);
        }
      }
    }

    if (socket.roomId) {
      const room = rooms.get(socket.roomId);
      if (room) {
        const player = room.players.find(p => p.id === socket.id);
        const isPlayer = player !== undefined;
        const isSpectator = socket.isSpectator;

        if (isPlayer) {
          // If a player disconnects, delete the entire room
          io.to(socket.roomId).emit('roomClosed', { message: 'Játékos kilépett, szoba bezárva' });

          // Kick all spectators back to lobby
          room.spectators.forEach(spectator => {
            const spectatorSocket = io.sockets.sockets.get(spectator.id);
            if (spectatorSocket) {
              spectatorSocket.leave(socket.roomId);
              spectatorSocket.roomId = null;
              spectatorSocket.isSpectator = false;
            }
          });

          rooms.delete(socket.roomId);
          console.log(`Room ${socket.roomId} deleted because player ${player.name} disconnected`);
        } else if (isSpectator) {
          // If a spectator disconnects, just remove them
          room.removeSpectator(socket.id);
          io.to(socket.roomId).emit('message', `${client?.name || 'Néző'} kilépett a nézői módból`);
          io.to(socket.roomId).emit('gameState', room.getState());
          console.log(`Spectator ${client?.name} left room ${socket.roomId}`);
        }

        // Broadcast updated rooms list
        broadcastRoomsList();
      }
    }

    // Broadcast updated online players list to admins and rooms list
    broadcastOnlinePlayers();
    broadcastRoomsList();
    broadcastLobbyPlayers();
  });
});

// Balambér announces game result to lobby
function announceGameResult(winnerName, loserName, isDraw = false) {
  // Check if there are players in lobby (not in a room and not admin)
  const lobbyPlayers = [];
  connectedClients.forEach((client, sid) => {
    if (!client.room && !client.isAdmin) {
      lobbyPlayers.push(sid);
    }
  });

  // Only send if there are players in lobby
  if (lobbyPlayers.length > 0) {
    let message;
    if (isDraw) {
      message = `⚡ Döntetlen! ${winnerName} és ${loserName} nem tudtak nyerni! 🤝`;
    } else {
      const announcements = [
        `🏆 ${winnerName} legyőzte ${loserName}-t! Gratulálok! 🎉`,
        `⚔️ ${winnerName} nyert ${loserName} ellen! Szép játék! 👏`,
        `🎯 ${winnerName} győzött! ${loserName} legközelebb több szerencsét! 🍀`,
        `🔥 ${winnerName} simán verte ${loserName}-t! Respect! 💪`,
        `✨ ${winnerName} csapata nyert! ${loserName} majd legközelebb! 😊`
      ];
      message = announcements[Math.floor(Math.random() * announcements.length)];
    }

    announceLobbyEvent(message);
  }
}

// Generic function to announce events to lobby
function announceLobbyEvent(message, excludeSocketId = null) {
  const lobbyPlayers = [];
  connectedClients.forEach((client, sid) => {
    if (!client.room && !client.isAdmin && sid !== excludeSocketId) {
      lobbyPlayers.push(sid);
    }
  });

  if (lobbyPlayers.length > 0) {
    const chatMessage = {
      senderId: 'bot',
      senderName: '🤖 Balambér',
      message: message,
      timestamp: Date.now()
    };

    // Add to chat history
    addToLobbyChatHistory(chatMessage);

    lobbyPlayers.forEach(sid => {
      io.to(sid).emit('lobbyChatMessage', chatMessage);
    });

    console.log(`Balambér announced: "${message}" to ${lobbyPlayers.length} players`);
  }
}

// Balambér chatbot - sends random messages to lobby
function sendBalamberMessage() {
  // Check if there are players in lobby (not in a room and not admin)
  const lobbyPlayers = [];
  connectedClients.forEach((client, sid) => {
    if (!client.room && !client.isAdmin) {
      lobbyPlayers.push(sid);
    }
  });

  // Only send if there are players in lobby
  if (lobbyPlayers.length > 0) {
    const randomMessage = balamberMessages[Math.floor(Math.random() * balamberMessages.length)];

    const chatMessage = {
      senderId: 'bot',
      senderName: '🤖 Balambér',
      message: randomMessage,
      timestamp: Date.now()
    };

    // Add to chat history
    addToLobbyChatHistory(chatMessage);

    lobbyPlayers.forEach(sid => {
      io.to(sid).emit('lobbyChatMessage', chatMessage);
    });

    console.log(`Balambér said: "${randomMessage}" to ${lobbyPlayers.length} players`);
  }
}

// Start Balambér chatbot (sends message every 60-120 seconds)
function scheduleNextBalamberMessage() {
  const delay = 60000 + Math.random() * 60000; // 60-120 seconds
  setTimeout(() => {
    sendBalamberMessage();
    scheduleNextBalamberMessage();
  }, delay);
}

// === Data Persistence Functions ===

// Ensure data directory exists
async function ensureDataDirectory() {
  const dataDir = path.join(__dirname, 'data');
  try {
    await fs.mkdir(dataDir, { recursive: true });
  } catch (error) {
    console.error('Error creating data directory:', error);
  }
}

// Save statistics to file
async function saveStats() {
  try {
    await ensureDataDirectory();
    await fs.writeFile(STATS_FILE, JSON.stringify(gameStats, null, 2));
    console.log('📊 Statistics saved');
  } catch (error) {
    console.error('Error saving statistics:', error);
  }
}

// Load statistics from file
async function loadStats() {
  try {
    const data = await fs.readFile(STATS_FILE, 'utf8');
    const loadedStats = JSON.parse(data);
    // Merge loaded stats with default structure (in case of new fields)
    gameStats = { ...gameStats, ...loadedStats };
    console.log('📊 Statistics loaded from file');
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error('Error loading statistics:', error);
    } else {
      console.log('📊 No previous statistics found, starting fresh');
    }
  }
}

// Save chat history to file
async function saveChatHistory() {
  try {
    await ensureDataDirectory();
    await fs.writeFile(CHAT_HISTORY_FILE, JSON.stringify(lobbyChatHistory, null, 2));
    console.log('💬 Chat history saved');
  } catch (error) {
    console.error('Error saving chat history:', error);
  }
}

// Load chat history from file
async function loadChatHistory() {
  try {
    const data = await fs.readFile(CHAT_HISTORY_FILE, 'utf8');
    lobbyChatHistory = JSON.parse(data);
    console.log('💬 Chat history loaded from file');
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error('Error loading chat history:', error);
    } else {
      console.log('💬 No previous chat history found, starting fresh');
    }
  }
}

// Add message to lobby chat history (keep last 10)
function addToLobbyChatHistory(message) {
  lobbyChatHistory.push(message);
  // Keep only last 10 messages
  if (lobbyChatHistory.length > 10) {
    lobbyChatHistory = lobbyChatHistory.slice(-10);
  }
  // Save to file (async, don't wait)
  saveChatHistory().catch(err => console.error('Failed to save chat history:', err));
}

// Start server and load data
async function startServer() {
  // Load persisted data
  await loadStats();
  await loadChatHistory();

  http.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Open http://localhost:${PORT} in your browser`);

    // Start Balambér chatbot after 30 seconds
    setTimeout(() => {
      console.log('🤖 Balambér chatbot activated!');
      scheduleNextBalamberMessage();
    }, 30000);

    // Send lobby chat history to new players when they join
    io.on('connection', (socket) => {
      socket.on('requestLobbyChatHistory', () => {
        lobbyChatHistory.forEach(msg => {
          socket.emit('lobbyChatMessage', msg);
        });
      });
    });
  });
}

// Start the server
startServer();
