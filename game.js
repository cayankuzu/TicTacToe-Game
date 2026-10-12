"use strict";

/* ==========================================================================
   Tic Tac Toe · MeMoDe
   Tek oyuncu (yapay zekâ) ve iki oyunculu seri maçlar; 3×3 – 6×6 tahtalar.
   ========================================================================== */

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

const STORAGE_KEY = "memode-tictactoe-v2";
const WIN_LENGTH = { 3: 3, 4: 4, 5: 4, 6: 5 };
const LENGTH_WORD = { 3: "üçlü", 4: "dörtlü", 5: "beşli" };
const DIFFICULTY_LABEL = { easy: "Çırak", normal: "Usta", hard: "Efsane" };
const DIFFICULTY_HINT = {
  easy: "Ara sıra hata yapar; kuralları öğrenmek için ideal.",
  normal: "Tehditleri görür ama her fırsatı değerlendirmez.",
  hard: "3×3'te kusursuz oynar; büyük tahtalarda en güçlü hamleyi arar.",
};
const HUMAN = "X";
const AI = "O";
const DIRECTIONS = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
];

/* ------------------------------------------------------------ persistence */

const defaults = {
  settings: { mode: "ai", difficulty: "normal", board: 3, series: 2, timer: 0, muted: false },
  records: { wins: { easy: 0, normal: 0, hard: 0 }, streak: 0, bestStreak: 0 },
};

function loadStore() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return {
      settings: { ...defaults.settings, ...(saved.settings || {}) },
      records: {
        ...defaults.records,
        ...(saved.records || {}),
        wins: { ...defaults.records.wins, ...((saved.records || {}).wins || {}) },
      },
    };
  } catch {
    return structuredClone(defaults);
  }
}

const store = loadStore();
const settings = store.settings;
const records = store.records;

function saveStore() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ settings, records }));
  } catch {
    /* Kayıt yapılamasa da oyun çalışır. */
  }
}

/* ------------------------------------------------------------------ audio */

const sound = (() => {
  let context = null;

  function ctx() {
    if (settings.muted) return null;
    if (!context) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return null;
      context = new AudioContext();
    }
    if (context.state === "suspended") context.resume();
    return context;
  }

  function tone(frequency, duration, { type = "sine", gain = 0.12, delay = 0, slide = 0 } = {}) {
    const audio = ctx();
    if (!audio) return;
    const start = audio.currentTime + delay;
    const oscillator = audio.createOscillator();
    const volume = audio.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    if (slide) oscillator.frequency.exponentialRampToValueAtTime(frequency * slide, start + duration);
    volume.gain.setValueAtTime(0.0001, start);
    volume.gain.exponentialRampToValueAtTime(gain, start + 0.012);
    volume.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(volume).connect(audio.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }

  return {
    click: () => tone(880, 0.05, { type: "square", gain: 0.03 }),
    place: (mark) =>
      mark === "X"
        ? (tone(420, 0.12, { type: "triangle", gain: 0.14, slide: 0.7 }), tone(180, 0.1, { type: "sine", gain: 0.1 }))
        : (tone(520, 0.16, { type: "sine", gain: 0.13, slide: 1.4 }), tone(260, 0.12, { type: "sine", gain: 0.06 })),
    win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.32, { type: "triangle", gain: 0.12, delay: i * 0.09 })),
    lose: () => [392, 330, 262].forEach((f, i) => tone(f, 0.36, { type: "sawtooth", gain: 0.05, delay: i * 0.12 })),
    draw: () => [330, 330].forEach((f, i) => tone(f, 0.22, { type: "sine", gain: 0.08, delay: i * 0.16 })),
    tick: () => tone(1200, 0.04, { type: "square", gain: 0.035 }),
    match: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.5, { type: "triangle", gain: 0.1, delay: i * 0.11 })),
  };
})();

/* ------------------------------------------------------------------ state */

const game = {
  size: 3,
  length: 3,
  board: [],
  turn: "X",
  starter: "X",
  over: false,
  matchOver: false,
  winCells: [],
  history: [],
  score: { X: 0, O: 0 },
  round: 1,
  cursor: 4,
  paused: false,
  aiThinking: false,
  aiTimer: 0,
  timer: { deadline: 0, remaining: 0, frame: 0, lastTick: 0 },
};

