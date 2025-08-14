// Load quotes from local storage or default
let quotes = JSON.parse(localStorage.getItem("quotes")) || [
  { text: "Life is what happens when you're busy making other plans.", author: "John Lennon", category: "Life" },
  { text: "Get busy living or get busy dying.", author: "Stephen King", category: "Motivation" },
  { text: "The purpose of our lives is to be happy.", author: "Dalai Lama", category: "Life" }
];

// Last selected category
let lastSelectedCategory = localStorage.getItem("selectedCategory") || "all";

// Session storage example: last viewed quote
if (sessionStorage.getItem("lastQuote")) {
  console.log("Last viewed quote this session:", sessionStorage.getItem("lastQuote"));
}

function saveQuotes() {
  localStorage.setItem("quotes", JSON.stringify(quotes));
}

function populateCategories() {
  const categoryFilter = document.getElementById("categoryFilter");
  const uniqueCategories = [...new Set(quotes.map(q => q.category))];

  categoryFilter.innerHTML = '<option value="all">All Categories</option>';
  uniqueCategories.forEach(category => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    categoryFilter.appendChild(option);
  });

  categoryFilter.value = lastSelectedCategory;
}

function displayQuotes(filteredQuotes) {
  const quoteDisplay = document.getElementById("quoteDisplay");
  quoteDisplay.innerHTML = "";

  filteredQuotes.forEach(q => {
    const quoteEl = document.createElement("p");
    quoteEl.textContent = `"${q.text}" — ${q.author} [${q.category}]`;
    quoteEl.onclick = () => {
      sessionStorage.setItem("lastQuote", q.text);
      alert(`Stored last viewed quote in session: "${q.text}"`);
    };
    quoteDisplay.appendChild(quoteEl);
  });
}

function filterQuotes() {
  const selectedCategory = document.getElementById("categoryFilter").value;
  localStorage.setItem("selectedCategory", selectedCategory);

  if (selectedCategory === "all") {
    displayQuotes(quotes);
  } else {
    displayQuotes(quotes.filter(q => q.category === selectedCategory));
  }
}

// Random Quote Function
function showRandomQuote() {
  const selectedCategory = document.getElementById("categoryFilter").value;
  let availableQuotes = (selectedCategory === "all") 
    ? quotes 
    : quotes.filter(q => q.category === selectedCategory);

  if (availableQuotes.length === 0) {
    alert("No quotes available for this category.");
    return;
  }

  const randomQuote = availableQuotes[Math.floor(Math.random() * availableQuotes.length)];
  alert(`"${randomQuote.text}" — ${randomQuote.author} [${randomQuote.category}]`);
}

function addQuote(event) {
  event.preventDefault();
  const text = document.getElementById("quoteText").value.trim();
  const author = document.getElementById("quoteAuthor").value.trim();
  const category = document.getElementById("quoteCategory").value.trim();

  if (!text || !author || !category) return alert("Please fill all fields.");

  quotes.push({ text, author, category });
  saveQuotes();
  populateCategories();
  filterQuotes();

  event.target.reset();
}

// JSON Export
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

// JSON Import
function importFromJsonFile(event) {
  const fileReader = new FileReader();
  fileReader.onload = function(e) {
    try {
      const importedQuotes = JSON.parse(e.target.result);
      if (Array.isArray(importedQuotes)) {
        quotes.push(...importedQuotes);
        saveQuotes();
        populateCategories();
        filterQuotes();
        alert('Quotes imported successfully!');
      } else {
        alert("Invalid JSON format.");
      }
    } catch (err) {
      alert("Error parsing JSON file.");
    }
  };
  fileReader.readAsText(event.target.files[0]);
}

// Event listeners
document.getElementById("addQuoteForm").addEventListener("submit", addQuote);
document.getElementById("importFile").addEventListener("change", importFromJsonFile);
document.getElementById("randomQuoteBtn").addEventListener("click", showRandomQuote);

// Initialize app
populateCategories();
filterQuotes();
