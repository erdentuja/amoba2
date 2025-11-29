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
const timerProgressFill = document.getElementById('timerProgressFill');
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
const viewStatsBtn = document.getElementById('viewStatsBtn');
const backToLobbyBtn = document.getElementById('backToLobbyBtn');
const statsView = document.getElementById('statsView');
const defeatModal = document.getElementById('defeatModal');
const defeatNewGameBtn = document.getElementById('defeatNewGameBtn');
const defeatLeaveBtn = document.getElementById('defeatLeaveBtn');
const messageModal = document.getElementById('messageModal');
const messageModalClose = document.querySelector('.message-modal-close');
const messageModalBtn = document.getElementById('messageModalBtn');

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

  // Auto-login if player name is saved
  const savedPlayerName = localStorage.getItem('playerName');
  if (savedPlayerName) {
    // Wait for socket connection to be established
    setTimeout(() => {
      if (socket) {
        socket.emit('login', { playerName: savedPlayerName });
      }
    }, 100);
  }
}

// Initialize socket connection
function initSocketConnection() {
  if (!socket) {
    socket = io();

    // Set myPlayerId when connected
    socket.on('connect', () => {
      myPlayerId = socket.id;
      console.log('🔌 Socket connected! My ID:', myPlayerId);

      // If user was logged in before, re-login automatically
      if (isLoggedIn && myPlayerName) {
        console.log('🔄 Auto re-login as:', myPlayerName);
        socket.emit('login', { playerName: myPlayerName });
      }
    });

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

      // Save player name to localStorage for auto-login on refresh
      localStorage.setItem('playerName', playerName);

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
      showModalMessage(error, 'error');
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

    // Handle disconnect
    socket.on('disconnect', (reason) => {
      console.log('Disconnected from server:', reason);
      // Show reconnecting message
      if (isLoggedIn) {
        showMessage('⚠️ Kapcsolat megszakadt... Újracsatlakozás...');
      }
    });

    // Handle reconnect
    socket.on('connect', () => {
      console.log('Connected to server with ID:', socket.id);
      myPlayerId = socket.id;

      // If user was logged in before, re-login automatically
      if (isLoggedIn && myPlayerName) {
        console.log('Auto re-login as:', myPlayerName);
        socket.emit('login', { playerName: myPlayerName });
      }
    });
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
  viewStatsBtn.addEventListener('click', showStatsView);
  backToLobbyBtn.addEventListener('click', hideStatsView);

  // Canvas events for both mouse and touch
  canvas.addEventListener('click', handleCanvasClick);
  canvas.addEventListener('touchstart', handleCanvasClick, { passive: false });

  // Victory modal controls
  if (victoryNewGameBtn) victoryNewGameBtn.addEventListener('click', requestNewGame);
  if (victoryLeaveBtn) victoryLeaveBtn.addEventListener('click', leaveGameFromVictory);

  // Defeat modal controls
  if (defeatNewGameBtn) defeatNewGameBtn.addEventListener('click', requestNewGame);
  if (defeatLeaveBtn) defeatLeaveBtn.addEventListener('click', leaveGameFromVictory);

  // New game request modal
  if (acceptNewGameBtn) acceptNewGameBtn.addEventListener('click', acceptNewGame);
  if (declineNewGameBtn) declineNewGameBtn.addEventListener('click', declineNewGame);

  // Message modal controls
  if (messageModalClose) messageModalClose.addEventListener('click', hideMessageModal);
  if (messageModalBtn) messageModalBtn.addEventListener('click', hideMessageModal);
  if (messageModal) {
    messageModal.addEventListener('click', (e) => {
      if (e.target === messageModal) hideMessageModal();
    });
  }
}

// Handle login
function handleLogin() {
  const playerName = loginPlayerNameInput.value.trim();

  if (!playerName) {
    showModalMessage('Kérlek add meg a neved!', 'warning');
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
    showModalMessage('Kérlek először jelentkezz be!', 'warning');
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

    // Check if current user is the creator
    const isCreator = room.creatorId === myPlayerId;

    // Action buttons
    let actionButtons = '';
    if (room.status === 'waiting') {
      const joinBtn = `<button class="btn btn-primary" onclick="joinExistingRoom('${room.roomId}')" style="width: auto; flex: 1;">Csatlakozás</button>`;
      const deleteBtn = isCreator
        ? `<button class="btn btn-danger" onclick="deleteMyRoom('${room.roomId}')" style="width: auto;">🗑️ Törlés</button>`
        : '';
      actionButtons = `<div style="display: flex; gap: 10px; margin-top: 10px;">${joinBtn}${deleteBtn}</div>`;
    } else {
      actionButtons = `<button class="btn btn-secondary" onclick="watchGame('${room.roomId}')">👁️ Megnézem (${room.spectatorCount || 0} néző)</button>`;
    }

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
      ${actionButtons}
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

// Delete own waiting room
function deleteMyRoom(roomId) {
  if (confirm('Biztosan törölni szeretnéd ezt a várakozó szobát?')) {
    socket.emit('deleteRoom', { roomId });
  }
}

// Handle logout
function handleLogout() {
  if (confirm('Biztosan ki szeretnél lépni?')) {
    // Clear saved player name
    localStorage.removeItem('playerName');

    // Reset state
    isLoggedIn = false;
    myPlayerName = null;
    myPlayerId = null;
    gameState = null;
    currentRoomId = null;
    isSpectator = false;

    // Disconnect socket
    if (socket) {
      socket.disconnect();
      socket = null;
    }

    // Show login screen
    loginScreen.style.display = 'flex';
    lobby.style.display = 'none';
    gameArea.style.display = 'none';
    adminPanel.style.display = 'none';

    // Clear input
    loginPlayerNameInput.value = '';

    // Reconnect socket for next login
    initSocketConnection();
  }
}

// Show statistics view
function showStatsView() {
  lobby.style.display = 'none';
  statsView.style.display = 'block';

  // Request stats from server
  socket.emit('requestStats');
}

// Hide statistics view and return to lobby
function hideStatsView() {
  statsView.style.display = 'none';
  lobby.style.display = 'flex';
}

// Watch a game as spectator
function watchGame(roomId) {
  if (!isLoggedIn) {
    showModalMessage('Kérlek először jelentkezz be!', 'warning');
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
    showModalMessage('Kérlek először jelentkezz be!', 'warning');
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

  // Calculate progress percentage
  const totalDuration = gameState && gameState.timerDuration ? gameState.timerDuration : 60;
  const percentage = (seconds / totalDuration) * 100;

  // Update progress bar width
  if (timerProgressFill) {
    timerProgressFill.style.width = `${percentage}%`;
  }

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

      // Show victory or defeat modal (only for actual players in the game)
      // Check if I'm actually a player in this game (not spectator, not just watching)
      console.log('=== GAME OVER DEBUG ===');
      console.log('Winner:', gameState.winner);
      console.log('My Player ID:', myPlayerId);
      console.log('Players:', gameState.players);
      console.log('Is Spectator:', isSpectator);

      const amIPlayer = gameState.players.some(p => p.id === myPlayerId);
      console.log('Am I a player?', amIPlayer);

      if (amIPlayer) {
        // Check if I won or lost
        if (gameState.winner.id === myPlayerId) {
          // I won - show victory modal
          console.log('➡️ I WON! Showing victory modal');
          showVictoryModal(gameState.winner);
        } else {
          // I lost - show defeat modal
          console.log('➡️ I LOST! Showing defeat modal');
          showDefeatModal(gameState.winner);
        }
      } else {
        console.log('➡️ Not showing modal - not a player');
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
const timerStatusText = document.getElementById('timerStatusText');
const aiVsAiEnabledCheckbox = document.getElementById('aiVsAiEnabled');
const saveAIBtn = document.getElementById('saveAIBtn');
const clearStatsBtn = document.getElementById('clearStatsBtn');

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

// Auto-save timer settings when toggle changes
timerEnabledCheckbox.addEventListener('change', () => {
  const enabled = timerEnabledCheckbox.checked;
  const duration = parseInt(timerDurationInput.value);

  // Update status text
  if (timerStatusText) {
    timerStatusText.textContent = enabled ? 'Be' : 'Ki';
    timerStatusText.style.color = enabled ? '#2ecc71' : '#999';
  }

  socket.emit('adminSetTimer', { enabled, duration });
});

// Auto-save timer settings when duration changes
timerDurationInput.addEventListener('change', () => {
  const enabled = timerEnabledCheckbox.checked;
  const duration = parseInt(timerDurationInput.value);

  socket.emit('adminSetTimer', { enabled, duration });
});

saveAIBtn.addEventListener('click', () => {
  const aiVsAiEnabled = aiVsAiEnabledCheckbox.checked;
  socket.emit('adminSetAISettings', { aiVsAiEnabled });
});

clearStatsBtn.addEventListener('click', () => {
  if (confirm('Biztosan törölni szeretnéd az összes statisztikát? Ez a művelet nem vonható vissza!')) {
    socket.emit('adminClearStats');
  }
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
    showModalMessage(error || 'Helytelen admin kód', 'error');
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
    showModalMessage(message, 'warning');
    setTimeout(() => {
      location.reload();
    }, 2000);
  });

  socket.on('timerSettings', (settings) => {
    if (timerEnabledCheckbox && timerDurationInput) {
      timerEnabledCheckbox.checked = settings.enabled;
      timerDurationInput.value = settings.duration;

      // Update status text
      if (timerStatusText) {
        timerStatusText.textContent = settings.enabled ? 'Be' : 'Ki';
        timerStatusText.style.color = settings.enabled ? '#2ecc71' : '#999';
      }
    }
  });

  socket.on('aiSettings', (settings) => {
    if (aiVsAiEnabledCheckbox) {
      aiVsAiEnabledCheckbox.checked = settings.aiVsAiEnabled;
    }
  });

  socket.on('gameStats', (stats) => {
    updateGameStats(stats);
    updateStatsView(stats);
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
  console.log('🏆 showVictoryModal called with winner:', winner);
  const victoryModal = document.getElementById('victoryModal');
  const victoryWinnerName = document.getElementById('victoryWinnerName');

  console.log('Victory modal element:', victoryModal);
  console.log('Victory winner name element:', victoryWinnerName);

  if (!victoryModal || !victoryWinnerName) {
    console.error('❌ Victory modal elements not found!');
    return;
  }

  victoryWinnerName.textContent = winner.name;
  victoryModal.style.display = 'flex';
  console.log('✅ Victory modal displayed');

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

// Defeat modal functions
function showDefeatModal(winner) {
  console.log('😢 showDefeatModal called with winner:', winner);
  console.log('Defeat modal element:', defeatModal);

  if (!defeatModal) {
    console.error('❌ Defeat modal element not found!');
    return;
  }

  const defeatWinnerName = document.getElementById('defeatWinnerName');
  console.log('Defeat winner name element:', defeatWinnerName);

  if (defeatWinnerName) {
    defeatWinnerName.textContent = winner.name;
  }

  defeatModal.style.display = 'flex';
  console.log('✅ Defeat modal displayed');
}

function closeDefeatModal() {
  if (defeatModal) {
    defeatModal.style.display = 'none';
  }
}

// Message modal functions (replaces alert)
function showModalMessage(message, type = 'info') {
  if (!messageModal) return;

  const messageModalIcon = document.getElementById('messageModalIcon');
  const messageModalTitle = document.getElementById('messageModalTitle');
  const messageModalText = document.getElementById('messageModalText');

  // Set icon based on type
  let icon = 'ℹ️';
  let title = 'Üzenet';
  if (type === 'error') {
    icon = '❌';
    title = 'Hiba';
    messageModalIcon.className = 'message-modal-icon error';
  } else if (type === 'success') {
    icon = '✅';
    title = 'Siker';
    messageModalIcon.className = 'message-modal-icon success';
  } else if (type === 'warning') {
    icon = '⚠️';
    title = 'Figyelmeztetés';
    messageModalIcon.className = 'message-modal-icon warning';
  } else {
    messageModalIcon.className = 'message-modal-icon';
  }

  messageModalIcon.textContent = icon;
  messageModalTitle.textContent = title;
  messageModalText.textContent = message;

  messageModal.style.display = 'flex';
}

function hideMessageModal() {
  if (messageModal) {
    messageModal.style.display = 'none';
  }
}

// Request new game
function requestNewGame() {
  closeVictoryModal();
  closeDefeatModal();
  socket.emit('requestNewGame');
  showMessage('Új játék kérés elküldve...');
}

// Leave game from victory/defeat modal
function leaveGameFromVictory() {
  closeVictoryModal();
  closeDefeatModal();
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

// Game Statistics Charts
let peakTimesChart = null;
let boardSizesChart = null;
let gameModesChart = null;
let resultsChart = null;

// Stats view charts (separate instances)
let statsPeakTimesChart = null;
let statsBoardSizesChart = null;
let statsGameModesChart = null;
let statsResultsChart = null;

function updateGameStats(stats) {
  // Update stat cards
  document.getElementById('totalGames').textContent = stats.totalGames || 0;
  document.getElementById('activeGames').textContent = stats.activeGames || 0;
  document.getElementById('completedGames').textContent = stats.totalGamesCompleted || 0;
  const playerWinsEl = document.getElementById('playerWins');
  if (playerWinsEl) {
    playerWinsEl.textContent = stats.playerWins || 0;
  }

  // Update charts
  updatePeakTimesChart(stats.peakTimes);
  updateBoardSizesChart(stats.boardSizes);
  updateGameModesChart(stats.gameModes);
  updateResultsChart(stats);
}

// Update stats view (for public statistics page)
function updateStatsView(stats) {
  // Update stat cards
  const statsTotalGames = document.getElementById('statsTotalGames');
  const statsActiveGames = document.getElementById('statsActiveGames');
  const statsCompletedGames = document.getElementById('statsCompletedGames');
  const statsAiWinRate = document.getElementById('statsAiWinRate');

  if (statsTotalGames) statsTotalGames.textContent = stats.totalGames || 0;
  if (statsActiveGames) statsActiveGames.textContent = stats.activeGames || 0;
  if (statsCompletedGames) statsCompletedGames.textContent = stats.totalGamesCompleted || 0;

  // Calculate AI win rate
  const totalFinished = stats.playerWins + stats.aiWins;
  const aiWinRate = totalFinished > 0 ? Math.round((stats.aiWins / totalFinished) * 100) : 0;
  if (statsAiWinRate) statsAiWinRate.textContent = aiWinRate + '%';

  // Update charts
  updateStatsPeakTimesChart(stats.peakTimes);
  updateStatsBoardSizesChart(stats.boardSizes);
  updateStatsGameModesChart(stats.gameModes);
  updateStatsResultsChart(stats);
}

function updatePeakTimesChart(peakTimes) {
  const ctx = document.getElementById('peakTimesChart');
  if (!ctx) return;

  const hours = Array.from({length: 24}, (_, i) => `${i}:00`);
  
  if (peakTimesChart) {
    peakTimesChart.data.datasets[0].data = peakTimes;
    peakTimesChart.update();
  } else {
    peakTimesChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: hours,
        datasets: [{
          label: 'Játékok száma',
          data: peakTimes,
          borderColor: 'rgb(102, 126, 234)',
          backgroundColor: 'rgba(102, 126, 234, 0.1)',
          fill: true,
          tension: 0.4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              stepSize: 1
            }
          }
        }
      }
    });
  }
}

function updateBoardSizesChart(boardSizes) {
  const ctx = document.getElementById('boardSizesChart');
  if (!ctx) return;

  const labels = Object.keys(boardSizes).map(size => `${size}x${size}`);
  const data = Object.values(boardSizes);
  
  if (boardSizesChart) {
    boardSizesChart.data.labels = labels;
    boardSizesChart.data.datasets[0].data = data;
    boardSizesChart.update();
  } else {
    boardSizesChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: [
            'rgba(255, 99, 132, 0.8)',
            'rgba(54, 162, 235, 0.8)',
            'rgba(255, 206, 86, 0.8)',
            'rgba(75, 192, 192, 0.8)'
          ],
          borderWidth: 2,
          borderColor: '#fff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom'
          }
        }
      }
    });
  }
}

