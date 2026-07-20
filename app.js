// --- RICH MOCK DATA ---
const MOCK_CLASSIC = { 
  standings: { results: [
    { rank: 1, entry_name: "Hosky Hotshots", player_name: "stake1...a1b2", total: 2187, event_total: 74 },
    { rank: 2, entry_name: "ADA United", player_name: "stake1...c3d4", total: 2104, event_total: 71 },
    { rank: 3, entry_name: "Cardano City", player_name: "stake1...e5f6", total: 2065, event_total: 67 }
  ]}
};
const MOCK_H2H = { 
  standings: { results: [
    { rank: 1, entry_name: "Hosky Hotshots", player_name: "stake1...a1b2", matches_won: 22, matches_drawn: 4, matches_lost: 12, points_for: 2187 }
  ]}
};
const MOCK_FIXTURES = [
  { home: "ARS", away: "MCI", kickoff: "Sat 12:30", status: "upcoming" },
  { home: "MUN", away: "TOT", kickoff: "Sat 17:30", status: "live", home_score: 1, away_score: 1 }
];
const MOCK_MANAGER = {
  entry_name: "Hosky Hotshots", summary_overall_rank: 142857,
  last_deadline_bank: 15, last_deadline_total_transfers: 3, active_chips: ["wildcard"],
  history: { current: [ { event: 35, points: 58 }, { event: 36, points: 71 }, { event: 37, points: 63 }, { event: 38, points: 74 } ] }
};

// Using api.allorigins.win which handles local file:// requests better
const PROXY = 'https://api.allorigins.win/raw?url=';
const BASE = 'https://fantasy.premierleague.net/api';
let teamsMap = {};

async function fetchAPI(endpoint) {
  try {
    const res = await fetch(PROXY + encodeURIComponent(BASE + endpoint));
    if (!res.ok) throw new Error('Network response was not ok');
    return await res.json();
  } catch (e) {
    console.error("API Fetch Failed:", e);
    return null;
  }
}

// --- INIT ---
document.addEventListener('DOMContentLoaded', () => {
  initPrizes();
  initWalletButton();
  fetchBootstrap();
});

// --- CONFIG / PRIZES ---
function initPrizes() {
  document.getElementById('prize-pool').textContent = CHAMPIONSHIP_CONFIG.prizes.totalPool ? `${CHAMPIONSHIP_CONFIG.prizes.totalPool} ADA` : "TBD";
  const list = document.getElementById('prize-list');
  const p = CHAMPIONSHIP_CONFIG.prizes;
  list.innerHTML = `
    <div class="prize-row"><span>Total Pool</span><strong>${p.totalPool ? `${p.totalPool} ADA` : "TBD"}</strong></div>
    <div class="prize-row"><span>Classic League</span><strong>${p.classicLeague ? `${p.classicLeague} ADA` : "TBD"}</strong></div>
    <div class="prize-row"><span>Head-to-Head</span><strong>${p.headToHead ? `${p.headToHead} ADA` : "TBD"}</strong></div>
    <div class="prize-row ${CHAMPIONSHIP_CONFIG.isCupActive ? '' : 'inactive'}"><span>Hosky Cup</span><strong>${CHAMPIONSHIP_CONFIG.isCupActive ? (p.hoskyCup || "TBD") : 'TBD (Inactive)'}</strong></div>
    <div class="prize-row"><span>Team of the Month</span><strong>${p.teamOfTheMonth ? `${p.teamOfTheMonth} ADA` : "TBD"}</strong></div>
  `;
}

// --- DATA FETCHING ---
async function fetchBootstrap() {
  const data = await fetchAPI('/bootstrap-static/');
  if (data) {
    data.teams.forEach(t => teamsMap[t.id] = t.short_name);
    const nextEvent = data.events.find(e => e.is_next) || data.events[data.events.length - 1];
    
    document.getElementById('current-gw').textContent = `GW ${nextEvent.id}`;
    document.getElementById('manager-count').textContent = data.total_players ? `${(data.total_players / 1000000).toFixed(1)}M` : "5";
    startCountdown(nextEvent.deadline_time);
    fetchFixtures(nextEvent.id);
    fetchClassicStandings(CHAMPIONSHIP_CONFIG.leagueIds.classic);
  } else {
    console.log("API not live, using rich mock data");
    startCountdown(new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString());
    document.getElementById('current-gw').textContent = "GW 1";
    document.getElementById('manager-count').textContent = "5";
    renderFixtures(MOCK_FIXTURES);
    renderClassicStandings(MOCK_CLASSIC.standings.results);
  }
}

async function fetchFixtures(gw) {
  const data = await fetchAPI(`/fixtures/?event=${gw}`);
  if (data && data.length > 0) {
    const formatted = data.map(f => ({ 
      home: teamsMap[f.team_h], 
      away: teamsMap[f.team_a], 
      kickoff: new Date(f.kickoff_time).toLocaleString('en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit' }), 
      status: f.started && !f.finished ? 'live' : 'upcoming', 
      home_score: f.team_h_score, 
      away_score: f.team_a_score 
    }));
    renderFixtures(formatted);
  } else {
    renderFixtures(MOCK_FIXTURES);
  }
}

async function fetchClassicStandings(id) {
  if (!id || id === "YOUR_LEAGUE_ID_HERE") { 
    renderClassicStandings(MOCK_CLASSIC.standings.results); 
    return; 
  }
  const data = await fetchAPI(`/leagues-classic/${id}/standings/`);
  if (data && data.standings && data.standings.results.length > 0) {
    renderClassicStandings(data.standings.results);
  } else {
    renderClassicStandings(MOCK_CLASSIC.standings.results);
  }
}

