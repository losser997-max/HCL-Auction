const defaultTeams = [
    { id: 1, name: 'Team A', credits: 150, roster: [] },
    { id: 2, name: 'Team B', credits: 150, roster: [] },
    { id: 3, name: 'Team C', credits: 150, roster: [] },
    { id: 4, name: 'Team D', credits: 150, roster: [] },
    { id: 5, name: 'Team E', credits: 150, roster: [] },
    { id: 6, name: 'Team F', credits: 150, roster: [] }
];

// Role → CSS class mapping (case-insensitive, partial match)
const ROLE_CLASS_MAP = [
    { match: ['batsman', 'batter', 'bat'],        cls: 'role-batsman' },
    { match: ['bowler', 'bowling', 'bowl'],        cls: 'role-bowler' },
    { match: ['all-rounder', 'allrounder', 'all rounder', 'ar'], cls: 'role-allrounder' },
    { match: ['wicket', 'keeper', 'wk'],           cls: 'role-keeper' },
];

function getRoleClass(role = '') {
    const r = role.toLowerCase();
    for (const { match, cls } of ROLE_CLASS_MAP) {
        if (match.some(m => r.includes(m))) return cls;
    }
    return 'role-default';
}

let players = JSON.parse(localStorage.getItem('auctionPlayers')) || [];
let historyLog = JSON.parse(localStorage.getItem('auctionHistory')) || [];
let teams = JSON.parse(localStorage.getItem('auctionTeams')) || JSON.parse(JSON.stringify(defaultTeams));

updateUI();

