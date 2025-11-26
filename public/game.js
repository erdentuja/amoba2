// Game constants
const CELL_SIZE = 50;
let BOARD_SIZE = 15;
let CANVAS_SIZE = BOARD_SIZE * CELL_SIZE;

// DOM elements
const lobby = document.getElementById('lobby');
const gameArea = document.getElementById('gameArea');
const playerNameInput = document.getElementById('playerName');
const roomIdInput = document.getElementById('roomId');
const boardSizeInput = document.getElementById('boardSize');
const joinBtn = document.getElementById('joinBtn');
const resetBtn = document.getElementById('resetBtn');
const leaveBtn = document.getElementById('leaveBtn');
const canvas = document.getElementById('gameBoard');
const ctx = canvas.getContext('2d');
const currentTurnDiv = document.getElementById('currentTurn');
const messagesDiv = document.getElementById('messages');
const player1Info = document.getElementById('player1Info');
const player2Info = document.getElementById('player2Info');

// Game state
let socket = null;
let gameState = null;
let myPlayerId = null;

// Initialize
function init() {
  setupEventListeners();
  drawBoard();
}

function setupEventListeners() {
  joinBtn.addEventListener('click', joinGame);
  resetBtn.addEventListener('click', resetGame);
  leaveBtn.addEventListener('click', leaveGame);
  canvas.addEventListener('click', handleCanvasClick);

  // Allow Enter key to join
  playerNameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') joinGame();
  });
  roomIdInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') joinGame();
  });
}

function joinGame() {
  const playerName = playerNameInput.value.trim();
  const roomId = roomIdInput.value.trim();
  const boardSize = parseInt(boardSizeInput.value);

  if (!playerName) {
    alert('Kérlek add meg a neved!');
    return;
  }

  if (!roomId) {
    alert('Kérlek add meg a szoba azonosítót!');
    return;
  }

  // Initialize socket connection
  socket = io();
  myPlayerId = socket.id;

  // Setup socket event listeners
  socket.on('connect', () => {
    socket.emit('joinRoom', { roomId, playerName, boardSize });
  });

  socket.on('gameState', (state) => {
    gameState = state;
    // Update board size from server
    if (state.boardSize) {
      BOARD_SIZE = state.boardSize;
      CANVAS_SIZE = BOARD_SIZE * CELL_SIZE;
      canvas.width = CANVAS_SIZE;
      canvas.height = CANVAS_SIZE;
    }
    updateGameDisplay();
  });

  socket.on('message', (msg) => {
    showMessage(msg);
  });

  socket.on('error', (error) => {
    alert(error);
  });

  // Show game area
  lobby.style.display = 'none';
  gameArea.style.display = 'block';
}

function leaveGame() {
  if (socket) {
    socket.disconnect();
  }
  gameArea.style.display = 'none';
  lobby.style.display = 'flex';
  gameState = null;
}

function resetGame() {
  if (socket) {
    socket.emit('resetGame');
  }
}

function handleCanvasClick(e) {
  if (!gameState || gameState.gameOver) return;

  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  const col = Math.floor(x / CELL_SIZE);
  const row = Math.floor(y / CELL_SIZE);

  if (row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE) {
    socket.emit('makeMove', { row, col });
  }
}

