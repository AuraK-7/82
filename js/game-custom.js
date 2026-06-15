function buildCustomAllPlayers() {
  if (_customAllPlayers) return _customAllPlayers;
  const list = [];
  for (const [decade, teams] of Object.entries(NBA_DATA)) {
    for (const [team, players] of Object.entries(teams)) {
      players.forEach(p => {
        const positions = p.positions && p.positions.length > 0 ? p.positions : (p.pos ? p.pos.split('/').filter(x => POS_ORDER.includes(x.trim())) : ['SF']);
        const slotObj = { name: p.name, pos: p.pos, positions: positions, team: team, decade: decade, pts: p.stats.pts, reb: p.stats.reb, ast: p.stats.ast, stl: p.stats.stl, blk: p.stats.blk };
        const rating = playerRating(slotObj);
        list.push({ name: p.name, pos: p.pos, positions: positions, team: team, decade: decade, pts: p.stats.pts, reb: p.stats.reb, ast: p.stats.ast, stl: p.stats.stl, blk: p.stats.blk, rating: rating, total: p.stats.pts + p.stats.reb + p.stats.ast, key: p.name + '|' + team + '|' + decade });
      });
    }
  }
  list.sort((a, b) => b.rating - a.rating);
  _customAllPlayers = list;
  return list;
}

/** Get eligible players for the active position */
function getEligibleForActive() {
  const all = buildCustomAllPlayers();
  const pos = _customActivePos;
  let eligible = all.filter(p => p.positions.includes(pos));
  if (_customDecadeFilter !== 'all') eligible = eligible.filter(p => p.decade === _customDecadeFilter);
  if (_customSearchQuery) eligible = eligible.filter(p => p.name.toLowerCase().includes(_customSearchQuery.toLowerCase()));
  return eligible;
}

/** Get list of already-picked player keys */
function getPickedKeys(excludePos) {
  const keys = new Set();
  ['PG','SG','SF','PF','C'].forEach(pos => {
    if (pos === excludePos) return;
    const p = _customPicks[pos];
    if (p) keys.add(playerKey(p));
  });
  return keys;
}

function playerKey(p) { return p.name + '|' + p.team + '|' + p.decade; }

/** Format position badges: show max 3, then +N */
function fmtPositions(positions) {
  if (!positions || positions.length === 0) return '';
  if (positions.length <= 3) return positions.map(function(p) { return '<span class="pos-badge">' + p + '</span>'; }).join('');
  return positions.slice(0, 3).map(function(p) { return '<span class="pos-badge">' + p + '</span>'; }).join('') +
    '<span class="pos-badge" style="background:rgba(255,255,255,0.12);color:var(--text-muted);">+' + (positions.length - 3) + '</span>';
}

/** Set active position for browsing */
function setActivePosition(pos) {
  _customActivePos = pos;
  renderRosterCards();
  renderActivePosBadge();
  renderDecadePills();
  renderTopRecs();
  renderPlayerList();
  document.getElementById('customSearchBar').value = '';
  _customSearchQuery = '';
  updateCustomPageHint();
}

/** Render all 5 position cards in the left roster */
function renderRosterCards() {
  ['PG','SG','SF','PF','C'].forEach(pos => {
    const card = document.getElementById('posCard' + pos);
    if (!card) return;
    const pick = _customPicks[pos];
    const isActive = pos === _customActivePos;

    // Skip unchanged cards
    var prevKey = card._prevKey || '';
    var currKey = (pick ? playerKey(pick) : '') + '|' + isActive;
    if (prevKey === currKey) return;
    card._prevKey = currKey;

    // Clear classes
    card.classList.remove('active-slot', 'filled-slot');

    if (pick) {
      card.classList.add('filled-slot');
      const colors = TEAM_COLORS[pick.team] || ['#333','#555'];
      card.style.borderColor = colors[0];
      card.style.background = `linear-gradient(135deg, ${colors[0]}22, ${(colors[1]||colors[0])}11)`;
      card.style.boxShadow = `0 0 14px ${colors[0]}44`;
      card.innerHTML = `
        <button class="clear-slot-btn" onclick="event.stopPropagation();clearPositionSlot('${pos}')">✕</button>
        <div class="pos-badge ${pos}">${pos}</div>
        <div class="slot-player-name-card">${pick.name.split('-').pop()}</div>
        <div class="slot-player-meta">${teamCN(pick.team)} · ${pick.decade}</div>
        <div class="slot-player-rating">⭐ ${pick.rating}</div>
      `;
    } else {
      card.style.borderColor = '';
      card.style.background = '';
      card.style.boxShadow = '';
      card.innerHTML = `
        <div class="pos-badge ${pos}">${pos}</div>
        <span class="slot-status">点击选择</span>
        <button class="clear-slot-btn" onclick="event.stopPropagation();clearPositionSlot('${pos}')">✕</button>
      `;
    }

    if (isActive) card.classList.add('active-slot');
  });

  // Update roster count
  const filled = ['PG','SG','SF','PF','C'].filter(p => _customPicks[p] !== null).length;
  const label = document.getElementById('rosterCountLabel');
  if (label) label.textContent = `已选 ${filled}/5`;
}

