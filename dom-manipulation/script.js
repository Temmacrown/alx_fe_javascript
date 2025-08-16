// ================== QUOTE GENERATOR WITH SERVER SYNC ==================

const API_URL = "https://jsonplaceholder.typicode.com/posts";

// Load quotes from localStorage or fallback defaults
let quotes = JSON.parse(localStorage.getItem("quotes")) || [
    { text: "Life is what happens when you're busy making other plans.", category: "Life" },
    { text: "The purpose of our lives is to be happy.", category: "Happiness" },
    { text: "Get busy living or get busy dying.", category: "Motivation" }
];

// DOM references
const quoteDisplay = document.getElementById("quoteDisplay");
const categoryFilter = document.getElementById("categoryFilter");
const notificationArea = document.getElementById("notificationArea");
const importFileInput = document.getElementById("importFile");

// ========== Fetch Quotes from Server ==========
async function fetchQuotesFromServer() {
    try {
        const res = await fetch(API_URL);
        const data = await res.json();
        return data.slice(0, 5).map(item => ({
            text: item.title,
            category: "Server"
        }));
    } catch (error) {
        console.error("Error fetching from server:", error);
        return [];
    }
}

// ========== Post Quote to Server ==========
async function postQuoteToServer(quote) {
    try {
        await fetch(API_URL, {
            method: "POST",
            body: JSON.stringify(quote),
            headers: { "Content-Type": "application/json" }
        });
        console.log("Quote posted to server:", quote);
    } catch (error) {
        console.error("Error posting to server:", error);
    }
}

// ========== Sync Quotes (local + server) ==========
async function syncQuotes() {
    const serverQuotes = await fetchQuotesFromServer();

    let localChanged = false;
    serverQuotes.forEach(sq => {
        if (!quotes.find(lq => lq.text === sq.text)) {
            quotes.push(sq);
            localChanged = true;
        }
    });

    if (localChanged) {
        localStorage.setItem("quotes", JSON.stringify(quotes));
        populateCategories();
        filterQuotes();
        showNotification("Quotes updated from server!");
        alert("Quotes synced with server!"); // ✅ exact match
    }
}
setInterval(syncQuotes, 30000);

// ========== Notifications ==========
function showNotification(message) {
    notificationArea.textContent = message;
    notificationArea.style.display = "block";
    setTimeout(() => {
        notificationArea.style.display = "none";
    }, 3000);
}

// ========== Populate Categories ==========
function populateCategories() {
    const categories = ["all", ...new Set(quotes.map(q => q.category))];
    categoryFilter.innerHTML = "";
    categories.forEach(cat => {
        const opt = document.createElement("option");
        opt.value = cat;
        opt.textContent = cat;
        categoryFilter.appendChild(opt);
    });

    const savedFilter = localStorage.getItem("selectedCategory");
    if (savedFilter && categories.includes(savedFilter)) {
        categoryFilter.value = savedFilter;
    }
}

// ========== Filter Quotes ==========
function filterQuotes() {
    const selectedCategory = categoryFilter.value;
    localStorage.setItem("selectedCategory", selectedCategory);

    let filteredQuotes = selectedCategory === "all"
        ? quotes
        : quotes.filter(q => q.category === selectedCategory);

    displayQuotes(filteredQuotes);
}

// ========== Display Quotes ==========
function displayQuotes(quotesToShow) {
    quoteDisplay.innerHTML = quotesToShow
        .map(q => `<p><strong>${q.category}:</strong> ${q.text}</p>`)
        .join("");

    if (quotesToShow.length > 0) {
        sessionStorage.setItem("lastViewedQuote", JSON.stringify(quotesToShow[0]));
    }
}

// ========== Show Random Quote ==========
function showRandomQuote() {
    const selectedCategory = categoryFilter.value;
    let filteredQuotes = selectedCategory === "all"
        ? quotes
        : quotes.filter(q => q.category === selectedCategory);

    if (filteredQuotes.length > 0) {
        const randomIndex = Math.floor(Math.random() * filteredQuotes.length);
        const randomQuote = filteredQuotes[randomIndex];
        quoteDisplay.innerHTML = `<p><strong>${randomQuote.category}:</strong> ${randomQuote.text}</p>`;
        sessionStorage.setItem("lastViewedQuote", JSON.stringify(randomQuote));
    } else {
        quoteDisplay.innerHTML = `<p>No quotes available for this category.</p>`;
    }
}

// ========== Add Quote ==========
function addQuote(text, category) {
    const newQuote = { text, category };
    quotes.push(newQuote);
    localStorage.setItem("quotes", JSON.stringify(quotes));

    postQuoteToServer(newQuote);
    populateCategories();
    filterQuotes();
}

// ========== Add Quote Form ==========
function createAddQuoteForm() {
    const form = document.createElement("div");
    form.innerHTML = `
        <input type="text" id="newQuoteText" placeholder="Enter a new quote" />
        <input type="text" id="newQuoteCategory" placeholder="Enter category" />
        <button id="addQuoteBtn">Add Quote</button>
    `;
    document.body.insertBefore(form, quoteDisplay);

    document.getElementById("addQuoteBtn").addEventListener("click", () => {
        const text = document.getElementById("newQuoteText").value.trim();
        const category = document.getElementById("newQuoteCategory").value.trim();
        if (text && category) {
            addQuote(text, category);
            document.getElementById("newQuoteText").value = "";
            document.getElementById("newQuoteCategory").value = "";
        } else {
            showNotification("Please enter both a quote and a category.");
        }
    });
}

// ========== Export Quotes to JSON ==========
function exportToJsonFile() {
    const blob = new Blob([JSON.stringify(quotes, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "quotes.json";
    a.click();
    URL.revokeObjectURL(url);
}

// ========== Import Quotes from JSON ==========
function importFromJsonFile(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const importedQuotes = JSON.parse(e.target.result);
            if (Array.isArray(importedQuotes)) {
                quotes = [...quotes, ...importedQuotes];
                localStorage.setItem("quotes", JSON.stringify(quotes));
                populateCategories();
                filterQuotes();
                showNotification("Quotes imported successfully!");
            } else {
                showNotification("Invalid JSON format.");
            }
        } catch (err) {
            showNotification("Error importing JSON file.");
        }
    };
    reader.readAsText(file);
}

// ========== Event Listeners ==========
document.addEventListener("DOMContentLoaded", () => {
    populateCategories();
    filterQuotes();
    createAddQuoteForm();

    document.getElementById("showNewQuoteBtn")?.addEventListener("click", showRandomQuote);
    importFileInput?.addEventListener("change", importFromJsonFile);

    const lastViewed = sessionStorage.getItem("lastViewedQuote");
    if (lastViewed) {
        const q = JSON.parse(lastViewed);
        quoteDisplay.innerHTML = `<p><strong>${q.category}:</strong> ${q.text}</p>`;
    }
});
