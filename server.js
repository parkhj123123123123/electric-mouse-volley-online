const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3000;
const rooms = new Map();

const WORLD = {
  width: 1280,
  height: 720,
  groundY: 640,
  netX: 640,
  netWidth: 22,
  netHeight: 180
};

const PLAYER = {
  radius: 52,
  speed: 520,
  jump: 980,
  gravity: 2200
};

const BALL = {
  radius: 28,
  gravity: 1250,
  maxSpeed: 1200
};

function roomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code;
  do {
    code = Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  } while (rooms.has(code));
  return code;
}

function makePlayer(side) {
  const x = side === 0 ? 300 : 980;
  return {
    x,
    y: WORLD.groundY - PLAYER.radius,
    vx: 0,
    vy: 0,
    input: { left: false, right: false, jump: false },
    onGround: true,
    side
  };
}

function makeBall() {
  return {
    x: WORLD.width / 2,
    y: 220,
    vx: Math.random() < 0.5 ? -220 : 220,
    vy: -220
  };
}

function makeRoom(code) {
  return {
    code,
    sockets: [],
    players: [makePlayer(0), makePlayer(1)],
    ball: makeBall(),
    score: [0, 0],
    started: false,
    lastTs: Date.now(),
    pointPauseUntil: 0
  };
}

function publicState(room) {
  return {
    world: WORLD,
    players: room.players.map(p => ({
      x: p.x, y: p.y, vx: p.vx, vy: p.vy, side: p.side
    })),
    ball: { ...room.ball },
    score: [...room.score],
    started: room.started
  };
}

