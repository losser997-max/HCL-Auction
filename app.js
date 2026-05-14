const defaultTeams = [
    { id: 1, name: 'Team A', credits: 150, roster: [] },
    { id: 2, name: 'Team B', credits: 150, roster: [] },
    { id: 3, name: 'Team C', credits: 150, roster: [] },
    { id: 4, name: 'Team D', credits: 150, roster: [] },
    { id: 5, name: 'Team E', credits: 150, roster: [] },
    { id: 6, name: 'Team F', credits: 150, roster: [] }
];

let players = JSON.parse(localStorage.getItem('auctionPlayers')) || [];
let historyLog = JSON.parse(localStorage.getItem('auctionHistory')) || [];
let teams = JSON.parse(localStorage.getItem('auctionTeams')) || JSON.parse(JSON.stringify(defaultTeams));

updateUI();

// 1. Load & Strictly Randomize Excel Data
function loadExcel() {
    const fileInput = document.getElementById('fileInput');
    const file = fileInput.files[0];
    if (!file) return alert("Please select an Excel file first.");

    const reader = new FileReader();
    reader.onload = function(e) {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, {type: 'array'});
        const sheetName = workbook.SheetNames[0];
        let sheetData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
        
        // Robust Randomization (Fisher-Yates Shuffle)
        for (let i = sheetData.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [sheetData[i], sheetData[j]] = [sheetData[j], sheetData[i]];
        }
        
        players = sheetData;
        saveData();
        updateUI();
        alert(`Successfully loaded and randomized ${players.length} players!`);
    };
    reader.readAsArrayBuffer(file);
}

// 2. Max Bid Calculation (15 Player Quota, 2 Cr Min)
function calculateMaxBid(team) {
    const neededPlayers = Math.max(0, 15 - team.roster.length);
    // If buying the current player, they need (neededPlayers - 1) MORE players after.
    const neededAfterCurrent = Math.max(0, neededPlayers - 1);
    const reservedCredits = neededAfterCurrent * 2;
    return team.credits - reservedCredits;
}

// 3. Process SOLD Player
function sellPlayer() {
    if (players.length === 0) return alert("No players left in the pool!");

    const teamId = parseInt(document.getElementById('teamSelect').value);
    const amount = parseInt(document.getElementById('bidAmount').value);
    const team = teams.find(t => t.id === teamId);

    const maxAllowedBid = calculateMaxBid(team);

    if (amount > maxAllowedBid) {
        return alert(`TRANSACTION BLOCKED!\n\n${team.name} has ${team.credits} Cr left.\nThey must reserve at least ${team.credits - maxAllowedBid} Cr to fill out their mandatory 15-player squad.\n\nMAXIMUM BID ALLOWED: ${maxAllowedBid} Cr.`);
    }

    const soldPlayer = players.shift();
    soldPlayer.Sold_Price = amount;
    soldPlayer.Team = team.name;
    
    team.credits -= amount;
    team.roster.push(soldPlayer);

    // Add to top of history
    historyLog.unshift({
        name: soldPlayer.Name || soldPlayer.name || 'Unknown',
        status: 'SOLD',
        detail: `${team.name} (${amount} Cr)`
    });

    document.getElementById('bidAmount').value = 2; // Reset bid
    saveData();
    updateUI();
}

// 4. Process UNSOLD/PASS Player
function passPlayer() {
    if (players.length === 0) return alert("No players left in the pool!");
    const passedPlayer = players.shift();
    
    // Add to top of history
    historyLog.unshift({
        name: passedPlayer.Name || passedPlayer.name || 'Unknown',
        status: 'UNSOLD',
        detail: 'Passed'
    });
    
    document.getElementById('bidAmount').value = 2;
    saveData();
    updateUI();
}

// 5. Update entire user interface
function updateUI() {
    const board = document.getElementById('auctionBoard');
    
    // Active Player Area
    if (players.length > 0) {
        const p = players[0];
        document.getElementById('dispName').innerText = p.Name || p.name || 'Unknown Player';
        document.getElementById('dispRole').innerText = p.Role || p.role || 'Role N/A';
        document.getElementById('dispRemaining').innerText = players.length;
        board.style.display = 'flex';
    } else {
        board.style.display = 'none';
    }

    // Teams Grid
    const gridDiv = document.getElementById('teamsGrid');
    gridDiv.innerHTML = '';
    teams.forEach(team => {
        gridDiv.innerHTML += `
            <div class="team-card">
                <h3>${team.name}</h3>
                <div class="credits">${team.credits}</div>
                <div class="max-bid">Max Bid: ${calculateMaxBid(team)} Cr</div>
                <ul>
                    ${team.roster.map(p => `
                        <li>
                            <div class="player-meta">
                                <strong>${p.Name || p.name}</strong>
                                <small>${p.Role || p.role}</small>
                            </div>
                            <strong style="color:#e74c3c;">${p.Sold_Price}</strong>
                        </li>
                    `).join('')}
                </ul>
            </div>
        `;
    });

    // Auctioned History Sidebar
    const historyList = document.getElementById('historyList');
    historyList.innerHTML = historyLog.map(h => `
        <li class="${h.status === 'SOLD' ? 'status-sold' : 'status-unsold'}">
            <strong>${h.name}</strong>
            <span style="color:#7f8c8d; font-size: 0.85rem;">
                ${h.status === 'SOLD' ? `Sold to ${h.detail}` : 'UNSOLD'}
            </span>
        </li>
    `).join('');
}

// 6. Export to Excel
function downloadResults() {
    let exportData = [];
    
    teams.forEach(team => {
        team.roster.forEach(player => {
            exportData.push({
                Team: team.name,
                Player: player.Name || player.name || 'Unknown',
                Role: player.Role || player.role || 'N/A',
                Status: 'SOLD',
                Sold_Price: player.Sold_Price
            });
        });
    });

    historyLog.forEach(item => {
        if (item.status === 'UNSOLD') {
            exportData.push({
                Team: 'NONE',
                Player: item.name,
                Role: 'N/A',
                Status: 'UNSOLD',
                Sold_Price: 0
            });
        }
    });

    if (exportData.length === 0) return alert("No data to export.");

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "HCL 2026 Results");
    XLSX.writeFile(workbook, "HCL_2026_Auction_Results.xlsx");
}

function saveData() {
    localStorage.setItem('auctionPlayers', JSON.stringify(players));
    localStorage.setItem('auctionHistory', JSON.stringify(historyLog));
    localStorage.setItem('auctionTeams', JSON.stringify(teams));
}

function resetAuction() {
    if(confirm("WARNING: This will wipe all current auction data and reset everything to zero. Are you sure?")) {
        localStorage.clear();
        players = [];
        historyLog = [];
        teams = JSON.parse(JSON.stringify(defaultTeams));
        updateUI();
    }
}