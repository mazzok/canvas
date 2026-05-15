import WebSocket from "ws";

// ── Config ──────────────────────────────────────────────────────────────────
const PLAYER_COUNT = 5;
const STROKE_COUNT = 500;
const STROKE_INTERVAL_MS = 33; // ~30 strokes/sec
const COLORS = ["#1a1a2e", "#e74c3c", "#3498db", "#2ecc71", "#f39c12", "#9b59b6"];
const CATEGORY = "tiere";

// ── Argument parsing ────────────────────────────────────────────────────────
const target = process.argv[2];
if (!target) {
  console.error("Usage: node load-test.js <host:port>");
  console.error("  e.g. node load-test.js localhost:8080");
  console.error("  e.g. node load-test.js pi         (shortcut for 192.168.0.17:8080)");
  process.exit(1);
}

const resolved = target === "pi" ? "192.168.0.17:8080" : target;
const BASE_URL = `http://${resolved}`;
const WS_URL = `ws://${resolved}`;

// ── Session creation ────────────────────────────────────────────────────────
async function createSession() {
  const res = await fetch(`${BASE_URL}/api/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nickname: "LoadTest-Host", language: "DE" }),
  });
  if (!res.ok) {
    throw new Error(`Failed to create session: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  console.log(`Session created: ${data.sessionId}`);
  return data; // { sessionId, joinUrl, playerId }
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

// ── WebSocket client ────────────────────────────────────────────────────────
function connectPlayer(sessionId, nickname, existingPlayerId) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${WS_URL}/ws/${sessionId}`);
    const client = {
      ws,
      nickname,
      playerId: existingPlayerId || null,
      isHost: false,
      ready: false,
    };

    const messageHandlers = [];

    client.onMessage = (handler) => messageHandlers.push(handler);

    client.waitFor = (type, timeoutMs = 30_000) =>
      Promise.race([
        new Promise((res) => {
          const handler = (msg) => {
            if (msg.type === type) {
              const idx = messageHandlers.indexOf(handler);
              if (idx >= 0) messageHandlers.splice(idx, 1);
              res(msg);
            }
          };
          messageHandlers.push(handler);
        }),
        new Promise((_, rej) =>
          setTimeout(() => rej(new Error(`Timeout waiting for ${type} (${timeoutMs}ms)`)), timeoutMs)
        ),
      ]);

    client.send = (type, payload) => {
      ws.send(JSON.stringify({ type, payload }));
    };

    ws.on("open", () => {
      // Send JOIN message
      const payload = { nickname };
      if (existingPlayerId) payload.playerId = existingPlayerId;
      client.send("JOIN", payload);
    });

    ws.on("message", (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === "GAME_STATE" && !client.ready) {
        client.playerId = msg.payload.playerId;
        client.isHost = msg.payload.isHost;
        client.ready = true;
        resolve(client);
      }
      // Notify all registered handlers
      for (const handler of [...messageHandlers]) {
        handler(msg);
      }
    });

    ws.on("error", (err) => {
      reject(new Error(`WebSocket error for ${nickname}: ${err.message}`));
    });

    ws.on("close", () => {
      if (!client.ready) {
        reject(new Error(`WebSocket closed before ${nickname} joined`));
      }
    });
  });
}

async function joinAllPlayers(sessionId, hostPlayerId) {
  console.log(`Connecting ${PLAYER_COUNT} players...`);
  const clients = [];

  // Host reconnects via WebSocket (already created via REST)
  const host = await connectPlayer(sessionId, "LoadTest-Host", hostPlayerId);
  clients.push(host);
  console.log(`  [1/${PLAYER_COUNT}] ${host.nickname} joined (host)`);

  // Remaining players join fresh
  for (let i = 2; i <= PLAYER_COUNT; i++) {
    const client = await connectPlayer(sessionId, `LoadTest-P${i}`);
    clients.push(client);
    console.log(`  [${i}/${PLAYER_COUNT}] ${client.nickname} joined`);
  }

  return clients;
}

// ── Game phase navigation ───────────────────────────────────────────────────
async function navigateToDrawing(clients) {
  const host = clients[0];

  // All clients listen for ROUND_STARTED
  const roundStartedPromises = clients.map((c) => c.waitFor("ROUND_STARTED"));

  // Host starts game → moves to CATEGORY phase
  console.log("Starting game...");
  host.send("START_GAME", {});

  // Wait for CATEGORY_OPTIONS to confirm phase transition
  await host.waitFor("CATEGORY_OPTIONS");

  // Host selects category → skips voting countdown → moves to DRAWING
  console.log(`Selecting category: ${CATEGORY}`);
  host.send("SELECT_CATEGORY", { category: CATEGORY });

  // Wait for all clients to receive ROUND_STARTED
  const roundStartedMsgs = await Promise.all(roundStartedPromises);
  const drawerId = roundStartedMsgs[0].payload.drawerId;
  const drawerNickname = roundStartedMsgs[0].payload.drawerNickname;

  // Identify drawer client
  const drawer = clients.find((c) => c.playerId === drawerId);
  const watchers = clients.filter((c) => c.playerId !== drawerId);

  console.log(`Round started — drawer: ${drawerNickname}`);
  console.log(`Watchers: ${watchers.map((w) => w.nickname).join(", ")}`);

  return { drawer, watchers };
}

// ── Stroke simulation ───────────────────────────────────────────────────────
function generateStrokes(count) {
  const strokes = [];
  let x = Math.random();
  let y = Math.random();

  let i = 0;
  while (i < count) {
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];
    const size = Math.floor(Math.random() * 3) + 1;
    const moveCount = Math.min(
      Math.floor(randomBetween(10, 20)),
      count - i - 2 // leave room for START and END
    );

    if (i + moveCount + 2 > count) {
      // Not enough room for a full stroke sequence, fill remainder with MOVEs
      for (; i < count; i++) {
        x += randomBetween(-0.05, 0.05);
        y += randomBetween(-0.05, 0.05);
        x = Math.max(0, Math.min(1, x));
        y = Math.max(0, Math.min(1, y));
        strokes.push({ x, y, color, size, type: "MOVE" });
      }
      break;
    }

    // START
    x = Math.random();
    y = Math.random();
    strokes.push({ x, y, color, size, type: "START" });
    i++;

    // MOVEs
    for (let m = 0; m < moveCount; m++) {
      x += randomBetween(-0.05, 0.05);
      y += randomBetween(-0.05, 0.05);
      x = Math.max(0, Math.min(1, x));
      y = Math.max(0, Math.min(1, y));
      strokes.push({ x, y, color, size, type: "MOVE" });
      i++;
    }

    // END
    strokes.push({ x, y, color, size, type: "END" });
    i++;
  }

  return strokes.slice(0, count);
}

async function sendStrokesAndMeasure(drawer, watchers) {
  const strokes = generateStrokes(STROKE_COUNT);
  const sendTimes = [];

  // Register stroke listeners on all watchers BEFORE sending
  const watcherReceiveTimes = watchers.map(() => []);
  watchers.forEach((watcher, wi) => {
    watcher.onMessage((msg) => {
      if (msg.type === "STROKE") {
        watcherReceiveTimes[wi].push(Date.now());
      }
    });
  });

  console.log(`\nSending ${STROKE_COUNT} strokes at ~${Math.round(1000 / STROKE_INTERVAL_MS)}/sec...`);
  const startTime = Date.now();

  // Send strokes with interval
  for (let i = 0; i < strokes.length; i++) {
    sendTimes.push(Date.now());
    drawer.send("STROKE", strokes[i]);
    if (i < strokes.length - 1) {
      await sleep(STROKE_INTERVAL_MS);
    }
  }

  const sendDuration = Date.now() - startTime;
  console.log(`All strokes sent in ${(sendDuration / 1000).toFixed(1)}s`);

  // Wait a bit for remaining messages to arrive
  await sleep(2000);

  return { sendTimes, watcherReceiveTimes };
}

// ── Statistics ──────────────────────────────────────────────────────────────
function calculateStats(sendTimes, watcherReceiveTimes) {
  const allLatencies = [];

  for (const receiveTimes of watcherReceiveTimes) {
    const count = Math.min(sendTimes.length, receiveTimes.length);
    for (let i = 0; i < count; i++) {
      allLatencies.push(receiveTimes[i] - sendTimes[i]);
    }
  }

  if (allLatencies.length === 0) {
    return null;
  }

  allLatencies.sort((a, b) => a - b);

  const sum = allLatencies.reduce((a, b) => a + b, 0);
  const avg = sum / allLatencies.length;
  const min = allLatencies[0];
  const max = allLatencies[allLatencies.length - 1];
  const p95Index = Math.floor(allLatencies.length * 0.95);
  const p95 = allLatencies[p95Index];

  // Count dropped strokes per watcher
  const totalExpected = sendTimes.length * watcherReceiveTimes.length;
  const totalReceived = watcherReceiveTimes.reduce((sum, rt) => sum + rt.length, 0);
  const dropped = totalExpected - totalReceived;

  return { min, avg, p95, max, dropped, totalExpected, totalReceived, count: allLatencies.length };
}

function getVerdict(avg) {
  if (avg < 30) return "SMOOTH";
  if (avg < 80) return "PLAYABLE";
  if (avg < 150) return "LAGGY";
  return "UNPLAYABLE";
}

function printReport(stats) {
  console.log("\n" + "=".repeat(50));
  console.log(`Target: ${resolved}`);
  console.log(`Players: ${PLAYER_COUNT}`);
  console.log(`Strokes sent: ${STROKE_COUNT} @ ~${Math.round(1000 / STROKE_INTERVAL_MS)}/sec`);
  console.log("");

  if (!stats) {
    console.log("ERROR: No strokes received by any watcher!");
    return;
  }

  console.log("Stroke delivery latency (sender → receiver):");
  console.log(`  Min:  ${stats.min.toFixed(0).padStart(6)}ms`);
  console.log(`  Avg:  ${stats.avg.toFixed(0).padStart(6)}ms`);
  console.log(`  P95:  ${stats.p95.toFixed(0).padStart(6)}ms`);
  console.log(`  Max:  ${stats.max.toFixed(0).padStart(6)}ms`);
  console.log(`  Dropped: ${stats.dropped} / ${stats.totalExpected}`);
  console.log("");

  const verdict = getVerdict(stats.avg);
  const verdictDescriptions = {
    SMOOTH: "avg < 30ms",
    PLAYABLE: "avg 30-80ms",
    LAGGY: "avg 80-150ms",
    UNPLAYABLE: "avg > 150ms",
  };
  console.log(`Verdict: ${verdict} (${verdictDescriptions[verdict]})`);
  console.log("=".repeat(50));
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\nCanvas WebSocket Load Test`);
  console.log(`Target: ${resolved}`);
  console.log(`Players: ${PLAYER_COUNT}, Strokes: ${STROKE_COUNT}\n`);

  try {
    // 1. Create session
    const session = await createSession();

    // 2. Connect all players
    const clients = await joinAllPlayers(session.sessionId, session.playerId);

    // 3. Navigate to DRAWING phase
    const { drawer, watchers } = await navigateToDrawing(clients);

    // 4. Send strokes and measure
    const { sendTimes, watcherReceiveTimes } = await sendStrokesAndMeasure(drawer, watchers);

    // 5. Calculate and print stats
    const stats = calculateStats(sendTimes, watcherReceiveTimes);
    printReport(stats);

    // 6. Cleanup — close all WebSocket connections and exit
    for (const client of clients) {
      client.ws.close();
    }
    process.exit(0);
  } catch (err) {
    console.error(`\nFATAL: ${err.message}`);
    process.exit(1);
  }
}

main();
