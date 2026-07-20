const MOCK_CLASSIC = { standings: { results: [{ rank: 1, entry_name: "Hosky Hotshots", player_name: "stake1...a1b2", total: 2187, event_total: 74 }, { rank: 2, entry_name: "ADA United", player_name: "stake1...c3d4", total: 2104, event_total: 71 }] } };
const MOCK_FIXTURES = [{ home: "ARS", away: "MCI", kickoff: "Sat 12:30", status: "upcoming" }, { home: "MUN", away: "TOT", kickoff: "Sat 17:30", status: "live", home_score: 1, away_score: 1 }];
const MOCK_MANAGER = { name: "Hosky Manager", entry_name: "Hosky Hotshots", summary_overall_rank: 142857, last_deadline_bank: 15, last_deadline_total_transfers: 3, active_chips: ["wc"], history: { current: [{ event: 35, points: 58 }, { event: 36, points: 71 }, { event: 37, points: 63 }, { event: 38, points: 74 }] } };

const BASE = 'https://fantasy.premierleague.com/api';
let teamsMap = {};

document.addEventListener('DOMContentLoaded', () => {
  initPrizes();
  initWalletButton();
  fetchBootstrap();
});

function initPrizes() {
  document.getElementById('prize-pool').textContent = CHAMPIONSHIP_CONFIG.prizes.totalPool || "TBD";
  const list = document.getElementById('prize-list');
  const p = CHAMPIONSHIP_CONFIG.prizes;
  list.innerHTML = `
    <div class="prize-row"><span>Total Pool</span><strong>${p.totalPool || "TBD"}</strong></div>
    <div class="prize-row"><span>Classic League</span><strong>${p.classicLeague || "TBD"}</strong></div>
    <div class="prize-row"><span>Head-to-Head</span><strong>${p.headToHead || "TBD"}</strong></div>
    <div class="prize-row ${CHAMPIONSHIP_CONFIG.isCupActive ? '' : 'inactive'}"><span>Hosky Cup</span><strong>${CHAMPIONSHIP_CONFIG.isCupActive ? (p.hoskyCup || "TBD") : 'Inactive'}</strong></div>
    <div class="prize-row"><span>Team of the Month</span><strong>${p.teamOfTheMonth || "TBD"}</strong></div>
  `;
}

async function fetchBootstrap() {
  try {
    const res = await fetch(`${BASE}/bootstrap-static/`);
    const data = await res.json();
    data.teams.forEach(t => teamsMap[t.id] = t.short_name);
    const nextEvent = data.events.find(e => e.is_next) || data.events[0];
    document.getElementById('current-gw').textContent = `GW ${nextEvent.id}`;
    document.getElementById('manager-count').textContent = "1.2M";
    startCountdown(nextEvent.deadline_time);
    fetchFixtures(nextEvent.id);
    fetchClassicStandings(CHAMPIONSHIP_CONFIG.leagueIds.classic);
  } catch (e) {
    startCountdown(new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString());
    document.getElementById('current-gw').textContent = "GW 1";
    document.getElementById('manager-count').textContent = "5";
    renderFixtures(MOCK_FIXTURES);
    renderClassicStandings(MOCK_CLASSIC.standings.results);
  }
}

async function fetchFixtures(gw) {
  try {
    const res = await fetch(`${BASE}/fixtures/?event=${gw}`);
    const data = await res.json();
    if (!data || data.length === 0) throw new Error("No fixtures");
    const formatted = data.map(f => ({ home: teamsMap[f.team_h], away: teamsMap[f.team_a], kickoff: new Date(f.kickoff_time).toLocaleString('en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit' }), status: f.started && !f.finished ? 'live' : 'upcoming', home_score: f.team_h_score, away_score: f.team_a_score }));
    renderFixtures(formatted);
  } catch (e) { renderFixtures(MOCK_FIXTURES); }
}

async function fetchClassicStandings(id) {
  if (!id) { renderClassicStandings(MOCK_CLASSIC.standings.results); return; }
  try {
    const res = await fetch(`${BASE}/leagues-classic/${id}/standings/`);
    const data = await res.json();
    renderClassicStandings(data.standings.results);
  } catch (e) { renderClassicStandings(MOCK_CLASSIC.standings.results); }
}

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
      <thead><tr><th>#</th><th>Manager</th><th>Wallet</th><th>GW Pts</th><th>Total</th></tr></thead>
      <tbody>${results.map(r => `<tr><td>${r.rank}</td><td>${r.entry_name}</td><td>${r.player_name}</td><td>${r.event_total}</td><td><strong>${r.total}</strong></td></tr>`).join('')}</tbody>
    </table>
  `;
}

function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  event.target.classList.add('active');
  if (tab === 'classic') fetchClassicStandings(CHAMPIONSHIP_CONFIG.leagueIds.classic);
  if (tab === 'h2h') renderClassicStandings(MOCK_CLASSIC.standings.results);
  if (tab === 'cup') document.getElementById('standings-table').innerHTML = `<div style="text-align:center; padding:20px; color:#94a3b8;">Cup activates GW17</div>`;
}

function startCountdown(deadlineISO) {
  const interval = setInterval(() => {
    const diff = new Date(deadlineISO) - new Date();
    if (diff <= 0) { document.getElementById('countdown').textContent = 'PASSED'; clearInterval(interval); return; }
    const d = Math.floor(diff / 86400000); const h = Math.floor((diff % 86400000) / 3600000); const m = Math.floor((diff % 3600000) / 60000); const s = Math.floor((diff % 60000) / 1000);
    document.getElementById('countdown').textContent = `${d}d ${h}h ${m}m ${s}s`;
  }, 1000);
}

function initWalletButton() {
  const btn = document.getElementById('wallet-btn');
  const pill = document.getElementById('wallet-pill');
  const fplInput = document.getElementById('fpl-id-input');

  btn.addEventListener('click', async () => {
    if (typeof window.MeshSDK === 'undefined') { alert('MeshJS failed to load.'); return; }
    try {
      const wallet = await window.MeshSDK.BrowserWallet.enable('eternl');
      const address = await wallet.getChangeAddress();
      const truncated = `${address.slice(0, 7)}...${address.slice(-4)}`;
      btn.style.display = 'none';
      pill.textContent = `🟢 ${truncated}`;
      pill.style.display = 'block';
      fplInput.disabled = false;
      fplInput.placeholder = "Enter FPL Team ID...";
      document.querySelector('.input-note').textContent = "Wallet connected. Enter ID to load dossier.";
      fplInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') fetchManagerDossier(fplInput.value); });
    } catch (e) { alert('Wallet connection failed.'); }
  });
}

async function fetchManagerDossier(id) {
  try {
    const profile = await (await fetch(`${BASE}/entry/${id}/`)).json();
    const history = await (await fetch(`${BASE}/entry/${id}/history/`)).json();
    renderDossier(profile, history);
  } catch (e) { renderDossier(MOCK_MANAGER, MOCK_MANAGER.history); }
}

function renderDossier(profile, history) {
  const card = document.getElementById('dossier-card');
  const last4 = history.current.slice(-4);
  const maxPts = Math.max(...last4.map(g => g.points), 50);
  document.getElementById('dossier-content').innerHTML = `
    <div style="margin-bottom: 15px;"><strong style="font-size: 1.1rem; color:#155cb4;">${profile.entry_name || profile.name}</strong><div style="font-size: 0.8rem; color:#64748b;">Global Rank: ${profile.summary_overall_rank}</div></div>
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