const el = {
  screens: { menu: $("#menuScreen"), setup: $("#setupScreen"), game: $("#gameScreen") },
  board: $("#board"),
  boardFrame: $(".board-frame"),
  winLine: $("#winLine"),
  status: $("#status"),
  timer: $("#timer"),
  timerFill: $("#timerFill"),
  modeChip: $("#modeChip"),
  roundChip: $("#roundChip"),
  cards: { X: $("#cardX"), O: $("#cardO") },
  roles: { X: $("#roleX"), O: $("#roleO") },
  names: { X: $("#nameX"), O: $("#nameO") },
  scores: { X: $("#scoreX"), O: $("#scoreO") },
  pips: { X: $("#pipsX"), O: $("#pipsO") },
  pause: $("#pauseOverlay"),
  result: $("#resultOverlay"),
  rules: $("#rulesOverlay"),
  resultKicker: $("#resultKicker"),
  resultTitle: $("#resultTitle"),
  resultScore: $("#resultScore"),
  resultNote: $("#resultNote"),
  resultPrimary: $("#resultPrimary"),
  sound: $("#soundToggle"),
  undo: $("#undoButton"),
  confetti: $("#confetti"),
  record: $("#menuRecord"),
  demo: $("#demoBoard"),
  difficultyField: $("#difficultyField"),
  difficultyHint: $("#difficultyHint"),
  setupKicker: $("#setupKicker"),
};

const isAiMode = () => settings.mode === "ai";
const other = (mark) => (mark === "X" ? "O" : "X");

/* -------------------------------------------------------------- markup */

const markSvg = (mark, extra = "") =>
  mark === "X"
    ? `<svg viewBox="0 0 100 100" class="${extra || "mark mark--x"}"><path d="M25 25 75 75" /><path d="M75 25 25 75" /></svg>`
    : `<svg viewBox="0 0 100 100" class="${extra || "mark mark--o"}"><circle cx="50" cy="50" r="26" transform="rotate(-90 50 50)" /></svg>`;

const ghostSvg = () => markSvg("X", "ghost ghost--x") + markSvg("O", "ghost ghost--o");

function colored(mark, text = mark) {
  return `<b style="color:var(--${mark.toLowerCase()})">${text}</b>`;
}

function playerName(mark) {
  if (!isAiMode()) return `Oyuncu ${mark}`;
  return mark === HUMAN ? "Sen" : "Yapay zekâ";
}

/* ------------------------------------------------------------- screens */

function showScreen(name) {
  Object.entries(el.screens).forEach(([key, node]) => node.classList.toggle("is-active", key === name));
  if (name === "menu") startDemo();
  else stopDemo();
}

function openOverlay(node) {
  node.hidden = false;
  const focusTarget = $(".btn--primary, button", node);
  requestAnimationFrame(() => focusTarget?.focus());
}

function closeOverlay(node) {
  node.hidden = true;
}

/* ---------------------------------------------------------------- menu */

function renderRecords() {
  const total = records.wins.easy + records.wins.normal + records.wins.hard;
  el.record.innerHTML = `
    <div><dt>Galibiyet</dt><dd>${total}</dd></div>
    <div><dt>Efsane</dt><dd>${records.wins.hard}</dd></div>
    <div><dt>En uzun seri</dt><dd>${records.bestStreak}</dd></div>`;
}

let demoTimer = 0;
const DEMO_SEQUENCE = [4, 0, 2, 6, 3, 5, 1, 7, 8];

function startDemo() {
  stopDemo();
  el.demo.innerHTML = Array.from({ length: 9 }, () => `<div class="cell"></div>`).join("");
  const cells = $$(".cell", el.demo);
  const moves = DEMO_SEQUENCE.slice(0, 7);
  let step = 0;
  const run = () => {
    if (step < moves.length) {
      const mark = step % 2 === 0 ? "X" : "O";
      cells[moves[step]].innerHTML = markSvg(mark);
      step += 1;
      demoTimer = window.setTimeout(run, 720);
    } else {
      [4, 1, 7].forEach((index) => cells[index].classList.add("is-winner"));
      demoTimer = window.setTimeout(() => {
        cells.forEach((cell) => {
          cell.innerHTML = "";
          cell.classList.remove("is-winner");
        });
        step = 0;
        demoTimer = window.setTimeout(run, 600);
      }, 2200);
    }
  };
  demoTimer = window.setTimeout(run, 500);
}

