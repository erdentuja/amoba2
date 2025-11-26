const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

const PORT = process.env.PORT || 3000;
const ADMIN_CODE = process.env.ADMIN_CODE || 'admin123'; // Change this in production!

// Track connected clients
const connectedClients = new Map(); // socketId -> {name, isAdmin, connectedAt}

// Serve static files
app.use(express.static('public'));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Game state management
const rooms = new Map();

class GameRoom {
  constructor(roomId, boardSize = 15) {
    this.roomId = roomId;
    this.boardSize = boardSize;
    this.players = [];
    this.board = Array(boardSize).fill(null).map(() => Array(boardSize).fill(null));
    this.currentPlayer = 0; // 0 or 1
    this.gameOver = false;
    this.winner = null;
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

    // Check for win
    if (this.checkWin(row, col, symbol)) {
      this.gameOver = true;
      this.winner = this.players[this.currentPlayer];
      return { success: true, gameOver: true, winner: this.winner };
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

      // Check positive direction
      for (let i = 1; i < 5; i++) {
        const newRow = row + dx * i;
        const newCol = col + dy * i;
        if (newRow >= 0 && newRow < this.boardSize && newCol >= 0 && newCol < this.boardSize && this.board[newRow][newCol] === symbol) {
          count++;
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
        } else {
          break;
        }
      }

      if (count >= 5) return true;
    }

    return false;
  }

  isBoardFull() {
    for (let i = 0; i < this.boardSize; i++) {
      for (let j = 0; j < this.boardSize; j++) {
        if (this.board[i][j] === null) return false;
      }
    }
    return true;
  }

  reset() {
    this.board = Array(this.boardSize).fill(null).map(() => Array(this.boardSize).fill(null));
    this.currentPlayer = 0;
    this.gameOver = false;
    this.winner = null;
  }

  getState() {
    return {
      board: this.board,
      boardSize: this.boardSize,
      players: this.players,
      currentPlayer: this.currentPlayer,
      gameOver: this.gameOver,
      winner: this.winner
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
      isWaiting: room.players.length === 1,
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

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Add to connected clients (as guest initially)
  connectedClients.set(socket.id, {
    name: 'Guest',
    isAdmin: false,
    connectedAt: new Date()
  });

  // Send current rooms list to newly connected client
  socket.emit('roomsList', getRoomsList());

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

  socket.on('joinRoom', ({ roomId, playerName, boardSize }) => {
    if (!rooms.has(roomId)) {
      const size = boardSize || 15;
      rooms.set(roomId, new GameRoom(roomId, size));
    }

    const room = rooms.get(roomId);
    const joined = room.addPlayer(socket.id, playerName || `Player ${room.players.length + 1}`);

    if (joined) {
      socket.join(roomId);
      socket.roomId = roomId;

      // Update connected client info
      const client = connectedClients.get(socket.id);
      if (client) {
        client.name = playerName;
        client.room = roomId;
      }

      io.to(roomId).emit('gameState', room.getState());
      io.to(roomId).emit('message', `${playerName || 'Player'} joined the game`);

      if (room.players.length === 2) {
        io.to(roomId).emit('message', 'Game started! X goes first.');
      }

      // Broadcast updated rooms list
      broadcastRoomsList();
      broadcastOnlinePlayers();
    } else {
      socket.emit('error', 'Room is full');
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
      }
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

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);

    // Remove from connected clients
    connectedClients.delete(socket.id);

    if (socket.roomId) {
      const room = rooms.get(socket.roomId);
      if (room) {
        const player = room.players.find(p => p.id === socket.id);
        room.removePlayer(socket.id);

        if (room.players.length === 0) {
          rooms.delete(socket.roomId);
        } else {
          io.to(socket.roomId).emit('message', `${player?.name || 'Player'} left the game`);
          io.to(socket.roomId).emit('gameState', room.getState());
        }

        // Broadcast updated rooms list
        broadcastRoomsList();
      }
    }

    // Broadcast updated online players list to admins
    broadcastOnlinePlayers();
  });
});

http.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Open http://localhost:${PORT} in your browser`);
});
