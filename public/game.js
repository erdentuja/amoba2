// Game constants
const CELL_SIZE = 35; // Csökkentve a jobb illeszkedés érdekében
let BOARD_SIZE = 15;
let CANVAS_SIZE = BOARD_SIZE * CELL_SIZE;

// DOM elements
const loginScreen = document.getElementById('loginScreen');
const loginPlayerNameInput = document.getElementById('loginPlayerName');
const loginBtn = document.getElementById('loginBtn');
const lobby = document.getElementById('lobby');
const gameArea = document.getElementById('gameArea');
const boardSizeInput = document.getElementById('boardSize');
const createRoomBtn = document.getElementById('createRoomBtn');
const roomsListDiv = document.getElementById('roomsList');
const undoBtn = document.getElementById('undoBtn');
const resetBtn = document.getElementById('resetBtn');
const leaveBtn = document.getElementById('leaveBtn');
const leaveSpectatorBtn = document.getElementById('leaveSpectatorBtn');
const logoutBtn = document.getElementById('logoutBtn');
const welcomePlayerName = document.getElementById('welcomePlayerName');
const lobbyOnlinePlayersList = document.getElementById('lobbyOnlinePlayersList');
const lobbyOnlineCount = document.getElementById('lobbyOnlineCount');
const canvas = document.getElementById('gameBoard');
const ctx = canvas.getContext('2d');
const currentTurnDiv = document.getElementById('currentTurn');
const messagesDiv = document.getElementById('messages');
const player1Info = document.getElementById('player1Info');
const player2Info = document.getElementById('player2Info');
const timerDiv = document.getElementById('timer');
const timerDisplay = document.getElementById('timerDisplay');
const roomIdDisplay = document.getElementById('roomIdDisplay');
const victoryNewGameBtn = document.getElementById('victoryNewGameBtn');
const victoryLeaveBtn = document.getElementById('victoryLeaveBtn');
const newGameRequestModal = document.getElementById('newGameRequestModal');
const acceptNewGameBtn = document.getElementById('acceptNewGameBtn');
const declineNewGameBtn = document.getElementById('declineNewGameBtn');
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const chatSendBtn = document.getElementById('chatSendBtn');
const lobbyChatMessages = document.getElementById('lobbyChatMessages');
const lobbyChatInput = document.getElementById('lobbyChatInput');
const lobbyChatSendBtn = document.getElementById('lobbyChatSendBtn');

// Game state
let socket = null;
let gameState = null;
let myPlayerId = null;
let myPlayerName = null;
let currentRoomId = null;
let isLoggedIn = false;
let isAdmin = false;
let isSpectator = false;
let timerInterval = null;
let winningAnimationFrame = 0;
let animationInterval = null;

// Sound system
const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioContext = new AudioContext();
let soundEnabled = true;

// Sound effects using Web Audio API
const sounds = {
  click: () => {
    if (!soundEnabled) return;
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 800;
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.1);
  },

  win: () => {
    if (!soundEnabled) return;
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.type = 'triangle';

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

    // Victory melody
    const notes = [523, 659, 784, 1047]; // C, E, G, C
    notes.forEach((freq, i) => {
      oscillator.frequency.setValueAtTime(freq, audioContext.currentTime + i * 0.15);
    });

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.6);
  },

  gameStart: () => {
    if (!soundEnabled) return;
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(440, audioContext.currentTime);
    oscillator.frequency.setValueAtTime(554, audioContext.currentTime + 0.1);

    gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.2);
  },

  error: () => {
    if (!soundEnabled) return;
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.type = 'sawtooth';
    oscillator.frequency.value = 200;

    gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.15);
  }
};

function toggleSound() {
  soundEnabled = !soundEnabled;
  const soundBtn = document.getElementById('soundToggle');
  if (soundBtn) {
    soundBtn.textContent = soundEnabled ? '🔊 Hang BE' : '🔇 Hang KI';
    soundBtn.classList.toggle('sound-off', !soundEnabled);
  }
  localStorage.setItem('soundEnabled', soundEnabled);
}