function stopDemo() {
  window.clearTimeout(demoTimer);
}

/* --------------------------------------------------------------- setup */

function syncSegmented() {
  $$(".segmented[data-setting]").forEach((group) => {
    const key = group.dataset.setting;
    $$("button", group).forEach((button) => {
      const checked = String(settings[key]) === button.dataset.value;
      button.setAttribute("aria-checked", String(checked));
      button.tabIndex = checked ? 0 : -1;
    });
  });
  el.difficultyField.hidden = !isAiMode();
  el.difficultyHint.textContent = DIFFICULTY_HINT[settings.difficulty];
  el.setupKicker.textContent = isAiMode() ? "Yapay zekâya karşı" : "İki oyuncu";
}

function openSetup(mode) {
  settings.mode = mode;
  saveStore();
  syncSegmented();
  showScreen("setup");
  requestAnimationFrame(() => $('.segmented button[aria-checked="true"]', el.screens.setup)?.focus());
}

$$(".segmented[data-setting]").forEach((group) => {
  group.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    const key = group.dataset.setting;
    const raw = button.dataset.value;
    settings[key] = ["board", "series", "timer"].includes(key) ? Number(raw) : raw;
    sound.click();
    saveStore();
    syncSegmented();
  });
  group.addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    event.preventDefault();
    const buttons = $$("button", group);
    const current = buttons.findIndex((button) => button.getAttribute("aria-checked") === "true");
    const step = event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1;
    const next = buttons[(current + step + buttons.length) % buttons.length];
    next.click();
    next.focus();
  });
});

/* ---------------------------------------------------------------- rules */

function findLine(board, size, length) {
  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column < size; column += 1) {
      const mark = board[row * size + column];
      if (!mark) continue;
      for (const [dr, dc] of DIRECTIONS) {
        const cells = [];
        for (let step = 0; step < length; step += 1) {
          const r = row + dr * step;
          const c = column + dc * step;
          if (r < 0 || r >= size || c < 0 || c >= size || board[r * size + c] !== mark) break;
          cells.push(r * size + c);
        }
        if (cells.length === length) return { mark, cells };
      }
    }
  }
  return null;
}

const emptyCells = (board) => board.reduce((list, value, index) => (value ? list : [...list, index]), []);

/* ------------------------------------------------------------------- AI */

function immediateMove(board, mark) {
  for (const index of emptyCells(board)) {
    board[index] = mark;
    const line = findLine(board, game.size, game.length);
    board[index] = "";
    if (line) return index;
  }
  return -1;
}

function minimax(board, player, depth, alpha, beta) {
  const line = findLine(board, 3, 3);
  if (line) return line.mark === AI ? 10 - depth : depth - 10;
  const empties = emptyCells(board);
  if (!empties.length) return 0;

  if (player === AI) {
    let best = -Infinity;
    for (const index of empties) {
      board[index] = AI;
      best = Math.max(best, minimax(board, HUMAN, depth + 1, alpha, beta));
      board[index] = "";
      alpha = Math.max(alpha, best);
      if (beta <= alpha) break;
    }
    return best;
  }

  let best = Infinity;
  for (const index of empties) {
    board[index] = HUMAN;
    best = Math.min(best, minimax(board, AI, depth + 1, alpha, beta));
    board[index] = "";
    beta = Math.min(beta, best);
    if (beta <= alpha) break;
  }
  return best;
}

function perfectMove(board) {
  let bestScore = -Infinity;
  let bestMoves = [];
  for (const index of emptyCells(board)) {
    board[index] = AI;
    const score = minimax(board, HUMAN, 0, -Infinity, Infinity);
    board[index] = "";
    if (score > bestScore) {
      bestScore = score;
      bestMoves = [index];
    } else if (score === bestScore) {
      bestMoves.push(index);
    }
  }
  return pick(bestMoves);
}

const WEIGHTS = [0, 1, 9, 70, 600, 6000, 60000];