function updateGameModesChart(gameModes) {
  const ctx = document.getElementById('gameModesChart');
  if (!ctx) return;

  const modeLabels = {
    'pvp': 'PvP',
    'ai-easy': 'AI Easy',
    'ai-medium': 'AI Medium',
    'ai-hard': 'AI Hard',
    'ai-vs-ai': 'AI vs AI'
  };
  
  const labels = Object.keys(gameModes).map(mode => modeLabels[mode] || mode);
  const data = Object.values(gameModes);
  
  if (gameModesChart) {
    gameModesChart.data.labels = labels;
    gameModesChart.data.datasets[0].data = data;
    gameModesChart.update();
  } else {
    gameModesChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Játékok száma',
          data: data,
          backgroundColor: [
            'rgba(102, 126, 234, 0.8)',
            'rgba(118, 75, 162, 0.8)',
            'rgba(237, 100, 166, 0.8)',
            'rgba(255, 154, 158, 0.8)',
            'rgba(250, 208, 196, 0.8)'
          ],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              stepSize: 1
            }
          }
        }
      }
    });
  }
}

function updateResultsChart(stats) {
  const ctx = document.getElementById('resultsChart');
  if (!ctx) return;

  const data = [stats.playerWins || 0, stats.aiWins || 0, stats.draws || 0];
  
  if (resultsChart) {
    resultsChart.data.datasets[0].data = data;
    resultsChart.update();
  } else {
    resultsChart = new Chart(ctx, {
      type: 'pie',
      data: {
        labels: ['Játékos győzelem', 'AI győzelem', 'Döntetlen'],
        datasets: [{
          data: data,
          backgroundColor: [
            'rgba(75, 192, 192, 0.8)',
            'rgba(255, 99, 132, 0.8)',
            'rgba(255, 206, 86, 0.8)'
          ],
          borderWidth: 2,
          borderColor: '#fff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom'
          }
        }
      }
    });
  }
}