// Initialize
function init() {
  // Set initial canvas size
  canvas.width = CANVAS_SIZE;
  canvas.height = CANVAS_SIZE;

  // Load sound preference
  const savedSound = localStorage.getItem('soundEnabled');
  if (savedSound !== null) {
    soundEnabled = savedSound === 'true';
  }

  setupEventListeners();
  drawBoard();
  initSocketConnection();

  // Initialize sound button state
  const soundBtn = document.getElementById('soundToggle');
  if (soundBtn) {
    soundBtn.textContent = soundEnabled ? '🔊 Hang BE' : '🔇 Hang KI';
    soundBtn.classList.toggle('sound-off', !soundEnabled);
  }
}

// Initialize socket connection
function initSocketConnection() {
  if (!socket) {
    socket = io();
    myPlayerId = socket.id;

    // Handle rooms list updates
    socket.on('roomsList', (rooms) => {
      updateRoomsList(rooms);
    });

    // Handle lobby players list updates
    socket.on('lobbyPlayers', (players) => {
      updateLobbyPlayersList(players);
    });

    // Handle login success
    socket.on('loginSuccess', ({ playerName }) => {
      myPlayerName = playerName;
      isLoggedIn = true;
      loginScreen.style.display = 'none';
      lobby.style.display = 'flex';

      // Update welcome section
      if (welcomePlayerName) {
        welcomePlayerName.textContent = playerName;
      }

      console.log('Logged in as:', playerName);
    });

    // Handle room created
    socket.on('roomCreated', ({ roomId, boardSize }) => {
      showMessage(`Szoba létrehozva: ${roomId}. Most csatlakozz hozzá!`);
    });

    // Handle errors
    socket.on('error', (error) => {
      sounds.error();
      alert(error);
    });

    // Handle game state updates (for both players and spectators)
    socket.on('gameState', (state) => {
      const wasGameOver = gameState && gameState.gameOver;
      const playersChanged = !gameState || gameState.players.length !== state.players.length;

      gameState = state;

      // Update board size from server
      if (state.boardSize) {
        BOARD_SIZE = state.boardSize;
        CANVAS_SIZE = BOARD_SIZE * CELL_SIZE;
        canvas.width = CANVAS_SIZE;
        canvas.height = CANVAS_SIZE;
      }

      // Play sounds (only if not spectator or game just ended)
      if (!isSpectator) {
        if (state.gameOver && !wasGameOver) {
          sounds.win();
        } else if (playersChanged && state.players.length === 2) {
          sounds.gameStart();
        } else if (state.board && !wasGameOver) {
          sounds.click();
        }
      }

      updateGameDisplay();
    });

    // Handle messages
    socket.on('message', (msg) => {
      showMessage(msg);
    });

    // Handle chat messages
    socket.on('chatMessage', (data) => {
      addChatMessage(data);
    });

    // Handle lobby chat messages
    socket.on('lobbyChatMessage', (data) => {
      addLobbyChatMessage(data);
    });

    // Handle spectator joined
    socket.on('spectatorJoined', ({ roomId }) => {
      isSpectator = true;
      currentRoomId = roomId;
      lobby.style.display = 'none';
      gameArea.style.display = 'flex';

      // Show room ID for spectators
      if (roomIdDisplay) {
        roomIdDisplay.textContent = `📺 Szoba: ${roomId}`;
        roomIdDisplay.style.display = 'block';
      }

      // Show leave spectator button, hide game controls for spectators
      leaveSpectatorBtn.style.display = 'inline-block';
      undoBtn.style.display = 'none';
      resetBtn.style.display = 'none';
      leaveBtn.style.display = 'none';

      showMessage(`🎬 Nézői mód aktív`);
    });

    // Handle left spectator mode
    socket.on('leftSpectator', () => {
      isSpectator = false;
      currentRoomId = null;
      gameArea.style.display = 'none';
      lobby.style.display = 'flex';

      // Hide room ID display
      if (roomIdDisplay) {
        roomIdDisplay.style.display = 'none';
      }

      // Reset button visibility
      leaveSpectatorBtn.style.display = 'none';
      undoBtn.style.display = 'inline-block';
      resetBtn.style.display = 'inline-block';
      leaveBtn.style.display = 'inline-block';

      gameState = null;
      stopTimer();
    });

    // Handle room closed
    socket.on('roomClosed', ({ message }) => {
      alert(message || 'A szoba bezárva');
      isSpectator = false;
      currentRoomId = null;
      gameArea.style.display = 'none';
      lobby.style.display = 'flex';

      // Hide room ID display
      if (roomIdDisplay) {
        roomIdDisplay.style.display = 'none';
      }

      // Reset button visibility
      leaveSpectatorBtn.style.display = 'none';
      undoBtn.style.display = 'inline-block';
      resetBtn.style.display = 'inline-block';
      leaveBtn.style.display = 'inline-block';

      gameState = null;
      stopTimer();
    });

    // Handle new game request
    socket.on('newGameRequest', ({ requesterName }) => {
      const message = document.getElementById('newGameRequestMessage');
      if (message) {
        message.textContent = `${requesterName} új játékot szeretne kezdeni.`;
      }
      newGameRequestModal.style.display = 'flex';
    });

    // Handle new game accepted
    socket.on('newGameAccepted', () => {
      closeVictoryModal();
      showMessage('🎮 Az ellenfél elfogadta! Új játék indul...');
    });

    // Handle new game declined
    socket.on('newGameDeclined', () => {
      showMessage('❌ Az ellenfél elutasította az új játék kérést');
    });

    setupAdminListeners();
  }
}