// 1. Load & Randomize (With Confirmation)
function loadExcel() {
    const fileInput = document.getElementById('fileInput');
    const file = fileInput.files[0];

    if (!file) return alert("Please select an Excel file first.");

    if (players.length > 0 || historyLog.length > 0) {
        if (!confirm("Are you sure you want to load a new list? This will replace the current player queue.")) {
            return;
        }
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        let sheetData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

        // Fisher-Yates Shuffle
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

// 2. Change Team Name Function
function updateTeamName(teamId, newName) {
    const team = teams.find(t => t.id === teamId);
    if (team && newName.trim() !== '') {
        team.name = newName.trim();
        saveData();
        updateUI();
    }
}

function calculateMaxBid(team) {
    const neededPlayers = Math.max(0, 15 - team.roster.length);
    const neededAfterCurrent = Math.max(0, neededPlayers - 1);
    return team.credits - (neededAfterCurrent * 2);
}

function sellPlayer() {
    if (players.length === 0) return alert("No players left in the pool!");

    const teamId = parseInt(document.getElementById('teamSelect').value);
    const amount = parseInt(document.getElementById('bidAmount').value);
    const team = teams.find(t => t.id === teamId);

    const maxAllowedBid = calculateMaxBid(team);

    if (amount > maxAllowedBid) {
        return alert(`TRANSACTION BLOCKED!\n\n${team.name} has ${team.credits} Cr left.\nThey must reserve at least ${team.credits - maxAllowedBid} Cr to fill their 15-player squad.\n\nMAXIMUM ALLOWED BID: ${maxAllowedBid} Cr.`);
    }

    const soldPlayer = players.shift();
    soldPlayer.Sold_Price = amount;
    soldPlayer.Team = team.name;

    team.credits -= amount;
    team.roster.push(soldPlayer);

    historyLog.unshift({
        player: soldPlayer,
        name: soldPlayer.Name || soldPlayer.name || 'Unknown',
        status: 'SOLD',
        detail: `${team.name} (${amount} Cr)`
    });

    document.getElementById('bidAmount').value = 2;
    saveData();
    updateUI();
}

function passPlayer() {
    if (players.length === 0) return alert("No players left in the pool!");
    const passedPlayer = players.shift();

    historyLog.unshift({
        player: passedPlayer,
        name: passedPlayer.Name || passedPlayer.name || 'Unknown',
        status: 'UNSOLD',
        detail: 'Passed'
    });

    document.getElementById('bidAmount').value = 2;
    saveData();
    updateUI();
}

function updateUI() {
    const board = document.getElementById('auctionBoard');

    // Update Dynamic Team Dropdown
    const teamSelect = document.getElementById('teamSelect');
    const currentVal = teamSelect.value;
    teamSelect.innerHTML = teams.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
    if (currentVal && teams.find(t => t.id == currentVal)) {
        teamSelect.value = currentVal;
    }

    // Active Player Area
    if (players.length > 0) {
        const p = players[0];
        const role = p.Role || p.role || 'Role N/A';
        const achievement = p.Achievement || p.achievement || p.Achievements || p.achievements || '';

        document.getElementById('dispName').innerText = p.Name || p.name || 'Unknown Player';
        document.getElementById('dispRole').innerText = role;
        document.getElementById('dispRemaining').innerText = players.length;

        // Achievement display
        const achEl = document.getElementById('dispAchievement');
        if (achievement) {
            achEl.innerHTML = `<span class="ach-icon">🏆</span><span class="ach-text">${achievement}</span>`;
            achEl.style.display = 'flex';
        } else {
            achEl.style.display = 'none';
        }

        board.style.display = 'flex';
    } else {
        board.style.display = 'none';
    }

    // Teams Grid
    const gridDiv = document.getElementById('teamsGrid');
    gridDiv.innerHTML = '';
    teams.forEach(team => {
        const squadCount = team.roster.length;
        gridDiv.innerHTML += `
            <div class="team-card">
                <input type="text" class="team-name-input" value="${team.name}" onchange="updateTeamName(${team.id}, this.value)" title="Click to edit team name">
                <div class="credits">${team.credits}</div>
                <div class="max-bid">Max Bid: ${calculateMaxBid(team)} Cr</div>
                <div class="squad-count">
                    <span class="squad-num">${squadCount}</span>
                    <span class="squad-label">/ 15 Players</span>
                </div>
                <ul>
                    ${team.roster.map(p => {
                        const role = p.Role || p.role || '';
                        const roleClass = getRoleClass(role);
                        return `
                        <li class="player-row ${roleClass}">
                            <div class="player-meta">
                                <strong>${p.Name || p.name}</strong>
                                <small>${role}</small>
                            </div>
                            <span class="player-price">${p.Sold_Price}</span>
                        </li>`;
                    }).join('')}
                </ul>
            </div>
        `;
    });

    // Auctioned History Sidebar
    const historyList = document.getElementById('historyList');
    historyList.innerHTML = historyLog.map(h => `
        <li class="${h.status === 'SOLD' ? 'status-sold' : 'status-unsold'}">
            <strong>${h.name}</strong>
            <span>${h.status === 'SOLD' ? `Sold → ${h.detail}` : 'UNSOLD'}</span>
        </li>
    `).join('');

    // Update log count badge
    const logCount = document.getElementById('logCount');
    if (logCount) logCount.textContent = historyLog.length;
}

// 6. Structured Excel Export (Grouped by Team)
function downloadResults() {
    if (historyLog.length === 0 && teams.every(t => t.roster.length === 0)) {
        return alert("No data to export.");
    }

    let exportData = [
        ["Team Name / Status", "Player Name", "Role", "Achievement", "Sold Price (Cr)"]
    ];

    teams.forEach(team => {
        exportData.push([team.name.toUpperCase(), "", "", "", ""]);
        team.roster.forEach(p => {
            const ach = p.Achievement || p.achievement || p.Achievements || p.achievements || '';
            exportData.push(["", p.Name || p.name || 'Unknown', p.Role || p.role || 'N/A', ach, p.Sold_Price]);
        });
        exportData.push([]);
    });

    exportData.push(["UNSOLD PLAYERS", "", "", "", ""]);
    historyLog.forEach(item => {
        if (item.status === 'UNSOLD') {
            let p = item.player;
            const ach = p.Achievement || p.achievement || p.Achievements || p.achievements || '';
            exportData.push(["", p.Name || p.name || 'Unknown', p.Role || p.role || 'N/A', ach, "0"]);
        }
    });

    const worksheet = XLSX.utils.aoa_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "HCL 2026 Results");
    XLSX.writeFile(workbook, "HCL_2026_Auction_Results.xlsx");
}

function saveData() {
    localStorage.setItem('auctionPlayers', JSON.stringify(players));
    localStorage.setItem('auctionHistory', JSON.stringify(historyLog));
    localStorage.setItem('auctionTeams', JSON.stringify(teams));
}

// 7. Reset Auction (With Confirmation)
function resetAuction() {
    if (confirm("WARNING: Are you absolutely sure? This will wipe all current auction data and reset everything to zero.")) {
        localStorage.clear();
        players = [];
        historyLog = [];
        teams = JSON.parse(JSON.stringify(defaultTeams));
        updateUI();
    }
}
