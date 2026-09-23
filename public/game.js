const socket = io();

const menu = document.getElementById("menu");
const lobby = document.getElementById("lobby");
const gameArea = document.getElementById("gameArea");
const createBtn = document.getElementById("createBtn");
const joinBtn = document.getElementById("joinBtn");
const roomInput = document.getElementById("roomInput");
const menuMsg = document.getElementById("menuMsg");
const roomCodeEl = document.getElementById("roomCode");
const copyBtn = document.getElementById("copyBtn");
const lobbyMsg = document.getElementById("lobbyMsg");
const roomBadge = document.getElementById("roomBadge");
const statusEl = document.getElementById("status");

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

let myPlayerIndex = null;
let currentRoom = null;
let state = null;

const input = {
  left: false,
  right: false,
  jump: false
};

function show(el) { el.classList.remove("hidden"); }
function hide(el) { el.classList.add("hidden"); }

function enterLobby(code) {
  currentRoom = code;
  roomCodeEl.textContent = code;
  roomBadge.textContent = `ROOM ${code}`;
  hide(menu);
  hide(gameArea);
  show(lobby);
}

function enterGame() {
  hide(menu);
  hide(lobby);
  show(gameArea);
}

createBtn.addEventListener("click", () => {
  menuMsg.textContent = "";
  socket.emit("createRoom", {}, (res) => {
    if (!res?.ok) return;
    myPlayerIndex = res.playerIndex;
    enterLobby(res.code);
  });
});

joinBtn.addEventListener("click", joinRoom);
roomInput.addEventListener("keydown", e => {
  if (e.key === "Enter") joinRoom();
});

function joinRoom() {
  const code = roomInput.value.trim().toUpperCase();
  if (code.length !== 5) {
    menuMsg.textContent = "방 코드는 5자리입니다.";
    return;
  }

  socket.emit("joinRoom", { code }, (res) => {
    if (!res?.ok) {
      menuMsg.textContent = res?.error || "참가 실패";
      return;
    }

    myPlayerIndex = res.playerIndex;
    currentRoom = res.code;
    roomBadge.textContent = `ROOM ${res.code}`;
    enterGame();
  });
}

copyBtn.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(currentRoom);
    copyBtn.textContent = "복사됨";
    setTimeout(() => copyBtn.textContent = "코드 복사", 1000);
  } catch {
    copyBtn.textContent = currentRoom;
  }
});

socket.on("gameStarted", () => {
  lobbyMsg.textContent = "친구 입장 완료. 게임 시작!";
  setTimeout(enterGame, 400);
});

socket.on("state", nextState => {
  state = nextState;
});

socket.on("point", ({ scorer, score }) => {
  statusEl.textContent = `${scorer === myPlayerIndex ? "득점!" : "상대 득점"}  ${score[0]} : ${score[1]}`;
  setTimeout(() => statusEl.textContent = "플레이 중", 1200);
});

socket.on("opponentLeft", () => {
  statusEl.textContent = "상대방이 나갔습니다.";
});

socket.on("disconnect", () => {
  statusEl.textContent = "서버 연결 끊김";
});

socket.on("connect", () => {
  statusEl.textContent = "연결됨";
});

function emitInput() {
  socket.emit("input", input);
}

const keyMap = {
  "a": "left",
  "arrowleft": "left",
  "d": "right",
  "arrowright": "right",
  "w": "jump",
  "arrowup": "jump",
  " ": "jump"
};

window.addEventListener("keydown", e => {
  const k = keyMap[e.key.toLowerCase()];
  if (!k) return;
  e.preventDefault();
  if (!input[k]) {
    input[k] = true;
    emitInput();
  }
});

window.addEventListener("keyup", e => {
  const k = keyMap[e.key.toLowerCase()];
  if (!k) return;
  e.preventDefault();
  input[k] = false;
  emitInput();
});

document.querySelectorAll("[data-key]").forEach(btn => {
  const key = btn.dataset.key;

  const down = e => {
    e.preventDefault();
    input[key] = true;
    emitInput();
  };

  const up = e => {
    e.preventDefault();
    input[key] = false;
    emitInput();
  };

  btn.addEventListener("pointerdown", down);
  btn.addEventListener("pointerup", up);
  btn.addEventListener("pointercancel", up);
  btn.addEventListener("pointerleave", up);
});

