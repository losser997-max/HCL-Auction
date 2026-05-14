// Initial State Setup
const defaultTeams = [
    { id: 1, name: 'Team Alpha', credits: 150, roster: [] },
    { id: 2, name: 'Team Beta', credits: 150, roster: [] },
    { id: 3, name: 'Team Gamma', credits: 150, roster: [] },
    { id: 4, name: 'Team Delta', credits: 150, roster: [] },
    { id: 5, name: 'Team Epsilon', credits: 150, roster: [] },
    { id: 6, name: 'Team Zeta', credits: 150, roster: [] }
];

let players = JSON.parse(localStorage.getItem('auctionPlayers')) || [];
let teams = JSON.parse(localStorage.getItem('auctionTeams')) || JSON.parse(JSON.stringify(defaultTeams));

// Initialize UI on load
updateUI();

// 1. Read Excel File from Browser
function loadExcel() {
    const fileInput = document.getElementById('fileInput');
    const file = fileInput.files[0];
    if (!file) return alert("Please select an Excel file first.");

    const reader = new FileReader();
    reader.onload = function(e) {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, {type: 'array'});
        const sheetName = workbook.SheetNames[0];
        const sheetData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
        
        players = sheetData;
        saveData();
        updateUI();
        alert(`Successfully loaded ${players.length} players!`);
    };
    reader.readAsArrayBuffer(file);
}

// 2. Sell Player Logic
function sellPlayer() {
    if (players.length === 0) return alert("No players left in queue!");

    const teamId = parseInt(document.getElementById('teamSelect').value);
    const amount = parseInt(document.getElementById('bidAmount').value);
    const team = teams.find(t => t.id === teamId);

    if (team.credits < amount) {
        return alert(`Insufficient credits! ${team.name} only has ${team.credits} left.`);
    }

    const soldPlayer = players.shift(); // Remove from queue
    soldPlayer.Sold_Price = amount;     // Assign price
    
    team.credits -= amount;             // Deduct credits
    team.roster.push(soldPlayer);       // Add to team

    document.getElementById('bidAmount').value = 2; // Reset bid
    saveData();
    updateUI();
}

// 3. Pass Player Logic
function passPlayer() {
    if (players.length === 0) return alert("No players left in queue!");
    const passedPlayer = players.shift();
    players.push(passedPlayer); // Move to back of the line
    document.getElementById('bidAmount').value = 2;
    saveData();
    updateUI();
}

// 4. Update Dashboard UI
function updateUI() {
    // Update Active Player
    const playerDiv = document.getElementById('playerDisplay');
    const controlsDiv = document.getElementById('adminControls');
    
    if (players.length > 0) {
        const p = players[0];
        playerDiv.innerHTML = `
            <h2>${p.Name || p.name || 'Unknown Player'}</h2>
            <p>Role: ${p.Role || p.role || 'N/A'}</p>
            <p>Players Remaining in Queue: ${players.length}</p>
        `;
        controlsDiv.style.display = 'flex';
    } else {
        playerDiv.innerHTML = `<h2>Auction Queue Empty</h2><p>Upload a list or finish the auction.</p>`;
        controlsDiv.style.display = 'none';
    }

    // Update Teams Grid
    const gridDiv = document.getElementById('teamsGrid');
    gridDiv.innerHTML = '';
    teams.forEach(team => {
        gridDiv.innerHTML += `
            <div class="team-card">
                <h3>${team.name}</h3>
                <div class="credits">${team.credits} Cr</div>
                <p style="margin:0 0 10px 0; color:#7f8c8d;">Squad Size: ${team.roster.length}</p>
                <ul>
                    ${team.roster.map(p => `
                        <li>
                            <span>${p.Name || p.name}</span>
                            <span class="player-price">${p.Sold_Price}</span>
                        </li>
                    `).join('')}
                </ul>
            </div>
        `;
    });
}

// 5. Generate Excel Download
function downloadResults() {
    let exportData = [];
    teams.forEach(team => {
        team.roster.forEach(player => {
            exportData.push({
                Team: team.name,
                Player: player.Name || player.name || 'Unknown',
                Role: player.Role || player.role || 'N/A',
                Sold_Price: player.Sold_Price
            });
        });
    });

    if (exportData.length === 0) return alert("No players have been sold yet.");

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Auction Results");
    
    // Trigger download
    XLSX.writeFile(workbook, "IPL_Auction_Results.xlsx");
}

// Helpers
function saveData() {
    localStorage.setItem('auctionPlayers', JSON.stringify(players));
    localStorage.setItem('auctionTeams', JSON.stringify(teams));
}

function resetAuction() {
    if(confirm("Are you sure? This will wipe all auction data and reset team purses to 150.")) {
        localStorage.removeItem('auctionPlayers');
        localStorage.removeItem('auctionTeams');
        players = [];
        teams = JSON.parse(JSON.stringify(defaultTeams));
        updateUI();
    }
}