function heuristic(board, index) {
  const { size, length } = game;
  const row = Math.floor(index / size);
  const column = index % size;
  let attack = 0;
  let defence = 0;

  for (const [dr, dc] of DIRECTIONS) {
    for (let offset = -(length - 1); offset <= 0; offset += 1) {
      let mine = 0;
      let theirs = 0;
      let valid = true;
      for (let step = 0; step < length; step += 1) {
        const r = row + dr * (offset + step);
        const c = column + dc * (offset + step);
        if (r < 0 || r >= size || c < 0 || c >= size) {
          valid = false;
          break;
        }
        const value = board[r * size + c];
        if (value === AI) mine += 1;
        else if (value === HUMAN) theirs += 1;
      }
      if (!valid) continue;
      if (theirs === 0) attack += WEIGHTS[mine + 1];
      if (mine === 0) defence += WEIGHTS[theirs + 1] * 0.92;
    }
  }

  const center = (size - 1) / 2;
  const distance = Math.abs(row - center) + Math.abs(column - center);
  return attack + defence + (size - distance) * 0.5;
}

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function chooseAiMove() {
  const board = [...game.board];
  const empties = emptyCells(board);
  const difficulty = settings.difficulty;
  const win = immediateMove(board, AI);
  const block = immediateMove(board, HUMAN);

  if (game.size === 3) {
    if (difficulty === "hard") return perfectMove(board);
    if (difficulty === "normal") {
      if (win >= 0) return win;
      if (block >= 0) return block;
      return Math.random() < 0.72 ? perfectMove(board) : pick(empties);
    }
    if (win >= 0 && Math.random() < 0.75) return win;
    if (block >= 0 && Math.random() < 0.45) return block;
    return pick(empties);
  }

  if (win >= 0 && (difficulty !== "easy" || Math.random() < 0.7)) return win;
  if (block >= 0) {
    const blockChance = { easy: 0.5, normal: 0.92, hard: 1 }[difficulty];
    if (Math.random() < blockChance) return block;
  }

  const ranked = empties
    .map((index) => ({ index, score: heuristic(board, index) + Math.random() * 0.4 }))
    .sort((a, b) => b.score - a.score);

  if (difficulty === "hard") return ranked[0].index;
  if (difficulty === "normal") return pick(ranked.slice(0, Math.min(3, ranked.length))).index;
  return pick(ranked.slice(0, Math.max(1, Math.ceil(ranked.length / 2)))).index;
}

function scheduleAi() {
  game.aiThinking = true;
  updateHud();
  const delay = 420 + Math.random() * 420 + (game.size > 3 ? 180 : 0);
  game.aiTimer = window.setTimeout(() => {
    game.aiTimer = 0;
    if (game.over || game.paused) return;
    game.aiThinking = false;
    playMove(chooseAiMove());
  }, delay);
}

/* --------------------------------------------------------------- board */

function buildBoard() {
  el.board.style.setProperty("--size", game.size);
  el.board.classList.remove("is-over");
  el.board.setAttribute(
    "aria-label",
    `${game.size} × ${game.size} tahta · kazanmak için ${game.length} işaret`,
  );
  el.board.innerHTML = game.board
    .map((_, index) => {
      const row = Math.floor(index / game.size) + 1;
      const column = (index % game.size) + 1;
      return `<button class="cell" type="button" role="gridcell" data-index="${index}" aria-label="${row}. satır ${column}. sütun, boş">${ghostSvg()}</button>`;
    })
    .join("");
  el.winLine.classList.remove("is-visible");
}

function paintCell(index) {
  const cell = el.board.children[index];
  const mark = game.board[index];
  const row = Math.floor(index / game.size) + 1;
  const column = (index % game.size) + 1;
  cell.classList.toggle("is-cursor", index === game.cursor && !game.over);
  if (!mark) {
    cell.innerHTML = ghostSvg();
    cell.classList.remove("is-placed");
    cell.setAttribute("aria-label", `${row}. satır ${column}. sütun, boş`);
    return;
  }
  cell.innerHTML = markSvg(mark);
  cell.classList.add("is-placed");
  cell.setAttribute("aria-label", `${row}. satır ${column}. sütun, ${mark}`);
}