function resetRound(room, serveToward) {
  room.players[0] = makePlayer(0);
  room.players[1] = makePlayer(1);
  room.ball = makeBall();
  room.ball.vx = serveToward === 0 ? -260 : 260;
  room.pointPauseUntil = Date.now() + 1200;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function circleCollision(ball, player) {
  const dx = ball.x - player.x;
  const dy = ball.y - player.y;
  const dist = Math.hypot(dx, dy);
  const minDist = BALL.radius + PLAYER.radius;

  if (dist > 0 && dist < minDist) {
    const nx = dx / dist;
    const ny = dy / dist;
    const overlap = minDist - dist;

    ball.x += nx * overlap;
    ball.y += ny * overlap;

    const relVx = ball.vx - player.vx;
    const relVy = ball.vy - player.vy;
    const relAlong = relVx * nx + relVy * ny;

    if (relAlong < 0) {
      const bounce = 1.08;
      ball.vx -= (1 + bounce) * relAlong * nx;
      ball.vy -= (1 + bounce) * relAlong * ny;
    }

    ball.vx += player.vx * 0.22;
    ball.vy += player.vy * 0.12 - 80;

    const sp = Math.hypot(ball.vx, ball.vy);
    if (sp > BALL.maxSpeed) {
      ball.vx = ball.vx / sp * BALL.maxSpeed;
      ball.vy = ball.vy / sp * BALL.maxSpeed;
    }
  }
}

function updateRoom(room, dt) {
  if (!room.started) return;
  if (Date.now() < room.pointPauseUntil) return;

  for (let i = 0; i < 2; i++) {
    const p = room.players[i];
    const inp = p.input;

    let dir = 0;
    if (inp.left) dir -= 1;
    if (inp.right) dir += 1;

    p.vx = dir * PLAYER.speed;

    if (inp.jump && p.onGround) {
      p.vy = -PLAYER.jump;
      p.onGround = false;
    }

    p.vy += PLAYER.gravity * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;

    if (p.y + PLAYER.radius >= WORLD.groundY) {
      p.y = WORLD.groundY - PLAYER.radius;
      p.vy = 0;
      p.onGround = true;
    }

    if (i === 0) {
      p.x = clamp(p.x, PLAYER.radius, WORLD.netX - WORLD.netWidth / 2 - PLAYER.radius);
    } else {
      p.x = clamp(p.x, WORLD.netX + WORLD.netWidth / 2 + PLAYER.radius, WORLD.width - PLAYER.radius);
    }
  }

  const b = room.ball;
  b.vy += BALL.gravity * dt;
  b.x += b.vx * dt;
  b.y += b.vy * dt;

  if (b.x - BALL.radius < 0) {
    b.x = BALL.radius;
    b.vx = Math.abs(b.vx) * 0.92;
  }
  if (b.x + BALL.radius > WORLD.width) {
    b.x = WORLD.width - BALL.radius;
    b.vx = -Math.abs(b.vx) * 0.92;
  }
  if (b.y - BALL.radius < 0) {
    b.y = BALL.radius;
    b.vy = Math.abs(b.vy) * 0.92;
  }

  const netTop = WORLD.groundY - WORLD.netHeight;
  const left = WORLD.netX - WORLD.netWidth / 2;
  const right = WORLD.netX + WORLD.netWidth / 2;

  if (
    b.x + BALL.radius > left &&
    b.x - BALL.radius < right &&
    b.y + BALL.radius > netTop &&
    b.y - BALL.radius < WORLD.groundY
  ) {
    if (b.y < netTop + 16 && b.vy > 0) {
      b.y = netTop - BALL.radius;
      b.vy = -Math.abs(b.vy) * 0.9;
    } else if (b.x < WORLD.netX) {
      b.x = left - BALL.radius;
      b.vx = -Math.abs(b.vx) * 0.9;
    } else {
      b.x = right + BALL.radius;
      b.vx = Math.abs(b.vx) * 0.9;
    }
  }

  circleCollision(b, room.players[0]);
  circleCollision(b, room.players[1]);

  if (b.y + BALL.radius >= WORLD.groundY) {
    const loserSide = b.x < WORLD.netX ? 0 : 1;
    const scorer = loserSide === 0 ? 1 : 0;
    room.score[scorer] += 1;

    io.to(room.code).emit("point", {
      scorer,
      score: [...room.score]
    });

    resetRound(room, scorer === 0 ? 1 : 0);
  }
}

io.on("connection", (socket) => {
  socket.on("createRoom", (_, ack) => {
    const code = roomCode();
    const room = makeRoom(code);
    rooms.set(code, room);

    room.sockets.push(socket.id);
    socket.join(code);
    socket.data.roomCode = code;
    socket.data.playerIndex = 0;

    ack({ ok: true, code, playerIndex: 0 });
    socket.emit("state", publicState(room));
  });

  socket.on("joinRoom", (payload, ack) => {
    const code = String(payload?.code || "").trim().toUpperCase();
    const room = rooms.get(code);

    if (!room) return ack({ ok: false, error: "방을 찾을 수 없습니다." });
    if (room.sockets.length >= 2) return ack({ ok: false, error: "이미 2명이 들어와 있습니다." });

    room.sockets.push(socket.id);
    socket.join(code);
    socket.data.roomCode = code;
    socket.data.playerIndex = 1;
    room.started = true;

    ack({ ok: true, code, playerIndex: 1 });
    io.to(code).emit("gameStarted", { code });
    io.to(code).emit("state", publicState(room));
  });

  socket.on("input", (input) => {
    const code = socket.data.roomCode;
    const idx = socket.data.playerIndex;
    const room = rooms.get(code);
    if (!room || idx === undefined) return;

    room.players[idx].input = {
      left: !!input.left,
      right: !!input.right,
      jump: !!input.jump
    };
  });

  socket.on("disconnect", () => {
    const code = socket.data.roomCode;
    const room = rooms.get(code);
    if (!room) return;

    room.sockets = room.sockets.filter(id => id !== socket.id);
    io.to(code).emit("opponentLeft");

    if (room.sockets.length === 0) {
      rooms.delete(code);
    } else {
      room.started = false;
    }
  });
});

setInterval(() => {
  const now = Date.now();
  for (const room of rooms.values()) {
    const dt = Math.min((now - room.lastTs) / 1000, 0.033);
    room.lastTs = now;
    updateRoom(room, dt);
    io.to(room.code).emit("state", publicState(room));
  }
}, 1000 / 60);

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});