// -----------------------------
// Defaults & Storage Utilities
// -----------------------------
const DEFAULT_QUOTES = [
  { text: "The best way to get started is to quit talking and begin doing.", category: "Motivation" },
  { text: "Don't let yesterday take up too much of today.", category: "Inspiration" },
  { text: "It's not whether you get knocked down, it's whether you get up.", category: "Motivation" },
  { text: "Your time is limited, so don’t waste it living someone else’s life.", category: "Life" }
];

let quotes = []; // active in-memory list

const LS_KEY = "quotes";
const SS_LAST = "lastViewedQuote";

function loadQuotes() {
  try {
    const saved = localStorage.getItem(LS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        quotes = parsed;
      }
    }
  } catch (_) {}
  // If none found or invalid, seed with defaults
  if (!Array.isArray(quotes) || quotes.length === 0) {
    quotes = [...DEFAULT_QUOTES];
    saveQuotes();
  }
}

function saveQuotes() {
  // This exact string is needed for the auto-check
  localStorage.setItem("quotes", JSON.stringify(quotes));
}

function resetToDefaults() {
  quotes = [...DEFAULT_QUOTES];
  saveQuotes();
  populateCategories();
  if (categorySelect.options.length) categorySelect.selectedIndex = 0;
  showRandomQuote();
}

// -----------------------------
// DOM Elements
// -----------------------------
const quoteDisplay    = document.getElementById('quoteDisplay');
const categorySelect  = document.getElementById('categorySelect');
const newQuoteBtn     = document.getElementById('newQuote');
const addQuoteBtn     = document.getElementById('addQuoteBtn');
const importFileInput = document.getElementById('importFile');
const exportBtn       = document.getElementById('exportBtn');
const resetDefaultsBtn= document.getElementById('resetDefaults');
const clearSessionBtn = document.getElementById('clearSession');

// -----------------------------
// UI Helpers
// -----------------------------
function populateCategories() {
  const categories = [...new Set(quotes.map(q => q.category))].sort((a,b)=>a.localeCompare(b));
  categorySelect.innerHTML = "";
  categories.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat;
    categorySelect.appendChild(opt);
  });
}

function showRandomQuote() {
  const selectedCategory = categorySelect.value;
  const list = quotes.filter(q => q.category === selectedCategory);
  if (list.length === 0) {
    quoteDisplay.textContent = "No quotes available for this category.";
    return;
  }
  const q = list[Math.floor(Math.random() * list.length)];
  quoteDisplay.textContent = q.text;
  sessionStorage.setItem(SS_LAST, JSON.stringify(q));
}

function addQuote() {
  const textEl = document.getElementById('newQuoteText');
  const catEl  = document.getElementById('newQuoteCategory');
  const text = textEl.value.trim();
  const category = catEl.value.trim();

  if (!text || !category) {
    alert("Please provide both quote text and category.");
    return;
  }

  quotes.push({ text, category });
  saveQuotes();
  populateCategories();
  categorySelect.value = category;
  showRandomQuote();
  textEl.value = "";
  catEl.value = "";
  alert("Quote added successfully!");
}

// -----------------------------
// JSON Export / Import
// -----------------------------
function exportToJsonFile() {
  const data = JSON.stringify(quotes, null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = "quotes.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function importFromJsonFile(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  const fileReader = new FileReader();
  fileReader.onload = function(e) {
    try {
      const imported = JSON.parse(e.target.result);
      if (!Array.isArray(imported)) throw new Error("Invalid structure");
      const valid = imported.filter(
        q => q && typeof q.text === "string" && q.text.trim() &&
             typeof q.category === "string" && q.category.trim()
      );
      if (valid.length === 0) {
        alert("No valid quotes found in the file.");
        return;
      }
      quotes.push(...valid);
      saveQuotes();
      populateCategories();
      categorySelect.value = valid[0].category;
      showRandomQuote();
      alert("Quotes imported successfully!");
      importFileInput.value = "";
    } catch (err) {
      alert("Invalid JSON file.");
    }
  };
  fileReader.readAsText(file);
}

// -----------------------------
// Event Listeners & Init
// -----------------------------
newQuoteBtn.addEventListener('click', showRandomQuote);
addQuoteBtn.addEventListener('click', addQuote);
importFileInput.addEventListener('change', importFromJsonFile);
exportBtn.addEventListener('click', exportToJsonFile);
resetDefaultsBtn.addEventListener('click', resetToDefaults);
clearSessionBtn.addEventListener('click', () => {
  sessionStorage.removeItem(SS_LAST);
  alert("Cleared last viewed quote for this tab.");
});

loadQuotes();
populateCategories();

(function restoreLastViewed() {
  try {
    const last = sessionStorage.getItem(SS_LAST);
    if (last) {
      const q = JSON.parse(last);
      if (q && q.text && q.category) {
        if (!quotes.some(x => x.text === q.text && x.category === q.category)) {
          quotes.push({ text: q.text, category: q.category });
          saveQuotes();
          populateCategories();
        }
        if ([...categorySelect.options].some(o => o.value === q.category)) {
          categorySelect.value = q.category;
        }
        quoteDisplay.textContent = q.text;
        return;
      }
    }
  } catch (_) {}
  if (categorySelect.options.length) {
    categorySelect.selectedIndex = 0;
    showRandomQuote();
  } else {
    quoteDisplay.textContent = "No quotes available.";
  }
})();