function refreshCells() {
  const humanTurn = !isAiMode() || game.turn === HUMAN;
  $$(".cell", el.board).forEach((cell, index) => {
    cell.disabled = Boolean(game.board[index]) || game.over || !humanTurn || game.aiThinking;
    cell.classList.toggle("is-cursor", index === game.cursor && !game.over && humanTurn);
  });
  el.board.dataset.turn = game.turn;
}

function drawWinLine(cells) {
  const frame = el.boardFrame.getBoundingClientRect();
  const first = el.board.children[cells[0]].getBoundingClientRect();
  const last = el.board.children[cells[cells.length - 1]].getBoundingClientRect();
  const x1 = first.left + first.width / 2 - frame.left;
  const y1 = first.top + first.height / 2 - frame.top;
  const x2 = last.left + last.width / 2 - frame.left;
  const y2 = last.top + last.height / 2 - frame.top;
  const pad = first.width * 0.32;
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const line = $("line", el.winLine);
  line.setAttribute("x1", x1 - Math.cos(angle) * pad);
  line.setAttribute("y1", y1 - Math.sin(angle) * pad);
  line.setAttribute("x2", x2 + Math.cos(angle) * pad);
  line.setAttribute("y2", y2 + Math.sin(angle) * pad);
  el.winLine.style.setProperty("--len", Math.hypot(x2 - x1, y2 - y1) + pad * 2);
  el.winLine.classList.remove("is-visible");
  void el.winLine.getBoundingClientRect();
  el.winLine.classList.add("is-visible");
}

/* ----------------------------------------------------------------- HUD */

function updateHud() {
  const target = settings.series;
  ["X", "O"].forEach((mark) => {
    el.scores[mark].textContent = game.score[mark];
    el.pips[mark].innerHTML =
      target > 1
        ? Array.from({ length: target }, (_, index) => `<i class="${index < game.score[mark] ? "is-won" : ""}"></i>`).join("")
        : "";
    const isTurn = !game.over && game.turn === mark;
    el.cards[mark].classList.toggle("is-turn", isTurn);
    el.cards[mark].classList.toggle("is-waiting", !game.over && !isTurn);
    el.cards[mark].classList.toggle("is-thinking", isTurn && game.aiThinking);
  });

  if (isAiMode()) {
    el.roles.X.textContent = "Sen";
    el.names.X.textContent = "Oyuncu";
    el.roles.O.textContent = `Rakip · ${DIFFICULTY_LABEL[settings.difficulty]}`;
    el.names.O.textContent = "Yapay zekâ";
  } else {
    el.roles.X.textContent = "Oyuncu 1";
    el.names.X.textContent = "Kırmızı · X";
    el.roles.O.textContent = "Oyuncu 2";
    el.names.O.textContent = "Yeşil · O";
  }

  const parts = [isAiMode() ? `Yapay zekâ · ${DIFFICULTY_LABEL[settings.difficulty]}` : "İki oyuncu", `${game.size}×${game.size}`];
  if (settings.timer) parts.push(`${settings.timer} sn`);
  el.modeChip.textContent = parts.join(" · ");
  el.roundChip.textContent =
    settings.series > 1 ? `Tur ${game.round} · ilk ${settings.series}'ye ulaşan kazanır` : "Tek tur";

  el.undo.disabled = !undoAvailable();

  if (game.over) return;
  const goal = `${LENGTH_WORD[game.length]} sırayı tamamla`;
  if (isAiMode()) {
    el.status.innerHTML = game.turn === HUMAN ? `${colored("X", "Sıra sende")} · ${goal}` : `${colored("O", "Yapay zekâ")} düşünüyor…`;
  } else {
    el.status.innerHTML = `${colored(game.turn, `Oyuncu ${game.turn}`)} oynuyor · ${goal}`;
  }
}

/* --------------------------------------------------------------- timer */

function stopTimer() {
  cancelAnimationFrame(game.timer.frame);
  game.timer.frame = 0;
}

function timerActiveFor(mark) {
  return settings.timer > 0 && (!isAiMode() || mark === HUMAN);
}

