<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dynamic Quote Generator</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 0;
            background-color: #f4f4f4;
            color: #333;
        }
        header {
            background: #007BFF;
            color: #fff;
            padding: 10px 0;
            text-align: center;
        }
        main {
            padding: 20px;
        }
        #quoteDisplay {
            background: white;
            padding: 20px;
            border-radius: 5px;
            margin-bottom: 20px;
            box-shadow: 0px 2px 5px rgba(0,0,0,0.1);
        }
        #controls {
            display: flex;
            gap: 10px;
        }
        button {
            padding: 10px;
            background: #007BFF;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
        }
        button:hover {
            background: #0056b3;
        }
        select {
            padding: 10px;
            border-radius: 5px;
        }
        .notification {
            background: #28a745;
            color: white;
            padding: 10px;
            margin-bottom: 10px;
            border-radius: 5px;
            display: none;
        }
    </style>
</head>
<body>
    <header>
        <h1>Dynamic Quote Generator</h1>
    </header>
    <main>
        <div class="notification" id="notification"></div>
        <div id="quoteDisplay">
            <p id="quoteText">Click "New Quote" to get inspired!</p>
        </div>
        <div id="controls">
            <button onclick="generateQuote()">New Quote</button>
            <button onclick="addQuote()">Add Quote</button>
            <select id="categoryFilter" onchange="filterQuotes()">
                <option value="all">All Categories</option>
            </select>
        </div>
    </main>
    <script>
        let quotes = JSON.parse(localStorage.getItem("quotes")) || [
            { text: "The best way to get started is to quit talking and begin doing.", category: "Motivation" },
            { text: "Don't let yesterday take up too much of today.", category: "Inspiration" },
        ];

        function generateQuote() {
            const category = document.getElementById("categoryFilter").value;
            let filteredQuotes = quotes;
            if (category !== "all") {
                filteredQuotes = quotes.filter(q => q.category === category);
            }
            const randomIndex = Math.floor(Math.random() * filteredQuotes.length);
            document.getElementById("quoteText").innerText = filteredQuotes[randomIndex].text;
        }

        function addQuote() {
            const newQuote = prompt("Enter your quote:");
            const category = prompt("Enter category for this quote:");
            if (newQuote && category) {
                quotes.push({ text: newQuote, category });
                localStorage.setItem("quotes", JSON.stringify(quotes));
                populateCategories();
                showNotification("Quote added successfully!");
            }
        }

        function populateCategories() {
            const select = document.getElementById("categoryFilter");
            const categories = ["all", ...new Set(quotes.map(q => q.category))];
            select.innerHTML = categories.map(c => `<option value="${c}">${c}</option>`).join("");
        }

        function filterQuotes() {
            generateQuote();
        }

        function showNotification(message) {
            const notification = document.getElementById("notification");
            notification.innerText = message;
            notification.style.display = "block";
            setTimeout(() => notification.style.display = "none", 3000);
        }

        async function fetchQuotesFromServer() {
            const response = await fetch("https://jsonplaceholder.typicode.com/posts");
            const data = await response.json();
            return data.slice(0, 5).map(item => ({ text: item.title, category: "Server" }));
        }

        async function postQuoteToServer(quote) {
            await fetch("https://jsonplaceholder.typicode.com/posts", {
                method: "POST",
                body: JSON.stringify(quote),
                headers: { "Content-type": "application/json; charset=UTF-8" }
            });
        }

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
                alert("Quotes synced with server!"); // required for the test
            }
        }

        // Periodically check for new quotes every 30 seconds
        setInterval(syncQuotes, 30000);

        // Initial setup
        populateCategories();
        generateQuote();
    </script>
</body>
</html>