// Stats view chart functions (duplicates for separate canvas instances)
function updateStatsPeakTimesChart(peakTimes) {
  const ctx = document.getElementById('statsPeakTimesChart');
  if (!ctx) return;

  const hours = Array.from({length: 24}, (_, i) => `${i}:00`);

  if (statsPeakTimesChart) {
    statsPeakTimesChart.data.datasets[0].data = peakTimes;
    statsPeakTimesChart.update();
  } else {
    statsPeakTimesChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: hours,
        datasets: [{
          label: 'Játékok száma',
          data: peakTimes,
          borderColor: 'rgb(102, 126, 234)',
          backgroundColor: 'rgba(102, 126, 234, 0.1)',
          fill: true,
          tension: 0.4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              stepSize: 1
            }
          }
        }
      }
    });
  }
}

function updateStatsBoardSizesChart(boardSizes) {
  const ctx = document.getElementById('statsBoardSizesChart');
  if (!ctx) return;

  const data = [boardSizes['9'] || 0, boardSizes['13'] || 0, boardSizes['15'] || 0, boardSizes['19'] || 0];

  if (statsBoardSizesChart) {
    statsBoardSizesChart.data.datasets[0].data = data;
    statsBoardSizesChart.update();
  } else {
    statsBoardSizesChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['9x9', '13x13', '15x15', '19x19'],
        datasets: [{
          data: data,
          backgroundColor: [
            'rgba(255, 99, 132, 0.8)',
            'rgba(54, 162, 235, 0.8)',
            'rgba(255, 206, 86, 0.8)',
            'rgba(75, 192, 192, 0.8)'
          ],
          borderWidth: 2,
          borderColor: '#fff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom'
          }
        }
      }
    });
  }
}