function startTimer(remaining = settings.timer * 1000) {
  stopTimer();
  if (!timerActiveFor(game.turn) || game.over) {
    el.timer.hidden = true;
    return;
  }
  el.timer.hidden = false;
  game.timer.deadline = performance.now() + remaining;
  game.timer.lastTick = Math.ceil(remaining / 1000);
  const total = settings.timer * 1000;
  const loop = (now) => {
    const left = Math.max(0, game.timer.deadline - now);
    const ratio = left / total;
    el.timerFill.style.transform = `scaleX(${ratio})`;
    el.timer.classList.toggle("is-critical", ratio < 0.34);
    const second = Math.ceil(left / 1000);
    if (second < game.timer.lastTick && ratio < 0.34) sound.tick();
    game.timer.lastTick = second;
    if (left <= 0) {
      game.timer.frame = 0;
      const move = pick(emptyCells(game.board));
      el.status.innerHTML = `${colored(game.turn, "Süre doldu")} · rastgele hamle yapıldı`;
      playMove(move, { forced: true });
      return;
    }
    game.timer.frame = requestAnimationFrame(loop);
  };
  game.timer.frame = requestAnimationFrame(loop);
}

/* ---------------------------------------------------------------- flow */

function startMatch() {
  closeOverlay(el.result);
  closeOverlay(el.pause);
  game.size = settings.board;
  game.length = WIN_LENGTH[settings.board];
  game.score = { X: 0, O: 0 };
  game.round = 1;
  game.matchOver = false;
  game.starter = "X";
  showScreen("game");
  startRound();
}

function startRound() {
  window.clearTimeout(game.aiTimer);
  game.aiThinking = false;
  game.board = Array(game.size * game.size).fill("");
  game.turn = game.starter;
  game.over = false;
  game.paused = false;
  game.winCells = [];
  game.history = [];
  game.cursor = Math.floor((game.size * game.size) / 2) - (game.size % 2 === 0 ? game.size / 2 : 0);
  buildBoard();
  refreshCells();
  updateHud();
  if (isAiMode() && game.turn === AI) scheduleAi();
  else startTimer();
}

function playMove(index, { forced = false } = {}) {
  if (game.over || game.paused || index < 0 || game.board[index]) return;
  stopTimer();
  game.board[index] = game.turn;
  game.history.push(index);
  game.cursor = index;
  paintCell(index);
  sound.place(game.turn);
  if (!forced && navigator.vibrate) navigator.vibrate(8);

  const line = findLine(game.board, game.size, game.length);
  if (line) return endRound(line.mark, line.cells);
  if (game.board.every(Boolean)) return endRound(null, []);

  game.turn = other(game.turn);
  refreshCells();
  updateHud();
  if (isAiMode() && game.turn === AI) scheduleAi();
  else startTimer();
}

function endRound(winner, cells) {
  game.over = true;
  game.aiThinking = false;
  stopTimer();
  el.timer.hidden = true;
  game.winCells = cells;
  el.board.classList.add("is-over");
  cells.forEach((index) => el.board.children[index].classList.add("is-winner"));
  refreshCells();

  if (winner) {
    game.score[winner] += 1;
    el.scores[winner].classList.remove("is-bump");
    void el.scores[winner].offsetWidth;
    el.scores[winner].classList.add("is-bump");
    drawWinLine(cells);
  } else {
    el.boardFrame.classList.remove("is-shake");
    void el.boardFrame.offsetWidth;
    el.boardFrame.classList.add("is-shake");
  }

  game.matchOver = Boolean(winner) && game.score[winner] >= settings.series;
  updateHud();

  const humanWon = winner && (!isAiMode() || winner === HUMAN);
  if (!winner) sound.draw();
  else if (game.matchOver && humanWon) sound.match();
  else if (humanWon) sound.win();
  else sound.lose();

  el.status.innerHTML = winner
    ? `${colored(winner, playerName(winner))} ${game.length}'li çizgiyi tamamladı`
    : "Tahta doldu · berabere";

  if (game.matchOver && isAiMode()) {
    if (winner === HUMAN) {
      records.wins[settings.difficulty] += 1;
      records.streak += 1;
      records.bestStreak = Math.max(records.bestStreak, records.streak);
    } else {
      records.streak = 0;
    }
    saveStore();
    renderRecords();
  }

  if (humanWon) window.setTimeout(() => burstConfetti(game.matchOver ? 140 : 70), 260);
  window.setTimeout(() => showResult(winner), winner ? 1100 : 800);
}