function drawRoundedRect(x, y, w, h, r, fill) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
}

function drawMouse(x, y, side, me) {
  const flip = side === 0 ? 1 : -1;

  ctx.save();
  ctx.translate(x, y);

  ctx.fillStyle = me ? "#ffe044" : "#ffd35a";
  ctx.strokeStyle = me ? "#4d3c00" : "#5b4700";
  ctx.lineWidth = 7;

  ctx.beginPath();
  ctx.arc(-26, -38, 20, 0, Math.PI * 2);
  ctx.arc(26, -38, 20, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(0, 0, 52, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#222";
  ctx.beginPath();
  ctx.arc(-28, -42, 9, 0, Math.PI * 2);
  ctx.arc(28, -42, 9, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#ff5353";
  ctx.beginPath();
  ctx.arc(-31 * flip, 10, 9, 0, Math.PI * 2);
  ctx.arc(31 * flip, 10, 9, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#1c1c1c";
  ctx.beginPath();
  ctx.arc(-16, -8, 5, 0, Math.PI * 2);
  ctx.arc(16, -8, 5, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#222";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 5, 10, 0.1 * Math.PI, 0.9 * Math.PI);
  ctx.stroke();

  ctx.strokeStyle = "#ffd325";
  ctx.lineWidth = 11;
  ctx.beginPath();
  ctx.moveTo(-48 * flip, 18);
  ctx.lineTo(-73 * flip, 5);
  ctx.lineTo(-61 * flip, -10);
  ctx.lineTo(-88 * flip, -28);
  ctx.stroke();

  ctx.restore();
}

function drawBall(ball) {
  const g = ctx.createRadialGradient(
    ball.x - 8, ball.y - 10, 3,
    ball.x, ball.y, 30
  );
  g.addColorStop(0, "#ffffff");
  g.addColorStop(1, "#d7e2ff");

  ctx.beginPath();
  ctx.arc(ball.x, ball.y, 28, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = "#26345d";
  ctx.lineWidth = 4;
  ctx.stroke();

  ctx.strokeStyle = "#7080aa";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, 15, -0.8, 2.2);
  ctx.stroke();
}

function drawScene() {
  requestAnimationFrame(drawScene);

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const sky = ctx.createLinearGradient(0, 0, 0, 720);
  sky.addColorStop(0, "#6fc9ff");
  sky.addColorStop(0.64, "#b5edff");
  sky.addColorStop(0.65, "#65cb79");
  sky.addColorStop(1, "#2c8b4b");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, 1280, 720);

  ctx.fillStyle = "rgba(255,255,255,0.72)";
  for (const c of [[160,120,70],[270,90,52],[1020,120,80],[880,70,46]]) {
    ctx.beginPath();
    ctx.arc(c[0], c[1], c[2], 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = "#d9b56b";
  ctx.fillRect(0, 640, 1280, 80);

  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.fillRect(635, 640, 10, 80);

  ctx.fillStyle = "#e8edf8";
  ctx.fillRect(629, 460, 22, 180);
  ctx.fillStyle = "#3d4f7a";
  for (let y = 475; y < 630; y += 20) {
    ctx.fillRect(632, y, 16, 3);
  }

  if (!state) {
    ctx.fillStyle = "#20345b";
    ctx.font = "700 34px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("게임 상태를 기다리는 중...", 640, 280);
    return;
  }

  const score = state.score || [0, 0];

  drawRoundedRect(510, 28, 260, 72, 22, "rgba(11,20,44,0.66)");
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.font = "900 44px system-ui";
  ctx.fillText(`${score[0]}  :  ${score[1]}`, 640, 79);

  drawMouse(state.players[0].x, state.players[0].y, 0, myPlayerIndex === 0);
  drawMouse(state.players[1].x, state.players[1].y, 1, myPlayerIndex === 1);
  drawBall(state.ball);

  ctx.font = "800 20px system-ui";
  ctx.fillStyle = "#172241";
  ctx.fillText(myPlayerIndex === 0 ? "나" : "친구", 300, 610);
  ctx.fillText(myPlayerIndex === 1 ? "나" : "친구", 980, 610);
}

drawScene();