/** Update active position badge in browser header */
function renderActivePosBadge() {
  const badge = document.getElementById('activePosBadge');
  if (!badge) return;
  badge.textContent = _customActivePos;
  badge.className = 'active-pos-indicator ' + _customActivePos;
}

/** Render decade filter pills */
function renderDecadePills() {
  const container = document.getElementById('customDecadeTabs');
  if (!container) return;
  const decades = ALL_DECADES.filter(function(d) { return buildCustomAllPlayers().some(function(p) { return p.decade === d; }); });
  let html = `<span class="decade-pill${_customDecadeFilter === 'all' ? ' active' : ''}" onclick="setDecadePill('all')">全部</span>`;
  decades.forEach(d => {
    html += `<span class="decade-pill${_customDecadeFilter === d ? ' active' : ''}" onclick="setDecadePill('${d}')">${d}</span>`;
  });
  container.innerHTML = html;
}

function setDecadePill(decade) {
  _customDecadeFilter = decade;
  _customSearchQuery = '';
  document.getElementById('customSearchBar').value = '';
  renderDecadePills();
  renderTopRecs();
  renderPlayerList();
}

/** Handle search */
var _searchTimer = null;
function onCustomSearch() {
  clearTimeout(_searchTimer);
  _searchTimer = setTimeout(function() {
    _customSearchQuery = (document.getElementById('customSearchBar').value || '').trim().toLowerCase();
    renderTopRecs();
    renderPlayerList();
  }, 200);
}

function renderPlayerList() {
  const container = document.getElementById('playerListScroll');
  const empty = document.getElementById('playerListEmpty');
  if (!container) return;
  const eligible = getEligibleForActive();
  const pickedKeys = getPickedKeys(_customActivePos);
  if (eligible.length === 0) {
    container.innerHTML = '';
    if (empty) empty.style.display = 'block';
    return;
  }
  if (empty) empty.style.display = 'none';
  // Show top 3 as highlighted first, then rest
  const top3 = eligible.filter(p => !pickedKeys.has(playerKey(p))).slice(0, 3);
  const topKeys = new Set(top3.map(p => playerKey(p)));
  container.innerHTML = eligible.map(p => {
    const key = playerKey(p);
    const isPicked = pickedKeys.has(key);
    const isTop = topKeys.has(key);
    const colors = TEAM_COLORS[p.team] || ['#333','#555'];
    const rating = p.rating;
    return `<div class="player-card${isPicked ? ' picked-row' : ''}" onclick="${isPicked ? '' : "pickPlayerForActive('" + key.replace(/'/g, "\\'") + "')"}"
      style="${isTop ? 'border-color:var(--gold-light);background:rgba(243,156,18,0.06);' : ''}">
      <div class="player-name">${p.name}</div>
      <div class="player-team" style="min-width:100px;">${teamCN(p.team)} · ${p.decade}</div>
      <div class="player-stats">
        <span class="stat-pill"><span class="stat-label">PTS</span> ${p.pts}</span>
        <span class="stat-pill"><span class="stat-label">REB</span> ${p.reb}</span>
        <span class="stat-pill"><span class="stat-label">AST</span> ${p.ast}</span>
        <span class="stat-pill" style="background:rgba(241,196,15,0.12);color:#f1c40f;">⭐${rating}</span>
      </div>
    </div>`;
  }).join('');
}