function showResult(winner) {
  const { X, O } = game.score;
  el.resultTitle.className = `result-title${winner ? ` is-${winner.toLowerCase()}` : ""}`;

  if (!winner) {
    el.resultKicker.textContent = `Tur ${game.round}`;
    el.resultTitle.textContent = "Berabere";
  } else if (isAiMode()) {
    el.resultKicker.textContent = game.matchOver ? "Maç bitti" : `Tur ${game.round}`;
    el.resultTitle.textContent =
      winner === HUMAN ? (game.matchOver ? "Zafer senin" : "Turu aldın") : game.matchOver ? "Yenildin" : "Tur rakibin";
  } else {
    el.resultKicker.textContent = game.matchOver ? "Maç bitti" : `Tur ${game.round}`;
    el.resultTitle.textContent = game.matchOver ? `Oyuncu ${winner} şampiyon` : `Oyuncu ${winner} turu aldı`;
  }

  el.resultScore.textContent = `${X} – ${O}`;
  if (game.matchOver && isAiMode() && winner === HUMAN) {
    el.resultNote.textContent = `${DIFFICULTY_LABEL[settings.difficulty]} seviyesinde galibiyet · seri: ${records.streak}`;
  } else if (!game.matchOver && settings.series > 1) {
    el.resultNote.textContent = `İlk ${settings.series} turu alan maçı kazanır · sıradaki turu ${playerName(other(game.starter))} açar`;
  } else {
    el.resultNote.textContent = "";
  }

  el.resultPrimary.textContent = game.matchOver ? "Rövanş" : "Sonraki tur";
  openOverlay(el.result);
}

function nextRound() {
  closeOverlay(el.result);
  if (game.matchOver) return startMatch();
  game.round += 1;
  game.starter = other(game.starter);
  startRound();
}

function undoAvailable() {
  return !game.over && !game.aiThinking && game.history.length >= (isAiMode() ? 2 : 1);
}

function undo() {
  if (!undoAvailable()) return;
  window.clearTimeout(game.aiTimer);
  // Yapay zekâya karşı geri alma, kendi son hamlen ve rakibin cevabını birlikte geri alır.
  const steps = isAiMode() ? 2 : 1;
  for (let step = 0; step < steps; step += 1) {
    const index = game.history.pop();
    game.board[index] = "";
    paintCell(index);
  }
  game.turn = isAiMode() ? HUMAN : other(game.turn);
  sound.click();
  refreshCells();
  updateHud();
  startTimer();
}

function pause() {
  if (!el.screens.game.classList.contains("is-active") || game.paused) return;
  game.paused = true;
  if (game.timer.frame) {
    game.timer.remaining = Math.max(0, game.timer.deadline - performance.now());
    stopTimer();
  } else {
    game.timer.remaining = 0;
  }
  window.clearTimeout(game.aiTimer);
  openOverlay(el.pause);
}

function resume() {
  closeOverlay(el.pause);
  game.paused = false;
  if (game.over) return;
  if (isAiMode() && game.turn === AI) scheduleAi();
  else startTimer(game.timer.remaining || settings.timer * 1000);
}

function burstConfetti(count) {
  const colors = ["var(--x)", "var(--o)", "var(--gold)", "#ffffff"];
  const pieces = Array.from({ length: count }, () => {
    const piece = document.createElement("i");
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.background = pick(colors);
    piece.style.setProperty("--dx", `${(Math.random() - 0.5) * 240}px`);
    piece.style.setProperty("--rot", `${Math.random() * 900 - 450}deg`);
    piece.style.setProperty("--dur", `${1.8 + Math.random() * 1.6}s`);
    piece.style.animationDelay = `${Math.random() * 0.25}s`;
    return piece;
  });
  el.confetti.append(...pieces);
  window.setTimeout(() => pieces.forEach((piece) => piece.remove()), 4000);
}

function setMuted(muted) {
  settings.muted = muted;
  saveStore();
  el.sound.classList.toggle("is-muted", muted);
  el.sound.setAttribute("aria-label", muted ? "Sesi aç" : "Sesi kapat");
}

/* -------------------------------------------------------------- events */