function setupEventListeners() {
  // Login
  loginBtn.addEventListener('click', handleLogin);
  loginPlayerNameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleLogin();
  });

  // Room creation
  createRoomBtn.addEventListener('click', handleCreateRoom);

  // Game controls
  undoBtn.addEventListener('click', undoMove);
  resetBtn.addEventListener('click', resetGame);
  leaveBtn.addEventListener('click', leaveGame);
  leaveSpectatorBtn.addEventListener('click', handleLeaveSpectator);
  logoutBtn.addEventListener('click', handleLogout);

  // Canvas events for both mouse and touch
  canvas.addEventListener('click', handleCanvasClick);
  canvas.addEventListener('touchstart', handleCanvasClick, { passive: false });

  // Victory modal controls
  if (victoryNewGameBtn) victoryNewGameBtn.addEventListener('click', requestNewGame);
  if (victoryLeaveBtn) victoryLeaveBtn.addEventListener('click', leaveGameFromVictory);

  // New game request modal
  if (acceptNewGameBtn) acceptNewGameBtn.addEventListener('click', acceptNewGame);
  if (declineNewGameBtn) declineNewGameBtn.addEventListener('click', declineNewGame);
}

// Handle login
function handleLogin() {
  const playerName = loginPlayerNameInput.value.trim();

  if (!playerName) {
    alert('Kérlek add meg a neved!');
    return;
  }

  if (socket) {
    socket.emit('login', { playerName });
  }
}

// Handle create room
function handleCreateRoom() {
  const boardSize = parseInt(boardSizeInput.value);
  const gameMode = document.getElementById('gameMode').value;

  if (!isLoggedIn) {
    alert('Kérlek először jelentkezz be!');
    return;
  }

  socket.emit('createRoom', { boardSize, gameMode });
}

// Update rooms list
function updateRoomsList(rooms) {
  if (rooms.length === 0) {
    roomsListDiv.innerHTML = '<p class="no-rooms">Jelenleg nincsenek szobák...</p>';
    return;
  }

  roomsListDiv.innerHTML = '';
  rooms.forEach(room => {
    const roomDiv = document.createElement('div');
    roomDiv.className = 'room-item';

    const playersList = room.players.length > 0 ? room.players.join(', ') : `${room.creatorName} (Létrehozó)`;
    const statusClass = room.status === 'waiting' ? 'waiting' : 'in-progress';
    const statusText = room.status === 'waiting' ? 'Várakozik' : 'Játék folyamatban';
    const actionButton = room.status === 'waiting'
      ? `<button class="btn btn-primary" onclick="joinExistingRoom('${room.roomId}')">Csatlakozás</button>`
      : `<button class="btn btn-secondary" onclick="watchGame('${room.roomId}')">👁️ Megnézem (${room.spectatorCount || 0} néző)</button>`;

    roomDiv.innerHTML = `
      <div class="room-header">
        <span class="room-id">🎮 ${room.roomId}</span>
        <span class="room-status ${statusClass}">${statusText}</span>
      </div>
      <div class="room-info">
        <span>👥 ${room.playerCount}/2 játékos</span>
        <span>📏 ${room.boardSize}x${room.boardSize}</span>
      </div>
      <div class="room-players">
        ${room.playerCount > 0 ? 'Játékosok: ' + playersList : 'Létrehozó: ' + room.creatorName}
      </div>
      ${actionButton}
    `;
    roomsListDiv.appendChild(roomDiv);
  });
}