// renderTopRecs kept as no-op for backward compat
function renderTopRecs() {}
/** Pick a player for the active position */
function pickPlayerForActive(key) {
  const all = buildCustomAllPlayers();
  const found = all.find(p => playerKey(p) === key);
  if (!found) return;

  // Check if already picked in another position
  const conflictPos = ['PG','SG','SF','PF','C'].find(p => p !== _customActivePos && _customPicks[p] && playerKey(_customPicks[p]) === key);
  if (conflictPos) {
    document.getElementById('customHint').textContent = `⚠️ ${found.name} 已在 ${conflictPos} 位置被选中`;
    return;
  }

  _customPicks[_customActivePos] = found;
  renderRosterCards();
  renderTopRecs();
  renderPlayerList();
  updateTeamPreview();
  updateCustomSimButton();
  document.getElementById('customHint').textContent = getCustomHintText();

  // Auto-advance to next empty position (lightweight)
  var nextPos = null;
  for (var i = 0; i < 5; i++) { if (!_customPicks[['PG','SG','SF','PF','C'][i]]) { nextPos = ['PG','SG','SF','PF','C'][i]; break; } }
  if (nextPos) {
    setTimeout(function() {
      _customActivePos = nextPos;
      renderRosterCards();
      renderActivePosBadge();
      renderPlayerList();
      document.getElementById('customSearchBar').value = '';
      _customSearchQuery = '';
      updateCustomPageHint();
    }, 200);
  }
}

/** Clear a position slot */
function clearPositionSlot(pos) {
  _customPicks[pos] = null;
  setActivePosition(pos);
  updateTeamPreview();
  updateCustomSimButton();
  document.getElementById('customHint').textContent = getCustomHintText();
}

/** Update team preview stats in bottom bar */
function updateTeamPreview() {
  const picks = ['PG','SG','SF','PF','C'].map(p => _customPicks[p]).filter(Boolean);
  const ratingEl = document.getElementById('tpRating');
  const winsEl = document.getElementById('tpWins');
  const gradeEl = document.getElementById('tpGrade');

  if (picks.length === 0) {
    if (ratingEl) ratingEl.textContent = '--';
    if (winsEl) { winsEl.textContent = '--'; winsEl.className = 'tp-wins'; }
    if (gradeEl) gradeEl.textContent = '--';
    return;
  }

  // Reuse precomputed ratings from buildCustomAllPlayers
  const ratings = picks.map(function(p) { return p.rating; });
  const product = ratings.reduce((a, b) => a * b, 1);
  const geoMean = Math.pow(product, 1 / ratings.length);

  if (picks.length < 5) {
    // Partial roster: pad with average of selected
    const avgRating = ratings.reduce((a, b) => a + b, 0) / ratings.length;
    const paddedRatings = [...ratings];
    while (paddedRatings.length < 5) paddedRatings.push(avgRating);
    const paddedProduct = paddedRatings.reduce((a, b) => a * b, 1);
    const paddedGeoMean = Math.pow(paddedProduct, 1 / 5);
    const teamOvr = Math.round(paddedGeoMean * 1.1 * 10) / 10;
    let wins = Math.round(82 * Math.pow(Math.min(teamOvr / 110, 1), 2.2));
    // Special rules
    if (wins === 64) wins = 65;
    else if (wins === 18) wins = 17;
    if (wins === 54) wins = 55;
    else if (wins === 27) { wins = 27; /* keep */ }

    const band = TEAM_GRADE_BANDS.find(b => wins >= b.min) || TEAM_GRADE_BANDS[TEAM_GRADE_BANDS.length - 1];
    if (ratingEl) ratingEl.textContent = teamOvr;
    if (winsEl) {
      winsEl.textContent = `${wins}-${82 - wins}`;
      winsEl.className = 'tp-wins ' + (wins >= 80 ? 'perfect' : wins >= 62 ? 'good' : wins >= 40 ? 'ok' : 'bad');
    }
    if (gradeEl) { gradeEl.textContent = band.grade; gradeEl.style.color = band.color; }
    // Mark as estimated
    if (ratingEl) ratingEl.textContent = '≈' + teamOvr;
  } else {
    const teamOvr = Math.round(geoMean * 1.1 * 10) / 10;
    let wins = Math.round(82 * Math.pow(Math.min(teamOvr / 110, 1), 2.2));
    if (wins === 64 && (82-wins) === 18) wins = 65;
    else if (wins === 18 && (82-wins) === 64) wins = 17;
    if (wins === 54) wins = 55;
    const losses = 82 - wins;

    const band = TEAM_GRADE_BANDS.find(b => wins >= b.min) || TEAM_GRADE_BANDS[TEAM_GRADE_BANDS.length - 1];
    if (ratingEl) ratingEl.textContent = teamOvr;
    if (winsEl) {
      winsEl.textContent = `${wins}-${losses}`;
      winsEl.className = 'tp-wins ' + (wins >= 80 ? 'perfect' : wins >= 62 ? 'good' : wins >= 40 ? 'ok' : 'bad');
    }
    if (gradeEl) { gradeEl.textContent = band.grade; gradeEl.style.color = band.color; }
  }
}