el.board.addEventListener("click", (event) => {
  const cell = event.target.closest(".cell");
  if (!cell || cell.disabled) return;
  playMove(Number(cell.dataset.index));
});

$$("[data-mode]").forEach((button) =>
  button.addEventListener("click", () => {
    sound.click();
    openSetup(button.dataset.mode);
  }),
);

$$("[data-open='rules']").forEach((button) =>
  button.addEventListener("click", () => {
    if (el.screens.game.classList.contains("is-active") && !game.paused) {
      game.paused = true;
      game.timer.remaining = game.timer.frame ? Math.max(0, game.timer.deadline - performance.now()) : 0;
      stopTimer();
      window.clearTimeout(game.aiTimer);
      el.rules.dataset.resume = "true";
    }
    openOverlay(el.rules);
  }),
);

document.addEventListener("click", (event) => {
  const action = event.target.closest("[data-action]")?.dataset.action;
  if (!action) return;
  sound.click();
  switch (action) {
    case "back":
      showScreen("menu");
      break;
    case "start":
      startMatch();
      break;
    case "resume":
      resume();
      break;
    case "restart-match":
      startMatch();
      break;
    case "setup":
      closeOverlay(el.pause);
      closeOverlay(el.result);
      game.paused = false;
      openSetup(settings.mode);
      break;
    case "menu":
      window.clearTimeout(game.aiTimer);
      stopTimer();
      closeOverlay(el.pause);
      closeOverlay(el.result);
      game.paused = false;
      renderRecords();
      showScreen("menu");
      break;
    case "close-rules":
      closeOverlay(el.rules);
      if (el.rules.dataset.resume) {
        delete el.rules.dataset.resume;
        game.paused = false;
        if (!game.over) {
          if (isAiMode() && game.turn === AI) scheduleAi();
          else startTimer(game.timer.remaining || settings.timer * 1000);
        }
      }
      break;
    default:
      break;
  }
});

el.resultPrimary.addEventListener("click", () => {
  sound.click();
  nextRound();
});
$("#pauseButton").addEventListener("click", pause);
$("#restartButton").addEventListener("click", () => {
  sound.click();
  startRound();
});
el.undo.addEventListener("click", undo);
el.sound.addEventListener("click", () => setMuted(!settings.muted));

document.addEventListener("keydown", (event) => {
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  const key = event.key;

  if (key === "Escape") {
    if (!el.rules.hidden) return $("[data-action='close-rules']").click();
    if (!el.pause.hidden) return resume();
    if (el.screens.setup.classList.contains("is-active")) return showScreen("menu");
    return pause();
  }

  if (key.toLowerCase() === "m") return setMuted(!settings.muted);

  const inGame = el.screens.game.classList.contains("is-active") && el.pause.hidden && el.rules.hidden && el.result.hidden;
  if (!inGame) {
    if (!el.result.hidden && (key === "Enter" || key === " ")) {
      event.preventDefault();
      nextRound();
    }
    return;
  }

  if (key.toLowerCase() === "u") return undo();
  if (key.toLowerCase() === "r") return startRound();
  if (key.toLowerCase() === "h") return $("[data-open='rules']", el.screens.game).click();

  const moves = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] };
  if (moves[key]) {
    event.preventDefault();
    const [dr, dc] = moves[key];
    const row = Math.floor(game.cursor / game.size);
    const column = game.cursor % game.size;
    const nextRow = (row + dr + game.size) % game.size;
    const nextColumn = (column + dc + game.size) % game.size;
    game.cursor = nextRow * game.size + nextColumn;
    refreshCells();
    el.board.children[game.cursor]?.focus({ preventScroll: true });
    return;
  }

  if (key === "Enter" || key === " ") {
    const focused = document.activeElement?.closest?.(".cell");
    if (focused) return;
    event.preventDefault();
    const humanTurn = !isAiMode() || game.turn === HUMAN;
    if (humanTurn && !game.aiThinking) playMove(game.cursor);
  }
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden && el.screens.game.classList.contains("is-active") && !game.over) pause();
});

window.addEventListener("resize", () => {
  if (game.over && game.winCells.length) drawWinLine(game.winCells);
});

/* ---------------------------------------------------------------- boot */

setMuted(settings.muted);
renderRecords();
syncSegmented();
startDemo();