// Update lobby players list
function updateLobbyPlayersList(players) {
  if (lobbyOnlineCount) {
    lobbyOnlineCount.textContent = players.length;
  }

  if (!lobbyOnlinePlayersList) return;

  if (players.length === 0) {
    lobbyOnlinePlayersList.innerHTML = '<p class="no-players">Nincsenek online játékosok...</p>';
    return;
  }

  lobbyOnlinePlayersList.innerHTML = '';
  players.forEach(player => {
    const playerDiv = document.createElement('div');
    playerDiv.className = 'lobby-player-item';

    const statusText = player.room ? `Játékban: ${player.room}` : 'Lobbiban';
    const isCurrentPlayer = player.socketId === socket.id;

    playerDiv.innerHTML = `
      <div class="lobby-player-info">
        <span class="lobby-player-name">${isCurrentPlayer ? '👤 ' : ''}${player.name}${isCurrentPlayer ? ' (Te)' : ''}</span>
        <span class="lobby-player-status">${statusText}</span>
      </div>
      ${isAdmin && !isCurrentPlayer ? `<button class="btn btn-danger" onclick="kickPlayerFromLobby('${player.socketId}')">Kick</button>` : ''}
    `;
    lobbyOnlinePlayersList.appendChild(playerDiv);
  });
}

// Kick player from lobby (admin only)
function kickPlayerFromLobby(socketId) {
  if (!isAdmin) return;
  if (confirm('Biztosan kickelni szeretnéd ezt a játékost?')) {
    socket.emit('adminKickPlayer', { targetSocketId: socketId });
  }
}

// Handle logout
function handleLogout() {
  if (confirm('Biztosan ki szeretnél lépni?')) {
    location.reload();
  }
}

// Watch a game as spectator
function watchGame(roomId) {
  if (!isLoggedIn) {
    alert('Kérlek először jelentkezz be!');
    return;
  }

  socket.emit('watchRoom', { roomId });
}

// Handle leave spectator mode
function handleLeaveSpectator() {
  if (confirm('Kilépés a nézői módból?')) {
    socket.emit('leaveSpectator');
  }
}

// Join existing room
function joinExistingRoom(roomId) {
  if (!isLoggedIn) {
    alert('Kérlek először jelentkezz be!');
    return;
  }

  socket.emit('joinRoom', { roomId });

  // Set current room ID
  currentRoomId = roomId;

  // Show game area
  lobby.style.display = 'none';
  gameArea.style.display = 'block';
}

function leaveGame() {
  // Notify server that player is leaving
  if (socket && currentRoomId) {
    socket.emit('leaveRoom');
  }

  stopTimer();
  clearChat();
  gameArea.style.display = 'none';
  lobby.style.display = 'flex';
  gameState = null;
  currentRoomId = null;
}

function undoMove() {
  if (socket) {
    socket.emit('undoMove');
  }
}

function resetGame() {
  if (socket) {
    socket.emit('resetGame');
  }
}

