/**
 * CSE201 Data Structures Mini Project
 * Multiplayer Game Server Matchmaking System
 * Modules:
 *  1. FIFO Waiting Queue (O(1) Enqueue / Dequeue)
 *  2. Binary Min-Heap Priority Queue (O(log n) Extract-Min & Re-Heapify)
 *  3. Eligibility Rules (Region Match + Available Slots >= Party Size)
 */

// ==========================================
// MODULE 1: FIFO WAITING QUEUE
// ==========================================
class PlayerFIFOQueue {
  constructor() {
    this.items = [];
  }

  enqueue(player) {
    this.items.push(player);
  }

  dequeue() {
    return this.items.length > 0 ? this.items.shift() : null;
  }

  peek() {
    return this.items.length > 0 ? this.items[0] : null;
  }

  isEmpty() {
    return this.items.length === 0;
  }

  size() {
    return this.items.length;
  }
}

// ==========================================
// MODULE 2: BINARY MIN-HEAP (PRIORITY QUEUE)
// ==========================================
class ServerMinHeap {
  constructor() {
    this.heap = [];
  }

  getLoadPercent(server) {
    return (server.usedSlots / server.capacity) * 100;
  }

  swap(i, j) {
    [this.heap[i], this.heap[j]] = [this.heap[j], this.heap[i]];
  }

  heapifyUp(index) {
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.getLoadPercent(this.heap[index]) < this.getLoadPercent(this.heap[parent])) {
        this.swap(index, parent);
        index = parent;
      } else {
        break;
      }
    }
  }

  heapifyDown(index) {
    const n = this.heap.length;
    while (true) {
      let smallest = index;
      const left = 2 * index + 1;
      const right = 2 * index + 2;

      if (left < n && this.getLoadPercent(this.heap[left]) < this.getLoadPercent(this.heap[smallest])) {
        smallest = left;
      }
      if (right < n && this.getLoadPercent(this.heap[right]) < this.getLoadPercent(this.heap[smallest])) {
        smallest = right;
      }

      if (smallest !== index) {
        this.swap(index, smallest);
        index = smallest;
      } else {
        break;
      }
    }
  }

  insert(server) {
    this.heap.push(server);
    this.heapifyUp(this.heap.length - 1);
  }

  extractMin() {
    if (this.heap.length === 0) return null;
    if (this.heap.length === 1) return this.heap.pop();

    const min = this.heap[0];
    this.heap[0] = this.heap.pop();
    this.heapifyDown(0);
    return min;
  }
}

// ==========================================
// INITIAL SERVER FLEET & STATE
// ==========================================
const DEFAULT_SERVERS = [
  { id: "IND-01", region: "India", capacity: 100, usedSlots: 40 },
  { id: "IND-02", region: "India", capacity: 100, usedSlots: 80 },
  { id: "SG-01", region: "Singapore", capacity: 100, usedSlots: 30 },
  { id: "SG-02", region: "Singapore", capacity: 100, usedSlots: 65 },
  { id: "EU-01", region: "Europe", capacity: 100, usedSlots: 25 }
];

let playerQueue = new PlayerFIFOQueue();
let serverHeap = new ServerMinHeap();
let playerCounter = 1;
let autoTimer = null;
let serverDecisions = {}; // Stores last walkthrough decision per server ID

function addLog(text, cssClass = "") {
  const logList = document.getElementById("log-list");
  const li = document.createElement("li");
  if (cssClass) li.className = cssClass;
  li.textContent = text;
  logList.prepend(li);
}

function initSystem(loadSlideDemo = false) {
  playerQueue = new PlayerFIFOQueue();
  serverHeap = new ServerMinHeap();
  serverDecisions = {};
  document.getElementById("log-list").innerHTML = "";

  DEFAULT_SERVERS.forEach(s => {
    serverHeap.insert({ ...s });
  });

  if (loadSlideDemo) {
    // Exact queue from Slide 8 & 9
    playerQueue.enqueue({ name: "Player_A", region: "India", slots: 4 });
    playerQueue.enqueue({ name: "Player_B", region: "Singapore", slots: 2 });
    playerQueue.enqueue({ name: "Player_C", region: "India", slots: 8 });
    playerCounter = 4;
    addLog("[INIT] Loaded PPT Walkthrough Scenario (Player_A, Player_B, Player_C).", "log-update");
    addLog("[WAIT] Player_A (India · 4 slots) is at front of FIFO queue.", "log-wait");
  } else {
    playerCounter = 1;
    addLog("[INIT] Matchmaking Engine Ready. Enqueue players to begin.", "log-update");
  }

  document.getElementById("player-id").value = `Player_${playerCounter}`;
  renderAll();
}