function updateStatsGameModesChart(gameModes) {
  const ctx = document.getElementById('statsGameModesChart');
  if (!ctx) return;

  const labels = ['PvP', 'AI Könnyű', 'AI Közepes', 'AI Nehéz', 'AI vs AI'];
  const data = [
    gameModes['pvp'] || 0,
    gameModes['ai-easy'] || 0,
    gameModes['ai-medium'] || 0,
    gameModes['ai-hard'] || 0,
    gameModes['ai-vs-ai'] || 0
  ];

  if (statsGameModesChart) {
    statsGameModesChart.data.labels = labels;
    statsGameModesChart.data.datasets[0].data = data;
    statsGameModesChart.update();
  } else {
    statsGameModesChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Játékok száma',
          data: data,
          backgroundColor: [
            'rgba(102, 126, 234, 0.8)',
            'rgba(118, 75, 162, 0.8)',
            'rgba(237, 100, 166, 0.8)',
            'rgba(255, 154, 158, 0.8)',
            'rgba(250, 208, 196, 0.8)'
          ],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              stepSize: 1
            }
          }
        }
      }
    });
  }
}

function updateStatsResultsChart(stats) {
  const ctx = document.getElementById('statsResultsChart');
  if (!ctx) return;

  const data = [stats.playerWins || 0, stats.aiWins || 0, stats.draws || 0];

  if (statsResultsChart) {
    statsResultsChart.data.datasets[0].data = data;
    statsResultsChart.update();
  } else {
    statsResultsChart = new Chart(ctx, {
      type: 'pie',
      data: {
        labels: ['Játékos győzelem', 'AI győzelem', 'Döntetlen'],
        datasets: [{
          data: data,
          backgroundColor: [
            'rgba(75, 192, 192, 0.8)',
            'rgba(255, 99, 132, 0.8)',
            'rgba(255, 206, 86, 0.8)'
          ],
          borderWidth: 2,
          borderColor: '#fff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom'
          }
        }
      }
    });
  }
}