// Timer functions
function startTimer() {
  stopTimer();

  timerInterval = setInterval(() => {
    if (gameState && gameState.timerEnabled && gameState.timerRemaining !== null) {
      updateTimerDisplay(gameState.timerRemaining);
    }
  }, 100); // Update every 100ms for smooth countdown
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function updateTimerDisplay(seconds) {
  if (seconds === null || seconds === undefined) {
    timerDiv.style.display = 'none';
    return;
  }

  timerDiv.style.display = 'block';
  timerDisplay.textContent = `${seconds}s`;

  // Change color based on remaining time
  if (seconds <= 10) {
    timerDisplay.style.color = '#e74c3c';
    timerDisplay.style.fontWeight = 'bold';
  } else if (seconds <= 30) {
    timerDisplay.style.color = '#f39c12';
    timerDisplay.style.fontWeight = 'normal';
  } else {
    timerDisplay.style.color = '#2ecc71';
    timerDisplay.style.fontWeight = 'normal';
  }
}

function handleCanvasClick(e) {
  if (!gameState || gameState.gameOver) return;

  // Prevent default touch behavior
  e.preventDefault();

  const rect = canvas.getBoundingClientRect();

  // Get coordinates from either touch or mouse event
  let clientX, clientY;
  if (e.type.startsWith('touch')) {
    const touch = e.touches[0] || e.changedTouches[0];
    clientX = touch.clientX;
    clientY = touch.clientY;
  } else {
    clientX = e.clientX;
    clientY = e.clientY;
  }

  // Calculate position relative to canvas, accounting for scaling
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;

  const x = (clientX - rect.left) * scaleX;
  const y = (clientY - rect.top) * scaleY;

  const col = Math.floor(x / CELL_SIZE);
  const row = Math.floor(y / CELL_SIZE);

  if (row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE) {
    // Resume audio context if suspended (browser autoplay policy)
    if (audioContext.state === 'suspended') {
      audioContext.resume();
    }
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

      // Start winning animation
      startWinningAnimation();

      // Show victory modal (only for players, not spectators)
      if (!isSpectator) {
        showVictoryModal(gameState.winner);
      }
    } else {
      currentTurnDiv.textContent = '🤝 Döntetlen!';
      currentTurnDiv.style.color = '#FF9800';
    }
  } else {
    // Stop winning animation if game is not over
    stopWinningAnimation();

    if (gameState.players.length < 2) {
      // Don't show waiting message in spectator mode
      if (!isSpectator) {
        currentTurnDiv.textContent = 'Várakozás másik játékosra...';
        currentTurnDiv.style.color = '#999';
      } else {
        currentTurnDiv.textContent = 'Játék hamarosan kezdődik...';
        currentTurnDiv.style.color = '#999';
      }
    } else {
      const currentPlayer = gameState.players[gameState.currentPlayer];
      const prefix = isSpectator ? '👁️ ' : '';
      currentTurnDiv.textContent = `${prefix}${currentPlayer.name} következik (${currentPlayer.symbol})`;
      currentTurnDiv.style.color = '#667eea';
    }
  }

  // Update undo button
  if (undoBtn) {
    undoBtn.disabled = !gameState.canUndo;
  }

  // Update timer
  if (gameState.timerEnabled && gameState.timerRemaining !== null) {
    updateTimerDisplay(gameState.timerRemaining);
    if (!timerInterval) {
      startTimer();
    }
  } else {
    timerDiv.style.display = 'none';
    stopTimer();
  }

  // Draw the board
  drawBoard();
}

// Start winning animation
function startWinningAnimation() {
  if (animationInterval) return; // Already running

  animationInterval = setInterval(() => {
    winningAnimationFrame++;
    drawBoard();
  }, 50); // 20 FPS animation
}

// Stop winning animation
function stopWinningAnimation() {
  if (animationInterval) {
    clearInterval(animationInterval);
    animationInterval = null;
    winningAnimationFrame = 0;
  }
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
          // Check if this piece is a winning piece
          const isWinningPiece = gameState.winningPieces &&
            gameState.winningPieces.some(([r, c]) => r === row && c === col);

          // Check if this is the last move
          const isLastMove = gameState.lastMove &&
            gameState.lastMove.row === row && gameState.lastMove.col === col;

          drawPiece(row, col, cell, isWinningPiece, isLastMove);
        }
      }
    }
  }
}