/** Hint text */
function getCustomHintText() {
  const filled = ['PG','SG','SF','PF','C'].filter(pos => _customPicks[pos] !== null).length;
  if (filled === 5) return '✅ 阵容已完整！点击「开始模拟」查看战绩';
  if (filled === 0) return '👆 点击左侧位置卡片开始选择';
  return `已选 ${filled}/5 名球员 · 继续点击左侧空位选择`;
}

function updateCustomPageHint() {
  document.getElementById('customPageHint').textContent = `当前选中: ${_customActivePos} 位 · 点击右侧球员卡片即可填入`;
}

/** Update sim button */
function updateCustomSimButton() {
  const allFilled = ['PG','SG','SF','PF','C'].every(pos => _customPicks[pos] !== null);
  document.getElementById('customSimBtn').disabled = !allFilled;
  const rf = document.getElementById('randomFillBtn');
  if (rf) rf.disabled = allFilled;
}

/** Random fill remaining empty positions */
function randomFillRemaining() {
  const all = buildCustomAllPlayers();
  const emptyPositions = ['PG','SG','SF','PF','C'].filter(pos => !_customPicks[pos]);
  if (emptyPositions.length === 0) {
    document.getElementById('customHint').textContent = '阵容已满，无需随机填充';
    return;
  }

  emptyPositions.forEach(pos => {
    const pickedKeys = getPickedKeys(pos);
    const eligible = all.filter(p => p.positions.includes(pos) && !pickedKeys.has(playerKey(p)));
    if (eligible.length > 0) {
      // Pick from top 10 randomly for variety
      const pool = eligible.slice(0, Math.min(10, eligible.length));
      _customPicks[pos] = pool[Math.floor(Math.random() * pool.length)];
    }
  });

  // Set active to first empty (should be none now)
  const nextEmpty = ['PG','SG','SF','PF','C'].find(p => !_customPicks[p]);
  if (nextEmpty) {
    setActivePosition(nextEmpty);
  } else {
    // All filled
    _customActivePos = 'PG';
    renderRosterCards();
    renderActivePosBadge();
    renderDecadePills();
    renderTopRecs();
    renderPlayerList();
  }
  updateTeamPreview();
  updateCustomSimButton();
  document.getElementById('customHint').textContent = getCustomHintText();
}

/** Reset all picks */
function resetAllPicks() {
  _customPicks = { PG: null, SG: null, SF: null, PF: null, C: null };
  _customActivePos = 'PG';
  _customDecadeFilter = 'all';
  _customSearchQuery = '';
  document.getElementById('customSearchBar').value = '';
  setActivePosition('PG');
  updateTeamPreview();
  updateCustomSimButton();
  document.getElementById('customHint').textContent = '阵容已重置 · 点击左侧位置卡片开始选择';
}