// Theme System
let currentTheme = 'light';
let currentBoardTheme = 'wood';
let currentPieceColor = 'classic';

// Get CSS variable value
function getCSSVariable(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

// Load theme from localStorage
function loadTheme() {
  const savedTheme = localStorage.getItem('theme') || 'light';
  const savedBoardTheme = localStorage.getItem('boardTheme') || 'wood';
  const savedPieceColor = localStorage.getItem('pieceColor') || 'classic';
  
  setTheme(savedTheme);
  setBoardTheme(savedBoardTheme);
  setPieceColor(savedPieceColor);
}

// Set main theme (dark/light)
function setTheme(theme) {
  currentTheme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);

  // Update all theme toggle buttons
  const themeToggleBtns = [
    document.getElementById('themeToggleBtn'),
    document.getElementById('themeToggleBtnLobby'),
    document.getElementById('themeToggleBtnGame')
  ];
  const icon = theme === 'dark' ? '☀️' : '🌓';
  themeToggleBtns.forEach(btn => {
    if (btn) {
      btn.textContent = icon;
    }
  });

  // Redraw board with new theme
  if (gameState) {
    drawBoard();
  }
}

// Toggle dark/light mode
function toggleTheme() {
  const newTheme = currentTheme === 'light' ? 'dark' : 'light';
  setTheme(newTheme);
}