function drawPiece(row, col, symbol, isWinningPiece = false, isLastMove = false) {
  const x = col * CELL_SIZE + CELL_SIZE / 2;
  const y = row * CELL_SIZE + CELL_SIZE / 2;
  let radius = CELL_SIZE / 2 - 5;

  // Pulsing effect for winning pieces
  if (isWinningPiece) {
    const pulseScale = 1 + Math.sin(winningAnimationFrame * 0.15) * 0.15;
    radius = radius * pulseScale;
  }

  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);

  if (symbol === 'X') {
    // Black stone
    const gradient = ctx.createRadialGradient(x - 5, y - 5, 5, x, y, radius);
    if (isWinningPiece) {
      // Gold glow for winning piece
      gradient.addColorStop(0, '#FFD700');
      gradient.addColorStop(0.3, '#333');
      gradient.addColorStop(1, '#000');
    } else {
      gradient.addColorStop(0, '#555');
      gradient.addColorStop(1, '#000');
    }
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.strokeStyle = isWinningPiece ? '#FFD700' : '#000';
    ctx.lineWidth = isWinningPiece ? 4 : 2;
    ctx.stroke();
  } else {
    // White stone
    const gradient = ctx.createRadialGradient(x - 5, y - 5, 5, x, y, radius);
    if (isWinningPiece) {
      // Gold glow for winning piece
      gradient.addColorStop(0, '#FFD700');
      gradient.addColorStop(0.3, '#fff');
      gradient.addColorStop(1, '#ddd');
    } else {
      gradient.addColorStop(0, '#fff');
      gradient.addColorStop(1, '#ddd');
    }
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.strokeStyle = isWinningPiece ? '#FFD700' : '#999';
    ctx.lineWidth = isWinningPiece ? 4 : 2;
    ctx.stroke();
  }

  // Add extra glow effect for winning pieces
  if (isWinningPiece) {
    ctx.shadowColor = '#FFD700';
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  // Draw last move indicator (small red dot)
  if (isLastMove && !isWinningPiece) {
    ctx.fillStyle = '#FF4444';
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fill();

    // Add white border for visibility
    ctx.strokeStyle = '#FFFFFF';
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

// Admin functionality
const adminLoginBtn = document.getElementById('adminLoginBtn');
const adminModal = document.getElementById('adminModal');
const adminCodeInput = document.getElementById('adminCodeInput');
const adminSubmitBtn = document.getElementById('adminSubmitBtn');
const closeModalBtn = document.querySelector('.close');
const adminPanel = document.getElementById('adminPanel');
const adminLogoutBtn = document.getElementById('adminLogoutBtn');
const onlinePlayersListDiv = document.getElementById('onlinePlayersList');
const adminRoomsListDiv = document.getElementById('adminRoomsList');
const onlineCountSpan = document.getElementById('onlineCount');
const roomsCountSpan = document.getElementById('roomsCount');
const timerEnabledCheckbox = document.getElementById('timerEnabled');
const timerDurationInput = document.getElementById('timerDuration');
const saveTimerBtn = document.getElementById('saveTimerBtn');
const aiVsAiEnabledCheckbox = document.getElementById('aiVsAiEnabled');
const saveAIBtn = document.getElementById('saveAIBtn');

// Admin modal controls
adminLoginBtn.addEventListener('click', () => {
  adminModal.style.display = 'flex';
});

closeModalBtn.addEventListener('click', () => {
  adminModal.style.display = 'none';
});

window.addEventListener('click', (e) => {
  if (e.target === adminModal) {
    adminModal.style.display = 'none';
  }
});

adminSubmitBtn.addEventListener('click', () => {
  const code = adminCodeInput.value.trim();
  if (code && socket) {
    socket.emit('adminLogin', { adminCode: code });
  }
});

adminCodeInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    adminSubmitBtn.click();
  }
});

adminLogoutBtn.addEventListener('click', () => {
  isAdmin = false;
  adminPanel.style.display = 'none';
  adminLoginBtn.style.display = 'block';
  lobby.style.display = 'flex';
  location.reload();
});

saveTimerBtn.addEventListener('click', () => {
  const enabled = timerEnabledCheckbox.checked;
  const duration = parseInt(timerDurationInput.value);

  if (duration < 10 || duration > 300) {
    alert('Az időtartamnak 10 és 300 másodperc között kell lennie!');
    return;
  }

  socket.emit('adminSetTimer', { enabled, duration });
});

saveAIBtn.addEventListener('click', () => {
  const aiVsAiEnabled = aiVsAiEnabledCheckbox.checked;
  socket.emit('adminSetAISettings', { aiVsAiEnabled });
});

