const defaultTeams = [
    { id: 1, name: 'Team Alpha', credits: 150, roster: [] },
    { id: 2, name: 'Team Beta', credits: 150, roster: [] },
    { id: 3, name: 'Team Gamma', credits: 150, roster: [] },
    { id: 4, name: 'Team Delta', credits: 150, roster: [] },
    { id: 5, name: 'Team Epsilon', credits: 150, roster: [] },
    { id: 6, name: 'Team Zeta', credits: 150, roster: [] }
];

let players = JSON.parse(localStorage.getItem('auctionPlayers')) || [];
let historyLog = JSON.parse(localStorage.getItem('auctionHistory')) || [];
let teams = JSON.parse(localStorage.getItem('auctionTeams')) || JSON.parse(JSON.stringify(defaultTeams));

updateUI();

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
        
        // Randomize the player queue
        players = sheetData.sort(() => Math.random() - 0.5);
        
        saveData();
        updateUI();
        alert(`Successfully loaded & randomized ${players.length} players!`);
    };
    reader.readAsArrayBuffer(file);
}

// Enforces 15 player quota and 2 base credit minimum
function calculateMaxBid(team) {
    const neededPlayers = Math.max(0, 15 - (team.roster.length + 1));
    const reservedCredits = neededPlayers * 2;
    return team.credits - reservedCredits;
}

function sellPlayer() {
    if (players.length === 0) return alert("No players left in queue!");

    const teamId = parseInt(document.getElementById('teamSelect').value);
    const amount = parseInt(document.getElementById('bidAmount').value);
    const team = teams.find(t => t.id === teamId);

    const maxAllowedBid = calculateMaxBid(team);

    // Block the bid if it breaks the math
    if (amount > maxAllowedBid) {
        return alert(`Transaction Failed!\n${team.name} has ${team.credits} Cr left.\nThey must reserve at least ${team.credits - maxAllowedBid} Cr to fill their 15-player quota.\nMaximum bid allowed: ${maxAllowedBid} Cr.`);
    }

    const soldPlayer = players.shift();
    soldPlayer.Sold_Price = amount;
    soldPlayer.Team = team.name;
    
    team.credits -= amount;
    team.roster.push(soldPlayer);

    // Add to History Log
    historyLog.unshift({
        name: soldPlayer.Name || soldPlayer.name || 'Unknown',
        status: 'SOLD',
        detail: `${team.name} (${amount} Cr)`
    });

    document.getElementById('bidAmount').value = 2; // reset base bid
    saveData();
    updateUI();
}

function passPlayer() {
    if (players.length === 0) return alert("No players left in queue!");
    const passedPlayer = players.shift();
    
    // Add to History Log as Unsold
    historyLog.unshift({
        name: passedPlayer.Name || passedPlayer.name || 'Unknown',
        status: 'UNSOLD',
        detail: 'Passed'
    });
    
    document.getElementById('bidAmount').value = 2;
    saveData();
    updateUI();
}

function updateUI() {
    const playerContainer = document.getElementById('playerDisplay');
    const controlsDiv = document.getElementById('adminControls');
    
    // 1. Current Player
    if (players.length > 0) {
        const p = players[0];
        document.getElementById('dispName').innerText = p.Name || p.name || 'Unknown';
        document.getElementById('dispRole').innerText = p.Role || p.role || 'N/A';
        document.getElementById('dispRemaining').innerText = players.length;
        
        playerContainer.style.display = 'grid';
        controlsDiv.style.display = 'flex';
    } else {
        playerContainer.style.display = 'none';
        controlsDiv.style.display = 'none';
    }

    // 2. Teams Columns
    const gridDiv = document.getElementById('teamsGrid');
    gridDiv.innerHTML = '';
    teams.forEach(team => {
        gridDiv.innerHTML += `
            <div class="team-card">
                <h3>${team.name}</h3>
                <div class="credits">${team.credits} Cr</div>
                <div class="squad-size">${team.roster.length} / 15 Players</div>
                <ul>
                    ${team.roster.map(p => `
                        <li>
                            <span><strong>${p.Name || p.name}</strong> <br><small>${p.Role || p.role}</small></span>
                            <span style="color:#e74c3c; font-weight:bold;">${p.Sold_Price}</span>
                        </li>
                    `).join('')}
                </ul>
            </div>
        `;
    });

    // 3. History Sidebar
    const historyList = document.getElementById('historyList');
    historyList.innerHTML = historyLog.map(h => `
        <li class="${h.status === 'SOLD' ? 'status-sold' : 'status-unsold'}">
            <span class="hist-name">${h.name}</span>
            <span class="hist-status"><strong>${h.status}</strong> - ${h.detail}</span>
        </li>
    `).join('');
}

function downloadResults() {
    let exportData = [];
    
    // Extract Sold Players
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

    // Extract Unsold from History Log
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
    XLSX.utils.book_append_sheet(workbook, worksheet, "Auction Results");
    XLSX.writeFile(workbook, "IPL_Auction_Results.xlsx");
}

// Helpers
function saveData() {
    localStorage.setItem('auctionPlayers', JSON.stringify(players));
    localStorage.setItem('auctionHistory', JSON.stringify(historyLog));
    localStorage.setItem('auctionTeams', JSON.stringify(teams));
}

function resetAuction() {
    if(confirm("Are you sure? This wipes all data and resets the board.")) {
        localStorage.clear();
        players = [];
        historyLog = [];
        teams = JSON.parse(JSON.stringify(defaultTeams));
        updateUI();
    }
}