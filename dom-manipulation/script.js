/************************************************************
 * Dynamic Quote Generator — Storage + Filter + Sync (Server)
 * - LocalStorage persistence (quotes, selectedCategory)
 * - SessionStorage (last viewed quote)
 * - JSON Import/Export
 * - Category filtering with persistence
 * - Simulated server sync via JSONPlaceholder
 * - Conflict detection and manual resolution (server wins by default)
 ************************************************************/

/* ----------------------- Seed & Storage Keys ----------------------- */

const DEFAULT_QUOTES = [
  { text: "Life is what happens when you're busy making other plans.", author: "John Lennon", category: "Life" },
  { text: "Get busy living or get busy dying.", author: "Stephen King", category: "Motivation" },
  { text: "The purpose of our lives is to be happy.", author: "Dalai Lama", category: "Life" }
];

const LS_QUOTES_KEY     = "quotes";
const LS_SELECTED_CAT   = "selectedCategory";
const LS_CONFLICTS_KEY  = "conflicts";
const SS_LAST_QUOTE     = "lastQuote";

// Simulated server endpoint (JSONPlaceholder)
const SERVER_ENDPOINT = "https://jsonplaceholder.typicode.com/posts?_limit=10";

// Poll interval (ms)
const SYNC_INTERVAL_MS = 30000;

/* ------------------------ App State ------------------------ */

let quotes = []; // active list (normalized)
let conflicts = []; // [{ id, local, server }]
let syncTimer = null;

/* ------------------------ Utilities ------------------------ */

function nowISO() {
  return new Date().toISOString();
}

// Simple unique id for local quotes
function generateId(prefix = "local") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// Ensure each quote has {id, text, author, category, updatedAt, source}
function normalizeQuote(q, fallbackSource = "local") {
  const copy = { ...q };
  if (!copy.id) copy.id = generateId(fallbackSource);
  if (!copy.text) copy.text = "";
  if (!copy.author) copy.author = "Unknown";
  if (!copy.category) copy.category = "General";
  if (!copy.updatedAt) copy.updatedAt = nowISO();
  if (!copy.source) copy.source = fallbackSource;
  return copy;
}

function loadQuotes() {
  try {
    const saved = JSON.parse(localStorage.getItem(LS_QUOTES_KEY));
    if (Array.isArray(saved) && saved.length) {
      quotes = saved.map(q => normalizeQuote(q, q.source || "local"));
    } else {
      quotes = DEFAULT_QUOTES.map(q => normalizeQuote(q, "local"));
      saveQuotes();
    }
  } catch {
    quotes = DEFAULT_QUOTES.map(q => normalizeQuote(q, "local"));
    saveQuotes();
  }
}

function saveQuotes() {
  localStorage.setItem(LS_QUOTES_KEY, JSON.stringify(quotes));
}

function loadConflicts() {
  try {
    const saved = JSON.parse(localStorage.getItem(LS_CONFLICTS_KEY));
    conflicts = Array.isArray(saved) ? saved : [];
  } catch {
    conflicts = [];
  }
}

function saveConflicts() {
  localStorage.setItem(LS_CONFLICTS_KEY, JSON.stringify(conflicts));
}

/* ------------------------ DOM Helpers ------------------------ */

function byId(id) { return document.getElementById(id); }

/* These elements must exist in your HTML:
   - #categoryFilter (select)
   - #quoteDisplay (div)
   - #addQuoteForm (form)
   - #quoteText, #quoteAuthor, #quoteCategory (inputs)
   - #importFile (input[type=file])
   - (Optional) #randomQuoteBtn (button) */
   
/* We will also inject a small toolbar:
   - #syncToolbar (container)
     - #syncStatus (span)
     - #syncNowBtn (button)
     - #resolveConflictsBtn (button)
     - #conflictsPanel (div) */