// Handle admin login response
function setupAdminListeners() {
  socket.on('adminLoginSuccess', () => {
    isAdmin = true;
    adminModal.style.display = 'none';
    adminCodeInput.value = '';
    adminPanel.style.display = 'block';
    adminLoginBtn.style.display = 'none';
    lobby.style.display = 'none';
    gameArea.style.display = 'none';

    // Request timer settings
    socket.emit('adminGetTimerSettings');

    // Request online players for admin panel
    socket.emit('adminGetOnlinePlayers');
  });

  socket.on('adminLoginFailed', ({ error }) => {
    alert(error || 'Helytelen admin kód');
    adminCodeInput.value = '';
  });

  socket.on('onlinePlayers', (players) => {
    updateOnlinePlayersList(players);
  });

  socket.on('roomsList', (rooms) => {
    if (isAdmin) {
      updateAdminRoomsList(rooms);
    }
    updateRoomsList(rooms);
  });

  socket.on('kicked', ({ message }) => {
    alert(message);
    location.reload();
  });

  socket.on('roomClosed', ({ message }) => {
    alert(message);
    leaveGame();
  });

  socket.on('timerSettings', (settings) => {
    if (timerEnabledCheckbox && timerDurationInput) {
      timerEnabledCheckbox.checked = settings.enabled;
      timerDurationInput.value = settings.duration;
    }
  });

  socket.on('aiSettings', (settings) => {
    if (aiVsAiEnabledCheckbox) {
      aiVsAiEnabledCheckbox.checked = settings.aiVsAiEnabled;
    }
  });
}

function updateOnlinePlayersList(players) {
  onlineCountSpan.textContent = players.length;

  if (players.length === 0) {
    onlinePlayersListDiv.innerHTML = '<p style="text-align: center; color: #999;">Nincs online játékos</p>';
    return;
  }

  onlinePlayersListDiv.innerHTML = '';
  players.forEach(player => {
    const div = document.createElement('div');
    div.className = 'admin-item';
    div.innerHTML = `
      <div class="admin-item-info">
        <span class="admin-item-name">${player.isAdmin ? '🛡️ ' : ''}${player.name}</span>
        <span class="admin-item-detail">Szoba: ${player.room || 'Lobby'}</span>
      </div>
      ${!player.isAdmin ? `<button class="btn btn-danger" onclick="kickPlayer('${player.socketId}')">Kick</button>` : ''}
    `;
    onlinePlayersListDiv.appendChild(div);
  });
}

function updateAdminRoomsList(rooms) {
  roomsCountSpan.textContent = rooms.length;

  if (rooms.length === 0) {
    adminRoomsListDiv.innerHTML = '<p style="text-align: center; color: #999;">Nincs aktív szoba</p>';
    return;
  }

  adminRoomsListDiv.innerHTML = '';
  rooms.forEach(room => {
    const div = document.createElement('div');
    div.className = 'admin-item';
    div.innerHTML = `
      <div class="admin-item-info">
        <span class="admin-item-name">🎮 ${room.roomId}</span>
        <span class="admin-item-detail">${room.playerCount}/2 játékos | ${room.boardSize}x${room.boardSize}</span>
      </div>
      <button class="btn btn-danger" onclick="closeRoom('${room.roomId}')">Bezár</button>
    `;
    adminRoomsListDiv.appendChild(div);
  });
}

function kickPlayer(socketId) {
  if (confirm('Biztosan kickelni szeretnéd ezt a játékost?')) {
    socket.emit('adminKickPlayer', { targetSocketId: socketId });
  }
}

function closeRoom(roomId) {
  if (confirm(`Biztosan bezárod a(z) "${roomId}" szobát?`)) {
    socket.emit('adminCloseRoom', { roomId });
  }
}

// Victory modal functions
function showVictoryModal(winner) {
  const victoryModal = document.getElementById('victoryModal');
  const victoryWinnerName = document.getElementById('victoryWinnerName');

  if (!victoryModal || !victoryWinnerName) return;

  victoryWinnerName.textContent = winner.name;
  victoryModal.style.display = 'flex';

  // Create confetti effect
  createConfetti();
}