// Set board theme
function setBoardTheme(theme) {
  currentBoardTheme = theme;
  document.documentElement.setAttribute('data-board-theme', theme);
  localStorage.setItem('boardTheme', theme);
  
  // Update active state
  document.querySelectorAll('[data-board-theme]').forEach(btn => {
    btn.classList.remove('active');
  });
  const activeBtn = document.querySelector(`[data-board-theme="${theme}"]`);
  if (activeBtn) {
    activeBtn.classList.add('active');
  }
  
  // Redraw board
  if (gameState) {
    drawBoard();
  }
}

// Set piece color scheme
function setPieceColor(colorScheme) {
  currentPieceColor = colorScheme;
  document.documentElement.setAttribute('data-piece-color', colorScheme);
  localStorage.setItem('pieceColor', colorScheme);
  
  // Update active state
  document.querySelectorAll('[data-piece-color]').forEach(btn => {
    btn.classList.remove('active');
  });
  const activeBtn = document.querySelector(`[data-piece-color="${colorScheme}"]`);
  if (activeBtn) {
    activeBtn.classList.add('active');
  }
  
  // Redraw board
  if (gameState) {
    drawBoard();
  }
}

// Get star positions based on board size
function getStarPositions() {
  if (BOARD_SIZE === 9) {
    return [[2, 2], [2, 6], [6, 2], [6, 6], [4, 4]];
  } else if (BOARD_SIZE === 13) {
    return [[3, 3], [3, 9], [9, 3], [9, 9], [6, 6]];
  } else if (BOARD_SIZE === 15) {
    return [[3, 3], [3, 11], [11, 3], [11, 11], [7, 7]];
  } else if (BOARD_SIZE === 19) {
    return [[3, 3], [3, 9], [3, 15], [9, 3], [9, 9], [9, 15], [15, 3], [15, 9], [15, 15]];
  }
  return [];
}