// ==========================================
// MODULE 3: ELIGIBILITY & MATCHMAKING LOGIC
// ==========================================
function matchNextPlayer() {
  if (playerQueue.isEmpty()) {
    addLog("[WARN] Waiting Queue is empty. Enqueue a player first.", "log-err");
    return;
  }

  const player = playerQueue.dequeue();
  serverDecisions = {};

  const deferred = [];
  let selectedServer = null;

  // Extract from Min-Heap in ascending order of load
  while (serverHeap.heap.length > 0) {
    const srv = serverHeap.extractMin();
    const availableSlots = srv.capacity - srv.usedSlots;

    if (srv.region !== player.region) {
      serverDecisions[srv.id] = {
        type: "rejected",
        label: "✗ REJECTED (Region Mismatch)"
      };
      deferred.push(srv);
    } else if (availableSlots < player.slots) {
      serverDecisions[srv.id] = {
        type: "rejected",
        label: "✗ REJECTED (Insufficient Slots)"
      };
      deferred.push(srv);
    } else if (!selectedServer) {
      // First eligible server extracted from Min-Heap is guaranteed lowest load
      selectedServer = srv;
      serverDecisions[srv.id] = {
        type: "selected",
        label: "✓ SELECTED (Suitable & Lowest Load)"
      };
    } else {
      serverDecisions[srv.id] = {
        type: "higher",
        label: "△ Eligible, but higher load"
      };
      deferred.push(srv);
    }
  }

  // Re-insert deferred servers into Min-Heap
  deferred.forEach(srv => serverHeap.insert(srv));

  if (selectedServer) {
    const oldPct = Math.round((selectedServer.usedSlots / selectedServer.capacity) * 100);
    selectedServer.usedSlots += player.slots;
    const newPct = Math.round((selectedServer.usedSlots / selectedServer.capacity) * 100);

    // Re-insert updated server & re-heapify
    serverHeap.insert(selectedServer);

    addLog(`[MATCH] ${player.name} (${player.region} · ${player.slots} slots) → ${selectedServer.id}`, "log-match");
    addLog(`[UPDATE] ${selectedServer.id} load updated: ${oldPct}% → ${newPct}%`, "log-update");
    addLog(`[HEAP] Min-Heap re-heapified`, "log-heap");
  } else {
    addLog(`[REJECTED] No eligible server found for ${player.name} (${player.region} · ${player.slots} slots).`, "log-err");
  }

  if (!playerQueue.isEmpty()) {
    const next = playerQueue.peek();
    addLog(`[WAIT] ${next.name} (${next.region} · ${next.slots} slots) next in queue`, "log-wait");
  } else {
    addLog(`[IDLE] All players in FIFO queue processed.`, "log-wait");
  }

  renderAll();
}

// ==========================================
// UI RENDERING
// ==========================================
function renderQueue() {
  const list = document.getElementById("fifo-list");
  document.getElementById("queue-count").textContent = playerQueue.size();
  list.innerHTML = "";

  if (playerQueue.isEmpty()) {
    list.innerHTML = `<div class="empty-msg">Queue is empty. Add a player above or click "Load PPT Walkthrough".</div>`;
    return;
  }

  playerQueue.items.forEach((p, index) => {
    const div = document.createElement("div");
    div.className = "queue-item" + (index === 0 ? " front" : "");
    div.innerHTML = `
      <span><strong>#${index + 1} ${p.name}</strong> (${p.region} · ${p.slots} slots)</span>
      <span class="queue-badge">${index === 0 ? "NEXT (HEAD)" : "WAITING"}</span>
    `;
    list.appendChild(div);
  });
}

