/**
 * MatchForge — Core Engine Simulation & Visualizer
 * Mirrors the modular C backend:
 * 1. Circular FIFO Queue (fixed buffer capacity, head/tail pointers)
 * 2. Binary Min-Heap (array-backed heap ordered by server load ratio)
 * 3. Eligibility Filter (Region, Game Mode, Remaining Capacity)
 */

// ==========================================
// 1. CIRCULAR FIFO QUEUE MODULE
// ==========================================
class CircularFIFOQueue {
  constructor(capacity = 12) {
    this.capacity = capacity;
    this.buffer = new Array(capacity).fill(null);
    this.head = 0;
    this.tail = 0;
    this.count = 0;
  }

  isFull() {
    return this.count === this.capacity;
  }

  isEmpty() {
    return this.count === 0;
  }

  enqueue(player) {
    if (this.isFull()) return false;
    this.buffer[this.tail] = player;
    this.tail = (this.tail + 1) % this.capacity;
    this.count++;
    return true;
  }

  dequeue() {
    if (this.isEmpty()) return null;
    const player = this.buffer[this.head];
    this.buffer[this.head] = null;
    this.head = (this.head + 1) % this.capacity;
    this.count--;
    return player;
  }

  peek() {
    return this.isEmpty() ? null : this.buffer[this.head];
  }
}

// ==========================================
// 2. BINARY MIN-HEAP MODULE (Load Balancing)
// ==========================================
class ServerMinHeap {
  constructor() {
    this.heap = [];
  }

  getLoadRatio(server) {
    return server.activePlayers / server.maxCapacity;
  }

  swap(i, j) {
    [this.heap[i], this.heap[j]] = [this.heap[j], this.heap[i]];
  }