// Initialize theme system
function initThemeSystem() {
  // Load saved theme
  loadTheme();

  // Theme toggle buttons (login, lobby, game)
  const themeToggleBtns = [
    document.getElementById('themeToggleBtn'),
    document.getElementById('themeToggleBtnLobby'),
    document.getElementById('themeToggleBtnGame')
  ];
  themeToggleBtns.forEach(btn => {
    if (btn) {
      btn.addEventListener('click', toggleTheme);
    }
  });

  // Theme settings buttons (login, lobby, game)
  const themeSettingsBtns = [
    document.getElementById('themeSettingsBtn'),
    document.getElementById('themeSettingsBtnLobby'),
    document.getElementById('themeSettingsBtnGame')
  ];
  const themeModal = document.getElementById('themeModal');
  const themeClose = themeModal?.querySelector('.theme-close');

  themeSettingsBtns.forEach(btn => {
    if (btn && themeModal) {
      btn.addEventListener('click', () => {
        themeModal.style.display = 'flex';
      });
    }
  });

  if (themeClose && themeModal) {
    themeClose.addEventListener('click', () => {
      themeModal.style.display = 'none';
    });
  }
  
  // Board theme buttons
  document.querySelectorAll('[data-board-theme]').forEach(btn => {
    btn.addEventListener('click', () => {
      const theme = btn.getAttribute('data-board-theme');
      setBoardTheme(theme);
    });
  });
  
  // Piece color buttons
  document.querySelectorAll('[data-piece-color]').forEach(btn => {
    btn.addEventListener('click', () => {
      const colorScheme = btn.getAttribute('data-piece-color');
      setPieceColor(colorScheme);
    });
  });
  
  // Close modal on outside click
  window.addEventListener('click', (e) => {
    if (e.target === themeModal) {
      themeModal.style.display = 'none';
    }
  });
}

