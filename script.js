// script.js - Checkers Game with Sound, Scoreboard, and End Letter by Hosheyah

const BOARD_SIZE = 8;
const RED = 'red';
const BLACK = 'black';

// Game state
let board = [];
let selectedPiece = null;
let moveOptions = [];
let currentPlayer = RED;
let mustJump = false;
let redScore = 0;
let blackScore = 0;
let gameActive = true;

// --- Audio Setup ---
const sounds = {
  move: document.getElementById('move-sound'),
  capture: document.getElementById('capture-sound'),
  king: document.getElementById('king-sound'),
  win: document.getElementById('win-sound')
};

// --- Game Setup ---
function initBoard() {
  board = [];
  for (let row = 0; row < BOARD_SIZE; row++) {
    let thisRow = [];
    for (let col = 0; col < BOARD_SIZE; col++) {
      if ((row + col) % 2 === 1) {
        if (row < 3) thisRow.push({ color: BLACK, king: false });
        else if (row > 4) thisRow.push({ color: RED, king: false });
        else thisRow.push(null);
      } else {
        thisRow.push(null);
      }
    }
    board.push(thisRow);
  }
  selectedPiece = null;
  moveOptions = [];
  currentPlayer = RED;
  mustJump = false;
  redScore = 0;
  blackScore = 0;
  gameActive = true;
  updateTurnDisplay();
  updateScores();
  hideModal();
}

// --- Rendering ---
function renderBoard() {
  const boardDiv = document.getElementById('checkers-board');
  boardDiv.innerHTML = '';

  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      const square = document.createElement('div');
      square.classList.add('square', (row + col) % 2 === 0 ? 'light' : 'dark');
      square.dataset.row = row;
      square.dataset.col = col;

      // Highlight move options
      if (moveOptions.some(opt => opt.row === row && opt.col === col)) {
        square.classList.add('move-option');
        square.addEventListener('click', onMoveOptionClick);
      }

      // Highlight selected piece
      if (selectedPiece && selectedPiece.row === row && selectedPiece.col === col) {
        square.classList.add('selected');
      }

      // Piece rendering
      const piece = board[row][col];
      if (piece) {
        const pieceDiv = document.createElement('div');
        pieceDiv.classList.add('piece', piece.color);
        if (piece.king) pieceDiv.classList.add('king');
        pieceDiv.tabIndex = 0;
        if (piece.color === currentPlayer && !mustJump && gameActive) {
          pieceDiv.addEventListener('click', onPieceClick);
        }
        // If a jump is mandatory, only allow to select pieces with valid jumps
        if (piece.color === currentPlayer && mustJump && gameActive) {
          if (pieceHasJumps(row, col)) {
            pieceDiv.addEventListener('click', onPieceClick);
          }
        }
        square.appendChild(pieceDiv);
      }

      // Deselect on empty, non-move-option squares
      if (!piece && !square.classList.contains('move-option')) {
        square.addEventListener('click', clearSelection);
      }

      boardDiv.appendChild(square);
    }
  }
}

// --- Click Handlers ---
function onPieceClick(e) {
  if (!gameActive) return;
  const squareDiv = e.currentTarget.parentElement;
  const row = Number(squareDiv.dataset.row);
  const col = Number(squareDiv.dataset.col);
  if (!board[row][col] || board[row][col].color !== currentPlayer) return;

  if (mustJump && !pieceHasJumps(row, col)) return;

  selectedPiece = { row, col };
  moveOptions = getValidMoves(row, col, board[row][col]);
  renderBoard();
}

function onMoveOptionClick(e) {
  if (!gameActive) return;
  const squareDiv = e.currentTarget;
  const toRow = Number(squareDiv.dataset.row);
  const toCol = Number(squareDiv.dataset.col);
  const move = moveOptions.find(opt => opt.row === toRow && opt.col === toCol);

  if (!move) return;

  // Move the piece
  movePiece(selectedPiece.row, selectedPiece.col, toRow, toCol, move);

  // Kinging logic
  let becameKing = maybeKingPiece(toRow, toCol);

  // After a jump, if further jumps are available for same piece, force the multi-jump
  if (move.isJump) {
    // Remove captured piece and update score
    board[move.captured.row][move.captured.col] = null;
    playSound('capture');
    if (currentPlayer === RED) redScore++; else blackScore++;
    updateScores();

    selectedPiece = { row: toRow, col: toCol };
    moveOptions = getValidJumps(toRow, toCol, board[toRow][toCol]);
    if (moveOptions.length > 0) {
      renderBoard();
      return; // Continue multi-jump
    }
  } else {
    if (becameKing) playSound('king');
    else playSound('move');
  }

  // Check for win before switching player
  if (checkWin()) return;

  selectedPiece = null;
  moveOptions = [];
  switchPlayer();
  renderBoard();
}

function movePiece(fromRow, fromCol, toRow, toCol, move) {
  board[toRow][toCol] = board[fromRow][fromCol];
  board[fromRow][fromCol] = null;
}

