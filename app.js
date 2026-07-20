// ============================================================
// HOSKY GM CHAMPIONSHIP — app.js
// ============================================================

const BASE = 'https://fantasy.premierleague.com/api';
let teamsMap = {};
let currentGW = 1;

// ============================================================
// FETCH — direct first, two fallback proxies if blocked
// ============================================================
async function fetchAPI(endpoint) {
  const url = BASE + endpoint;
  const proxies = [
    url,
    'https://corsproxy.io/?' + encodeURIComponent(url),
    'https://thingproxy.freeboard.io/fetch/' + url
  ];
  for (const attempt of proxies) {
    try {
      const res = await fetch(attempt);
      if (res.ok) {
        const data = await res.json();
        return data;
      }
    } catch (e) {
      continue;
    }
  }
  console.error('All fetch attempts failed for:', endpoint);
  return null;
}

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  initPrizes();
  initWallet();
  fetchBootstrap();
});

// ============================================================
// PRIZES (from config.js)
// ============================================================
function initPrizes() {
  const p = CHAMPIONSHIP_CONFIG.prizes;
  document.getElementById('prize-pool').textContent =
    p.totalPool ? p.totalPool + ' ADA' : 'TBD';

  document.getElementById('prize-list').innerHTML = `
    <div class="prize-row"><span>Total Pool</span><strong>${p.totalPool || 'TBD'}</strong></div>
    <div class="prize-row"><span>Classic League</span><strong>${p.classicLeague || 'TBD'}</strong></div>
    <div class="prize-row"><span>Head-to-Head</span><strong>${p.headToHead || 'TBD'}</strong></div>
    <div class="prize-row ${CHAMPIONSHIP_CONFIG.isCupActive ? '' : 'inactive'}">
      <span>Hosky Cup</span>
      <strong>${CHAMPIONSHIP_CONFIG.isCupActive ? (p.hoskyCup || 'TBD') : 'Inactive'}</strong>
    </div>
    <div class="prize-row"><span>Team of the Month</span><strong>${p.teamOfTheMonth || 'TBD'}</strong></div>
  `;
}

// ============================================================
// BOOTSTRAP — gameweek info + team name map
// ============================================================
async function fetchBootstrap() {
  setStatus('countdown', 'Loading...');
  setStatus('current-gw', '...');
  setStatus('manager-count', '...');

  const data = await fetchAPI('/bootstrap-static/');
  if (!data) {
    setStatus('countdown', 'Unavailable');
    setStatus('current-gw', '--');
    setStatus('manager-count', '--');
    setEl('fixtures-list', '<div class="empty-state">Unable to reach FPL API. Try refreshing.</div>');
    return;
  }

  // Build team ID → short name map
  data.teams.forEach(t => { teamsMap[t.id] = t.short_name; });

  // Find next or most recent gameweek
  const next = data.events.find(e => e.is_next);
  const current = data.events.find(e => e.is_current);
  const event = next || current || data.events[data.events.length - 1];
  currentGW = event.id;

  document.getElementById('current-gw').textContent = 'GW ' + currentGW;
  document.getElementById('manager-count').textContent =
    data.total_players ? (data.total_players / 1000000).toFixed(1) + 'M' : '--';

  startCountdown(event.deadline_time);
  fetchFixtures(currentGW);
  fetchClassicStandings(CHAMPIONSHIP_CONFIG.leagueIds.classic);
}

// ============================================================
// COUNTDOWN
// ============================================================
function startCountdown(iso) {
  const el = document.getElementById('countdown');
  const tick = () => {
    const diff = new Date(iso) - new Date();
    if (diff <= 0) { el.textContent = 'Deadline passed'; return; }
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    el.textContent = d + 'd ' + h + 'h ' + m + 'm ' + s + 's';
  };
  tick();
  setInterval(tick, 1000);
}

// ============================================================
// FIXTURES
// ============================================================
async function fetchFixtures(gw) {
  setEl('fixtures-list', '<div class="empty-state">Loading fixtures...</div>');
  const data = await fetchAPI('/fixtures/?event=' + gw);

  if (!data || data.length === 0) {
    setEl('fixtures-list', '<div class="empty-state">No fixtures released for this gameweek yet.</div>');
    return;
  }

  const html = data.map(f => {
    const home = teamsMap[f.team_h] || 'TBC';
    const away = teamsMap[f.team_a] || 'TBC';
    const isLive = f.started && !f.finished_provisional;
    const kickoff = f.kickoff_time
      ? new Date(f.kickoff_time).toLocaleString('en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit' })
      : 'TBC';

    const center = isLive
      ? `<span class="live-badge">● LIVE</span><span class="score">${f.team_h_score} - ${f.team_a_score}</span>`
      : `<span class="kickoff">${kickoff}</span>`;

    return `
      <div class="fixture-item ${isLive ? 'live' : ''}">
        <span class="fixture-team">${home}</span>
        <div class="fixture-center">${center}</div>
        <span class="fixture-team fixture-right">${away}</span>
      </div>`;
  }).join('');

  setEl('fixtures-list', html);
}

