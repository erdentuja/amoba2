const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

const PORT = process.env.PORT || 3000;

// Serve static files
app.use(express.static('public'));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Game state management
const rooms = new Map();
const BOARD_SIZE = 15;

class GameRoom {
  constructor(roomId) {
    this.roomId = roomId;
    this.players = [];
    this.board = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null));
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
    if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) return { success: false, error: 'Invalid position' };
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
        if (newRow >= 0 && newRow < BOARD_SIZE && newCol >= 0 && newCol < BOARD_SIZE && this.board[newRow][newCol] === symbol) {
          count++;
        } else {
          break;
        }
      }

      // Check negative direction
      for (let i = 1; i < 5; i++) {
        const newRow = row - dx * i;
        const newCol = col - dy * i;
        if (newRow >= 0 && newRow < BOARD_SIZE && newCol >= 0 && newCol < BOARD_SIZE && this.board[newRow][newCol] === symbol) {
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
    for (let i = 0; i < BOARD_SIZE; i++) {
      for (let j = 0; j < BOARD_SIZE; j++) {
        if (this.board[i][j] === null) return false;
      }
    }
    return true;
  }

  reset() {
    this.board = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null));
    this.currentPlayer = 0;
    this.gameOver = false;
    this.winner = null;
  }

  getState() {
    return {
      board: this.board,
      players: this.players,
      currentPlayer: this.currentPlayer,
      gameOver: this.gameOver,
      winner: this.winner
    };
  }
}

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('joinRoom', ({ roomId, playerName }) => {
    if (!rooms.has(roomId)) {
      rooms.set(roomId, new GameRoom(roomId));
    }

    const room = rooms.get(roomId);
    const joined = room.addPlayer(socket.id, playerName || `Player ${room.players.length + 1}`);

    if (joined) {
      socket.join(roomId);
      socket.roomId = roomId;

      io.to(roomId).emit('gameState', room.getState());
      io.to(roomId).emit('message', `${playerName || 'Player'} joined the game`);

      if (room.players.length === 2) {
        io.to(roomId).emit('message', 'Game started! X goes first.');
      }
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

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);

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
      }
    }
  });
});

http.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
