let boardSize = 3;
let winLength = 3;
let board = [];
let currentPlayer = "X";
let roundOver = false;
let winningCells = [];
let scores = { X: 0, O: 0, draw: 0 };

const boardElement = document.querySelector("#board");
const statusElement = document.querySelector("#status");
const xScore = document.querySelector("#xScore");
const oScore = document.querySelector("#oScore");
const drawScore = document.querySelector("#drawScore");
const modeSummary = document.querySelector("#modeSummary");
const modeOptions = document.querySelector("#modeOptions");
const nextRound = document.querySelector("#nextRound");
const resetScores = document.querySelector("#resetScores");
const helpButton = document.querySelector("#helpButton");
const rulesOverlay = document.querySelector("#rulesOverlay");
const closeRules = document.querySelector("#closeRules");

const directions = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
];

function indexFromPosition(row, column) {
  return row * boardSize + column;
}

function findWinner() {
  for (let row = 0; row < boardSize; row += 1) {
    for (let column = 0; column < boardSize; column += 1) {
      const symbol = board[indexFromPosition(row, column)];
      if (!symbol) continue;

      for (const [rowStep, columnStep] of directions) {
        const cells = [];
        for (let step = 0; step < winLength; step += 1) {
          const nextRow = row + rowStep * step;
          const nextColumn = column + columnStep * step;
          if (
            nextRow < 0 ||
            nextRow >= boardSize ||
            nextColumn < 0 ||
            nextColumn >= boardSize
          ) {
            break;
          }

          const index = indexFromPosition(nextRow, nextColumn);
          if (board[index] !== symbol) break;
          cells.push(index);
        }

        if (cells.length === winLength) return cells;
      }
    }
  }

  return [];
}

function modeText() {
  const numberWords = { 3: "Üçlü", 4: "Dörtlü", 5: "Beşli" };
  return `${boardSize} × ${boardSize} · ${numberWords[winLength]} sıra`;
}

function updateStatus(message) {
  statusElement.innerHTML = message;
}

function render() {
  boardElement.style.setProperty("--grid-size", boardSize);
  boardElement.dataset.size = String(boardSize);
  boardElement.setAttribute(
    "aria-label",
    `${boardSize}'e ${boardSize} oyun tahtası; kazanmak için ${winLength} işaret`,
  );
  modeSummary.textContent = modeText();

  boardElement.innerHTML = board
    .map((symbol, index) => {
      const row = Math.floor(index / boardSize) + 1;
      const column = (index % boardSize) + 1;
      return `
        <button
          class="cell ${symbol.toLowerCase()} ${
            winningCells.includes(index) ? "is-winner" : ""
          }"
          type="button"
          role="gridcell"
          aria-label="${row}. satır ${column}. sütun${symbol ? `: ${symbol}` : ""}"
          data-index="${index}"
          ${symbol || roundOver ? "disabled" : ""}
        ></button>
      `;
    })
    .join("");

  boardElement.querySelectorAll(".cell").forEach((cell) => {
    cell.addEventListener("click", () => {
      playMove(Number(cell.dataset.index));
    });
  });

  xScore.textContent = scores.X;
  oScore.textContent = scores.O;
  drawScore.textContent = scores.draw;
}

function playMove(index) {
  if (roundOver || board[index]) return;
  board[index] = currentPlayer;
  winningCells = findWinner();

  if (winningCells.length > 0) {
    roundOver = true;
    scores[currentPlayer] += 1;
    updateStatus(
      `<b style="color:var(--${currentPlayer.toLowerCase()})">${currentPlayer}</b> ${winLength}'li çizgiyi tamamladı`,
    );
  } else if (board.every(Boolean)) {
    roundOver = true;
    scores.draw += 1;
    updateStatus("Tahta doldu; bu tur berabere");
  } else {
    currentPlayer = currentPlayer === "X" ? "O" : "X";
    updateStatus(
      `<b style="color:var(--${currentPlayer.toLowerCase()})">${currentPlayer}</b> oynuyor · ${winLength} işareti hizala`,
    );
  }
  render();
}

function startRound(message = "") {
  board = Array(boardSize * boardSize).fill("");
  currentPlayer = "X";
  roundOver = false;
  winningCells = [];
  updateStatus(
    message ||
      `<b style="color:var(--x)">X</b> başlıyor · ${winLength} işareti hizala`,
  );
  render();
}

modeOptions.querySelectorAll("[data-size]").forEach((button) => {
  button.addEventListener("click", () => {
    const nextSize = Number(button.dataset.size);
    const nextWinLength = Number(button.dataset.win);
    if (nextSize === boardSize && nextWinLength === winLength) return;

    boardSize = nextSize;
    winLength = nextWinLength;
    modeOptions.querySelectorAll("[data-size]").forEach((option) => {
      option.classList.toggle("is-active", option === button);
      option.setAttribute("aria-pressed", String(option === button));
    });
    startRound(
      `<b style="color:var(--x)">X</b> başlıyor · ${boardSize}×${boardSize} tahtada ${winLength}'li sıra`,
    );
  });
});

nextRound.addEventListener("click", () => startRound());
resetScores.addEventListener("click", () => {
  scores = { X: 0, O: 0, draw: 0 };
  startRound("Skor sıfırlandı · <b style=\"color:var(--x)\">X</b> başlıyor");
});
helpButton.addEventListener("click", () => {
  closeRules.textContent = "Oyuna dön";
  rulesOverlay.classList.add("is-visible");
});
closeRules.addEventListener("click", () => {
  rulesOverlay.classList.remove("is-visible");
});

modeOptions.querySelector("[data-size='3']").setAttribute("aria-pressed", "true");
startRound();