// ============================================================
// CLASSIC STANDINGS
// ============================================================
async function fetchClassicStandings(id) {
  if (!id) {
    setEl('standings-body', '<div class="empty-state">No classic league ID set in config.js</div>');
    return;
  }

  setEl('standings-body', '<div class="empty-state">Loading standings...</div>');
  const data = await fetchAPI('/leagues-classic/' + id + '/standings/');

  if (!data || !data.standings || !data.standings.results.length) {
    setEl('standings-body', '<div class="empty-state">No standings found for league ' + id + '</div>');
    return;
  }

  // Show league name
  if (data.league && data.league.name) {
    const nameEl = document.getElementById('league-name');
    if (nameEl) nameEl.textContent = data.league.name;
  }

  const rows = data.standings.results.map(r => `
    <tr>
      <td class="rank">${r.rank}</td>
      <td class="manager">${r.player_name}</td>
      <td class="team-name">${r.entry_name}</td>
      <td class="gw-pts">${r.event_total || 0}</td>
      <td class="total"><strong>${r.total || 0}</strong></td>
    </tr>
  `).join('');

  setEl('standings-body', `
    <div class="standings-header">
      <span id="league-name">${data.league ? data.league.name : 'Classic League'}</span>
      <span class="season-tag">2024/25 Final</span>
    </div>
    <table class="standings-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Manager</th>
          <th>Team</th>
          <th>GW</th>
          <th>Total</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `);
}

// ============================================================
// H2H STANDINGS
// ============================================================
async function fetchH2HStandings(id) {
  if (!id) {
    setEl('standings-body', '<div class="empty-state">H2H league ID not yet set. Will appear when new season opens.</div>');
    return;
  }
  setEl('standings-body', '<div class="empty-state">Loading H2H standings...</div>');
  const data = await fetchAPI('/leagues-h2h/' + id + '/standings/');
  if (!data || !data.standings || !data.standings.results.length) {
    setEl('standings-body', '<div class="empty-state">No H2H standings found.</div>');
    return;
  }
  const rows = data.standings.results.map(r => `
    <tr>
      <td class="rank">${r.rank}</td>
      <td class="manager">${r.player_name}</td>
      <td class="team-name">${r.entry_name}</td>
      <td>${r.matches_won}W ${r.matches_drawn}D ${r.matches_lost}L</td>
      <td class="total"><strong>${r.points_for || 0}</strong></td>
    </tr>
  `).join('');
  setEl('standings-body', `
    <table class="standings-table">
      <thead><tr><th>#</th><th>Manager</th><th>Team</th><th>Record</th><th>Pts For</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `);
}

// ============================================================
// CUP
// ============================================================
async function fetchCup(id) {
  if (!CHAMPIONSHIP_CONFIG.isCupActive) {
    setEl('standings-body', `
      <div class="cup-inactive">
        <div class="cup-icon">🏆</div>
        <div class="cup-title">Hosky Cup</div>
        <div class="cup-sub">The FPL Cup activates at Gameweek 17.<br>Last season's cup data shown below once available.</div>
      </div>
    `);
    return;
  }
  const data = await fetchAPI('/league/' + id + '/cup-status/');
  if (!data) {
    setEl('standings-body', '<div class="empty-state">Cup data unavailable.</div>');
    return;
  }
  setEl('standings-body', '<div class="empty-state">Cup bracket coming soon.</div>');
}

// ============================================================
// TABS
// ============================================================
function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  event.target.classList.add('active');
  if (tab === 'classic') fetchClassicStandings(CHAMPIONSHIP_CONFIG.leagueIds.classic);
  if (tab === 'h2h') fetchH2HStandings(CHAMPIONSHIP_CONFIG.leagueIds.h2h);
  if (tab === 'cup') fetchCup(CHAMPIONSHIP_CONFIG.leagueIds.classic);
}