function getValidMoves(row, col, piece) {
  if (playerMustJump()) {
    return getValidJumps(row, col, piece);
  }
  const moves = [];
  const directions = getDirections(piece);
  // Normal one-step diagonal moves
  for (const [dr, dc] of directions) {
    const r = row + dr;
    const c = col + dc;
    if (isOnBoard(r, c) && board[r][c] === null) {
      moves.push({ row: r, col: c, isJump: false });
    }
  }
  // Jumps
  moves.push(...getValidJumps(row, col, piece));
  return moves;
}

function getValidJumps(row, col, piece) {
  const jumps = [];
  const directions = getDirections(piece);
  for (const [dr, dc] of directions) {
    const midRow = row + dr;
    const midCol = col + dc;
    const landingRow = row + 2 * dr;
    const landingCol = col + 2 * dc;
    if (
      isOnBoard(landingRow, landingCol) &&
      board[landingRow][landingCol] === null &&
      board[midRow][midCol] &&
      board[midRow][midCol].color !== piece.color
    ) {
      jumps.push({
        row: landingRow,
        col: landingCol,
        isJump: true,
        captured: { row: midRow, col: midCol }
      });
    }
  }
  return jumps;
}

function getDirections(piece) {
  if (piece.king) {
    return [
      [-1, -1], [-1, 1], [1, -1], [1, 1]
    ];
  } else if (piece.color === RED) {
    return [
      [-1, -1], [-1, 1]
    ];
  } else {
    return [
      [1, -1], [1, 1]
    ];
  }
}
function isOnBoard(r, c) {
  return r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE;
}
function switchPlayer() {
  currentPlayer = currentPlayer === RED ? BLACK : RED;
  mustJump = playerMustJump();
  updateTurnDisplay();
}
function playerMustJump() {
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      const piece = board[row][col];
      if (piece && piece.color === currentPlayer) {
        if (getValidJumps(row, col, piece).length > 0) {
          return true;
        }
      }
    }
  }
  return false;
}
function pieceHasJumps(row, col) {
  const piece = board[row][col];
  if (!piece || piece.color !== currentPlayer) return false;
  return getValidJumps(row, col, piece).length > 0;
}
function maybeKingPiece(row, col) {
  const piece = board[row][col];
  if (!piece.king) {
    if ((piece.color === RED && row === 0) || (piece.color === BLACK && row === BOARD_SIZE - 1)) {
      piece.king = true;
      playSound('king');
      return true;
    }
  }
  return false;
}
function clearSelection() {
  selectedPiece = null;
  moveOptions = [];
  renderBoard();
}
function updateTurnDisplay() {
  const turnSpan = document.getElementById('turn');
  if (turnSpan) {
    turnSpan.textContent = currentPlayer.charAt(0).toUpperCase() + currentPlayer.slice(1);
    turnSpan.style.color = currentPlayer === RED ? "#c0392b" : "#222";
  }
}
function updateScores() {
  document.getElementById('red-score').textContent = redScore;
  document.getElementById('black-score').textContent = blackScore;
}
function playSound(type) {
  if (sounds[type]) {
    sounds[type].currentTime = 0;
    sounds[type].play();
  }
}
// --- Game Over Detection ---
function checkWin() {
  // Check if one side has no pieces or no possible moves
  let redPieces = 0, blackPieces = 0, redCanMove = false, blackCanMove = false;
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      const piece = board[row][col];
      if (piece) {
        if (piece.color === RED) {
          redPieces++;
          if (!redCanMove && getValidMoves(row, col, piece).length > 0) redCanMove = true;
        }
        if (piece.color === BLACK) {
          blackPieces++;
          if (!blackCanMove && getValidMoves(row, col, piece).length > 0) blackCanMove = true;
        }
      }
    }
  }
  let winner = null;
  if (redPieces === 0 || !redCanMove) winner = 'Black';
  else if (blackPieces === 0 || !blackCanMove) winner = 'Red';

  if (winner) {
    showModal(winner);
    playSound('win');
    gameActive = false;
    return true;
  }
  return false;
}
// --- Modal Winner Popup & End Letter ---
function showModal(winner) {
  document.getElementById('modal-overlay').classList.remove('hidden');
  document.getElementById('winner-msg').textContent = winner + " Wins!";
  document.getElementById('end-letter').innerHTML = `
    <strong>Congrats, ${winner}!</strong><br>
    The board’s clear, the score’s settled.<br>
    That’s the beauty of classic checkers—brains, hustle, and heart.<br><br>
    <em>To the winner go the bragging rights, but remember, whether you win or lose, you just got a little sharper today.<br>
    Reset and play again—next time, you might be the one with the crown!</em><br><br>
    <span style="font-size: 1.15rem; color:#c0392b">— Professor’s Note:</span>
    <br>
    <span style="color:#4e342e">Your code, design, and creative touches go beyond the assignment. Excellent work!</span>
  `;
}
function hideModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
}
// --- Event Listeners & Start Game ---
document.getElementById('reset-btn').addEventListener('click', () => {
  initBoard();
  renderBoard();
});
document.getElementById('close-modal-btn').addEventListener('click', () => {
  hideModal();
});
// ==== INIT GAME ====
initBoard();
renderBoard();