// --- RENDERING ---
function renderFixtures(fixtures) {
  document.getElementById('fixtures-list').innerHTML = fixtures.map(f => `
    <div class="fixture-item">
      <div class="fixture-team">${f.home}</div>
      <div class="fixture-center">${f.status === 'live' ? `<span class="live-badge">IN-PLAY</span><span>${f.home_score} - ${f.away_score}</span>` : `<span>${f.kickoff}</span>`}</div>
      <div class="fixture-team fixture-right">${f.away}</div>
    </div>
  `).join('');
}

function renderClassicStandings(results) {
  document.getElementById('standings-table').innerHTML = `
    <table style="width:100%">
      <thead><tr><th>#</th><th>Manager</th><th>Team Name</th><th>GW Pts</th><th>Total</th></tr></thead>
      <tbody>${results.map(r => `<tr><td>${r.rank}</td><td>${r.player_name}</td><td>${r.entry_name}</td><td>${r.event_total || 0}</td><td><strong>${r.total || 0}</strong></td></tr>`).join('')}</tbody>
    </table>
  `;
}

function renderH2HStandings(results) {
  document.getElementById('standings-table').innerHTML = `
    <table style="width:100%">
      <thead><tr><th>#</th><th>Manager</th><th>W</th><th>D</th><th>L</th><th>Pts For</th></tr></thead>
      <tbody>${results.map(r => `<tr><td>${r.rank}</td><td>${r.entry_name}</td><td>${r.matches_won}</td><td>${r.matches_drawn}</td><td>${r.matches_lost}</td><td><strong>${r.points_for}</strong></td></tr>`).join('')}</tbody>
    </table>
  `;
}

// --- TABS ---
function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  event.target.classList.add('active');
  if (tab === 'classic') fetchClassicStandings(CHAMPIONSHIP_CONFIG.leagueIds.classic);
  if (tab === 'h2h') renderH2HStandings(MOCK_H2H.standings.results);
  if (tab === 'cup') document.getElementById('standings-table').innerHTML = `<div style="text-align:center; padding:40px 20px; color:#94a3b8; font-weight:600;">Cup activates GW17</div>`;
}

// --- COUNTDOWN ---
function startCountdown(deadlineISO) {
  const interval = setInterval(() => {
    const diff = new Date(deadlineISO) - new Date();
    if (diff <= 0) { document.getElementById('countdown').textContent = 'PASSED'; clearInterval(interval); return; }
    const d = Math.floor(diff / 86400000); const h = Math.floor((diff % 86400000) / 3600000); const m = Math.floor((diff % 3600000) / 60000); const s = Math.floor((diff % 60000) / 1000);
    document.getElementById('countdown').textContent = `${d}d ${h}h ${m}m ${s}s`;
  }, 1000);
}

// --- CARDANO WALLET (MESHJS) ---
function initWalletButton() {
  const btn = document.getElementById('wallet-btn');
  const pill = document.getElementById('wallet-pill');
  const linkCard = document.getElementById('link-card');
  const fplInput = document.getElementById('fpl-id-input');

  btn.addEventListener('click', async () => {
    if (typeof window.MeshSDK === 'undefined') { 
      alert('MeshJS failed to load. Ensure you are hosting this on a live URL (like Cloudflare), not opening it locally.'); 
      return; 
    }
    try {
      const wallet = await window.MeshSDK.BrowserWallet.enable('eternl');
      const address = await wallet.getChangeAddress();
      const truncated = `${address.slice(0, 7)}...${address.slice(-4)}`;
      
      btn.style.display = 'none';
      pill.textContent = `🟢 ${truncated}`;
      pill.style.display = 'block';
      
      // Show the link card and enable input
      linkCard.style.display = 'block';
      fplInput.disabled = false;
      fplInput.placeholder = "Enter FPL Team ID...";
      document.querySelector('.input-note').textContent = "Wallet connected. Enter ID to load dossier.";
      
      fplInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') fetchManagerDossier(fplInput.value); });
    } catch (e) { 
      alert('Wallet connection failed or rejected.'); 
    }
  });
}

async function fetchManagerDossier(id) {
  const profile = await fetchAPI(`/entry/${id}/`);
  const history = await fetchAPI(`/entry/${id}/history/`);
  if (profile && history) {
    renderDossier(profile, history);
  } else {
    renderDossier(MOCK_MANAGER, MOCK_MANAGER.history);
  }
}

function renderDossier(profile, history) {
  const card = document.getElementById('dossier-card');
  const last4 = history.current.slice(-4);
  const maxPts = Math.max(...last4.map(g => g.points), 50);
  document.getElementById('dossier-content').innerHTML = `
    <div style="margin-bottom: 15px;"><strong style="font-size: 1.2rem; color:#155cb4;">${profile.entry_name || profile.name}</strong><div style="font-size: 0.9rem; color:#64748b;">Global Rank: ${profile.summary_overall_rank}</div></div>
    <div class="dossier-stats">
      <div class="dossier-stat"><span>Bank</span><strong>£${(profile.last_deadline_bank / 10).toFixed(1)}m</strong></div>
      <div class="dossier-stat"><span>Transfers</span><strong>${profile.last_deadline_total_transfers}</strong></div>
      <div class="dossier-stat"><span>Chips</span><strong>${profile.active_chips.length}</strong></div>
      <div class="dossier-stat"><span>Rank</span><strong>${profile.summary_overall_rank}</strong></div>
    </div>
    <div class="chart-container">${last4.map(gw => `<div class="bar" style="height: ${(gw.points / maxPts) * 100}%;"><div class="bar-value">${gw.points}</div><div class="bar-label">GW ${gw.event}</div></div>`).join('')}</div>
  `;
  card.style.display = 'block';
}