/** Enter custom roster mode */
function enterCustomMode() {
  console.log("自选阵容已启用");
  _customAllPlayers = null;
  _customPicks = { PG: null, SG: null, SF: null, PF: null, C: null };
  _customActivePos = 'PG';
  _customDecadeFilter = 'all';
  _customSearchQuery = '';

  showScreen('screen-custom');
  renderRosterCards();
  renderActivePosBadge();
  renderDecadePills();
  renderTopRecs();
  renderPlayerList();
  updateTeamPreview();
  updateCustomSimButton();
  document.getElementById('customSearchBar').value = '';
  document.getElementById('customHint').textContent = '👆 点击左侧位置卡片开始选择';
  document.getElementById('customPageHint').textContent = '当前选中: PG 位 · 点击右侧球员卡片即可填入';
}

/** Toggle removed — custom mode is now standalone */

/** Run simulation with custom picks */
function runCustomSimulation() {
  const allFilled = ['PG','SG','SF','PF','C'].every(pos => _customPicks[pos] !== null);
  if (!allFilled) {
    document.getElementById('customHint').textContent = '⚠️ 请先为所有5个位置选择球员';
    return;
  }

  game = {
    round: MAX_ROUNDS, roster: [],
    slots: { PG: null, SG: null, SF: null, PF: null, C: null },
    usedDecades: [], usedCombos: [],
    skipTeam: 0, skipDecade: 0,
    currentTeam: null, currentDecade: null,
    spun: false, skipPending: null,
  };

  ['PG','SG','SF','PF','C'].forEach(pos => {
    const pick = _customPicks[pos];
    if (!pick) return;
    game.slots[pos] = {
      name: pick.name, pos: pick.pos, positions: pick.positions,
      assignedPos: pos, team: pick.team, decade: pick.decade,
      pts: pick.pts, reb: pick.reb, ast: pick.ast,
      stl: pick.stl, blk: pick.blk
    };
    game.roster.push(game.slots[pos]);
    if (!game.usedDecades.includes(pick.decade)) game.usedDecades.push(pick.decade);
  });

  console.log("自选阵容模拟开始:", ['PG','SG','SF','PF','C'].map(pos => {
    const p = game.slots[pos];
    return p ? `${pos}:${p.name}(${p.decade})` : `${pos}:空`;
  }).join(', '));

  runSimulation();
}

// ===================================================================
//  SALARY CAP MODE — 工资帽模式
// ===================================================================
var _salaryMode = false;
var _salaryCap = 100; // $100M
var _salaryPicks = { PG: null, SG: null, SF: null, PF: null, C: null };
var _salaryActivePos = 'PG';
var _salaryDecadeFilter = 'all';
var _salarySearchQuery = '';

function getPlayerSalary(p) {
  const r = p.rating;
  if (r >= 90) return 45;
  if (r >= 85) return 35;
  if (r >= 80) return 25;
  if (r >= 75) return 18;
  if (r >= 70) return 12;
  return 6;
}

function getSalaryUsed() {
  return ['PG','SG','SF','PF','C'].reduce((sum, pos) => {
    const p = _salaryPicks[pos];
    return sum + (p ? getPlayerSalary(p) : 0);
  }, 0);
}

function getSalaryRemaining() {
  return _salaryCap - getSalaryUsed();
}

function enterSalaryCapMode() {
  console.log("工资帽模式已启用");
  _salaryMode = true;
  buildCustomAllPlayers();
  _salaryPicks = { PG: null, SG: null, SF: null, PF: null, C: null };
  _salaryActivePos = 'PG';
  _salaryDecadeFilter = 'all';
  _salarySearchQuery = '';

  showScreen('screen-custom');
  document.getElementById('customHeaderText').textContent = '💰 工资帽挑战';
  document.getElementById('customPageHint').textContent = `薪资上限: $${_salaryCap}M | 球员按评分定价`;
  // toggle removed

  renderSalaryRosterCards();
  renderActivePosBadgeForMode(_salaryActivePos);
  renderDecadePillsForMode('salary');
  renderSalaryTopRecs();
  renderSalaryPlayerList();
  updateSalaryBar();
  updateSalarySimButton();
  document.getElementById('customSearchBar').value = '';
  document.getElementById('customHint').textContent = '💰 注意工资帽！高评分球员薪资更高';
}