// ============================================================
// WALLET — MeshJS via CDN
// ============================================================
function initWallet() {
  const btn = document.getElementById('wallet-btn');
  btn.addEventListener('click', connectWallet);
}

async function connectWallet() {
  const btn = document.getElementById('wallet-btn');
  btn.textContent = 'Connecting...';
  btn.disabled = true;

  // Wait up to 5 seconds for MeshJS to load
  let mesh = null;
  for (let i = 0; i < 10; i++) {
    if (window.Mesh) { mesh = window.Mesh; break; }
    if (window.mesh) { mesh = window.mesh; break; }
    if (window.MeshSDK) { mesh = window.MeshSDK; break; }
    await new Promise(r => setTimeout(r, 500));
  }

  if (!mesh || !mesh.BrowserWallet) {
    btn.textContent = 'Connect Wallet';
    btn.disabled = false;
    alert('No Cardano wallet detected. Please install Eternl, Nami, or Vespr and refresh the page.');
    return;
  }

  try {
    const wallets = await mesh.BrowserWallet.getInstalledWallets();
    if (!wallets || wallets.length === 0) {
      throw new Error('No wallets installed');
    }

    // Use first available wallet
    const wallet = await mesh.BrowserWallet.enable(wallets[0].name);
    const addresses = await wallet.getRewardAddresses();
    const stake = addresses[0];
    const short = stake.slice(0, 10) + '...' + stake.slice(-4);

    // Update UI
    btn.style.display = 'none';
    const pill = document.getElementById('wallet-pill');
    pill.textContent = '🟢 ' + short;
    pill.style.display = 'block';

    // Enable FPL linking
    document.getElementById('link-card').style.display = 'block';
    const input = document.getElementById('fpl-id-input');
    input.disabled = false;
    input.placeholder = 'Enter your FPL Team ID...';
    document.querySelector('.input-note').textContent = 'Wallet connected. Enter your FPL Team ID and press Enter.';
    input.addEventListener('keypress', e => {
      if (e.key === 'Enter' && input.value.trim()) {
        fetchManagerDossier(input.value.trim());
      }
    });

  } catch (e) {
    btn.textContent = 'Connect Wallet';
    btn.disabled = false;
    if (e.message === 'No wallets installed') {
      alert('No Cardano wallet found. Please install Eternl, Nami, or Vespr.');
    } else {
      alert('Connection cancelled or failed. Please try again.');
    }
  }
}

// ============================================================
// MANAGER DOSSIER
// ============================================================
async function fetchManagerDossier(id) {
  setEl('dossier-content', '<div class="empty-state">Loading your data...</div>');
  document.getElementById('dossier-card').style.display = 'block';

  const [profile, history] = await Promise.all([
    fetchAPI('/entry/' + id + '/'),
    fetchAPI('/entry/' + id + '/history/')
  ]);

  if (!profile) {
    setEl('dossier-content', '<div class="empty-state">Manager not found. Check your FPL Team ID.</div>');
    return;
  }

  const last4 = (history && history.current) ? history.current.slice(-4) : [];
  const maxPts = last4.length ? Math.max(...last4.map(g => g.points)) : 100;

  const bars = last4.map(gw => `
    <div class="bar-wrap">
      <div class="bar-val">${gw.points}</div>
      <div class="bar" style="height:${Math.round((gw.points / maxPts) * 100)}%"></div>
      <div class="bar-lbl">GW${gw.event}</div>
    </div>
  `).join('');

  setEl('dossier-content', `
    <div class="dossier-name">${profile.entry_name || 'Unknown Team'}</div>
    <div class="dossier-manager">${profile.player_first_name || ''} ${profile.player_last_name || ''}</div>
    <div class="dossier-stats">
      <div class="dossier-stat"><span>Global Rank</span><strong>${(profile.summary_overall_rank || 0).toLocaleString()}</strong></div>
      <div class="dossier-stat"><span>Bank</span><strong>£${((profile.last_deadline_bank || 0) / 10).toFixed(1)}m</strong></div>
      <div class="dossier-stat"><span>Transfers</span><strong>${profile.last_deadline_total_transfers || 0}</strong></div>
      <div class="dossier-stat"><span>Active Chips</span><strong>${(profile.active_chips || []).length}</strong></div>
    </div>
    ${last4.length ? `<div class="chart-container">${bars}</div>` : ''}
  `);
}

// ============================================================
// HELPERS
// ============================================================
function setEl(id, html) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html;
}

function setStatus(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}
