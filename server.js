const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

const PORT = process.env.PORT || 3000;
const ADMIN_CODE = process.env.ADMIN_CODE || 'admin123'; // Change this in production!

// Global timer settings (admin configurable)
let globalTimerSettings = {
  enabled: false,
  duration: 60 // seconds
};

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

class GameRoom {
  constructor(roomId, boardSize = 15, creatorId = null, creatorName = null) {
    this.roomId = roomId;
    this.boardSize = boardSize;
    this.creatorId = creatorId;
    this.creatorName = creatorName;
    this.players = [];
    this.board = Array(boardSize).fill(null).map(() => Array(boardSize).fill(null));
    this.currentPlayer = 0; // 0 or 1
    this.gameOver = false;
    this.winner = null;
    this.winningPieces = null;
    this.moveHistory = []; // [{row, col, symbol, player}, ...]
    this.timer = null;
    this.timerEndTime = null;
  }

  addPlayer(playerId, playerName) {
    if (this.players.length < 2) {
      this.players.push({ id: playerId, name: playerName, symbol: this.players.length === 0 ? 'X' : 'O' });
      return true;
    }
    return false;
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
    this.moveHistory = [];
    this.clearTimer();
  }

  getState() {
    return {
      board: this.board,
      boardSize: this.boardSize,
      players: this.players,
      currentPlayer: this.currentPlayer,
      gameOver: this.gameOver,
      winner: this.winner,
      winningPieces: this.winningPieces,
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
      boardSize: room.boardSize,
      players: room.players.map(p => p.name),
      creatorName: room.creatorName,
      isWaiting: room.players.length < 2,
      isFull: room.players.length === 2,
      gameStarted: room.players.length === 2
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

    // Add to connected clients
    connectedClients.set(socket.id, {
      name: name,
      isAdmin: false,
      connectedAt: new Date(),
      createdRoom: null
    });

    // Add to logged in players
    loggedInPlayers.set(socket.id, {
      name: name,
      loggedInAt: new Date()
    });

    socket.emit('loginSuccess', { playerName: name });
    console.log('Player logged in:', name, socket.id);

    // Broadcast updated players list to admins and lobby
    broadcastOnlinePlayers();
    broadcastLobbyPlayers();
  });

  // Create room (without joining)
  socket.on('createRoom', ({ roomId, boardSize }) => {
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

    // Check if room already exists
    if (rooms.has(roomId)) {
      socket.emit('error', 'Ez a szoba már létezik!');
      return;
    }

    const size = boardSize || 15;
    const newRoom = new GameRoom(roomId, size, socket.id, client.name);
    rooms.set(roomId, newRoom);

    // Track that this player created this room
    client.createdRoom = roomId;

    socket.emit('roomCreated', { roomId, boardSize: size });
    console.log(`Room ${roomId} created by ${client.name}`);

    // Broadcast updated rooms list
    broadcastRoomsList();
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

      io.to(roomId).emit('gameState', room.getState());
      io.to(roomId).emit('message', `${client.name} csatlakozott a játékhoz`);

      if (room.players.length === 2) {
        io.to(roomId).emit('message', 'Játék elindult! X kezd.');

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

  socket.on('makeMove', ({ row, col }) => {
    if (!socket.roomId) return;

    const room = rooms.get(socket.roomId);
    if (!room) return;

    const result = room.makeMove(socket.id, row, col);

    if (result.success) {
      io.to(socket.roomId).emit('gameState', room.getState());

      if (result.gameOver) {
        if (result.draw) {
          io.to(socket.roomId).emit('message', "It's a draw!");
        } else {
          io.to(socket.roomId).emit('message', `${result.winner.name} wins!`);
        }
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
      }
    } else {
      socket.emit('error', result.error);
    }
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

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);

    const client = connectedClients.get(socket.id);

    // Remove from connected clients and logged in players
    connectedClients.delete(socket.id);
    loggedInPlayers.delete(socket.id);

    // If player created a room, delete it if empty
    if (client && client.createdRoom) {
      const createdRoom = rooms.get(client.createdRoom);
      if (createdRoom && createdRoom.players.length === 0) {
        rooms.delete(client.createdRoom);
        console.log(`Deleted empty room ${client.createdRoom} created by ${client.name}`);
      }
    }

    if (socket.roomId) {
      const room = rooms.get(socket.roomId);
      if (room) {
        const player = room.players.find(p => p.id === socket.id);
        room.removePlayer(socket.id);

        if (room.players.length === 0) {
          rooms.delete(socket.roomId);
        } else {
          io.to(socket.roomId).emit('message', `${player?.name || 'Játékos'} kilépett a játékból`);
          io.to(socket.roomId).emit('gameState', room.getState());
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

http.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Open http://localhost:${PORT} in your browser`);
});