function renderSalaryRosterCards() {
  ['PG','SG','SF','PF','C'].forEach(pos => {
    const card = document.getElementById('posCard' + pos);
    if (!card) return;
    const pick = _salaryPicks[pos];
    const isActive = pos === _salaryActivePos;

    card.classList.remove('active-slot', 'filled-slot');
    if (pick) {
      card.classList.add('filled-slot');
      const colors = TEAM_COLORS[pick.team] || ['#333','#555'];
      card.style.borderColor = colors[0];
      card.style.background = `linear-gradient(135deg, ${colors[0]}22, ${(colors[1]||colors[0])}11)`;
      card.style.boxShadow = `0 0 14px ${colors[0]}44`;
      const salary = getPlayerSalary(pick);
      card.innerHTML = `<button class="clear-slot-btn" onclick="event.stopPropagation();clearSalarySlot('${pos}')">✕</button>
        <div class="pos-badge ${pos}">${pos}</div>
        <div class="slot-player-name-card">${pick.name.split('-').pop()}</div>
        <div class="slot-player-meta">${teamCN(pick.team)} · ${pick.decade}</div>
        <div class="slot-player-rating">💰$${salary}M ⭐${pick.rating}</div>`;
    } else {
      card.style.borderColor = '';
      card.style.background = '';
      card.style.boxShadow = '';
      card.innerHTML = `<div class="pos-badge ${pos}">${pos}</div>
        <span class="slot-status">点击选择</span>
        <button class="clear-slot-btn" onclick="event.stopPropagation();clearSalarySlot('${pos}')">✕</button>`;
    }
    if (isActive) card.classList.add('active-slot');
  });

  const filled = ['PG','SG','SF','PF','C'].filter(p => _salaryPicks[p] !== null).length;
  const label = document.getElementById('rosterCountLabel');
  if (label) label.textContent = `已选 ${filled}/5 | 薪资: $${getSalaryUsed()}M / $${_salaryCap}M`;
}

function updateSalaryBar() {
  const used = getSalaryUsed();
  const remaining = getSalaryRemaining();
  const over = remaining < 0;
  document.getElementById('customPageHint').textContent =
    `💰 薪资: $${used}M / $${_salaryCap}M | ${over ? '⚠️ 超帽!' : '剩余 $' + remaining + 'M'}`;
  const simBtn = document.getElementById('customSimBtn');
  if (simBtn && over) simBtn.disabled = true;
}

function updateSalarySimButton() {
  const allFilled = ['PG','SG','SF','PF','C'].every(pos => _salaryPicks[pos] !== null);
  const overBudget = getSalaryRemaining() < 0;
  document.getElementById('customSimBtn').disabled = !allFilled || overBudget;
  if (overBudget && allFilled) {
    document.getElementById('customHint').textContent = '⚠️ 薪资超帽！请更换低薪球员';
  }
}

function getSalaryEligible() {
  const all = buildCustomAllPlayers();
  const pos = _salaryActivePos;
  let eligible = all.filter(p => p.positions.includes(pos));
  if (_salaryDecadeFilter !== 'all') eligible = eligible.filter(p => p.decade === _salaryDecadeFilter);
  if (_salarySearchQuery) eligible = eligible.filter(p => p.name.toLowerCase().includes(_salarySearchQuery.toLowerCase()));
  return eligible;
}

function getSalaryPickedKeys(excludePos) {
  const keys = new Set();
  ['PG','SG','SF','PF','C'].forEach(pos => {
    if (pos === excludePos) return;
    const p = _salaryPicks[pos];
    if (p) keys.add(playerKey(p));
  });
  return keys;
}