  heapifyUp(index) {
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.getLoadRatio(this.heap[index]) < this.getLoadRatio(this.heap[parent])) {
        this.swap(index, parent);
        index = parent;
      } else {
        break;
      }
    }
  }

  heapifyDown(index) {
    const length = this.heap.length;
    while (true) {
      let smallest = index;
      const left = 2 * index + 1;
      const right = 2 * index + 2;

      if (left < length && this.getLoadRatio(this.heap[left]) < this.getLoadRatio(this.heap[smallest])) {
        smallest = left;
      }
      if (right < length && this.getLoadRatio(this.heap[right]) < this.getLoadRatio(this.heap[smallest])) {
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

  rebuild() {
    for (let i = Math.floor(this.heap.length / 2) - 1; i >= 0; i--) {
      this.heapifyDown(i);
    }
  }
}

// ==========================================
// 3. INITIAL SERVER FLEET & ENGINE STATE
// ==========================================
const INITIAL_SERVERS = [
  { id: "SRV-MUM-01", region: "AP-SOUTH", mode: "5v5-RANKED", activePlayers: 2, maxCapacity: 10 },
  { id: "SRV-MUM-02", region: "AP-SOUTH", mode: "BATTLE-ROYALE", activePlayers: 12, maxCapacity: 40 },
  { id: "SRV-MUM-03", region: "AP-SOUTH", mode: "DEATHMATCH", activePlayers: 6, maxCapacity: 16 },
  { id: "SRV-SGP-01", region: "AP-SOUTHEAST", mode: "5v5-RANKED", activePlayers: 4, maxCapacity: 10 },
  { id: "SRV-SGP-02", region: "AP-SOUTHEAST", mode: "BATTLE-ROYALE", activePlayers: 8, maxCapacity: 40 },
  { id: "SRV-FRA-01", region: "EU-CENTRAL", mode: "5v5-RANKED", activePlayers: 1, maxCapacity: 10 },
  { id: "SRV-FRA-02", region: "EU-CENTRAL", mode: "DEATHMATCH", activePlayers: 4, maxCapacity: 16 }
];

let queue = new CircularFIFOQueue(12);
let minHeap = new ServerMinHeap();
let playerCounter = 101;
let autoTickTimer = null;
let lastMatchedServerId = null;

function initEngine() {
  queue = new CircularFIFOQueue(12);
  minHeap = new ServerMinHeap();
  playerCounter = 101;
  lastMatchedServerId = null;

  INITIAL_SERVERS.forEach(srv => {
    minHeap.insert({ ...srv });
  });

  document.getElementById("log-list").innerHTML = "";
  logEvent("Engine initialized: Circular FIFO (cap 12) & Binary Min-Heap ready.", "ok");
  renderAll();
}

// ==========================================
// 4. ELIGIBILITY LOGIC & MATCHMAKING TICK
// ==========================================
function isServerEligible(server, player) {
  const regionMatch = server.region === player.region;
  const modeMatch = server.mode === player.mode;
  const hasCapacity = server.activePlayers < server.maxCapacity;
  return regionMatch && modeMatch && hasCapacity;
}

function processMatchmakingTick() {
  if (queue.isEmpty()) {
    logEvent("Tick skipped: Circular FIFO queue is empty.", "warn");
    return;
  }

  const player = queue.dequeue();
  const deferredServers = [];
  let assignedServer = null;

  // Pop from Min-Heap until we find the lowest-load eligible server
  while (minHeap.heap.length > 0) {
    const candidate = minHeap.extractMin();
    if (isServerEligible(candidate, player)) {
      assignedServer = candidate;
      break;
    } else {
      deferredServers.push(candidate);
    }
  }

  // Re-insert any skipped servers back into the Min-Heap
  deferredServers.forEach(srv => minHeap.insert(srv));

  if (assignedServer) {
    assignedServer.activePlayers++;
    minHeap.insert(assignedServer); // Re-insert with updated load
    lastMatchedServerId = assignedServer.id;

    const loadPct = Math.round((assignedServer.activePlayers / assignedServer.maxCapacity) * 100);
    logEvent(
      `MATCHED ${player.id} [${player.region} | ${player.mode}] ->${assignedServer.id} (Load: ${assignedServer.activePlayers}/${assignedServer.maxCapacity} • ${loadPct}\%)`, "ok" ); } else { lastMatchedServerId = null; logEvent( `DROPPED ${player.id} [${player.region} \vert{}${player.mode}]: No eligible server with free capacity.`,
      "err"
    );
  }

  renderAll();
}

// ==========================================
// 5. UI RENDERING & TELEMETRY
// ==========================================
function logEvent(message, type = "ok") {
  const logList = document.getElementById("log-list");
  const li = document.createElement("li");
  const time = new Date().toLocaleTimeString([], { hour12: false });
  li.className = `log-${type}`; li.textContent = `[${time}] ${message}`; logList.prepend(li); }  function renderFIFOQueue() { const container = document.getElementById("fifo-container"); document.getElementById("queue-count").textContent = queue.count; document.getElementById("queue-cap").textContent = queue.capacity;  container.innerHTML = "";  for (let i = 0; i < queue.capacity; i++) { const slot = document.createElement("div"); const player = queue.buffer[i]; const isHead = !queue.isEmpty() && i === queue.head;  slot.className = "fifo-slot" + (player ? " occupied" : "") + (isHead ? " head" : "");  let pointerLabel = `Slot [${i}]`;
    if (isHead) pointerLabel += " • HEAD";
    if (i === queue.tail && !queue.isFull()) pointerLabel += " • TAIL";

    if (player) {
      slot.innerHTML = `
        <span class="slot-tag">${pointerLabel}</span>
        <strong>${player.id}</strong>
        <span>${player.region}</span>
        <span class="slot-tag">${player.mode}</span>
      `;
    } else {
      slot.innerHTML = `
        <span class="slot-tag">${pointerLabel}</span>
        <span>EMPTY</span>
      `;
    }

    container.appendChild(slot);
  }
}

function renderMinHeap() {
  const heapContainer = document.getElementById("heap-array");
  heapContainer.innerHTML = "";

  minHeap.heap.forEach((srv, idx) => {
    const loadPct = Math.round((srv.activePlayers / srv.maxCapacity) * 100);
    const node = document.createElement("div");
    node.className = "heap-node" + (idx === 0 ? " root" : "");
    node.innerHTML = `
      <div class="idx">Heap[${idx}]${idx === 0 ? "(MIN ROOT)" : ""}</div>
      <div><strong>${srv.id}</strong>
