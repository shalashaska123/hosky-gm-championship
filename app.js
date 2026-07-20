const BASE = 'https://fantasy.premierleague.com/api';
let teamsMap = {};

// Smart fetch: Try direct first, fallback to proxy if blocked by CORS
async function fetchAPI(endpoint) {
  try {
    const res = await fetch(`${BASE}${endpoint}`);
    if (!res.ok) throw new Error('Direct failed');
    return await res.json();
  } catch (e) {
    try {
      const proxyRes = await fetch(`https://corsproxy.io/?url=${encodeURIComponent(BASE + endpoint)}`);
      if (!proxyRes.ok) return null;
      return await proxyRes.json();
    } catch (err) {
      console.error("API Fetch Failed completely:", err);
      return null;
    }
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
    document.getElementById('manager-count').textContent = data.total_players ? `${(data.total_players / 1000000).toFixed(1)}M` : "-";
    startCountdown(nextEvent.deadline_time);
    fetchFixtures(nextEvent.id);
    fetchClassicStandings(CHAMPIONSHIP_CONFIG.leagueIds.classic);
  } else {
    document.getElementById('countdown').textContent = "Unavailable";
    document.getElementById('current-gw').textContent = "Unavailable";
    document.getElementById('fixtures-list').innerHTML = `<div style="text-align:center; padding:20px; color:#94a3b8;">Unable to fetch FPL data.</div>`;
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
    document.getElementById('fixtures-list').innerHTML = `<div style="text-align:center; padding:20px; color:#94a3b8;">Fixtures have not been released for this Gameweek yet.</div>`;
  }
}

async function fetchClassicStandings(id) {
  if (!id || id === "YOUR_LEAGUE_ID_HERE") { 
    document.getElementById('standings-table').innerHTML = `<div style="text-align:center; padding:20px; color:#94a3b8;">Please set your League ID in config.js</div>`;
    return; 
  }
  const data = await fetchAPI(`/leagues-classic/${id}/standings/`);
  if (data && data.standings && data.standings.results.length > 0) {
    renderClassicStandings(data.standings.results);
  } else {
    document.getElementById('standings-table').innerHTML = `<div style="text-align:center; padding:20px; color:#94a3b8;">No standings found. Check your League ID.</div>`;
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
    <h3 style="color:#1e72d7; font-weight:700; margin-bottom:15px; font-size:1rem;">Last Season's Final Standings</h3>
    <table style="width:100%">
      <thead><tr><th>#</th><th>Manager</th><th>Team Name</th><th>GW Pts</th><th>Total</th></tr></thead>
      <tbody>${results.map(r => `<tr><td>${r.rank}</td><td>${r.player_name}</td><td>${r.entry_name}</td><td>${r.event_total || 0}</td><td><strong>${r.total || 0}</strong></td></tr>`).join('')}</tbody>
    </table>
  `;
}

// --- TABS ---
function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  event.target.classList.add('active');
  
  if (tab === 'classic') {
    fetchClassicStandings(CHAMPIONSHIP_CONFIG.leagueIds.classic);
  } else if (tab === 'h2h') {
    document.getElementById('standings-table').innerHTML = `<div style="text-align:center; padding:20px; color:#94a3b8;">H2H Standings will appear here.</div>`;
  } else if (tab === 'cup') {
    document.getElementById('standings-table').innerHTML = `<div style="text-align:center; padding:20px; color:#94a3b8;">Cup bracket will appear here once the FPL Cup begins (usually GW17).</div>`;
  }
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
    // Reverted to Claude's exact global variable: window.MeshSDK
    if (!window.MeshSDK || !window.MeshSDK.BrowserWallet) { 
      alert('Wallet SDK is still loading. Please wait a few seconds and try again.'); 
      return; 
    }
    try {
      const wallet = await window.MeshSDK.BrowserWallet.enable('eternl');
      const address = await wallet.getChangeAddress();
      const truncated = `${address.slice(0, 7)}...${address.slice(-4)}`;
      
      btn.style.display = 'none';
      pill.textContent = `🟢 ${truncated}`;
      pill.style.display = 'block';
      
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
    document.getElementById('dossier-content').innerHTML = `<div style="text-align:center; padding:20px; color:#94a3b8;">Manager data unavailable. Check your FPL Team ID.</div>`;
    document.getElementById('dossier-card').style.display = 'block';
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