function renderSalaryTopRecs() {
  const container = document.getElementById('topRecCards');
  if (!container) return;
  const eligible = getSalaryEligible();
  const pickedKeys = getSalaryPickedKeys(_salaryActivePos);
  const available = eligible.filter(p => !pickedKeys.has(playerKey(p)));
  const top3 = available.slice(0, 3);

  if (top3.length === 0) {
    container.innerHTML = '<div style="font-size:0.7rem;color:var(--text-muted);padding:8px;">暂无推荐球员</div>';
    return;
  }

  container.innerHTML = top3.map((p, i) => {
    const colors = TEAM_COLORS[p.team] || ['#333','#555'];
    const salary = getPlayerSalary(p);
    return `<div class="top-rec-card" onclick="pickSalaryPlayer('${playerKey(p).replace(/'/g, "\'")}')">
      <div class="rec-rank">#${i + 1}</div>
      <div class="rec-name">${p.name}</div>
      <div class="rec-meta"><span class="pos-color-dot" style="background:${colors[0]};display:inline-block;width:7px;height:7px;border-radius:50%;margin-right:3px;vertical-align:middle;"></span>${teamCN(p.team)} · ${p.decade}</div>
      <div class="rec-stats">
        <span class="rec-stat">PTS ${p.pts}</span>
        <span class="rec-stat">REB ${p.reb}</span>
        <span class="rec-stat">AST ${p.ast}</span>
      </div>
      <div class="rec-rating">💰$${salary}M ⭐${p.rating}</div>
    </div>`;
  }).join('');
}

function renderSalaryPlayerList() {
  const container = document.getElementById('playerListScroll');
  const empty = document.getElementById('playerListEmpty');
  if (!container) return;

  const eligible = getSalaryEligible();
  const pickedKeys = getSalaryPickedKeys(_salaryActivePos);

  if (eligible.length === 0) {
    container.innerHTML = '';
    if (empty) empty.style.display = 'block';
    return;
  }
  if (empty) empty.style.display = 'none';

  container.innerHTML = eligible.map(p => {
    const key = playerKey(p);
    const isPicked = pickedKeys.has(key);
    const salary = getPlayerSalary(p);
    const colors = TEAM_COLORS[p.team] || ['#333','#555'];
    return `<div class="player-list-row${isPicked ? ' picked-row' : ''}" onclick="${isPicked ? '' : "pickSalaryPlayer('" + key.replace(/'/g, "\'") + "')"}">
      <span class="pos-color-dot" style="background:${colors[0]};display:inline-block;width:7px;height:7px;border-radius:50%;flex-shrink:0;"></span>
      <span class="list-name">${p.name}</span>
      <span class="list-team-decade">${teamCN(p.team)} · ${p.decade}</span>
      <span class="list-stats">
        <span class="list-stat">PTS${p.pts}</span>
        <span class="list-stat">REB${p.reb}</span>
        <span class="list-stat">AST${p.ast}</span>
      </span>
      <span class="list-rating">💰${salary}M</span>
    </div>`;
  }).join('');
}

function pickSalaryPlayer(key) {
  const all = buildCustomAllPlayers();
  const found = all.find(p => playerKey(p) === key);
  if (!found) return;

  const conflictPos = ['PG','SG','SF','PF','C'].find(p => p !== _salaryActivePos && _salaryPicks[p] && playerKey(_salaryPicks[p]) === key);
  if (conflictPos) {
    document.getElementById('customHint').textContent = `⚠️ ${found.name} 已在 ${conflictPos} 位置`;
    return;
  }

  _salaryPicks[_salaryActivePos] = found;
  renderSalaryRosterCards();
  renderSalaryTopRecs();
  renderSalaryPlayerList();
  updateSalaryBar();
  updateSalarySimButton();
  document.getElementById('customHint').textContent = getSalaryHintText();

  const nextPos = ['PG','SG','SF','PF','C'].find(p => !_salaryPicks[p]);
  if (nextPos) {
    setTimeout(() => {
      _salaryActivePos = nextPos;
      renderSalaryRosterCards();
      renderActivePosBadgeForMode(_salaryActivePos);
      renderDecadePillsForMode('salary');
      renderSalaryTopRecs();
      renderSalaryPlayerList();
      document.getElementById('customSearchBar').value = '';
      _salarySearchQuery = '';
    }, 200);
  }
}

function clearSalarySlot(pos) {
  _salaryPicks[pos] = null;
  _salaryActivePos = pos;
  renderSalaryRosterCards();
  renderActivePosBadgeForMode(pos);
  renderDecadePillsForMode('salary');
  renderSalaryTopRecs();
  renderSalaryPlayerList();
  updateSalaryBar();
  updateSalarySimButton();
}