function createSyncToolbar() {
  if (byId("syncToolbar")) return;

  const host = document.body;

  const toolbar = document.createElement("div");
  toolbar.id = "syncToolbar";
  toolbar.style.cssText = `
    margin: 16px 0; padding: 10px; border: 1px solid #e3e3e3;
    border-radius: 8px; background:#f9fafb; display:flex; gap:10px; align-items:center; flex-wrap:wrap;
  `;

  const status = document.createElement("span");
  status.id = "syncStatus";
  status.textContent = "Sync status: idle";

  const syncBtn = document.createElement("button");
  syncBtn.id = "syncNowBtn";
  syncBtn.textContent = "Sync Now";
  syncBtn.style.cssText = "padding:8px 12px; cursor:pointer;";
  syncBtn.addEventListener("click", () => syncWithServer(true));

  const resolveBtn = document.createElement("button");
  resolveBtn.id = "resolveConflictsBtn";
  resolveBtn.textContent = "Resolve Conflicts";
  resolveBtn.style.cssText = "padding:8px 12px; cursor:pointer;";
  resolveBtn.disabled = true;
  resolveBtn.addEventListener("click", toggleConflictsPanel);

  const panel = document.createElement("div");
  panel.id = "conflictsPanel";
  panel.style.cssText = "display:none; width:100%; margin-top:8px;";

  toolbar.appendChild(status);
  toolbar.appendChild(syncBtn);
  toolbar.appendChild(resolveBtn);
  toolbar.appendChild(panel);

  // Insert toolbar just before quote display if possible, else at end of body
  const quoteDisplay = byId("quoteDisplay");
  if (quoteDisplay && quoteDisplay.parentNode) {
    quoteDisplay.parentNode.insertBefore(toolbar, quoteDisplay);
  } else {
    host.appendChild(toolbar);
  }

  // Initial enable/disable based on stored conflicts
  updateResolveButtonState();
}

function updateStatus(msg, isError = false) {
  const s = byId("syncStatus");
  if (!s) return;
  s.textContent = msg;
  s.style.color = isError ? "#b00020" : "#222";
}

function updateResolveButtonState() {
  const btn = byId("resolveConflictsBtn");
  if (!btn) return;
  btn.disabled = conflicts.length === 0;
}

/* ------------------------ Category & Display ------------------------ */

function populateCategories() {
  const sel = byId("categoryFilter");
  if (!sel) return;

  const uniqueCategories = [...new Set(quotes.map(q => q.category))].sort((a, b) => a.localeCompare(b));
  const lastSelected = localStorage.getItem(LS_SELECTED_CAT) || "all";

  sel.innerHTML = '<option value="all">All Categories</option>';
  uniqueCategories.forEach(cat => {
    const option = document.createElement("option");
    option.value = cat;
    option.textContent = cat;
    sel.appendChild(option);
  });

  sel.value = lastSelected;
}

function displayQuotes(list) {
  const container = byId("quoteDisplay");
  if (!container) return;
  container.innerHTML = "";

  list.forEach(q => {
    const p = document.createElement("p");
    p.textContent = `"${q.text}" — ${q.author} [${q.category}]`;
    p.style.cssText = "background:#f4f4f4; padding:10px; border-radius:5px; margin-bottom:8px; cursor:pointer;";
    p.onclick = () => {
      sessionStorage.setItem(SS_LAST_QUOTE, q.text);
      alert(`Stored last viewed quote in session: "${q.text}"`);
    };
    container.appendChild(p);
  });

  if (list.length === 0) {
    const empty = document.createElement("p");
    empty.textContent = "No quotes available for this category.";
    container.appendChild(empty);
  }
}

function filterQuotes() {
  const sel = byId("categoryFilter");
  if (!sel) return;
  const selectedCategory = sel.value;
  localStorage.setItem(LS_SELECTED_CAT, selectedCategory);

  if (selectedCategory === "all") {
    displayQuotes(quotes);
  } else {
    displayQuotes(quotes.filter(q => q.category === selectedCategory));
  }
}

/* ------------------------ Random Quote (optional button) ------------------------ */

function showRandomQuote() {
  const sel = byId("categoryFilter");
  const selectedCategory = sel ? sel.value : "all";
  const pool = selectedCategory === "all" ? quotes : quotes.filter(q => q.category === selectedCategory);
  if (!pool.length) {
    alert("No quotes available for this category.");
    return;
  }
  const q = pool[Math.floor(Math.random() * pool.length)];
  alert(`"${q.text}" — ${q.author} [${q.category}]`);
}

/* ------------------------ Add / Import / Export ------------------------ */