// Override drawBoard to use CSS variables
const originalDrawBoard = drawBoard;
drawBoard = function() {
  ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

  // Get colors from CSS variables
  const boardBg = getCSSVariable('--board-bg');
  const boardLine = getCSSVariable('--board-line');
  const boardStar = getCSSVariable('--board-star');

  // Draw background with gradient for depth
  const bgGradient = ctx.createLinearGradient(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  bgGradient.addColorStop(0, boardBg);
  bgGradient.addColorStop(1, shadeColor(boardBg, -10));
  ctx.fillStyle = bgGradient;
  ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

  // Draw grid lines (at cell edges, not centers)
  ctx.strokeStyle = boardLine;
  ctx.lineWidth = 2;

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

  // Draw star points in cell centers
  ctx.fillStyle = boardStar;
  const starPositions = getStarPositions();
  starPositions.forEach(([row, col]) => {
    const x = col * CELL_SIZE + CELL_SIZE / 2;
    const y = row * CELL_SIZE + CELL_SIZE / 2;
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
  });

  // Draw pieces
  if (gameState && gameState.board) {
    for (let row = 0; row < BOARD_SIZE; row++) {
      for (let col = 0; col < BOARD_SIZE; col++) {
        const cell = gameState.board[row][col];
        if (cell) {
          const isWinningPiece = gameState.winningPieces &&
            gameState.winningPieces.some(([r, c]) => r === row && c === col);
          const isLastMove = gameState.lastMove &&
            gameState.lastMove.row === row && gameState.lastMove.col === col;
          drawPiece(row, col, cell, isWinningPiece, isLastMove);
        }
      }
    }
  }
};

// Helper function to shade color
function shadeColor(color, percent) {
  const num = parseInt(color.replace("#",""), 16);
  const amt = Math.round(2.55 * percent);
  const R = (num >> 16) + amt;
  const G = (num >> 8 & 0x00FF) + amt;
  const B = (num & 0x0000FF) + amt;
  return "#" + (0x1000000 + (R<255?R<1?0:R:255)*0x10000 +
    (G<255?G<1?0:G:255)*0x100 + (B<255?B<1?0:B:255))
    .toString(16).slice(1);
}

// Override drawPiece to use CSS variables
const originalDrawPiece = drawPiece;
drawPiece = function(row, col, symbol, isWinning = false, isLastMove = false) {
  const x = col * CELL_SIZE + CELL_SIZE / 2;
  const y = row * CELL_SIZE + CELL_SIZE / 2;
  const radius = CELL_SIZE * 0.4;

  // Get piece colors from CSS variables
  const player1Color = getCSSVariable('--piece-player1');
  const player2Color = getCSSVariable('--piece-player2');
  const shadowColor = getCSSVariable('--piece-shadow');

  const pieceColor = symbol === 'X' ? player1Color : player2Color;

  // Draw shadow
  ctx.save();
  ctx.shadowColor = shadowColor;
  ctx.shadowBlur = 10;
  ctx.shadowOffsetX = 3;
  ctx.shadowOffsetY = 3;

  // Draw piece with gradient
  const gradient = ctx.createRadialGradient(x - radius * 0.3, y - radius * 0.3, 0, x, y, radius);
  gradient.addColorStop(0, lightenColor(pieceColor, 30));
  gradient.addColorStop(1, pieceColor);
  
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  // Draw winning animation
  if (isWinning) {
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, radius + 5, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Draw last move indicator
  if (isLastMove && !isWinning) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.beginPath();
    ctx.arc(x, y, radius * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }
};

// Helper function to lighten color
function lightenColor(color, percent) {
  const num = parseInt(color.replace("#",""), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.min(255, (num >> 16) + amt);
  const G = Math.min(255, (num >> 8 & 0x00FF) + amt);
  const B = Math.min(255, (num & 0x0000FF) + amt);
  return "#" + (0x1000000 + R*0x10000 + G*0x100 + B).toString(16).slice(1);
}

// Initialize theme system when page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initThemeSystem);
} else {
  initThemeSystem();
}
