const winningLines = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

let board = Array(9).fill("");
let currentPlayer = "X";
let roundOver = false;
let scores = { X: 0, O: 0, draw: 0 };

const boardElement = document.querySelector("#board");
const statusElement = document.querySelector("#status");
const xScore = document.querySelector("#xScore");
const oScore = document.querySelector("#oScore");
const drawScore = document.querySelector("#drawScore");
const nextRound = document.querySelector("#nextRound");
const resetScores = document.querySelector("#resetScores");
const helpButton = document.querySelector("#helpButton");
const rulesOverlay = document.querySelector("#rulesOverlay");
const closeRules = document.querySelector("#closeRules");

function findWinner() {
  return winningLines.find(
    ([first, second, third]) =>
      board[first] &&
      board[first] === board[second] &&
      board[first] === board[third],
  );
}

function updateStatus(message) {
  statusElement.innerHTML = message;
}

function render() {
  const winningLine = findWinner();
  boardElement.innerHTML = board
    .map(
      (symbol, index) => `
        <button
          class="cell ${symbol.toLowerCase()} ${
            winningLine?.includes(index) ? "is-winner" : ""
          }"
          type="button"
          role="gridcell"
          aria-label="${index + 1}. hücre${symbol ? `: ${symbol}` : ""}"
          data-index="${index}"
          ${symbol || roundOver ? "disabled" : ""}
        ></button>
      `,
    )
    .join("");

  boardElement.querySelectorAll(".cell").forEach((cell) => {
    cell.addEventListener("click", () => playMove(Number(cell.dataset.index)));
  });

  xScore.textContent = scores.X;
  oScore.textContent = scores.O;
  drawScore.textContent = scores.draw;
}

function playMove(index) {
  if (roundOver || board[index]) return;
  board[index] = currentPlayer;
  const winner = findWinner();

  if (winner) {
    roundOver = true;
    scores[currentPlayer] += 1;
    updateStatus(`<b style="color:var(--${currentPlayer.toLowerCase()})">${currentPlayer}</b> turu kazandı`);
  } else if (board.every(Boolean)) {
    roundOver = true;
    scores.draw += 1;
    updateStatus("Bu tur berabere");
  } else {
    currentPlayer = currentPlayer === "X" ? "O" : "X";
    updateStatus(
      `<b style="color:var(--${currentPlayer.toLowerCase()})">${currentPlayer}</b> oynuyor`,
    );
  }
  render();
}

function startRound() {
  board = Array(9).fill("");
  currentPlayer = "X";
  roundOver = false;
  updateStatus('<b style="color:var(--x)">X</b> başlıyor');
  render();
}

nextRound.addEventListener("click", startRound);
resetScores.addEventListener("click", () => {
  scores = { X: 0, O: 0, draw: 0 };
  startRound();
});
helpButton.addEventListener("click", () => {
  closeRules.textContent = "Oyuna dön";
  rulesOverlay.classList.add("is-visible");
});
closeRules.addEventListener("click", () => {
  rulesOverlay.classList.remove("is-visible");
});

startRound();