function closeVictoryModal() {
  const victoryModal = document.getElementById('victoryModal');
  if (victoryModal) {
    victoryModal.style.display = 'none';
    clearConfetti();
  }
}

// Request new game
function requestNewGame() {
  closeVictoryModal();
  socket.emit('requestNewGame');
  showMessage('Új játék kérés elküldve...');
}

// Leave game from victory modal
function leaveGameFromVictory() {
  closeVictoryModal();
  leaveGame();
}

// Accept new game request
function acceptNewGame() {
  newGameRequestModal.style.display = 'none';
  socket.emit('acceptNewGame');
}

// Decline new game request
function declineNewGame() {
  newGameRequestModal.style.display = 'none';
  socket.emit('declineNewGame');
  showMessage('Új játék kérés elutasítva');
}

// Confetti effect
function createConfetti() {
  const container = document.getElementById('confettiContainer');
  if (!container) return;

  const colors = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE'];
  const confettiCount = 100;

  for (let i = 0; i < confettiCount; i++) {
    const confetti = document.createElement('div');
    confetti.className = 'confetti';
    confetti.style.left = Math.random() * 100 + '%';
    confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    confetti.style.animationDelay = Math.random() * 3 + 's';
    confetti.style.animationDuration = (Math.random() * 3 + 2) + 's';
    container.appendChild(confetti);
  }
}

function clearConfetti() {
  const container = document.getElementById('confettiContainer');
  if (container) {
    container.innerHTML = '';
  }
}

// Chat functions
function sendChatMessage() {
  const message = chatInput.value.trim();

  if (!message || !socket) return;

  socket.emit('chatMessage', { message });
  chatInput.value = '';
}

function addChatMessage(data) {
  const messageDiv = document.createElement('div');
  const isOwnMessage = data.senderId === socket.id;
  const isSystemMessage = data.senderId === 'system';

  messageDiv.className = `chat-message ${isSystemMessage ? 'system' : isOwnMessage ? 'own' : 'other'}`;

  if (!isSystemMessage) {
    const headerDiv = document.createElement('div');
    headerDiv.className = 'chat-message-header';
    headerDiv.textContent = data.senderName;
    messageDiv.appendChild(headerDiv);
  }

  const bubbleDiv = document.createElement('div');
  bubbleDiv.className = 'chat-message-bubble';
  bubbleDiv.textContent = data.message;
  messageDiv.appendChild(bubbleDiv);

  chatMessages.appendChild(messageDiv);

  // Auto-scroll to bottom
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function clearChat() {
  if (chatMessages) {
    chatMessages.innerHTML = '';
  }
}

// Chat event listeners
if (chatSendBtn) {
  chatSendBtn.addEventListener('click', sendChatMessage);
}

if (chatInput) {
  chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      sendChatMessage();
    }
  });
}

// Lobby chat functions
function sendLobbyChatMessage() {
  const message = lobbyChatInput.value.trim();

  if (!message || !socket) return;

  socket.emit('lobbyChatMessage', { message });
  lobbyChatInput.value = '';
}

function addLobbyChatMessage(data) {
  const messageDiv = document.createElement('div');
  const isOwnMessage = data.senderId === socket.id;
  const isBotMessage = data.senderId === 'bot';

  messageDiv.className = `chat-message ${isBotMessage ? 'bot' : isOwnMessage ? 'own' : 'other'}`;

  const headerDiv = document.createElement('div');
  headerDiv.className = 'chat-message-header';
  headerDiv.textContent = data.senderName;
  messageDiv.appendChild(headerDiv);

  const bubbleDiv = document.createElement('div');
  bubbleDiv.className = 'chat-message-bubble';
  bubbleDiv.textContent = data.message;
  messageDiv.appendChild(bubbleDiv);

  lobbyChatMessages.appendChild(messageDiv);

  // Auto-scroll to bottom
  lobbyChatMessages.scrollTop = lobbyChatMessages.scrollHeight;
}

// Lobby chat event listeners
if (lobbyChatSendBtn) {
  lobbyChatSendBtn.addEventListener('click', sendLobbyChatMessage);
}

if (lobbyChatInput) {
  lobbyChatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      sendLobbyChatMessage();
    }
  });
}

// Start the game
init();