function updateGameDisplay() {
  if (!gameState) return;

  // Update player info
  if (gameState.players.length >= 1) {
    const p1 = gameState.players[0];
    player1Info.querySelector('.player-name').textContent = p1.name;
    player1Info.classList.toggle('active', gameState.currentPlayer === 0 && !gameState.gameOver);
  }

  if (gameState.players.length >= 2) {
    const p2 = gameState.players[1];
    player2Info.querySelector('.player-name').textContent = p2.name;
    player2Info.classList.toggle('active', gameState.currentPlayer === 1 && !gameState.gameOver);
  } else {
    player2Info.querySelector('.player-name').textContent = 'Várakozás...';
  }

  // Update current turn message
  if (gameState.gameOver) {
    if (gameState.winner) {
      currentTurnDiv.textContent = `🏆 ${gameState.winner.name} nyert!`;
      currentTurnDiv.style.color = '#4CAF50';
    } else {
      currentTurnDiv.textContent = '🤝 Döntetlen!';
      currentTurnDiv.style.color = '#FF9800';
    }
  } else if (gameState.players.length < 2) {
    currentTurnDiv.textContent = 'Várakozás másik játékosra...';
    currentTurnDiv.style.color = '#999';
  } else {
    const currentPlayer = gameState.players[gameState.currentPlayer];
    currentTurnDiv.textContent = `${currentPlayer.name} következik (${currentPlayer.symbol})`;
    currentTurnDiv.style.color = '#667eea';
  }

  // Draw the board
  drawBoard();
}

function drawBoard() {
  // Clear canvas
  ctx.fillStyle = '#fef8e8';
  ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

  // Draw grid
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 1;

  for (let i = 0; i <= BOARD_SIZE; i++) {
    // Vertical lines
    ctx.beginPath();
    ctx.moveTo(i * CELL_SIZE, 0);
    ctx.lineTo(i * CELL_SIZE, CANVAS_SIZE);
    ctx.stroke();

    // Horizontal lines
    ctx.beginPath();
    ctx.moveTo(0, i * CELL_SIZE);
    ctx.lineTo(CANVAS_SIZE, i * CELL_SIZE);
    ctx.stroke();
  }

  // Draw star points (traditional Go board style)
  let starPoints = [];
  if (BOARD_SIZE === 9) {
    starPoints = [[2, 2], [2, 6], [6, 2], [6, 6], [4, 4]];
  } else if (BOARD_SIZE === 13) {
    starPoints = [[3, 3], [3, 9], [9, 3], [9, 9], [6, 6]];
  } else if (BOARD_SIZE === 15) {
    starPoints = [[3, 3], [3, 11], [11, 3], [11, 11], [7, 7]];
  } else if (BOARD_SIZE === 19) {
    starPoints = [[3, 3], [3, 9], [3, 15], [9, 3], [9, 9], [9, 15], [15, 3], [15, 9], [15, 15]];
  }
  ctx.fillStyle = '#333';
  starPoints.forEach(([row, col]) => {
    ctx.beginPath();
    ctx.arc(col * CELL_SIZE + CELL_SIZE / 2, row * CELL_SIZE + CELL_SIZE / 2, 4, 0, Math.PI * 2);
    ctx.fill();
  });

  // Draw pieces
  if (gameState && gameState.board) {
    for (let row = 0; row < BOARD_SIZE; row++) {
      for (let col = 0; col < BOARD_SIZE; col++) {
        const cell = gameState.board[row][col];
        if (cell) {
          drawPiece(row, col, cell);
        }
      }
    }
  }
}

function drawPiece(row, col, symbol) {
  const x = col * CELL_SIZE + CELL_SIZE / 2;
  const y = row * CELL_SIZE + CELL_SIZE / 2;
  const radius = CELL_SIZE / 2 - 5;

  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);

  if (symbol === 'X') {
    // Black stone
    const gradient = ctx.createRadialGradient(x - 5, y - 5, 5, x, y, radius);
    gradient.addColorStop(0, '#555');
    gradient.addColorStop(1, '#000');
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.stroke();
  } else {
    // White stone
    const gradient = ctx.createRadialGradient(x - 5, y - 5, 5, x, y, radius);
    gradient.addColorStop(0, '#fff');
    gradient.addColorStop(1, '#ddd');
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.strokeStyle = '#999';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

function showMessage(msg) {
  messagesDiv.textContent = msg;
  setTimeout(() => {
    messagesDiv.textContent = '';
  }, 5000);
}

// Start the game
init();