function renderHeap() {
  const container = document.getElementById("heap-array");
  container.innerHTML = "";

  serverHeap.heap.forEach((srv, idx) => {
    const pct = Math.round((srv.usedSlots / srv.capacity) * 100);
    const node = document.createElement("div");
    node.className = "heap-node" + (idx === 0 ? " root" : "");
    node.innerHTML = `
      <div class="heap-idx">Index [${idx}] ${idx === 0 ? "• MIN ROOT" : ""}</div>
      <div><strong>${srv.id}</strong> (${srv.region})</div>
      <div>Load: ${pct}%</div>
    `;
    container.appendChild(node);
  });
}

function renderServers() {
  const grid = document.getElementById("server-grid");
  grid.innerHTML = "";

  const sorted = [...serverHeap.heap].sort((a, b) => a.id.localeCompare(b.id));

  sorted.forEach(srv => {
    const pct = Math.round((srv.usedSlots / srv.capacity) * 100);
    const decision = serverDecisions[srv.id];

    let cardClass = "server-card";
    let tagHtml = "";

    if (decision) {
      cardClass += ` status-${decision.type}`;
      tagHtml = `<span class="decision-tag tag-${decision.type}">${decision.label}</span>`;
    }

    let fillClass = "";
    if (pct >= 80) fillClass = "high";
    else if (pct >= 50) fillClass = "med";

    const card = document.createElement("div");
    card.className = cardClass;
    card.innerHTML = `
      <div class="server-top">
        <span>${srv.id}</span>
        <span>Load: ${pct}%</span>
      </div>
      <div class="server-sub">${srv.region} · ${srv.usedSlots}/${srv.capacity} slots used</div>
      <div class="bar-bg">
        <div class="bar-fill ${fillClass}" style="width: ${pct}%"></div>
      </div>
      ${tagHtml}
    `;
    grid.appendChild(card);
  });
}

function renderAll() {
  renderQueue();
  renderHeap();
  renderServers();
}

// ==========================================
// EVENT LISTENERS
// ==========================================
document.getElementById("enqueue-form").addEventListener("submit", e => {
  e.preventDefault();
  const nameInput = document.getElementById("player-id");
  const region = document.getElementById("player-region").value;
  const slots = parseInt(document.getElementById("player-slots").value, 10) || 1;
  const name = nameInput.value.trim() || `Player_${playerCounter}`;

  playerQueue.enqueue({ name, region, slots });
  addLog(`[ENQUEUE] ${name} (${region} · ${slots} slots) added to FIFO queue.`, "log-wait");

  playerCounter++;
  nameInput.value = `Player_${playerCounter}`;
  renderAll();
});

document.getElementById("btn-random").addEventListener("click", () => {
  const regions = ["India", "Singapore", "Europe"];
  const slotOptions = [1, 2, 4, 5];

  for (let i = 0; i < 3; i++) {
    const name = `Player_${playerCounter++}`;
    const region = regions[Math.floor(Math.random() * regions.length)];
    const slots = slotOptions[Math.floor(Math.random() * slotOptions.length)];
    playerQueue.enqueue({ name, region, slots });
  }
  document.getElementById("player-id").value = `Player_${playerCounter}`;
  addLog("[ENQUEUE] Added 3 random player requests to FIFO queue.", "log-wait");
  renderAll();
});

document.getElementById("btn-demo").addEventListener("click", () => {
  initSystem(true);
});

document.getElementById("btn-step").addEventListener("click", matchNextPlayer);

document.getElementById("btn-auto").addEventListener("click", e => {
  if (autoTimer) {
    clearInterval(autoTimer);
    autoTimer = null;
    e.target.textContent = "Auto-Run: OFF";
  } else {
    autoTimer = setInterval(() => {
      if (!playerQueue.isEmpty()) matchNextPlayer();
    }, 1500);
    e.target.textContent = "Auto-Run: ON";
  }
});

document.getElementById("btn-reset").addEventListener("click", () => {
  if (autoTimer) {
    clearInterval(autoTimer);
    autoTimer = null;
    document.getElementById("btn-auto").textContent = "Auto-Run: OFF";
  }
  initSystem(false);
});

// Boot with the PPT Walkthrough Scenario ready on load
initSystem(true);