function addQuote(event) {
  event.preventDefault();
  const text = byId("quoteText")?.value.trim();
  const author = byId("quoteAuthor")?.value.trim();
  const category = byId("quoteCategory")?.value.trim();

  if (!text || !author || !category) return alert("Please fill all fields.");

  const q = normalizeQuote({ text, author, category }, "local");
  quotes.push(q);
  saveQuotes();
  populateCategories();
  filterQuotes();

  byId("addQuoteForm")?.reset();
}

function exportToJsonFile() {
  const dataStr = JSON.stringify(quotes, null, 2);
  const blob = new Blob([dataStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "quotes.json";
  link.click();
  URL.revokeObjectURL(url);
}

function importFromJsonFile(event) {
  const fileReader = new FileReader();
  fileReader.onload = function (e) {
    try {
      const imported = JSON.parse(e.target.result);
      if (!Array.isArray(imported)) return alert("Invalid JSON format. Expected an array.");

      const valid = imported
        .map(x => normalizeQuote(x, x.source || "local"))
        .filter(q => q.text && q.category);

      if (!valid.length) return alert("No valid quotes found.");

      quotes.push(...valid);
      saveQuotes();
      populateCategories();
      filterQuotes();
      alert("Quotes imported successfully!");
    } catch {
      alert("Error parsing JSON file.");
    }
  };
  const file = event.target.files && event.target.files[0];
  if (file) fileReader.readAsText(file);
}

/* ------------------------ Simulated Server Sync ------------------------ */

/**
 * Fetch server quotes from JSONPlaceholder and map to our schema.
 * We mark them with source:'server' and id:'srv-<post.id>'.
 * We use post.title as text, a faux author, and 'Server'/'User <userId>' categories.
 */
async function fetchServerQuotes() {
  const res = await fetch(SERVER_ENDPOINT, { cache: "no-store" });
  if (!res.ok) throw new Error(`Server returned ${res.status}`);
  const posts = await res.json();
  const now = nowISO();

  return posts.map(p => normalizeQuote({
    id: `srv-${p.id}`,
    text: (p.title || "").trim() || `Post #${p.id}`,
    author: `User ${p.userId ?? "Server"}`,
    category: p.userId ? `User ${p.userId}` : "Server",
    updatedAt: now,
    source: "server"
  }, "server"));
}

/**
 * Merge server quotes into local quotes.
 * Conflict: same id exists locally with different content.
 * Strategy: Server wins (replace local). We log the conflict so user can revert.
 */
function mergeServerQuotes(serverQuotes) {
  let added = 0, updated = 0, conflicted = 0;

  const localById = new Map(quotes.map(q => [q.id, q]));

  serverQuotes.forEach(srv => {
    const local = localById.get(srv.id);

    if (!local) {
      // New from server
      quotes.push(srv);
      localById.set(srv.id, srv);
      added++;
      return;
    }

    // Compare payload fields (excluding updatedAt/source)
    const differs =
      local.text !== srv.text ||
      local.author !== srv.author ||
      local.category !== srv.category;

    if (differs) {
      // Conflict -> server wins, but keep a record so user can revert
      conflicts.push({
        id: srv.id,
        server: srv,
        local: local,
        timestamp: nowISO()
      });
      // Replace local with server
      Object.assign(local, srv);
      updated++;
      conflicted++;
    } else {
      // Same content; prefer server updatedAt/source
      local.updatedAt = srv.updatedAt;
      local.source = "server";
    }
  });

  // Persist conflicts & quotes
  saveQuotes();
  saveConflicts();
  updateResolveButtonState();

  return { added, updated, conflicted };
}

/**
 * Full sync flow: fetch -> merge -> update UI
 */
async function syncWithServer(triggeredManually = false) {
  updateStatus("Syncing with server...");
  try {
    const serverQuotes = await fetchServerQuotes();
    const { added, updated, conflicted } = mergeServerQuotes(serverQuotes);

    populateCategories();
    filterQuotes();

    const time = new Date().toLocaleTimeString();
    const msg = `Last sync ${triggeredManually ? "(manual)" : ""}: +${added} added, ${updated} updated, ${conflicted} conflicts. (${time})`;
    updateStatus(msg);
  } catch (err) {
    updateStatus(`Sync failed: ${err.message}`, true);
  }
}

/* ------------------------ Conflict Resolution UI ------------------------ */

function toggleConflictsPanel() {
  const panel = byId("conflictsPanel");
  if (!panel) return;

  if (panel.style.display === "none") {
    renderConflictsPanel();
    panel.style.display = "block";
  } else {
    panel.style.display = "none";
    panel.innerHTML = "";
  }
}

function renderConflictsPanel() {
  const panel = byId("conflictsPanel");
  if (!panel) return;

  panel.innerHTML = "";

  if (!conflicts.length) {
    const p = document.createElement("p");
    p.textContent = "No conflicts to resolve.";
    panel.appendChild(p);
    return;
  }

  conflicts.forEach((c, idx) => {
    const wrap = document.createElement("div");
    wrap.style.cssText = "border:1px solid #ddd; border-radius:6px; padding:8px; margin-bottom:8px; background:#fff;";

    const title = document.createElement("div");
    title.style.fontWeight = "bold";
    title.textContent = `Conflict #${idx + 1} — ID: ${c.id}`;
    wrap.appendChild(title);

    const details = document.createElement("pre");
    details.style.cssText = "white-space:pre-wrap; background:#f7f7f7; padding:8px; border-radius:4px;";
    details.textContent =
      `Local : "${c.local.text}" — ${c.local.author} [${c.local.category}]\n` +
      `Server: "${c.server.text}" — ${c.server.author} [${c.server.category}]`;
    wrap.appendChild(details);

    const actions = document.createElement("div");
    actions.style.cssText = "display:flex; gap:8px;";

    const keepServerBtn = document.createElement("button");
    keepServerBtn.textContent = "Keep Server";
    keepServerBtn.onclick = () => resolveConflict(c.id, "server");

    const keepLocalBtn = document.createElement("button");
    keepLocalBtn.textContent = "Keep Local";
    keepLocalBtn.onclick = () => resolveConflict(c.id, "local");

    actions.appendChild(keepServerBtn);
    actions.appendChild(keepLocalBtn);
    wrap.appendChild(actions);

    panel.appendChild(wrap);
  });
}

function resolveConflict(id, choice) {
  // Find conflict
  const idx = conflicts.findIndex(c => c.id === id);
  if (idx === -1) return;

  const c = conflicts[idx];

  // Apply resolution to quotes
  const targetIdx = quotes.findIndex(q => q.id === id);
  if (targetIdx !== -1) {
    const chosen = choice === "local" ? c.local : c.server;
    quotes[targetIdx] = { ...chosen, updatedAt: nowISO() };
  } else {
    // If missing (unlikely), add chosen
    const chosen = choice === "local" ? c.local : c.server;
    quotes.push({ ...chosen, updatedAt: nowISO() });
  }

  // Remove conflict record
  conflicts.splice(idx, 1);
  saveQuotes();
  saveConflicts();
  updateResolveButtonState();

  // Refresh UI
  populateCategories();
  filterQuotes();

  // Refresh panel
  renderConflictsPanel();
}

/* ------------------------ Initialization & Events ------------------------ */

function init() {
  // Load persisted state
  loadQuotes();
  loadConflicts();

  // Inject sync toolbar UI
  createSyncToolbar();

  // Wire base UI events if elements exist
  const addForm = byId("addQuoteForm");
  if (addForm) addForm.addEventListener("submit", addQuote);

  const importFile = byId("importFile");
  if (importFile) importFile.addEventListener("change", importFromJsonFile);

  const randomBtn = byId("randomQuoteBtn");
  if (randomBtn) randomBtn.addEventListener("click", showRandomQuote);

  // Initial paint
  populateCategories();
  filterQuotes();

  // Start periodic sync
  if (syncTimer) clearInterval(syncTimer);
  syncTimer = setInterval(() => syncWithServer(false), SYNC_INTERVAL_MS);

  // First sync shortly after load (staggered)
  setTimeout(() => syncWithServer(false), 1000);
}

// Kick off
document.addEventListener("DOMContentLoaded", init);

// Expose functions used directly in HTML (if any)
window.filterQuotes = filterQuotes;
window.importFromJsonFile = importFromJsonFile;
window.exportToJsonFile = exportToJsonFile;
window.showRandomQuote = showRandomQuote;