function getSalaryHintText() {
  const filled = ['PG','SG','SF','PF','C'].filter(pos => _salaryPicks[pos] !== null).length;
  const remaining = getSalaryRemaining();
  if (filled === 5 && remaining >= 0) return '✅ 阵容完整且薪资合规！点击开始模拟';
  if (remaining < 0) return `⚠️ 薪资超帽 $${Math.abs(remaining)}M！请调整`;
  if (filled === 0) return '💰 点击左侧位置卡片开始选择（注意工资帽）';
  return `已选 ${filled}/5 | 剩余薪资: $${remaining}M`;
}

function renderActivePosBadgeForMode(pos) {
  const badge = document.getElementById('activePosBadge');
  if (!badge) return;
  badge.textContent = pos;
  badge.className = 'active-pos-indicator ' + pos;
}

function renderDecadePillsForMode(mode) {
  const container = document.getElementById('customDecadeTabs');
  if (!container) return;
  const filterKey = mode === 'salary' ? '_salaryDecadeFilter' : '_challengeDecadeFilter';
  const filterVal = mode === 'salary' ? _salaryDecadeFilter : _challengeDecadeFilter;
  const decades = ALL_DECADES.filter(function(d) { return buildCustomAllPlayers().some(function(p) { return p.decade === d; }); });
  let html = `<span class="decade-pill${filterVal === 'all' ? ' active' : ''}" onclick="setModeDecadePill('${mode}','all')">全部</span>`;
  decades.forEach(d => {
    html += `<span class="decade-pill${filterVal === d ? ' active' : ''}" onclick="setModeDecadePill('${mode}','${d}')">${d}</span>`;
  });
  container.innerHTML = html;
}

function setModeDecadePill(mode, decade) {
  if (mode === 'salary') {
    _salaryDecadeFilter = decade;
    _salarySearchQuery = '';
    document.getElementById('customSearchBar').value = '';
    renderDecadePillsForMode('salary');
    renderSalaryTopRecs();
    renderSalaryPlayerList();
  } else {
    _challengeDecadeFilter = decade;
    _challengeSearchQuery = '';
    document.getElementById('customSearchBar').value = '';
    renderDecadePillsForMode('challenge');
    renderChallengeTopRecs();
    renderChallengePlayerList();
  }
}

function onModeSearch(mode) {
  const q = document.getElementById('customSearchBar').value || '';
  if (mode === 'salary') {
    _salarySearchQuery = q.trim().toLowerCase();
    renderSalaryTopRecs();
    renderSalaryPlayerList();
  }
}

function runSalarySimulation() {
  const allFilled = ['PG','SG','SF','PF','C'].every(pos => _salaryPicks[pos] !== null);
  if (!allFilled || getSalaryRemaining() < 0) {
    document.getElementById('customHint').textContent = '⚠️ 阵容不完整或薪资超帽';
    return;
  }

  game = {
    round: MAX_ROUNDS, roster: [],
    slots: { PG: null, SG: null, SF: null, PF: null, C: null },
    usedDecades: [], usedCombos: [],
    skipTeam: 0, skipDecade: 0,
    currentTeam: null, currentDecade: null,
    spun: false, skipPending: null,
  };

  ['PG','SG','SF','PF','C'].forEach(pos => {
    const pick = _salaryPicks[pos];
    if (!pick) return;
    game.slots[pos] = {
      name: pick.name, pos: pick.pos, positions: pick.positions,
      assignedPos: pos, team: pick.team, decade: pick.decade,
      pts: pick.pts, reb: pick.reb, ast: pick.ast,
      stl: pick.stl, blk: pick.blk
    };
    game.roster.push(game.slots[pos]);
    if (!game.usedDecades.includes(pick.decade)) game.usedDecades.push(pick.decade);
  });

  game._modeName = '工资帽模式';
  saveToHistory();
  runSimulation();
}

// Legacy challenge variables removed — see ChallengeEngine classes instead


//  ENGINEERING REFACTOR — shared simulation builder

// ===================================================================
//  CHALLENGE ENGINE — 问答挑战模式基类
// ===================================================================