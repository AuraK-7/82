async function startFunGame() {
  if (DATA_READY) { await DATA_READY; }
  _funMode = true;
  showScreen('screen-game');

  // 初始化 game 状态（跟经典模式一样）
  game = {
    round: 0,
    roster: [],
    slots: { PG: null, SG: null, SF: null, PF: null, C: null },
    usedDecades: [],
    usedCombos: [],
    skipTeam: 0,
    skipDecade: 0,
    currentTeam: null,
    currentDecade: null,
    spun: false,
    skipPending: null
  };
  pendingPick = null;
  moveState = null;

  // Update header
  document.getElementById('gameHeaderText').textContent = '💪 冲击82胜';

  // 显示阵容栏（跟经典模式一致）
  document.getElementById('rosterBar').style.display = '';
  document.getElementById('selectionHint').style.display = '';
  // 隐藏经典模式的轮次/老虎机/跳过按钮
  document.getElementById('roundLabel').style.display = 'none';
  document.getElementById('roundDesc').style.display = 'none';
  document.querySelector('.slot-controls').style.marginTop = '0';
  document.querySelector('.slot-controls-row').style.marginTop = '0';
  document.querySelector('.slot-machine').style.display = 'none';
  document.getElementById('spinBtn').style.display = 'none';
  document.getElementById('skipTeamBtn').style.display = 'none';
  document.getElementById('skipDecadeBtn').style.display = 'none';
  document.getElementById('filterTabsRow').style.display = 'none';

  // 显示自选控件 + 球员区
  document.getElementById('funControls').style.display = '';
  document.getElementById('funResultsArea').style.display = 'none';
  document.getElementById('funSimRow').style.display = 'none';
  document.getElementById('funSearchRow').style.display = 'none';
  document.getElementById('playerSection').style.display = 'none';

  // Reset dropdowns
  populateFunDropdowns();
  document.getElementById('funTeamSelect').value = '';
  document.getElementById('funDecadeSelect').value = '';
  document.getElementById('funTeamSelect').disabled = false;
  document.getElementById('funDecadeSelect').disabled = false;

  renderRosterBar();
  updateFunHeader();
  document.getElementById('playerHint').textContent = '选择球队和年代，然后点击球员加入阵容';
}

function onFunTeamChange() {
  var teamVal = document.getElementById('funTeamSelect').value;
  var decadeVal = document.getElementById('funDecadeSelect').value;
  if (teamVal) {
    populateFunDecadeSelect(teamVal);
    if (decadeVal && NBA_DATA[decadeVal] && NBA_DATA[decadeVal][teamVal]) {
      document.getElementById('funDecadeSelect').value = decadeVal;
    }
  } else {
    populateFunDecadeSelect('');
  }
  autoQueryFun();
}

function onFunDecadeChange() {
  var decadeVal = document.getElementById('funDecadeSelect').value;
  var teamVal = document.getElementById('funTeamSelect').value;
  if (decadeVal) {
    populateFunTeamSelect(decadeVal);
    if (teamVal && NBA_DATA[decadeVal] && NBA_DATA[decadeVal][teamVal]) {
      document.getElementById('funTeamSelect').value = teamVal;
    }
  } else {
    populateFunTeamSelect('');
  }
  autoQueryFun();
}

function autoQueryFun() {
  var teamVal = document.getElementById('funTeamSelect').value;
  var decadeVal = document.getElementById('funDecadeSelect').value;
  if (teamVal && decadeVal) {
    game.currentTeam = teamVal;
    game.currentDecade = decadeVal;
    renderFunPlayerGrid(teamVal, decadeVal);
    document.getElementById('playerSection').style.display = '';
  } else {
    document.getElementById('funResultsArea').style.display = 'none';
  }
}

/** 自选模式专用渲染：数据+评分，按评分降序，显示所有人 */
function renderFunPlayerGrid(team, decade) {
  var grid = document.getElementById('playerGrid');
  var bench = ERA_BENCHMARKS[decade] || ERA_BENCHMARKS['2020s'];
  var players = NBA_DATA[decade] ? (NBA_DATA[decade][team] || []) : [];
  var draftedNames = game.roster.map(function(r) { return r.name; });

  // 过滤已选，计算评分
  var rated = [];
  players.forEach(function(p) {
    if (draftedNames.includes(p.name)) return;
    var positionsArr = p.positions && p.positions.length > 0 ? p.positions : [p.pos || 'SF'];
    var slotObj = {
      name: p.name, pos: p.pos, positions: positionsArr,
      team: team, decade: decade,
      pts: p.stats.pts, reb: p.stats.reb, ast: p.stats.ast,
      stl: p.stats.stl ?? 0, blk: p.stats.blk ?? 0
    };
    var rating = playerRating(slotObj);
    rated.push({
      name: p.name, pos: p.pos, positions: positionsArr,
      pts: p.stats.pts, reb: p.stats.reb, ast: p.stats.ast,
      stl: p.stats.stl ?? 0, blk: p.stats.blk ?? 0,
      rating: rating
    });
  });

  // 按评分降序
  rated.sort(function(a, b) { return b.rating - a.rating; });

  if (rated.length === 0) {
    grid.innerHTML = '<div class="no-players"><div class="icon">😅</div><p>该球队在此年代没有可用球员</p></div>';
    document.getElementById('playerHint').textContent = '该球队在此年代没有可用球员';
    return;
  }

  document.getElementById('playerHint').textContent = '点击球员加入阵容 · 按评分降序';
  grid.innerHTML = '<div class="fun-player-list">' + rated.map(function(p) {
    var posDataAttr = encodeURIComponent(JSON.stringify(p.positions));
    var stlDisp = (p.stl != null && p.stl > 0) ? p.stl.toFixed(1) : '--';
    var blkDisp = (p.blk != null && p.blk > 0) ? p.blk.toFixed(1) : '--';
    var rc = p.rating >= 90 ? 'rating-s' : p.rating >= 85 ? 'rating-a' : p.rating >= 75 ? 'rating-b' : '';
    return '<div class="fun-player-card" data-positions=\'' + posDataAttr + '\' onclick="selectPlayer(this, \'' + p.name.replace(/'/g, "\\'") + '\', \'' + (p.pos || 'SF') + '\', ' + p.pts + ', ' + p.reb + ', ' + p.ast + ', ' + (p.stl ?? 0) + ', ' + (p.blk ?? 0) + ')">' +
      '<div class="fun-pc-name">' + p.name + '</div>' +
      '<div class="fun-pc-stats">' +
        '<span>PTS ' + p.pts.toFixed(1) + '</span>' +
        '<span>REB ' + p.reb.toFixed(1) + '</span>' +
        '<span>AST ' + p.ast.toFixed(1) + '</span>' +
      '</div>' +
      '<div class="fun-pc-rating ' + rc + '">' + p.rating + '</div>' +
    '</div>';
  }).join('') + '</div>';
}

// ===================================================================
//  GAME INIT
// ===================================================================
async function startGame() {
  // Ensure data is loaded
  if (DATA_READY) {
    await DATA_READY;
  }
  _funMode = false;
  _funSearchQuery = '';
  game = {
    round: 0,
    roster: [],
    slots: { PG: null, SG: null, SF: null, PF: null, C: null },
    usedDecades: [],
    usedCombos: [],
    skipTeam: 1,
    skipDecade: 1,
    currentTeam: null,
    currentDecade: null,
    spun: false,
    skipPending: null,
  };
  pendingPick = null;
  moveState = null;
  showScreen('screen-game');

  // Ensure classic mode UI is visible
  document.getElementById('gameHeaderText').textContent = '82-0 完美赛季大挑战';
  // Restore slot control margins
  document.querySelector('.slot-controls').style.marginTop = '';
  document.querySelector('.slot-controls-row').style.marginTop = '';
  document.getElementById('rosterBar').style.display = '';
  document.getElementById('roundLabel').style.display = '';
  document.getElementById('selectionHint').style.display = '';
  document.querySelector('.slot-machine').style.display = '';
  document.getElementById('spinBtn').style.display = '';
  document.getElementById('skipTeamBtn').style.display = '';
  document.getElementById('skipDecadeBtn').style.display = '';
  document.getElementById('filterTabsRow').style.display = '';
  // Hide fun-specific UI
  document.getElementById('funControls').style.display = 'none';
  document.getElementById('funResultsArea').style.display = 'none';
  document.getElementById('funSearchRow').style.display = 'none';

  renderRosterBar();
  nextRound();
}

// ===================================================================
//  POSITION SLOTS
// ===================================================================
const POS_ORDER = ['PG','SG','SF','C','PF'];

function getPositions(posStr) {
  if (!posStr) return [];
  return posStr.split('/').map(p => p.trim()).filter(p => POS_ORDER.includes(p));
}

function getEmptyPositions(posStr) {
  return getPositions(posStr).filter(p => !game.slots[p]);
}

function getFullPositions(posStr) {
  return getPositions(posStr).filter(p => game.slots[p]);
}

function renderRosterBar() {
  const bar = document.getElementById('rosterBar');
  // Top row: PG, SG | Bottom row: SF, C, PF
  const topRow = ['PG','SG'];
  const bottomRow = ['SF','C','PF'];
  
  function renderSlot(pos) {
    const p = game.slots[pos];
    const filled = !!p;
    let extraCls = '';
    
    // Check if this slot should be highlighted (pendingPick or moveState)
    const isHighlightTarget = (!filled && pendingPick && pendingPick.positions.includes(pos)) ||
                              (!filled && moveState && moveState.targetPositions.includes(pos));
    const isMoveSource = (filled && moveState && moveState.currentPos === pos);
    if (isHighlightTarget) extraCls += ' highlight';
    if (isMoveSource) extraCls += ' move-source';
    if (isHighlightTarget || isMoveSource) extraCls += ' clickable';
    
    const cls = (filled ? 'pos-slot filled' : 'pos-slot') + extraCls;
    
    if (p) {
      const colors = TEAM_COLORS[p.team] || ['#333','#555'];
      const mainColor = colors[0];
      const color2 = colors[1] || mainColor;
      const style = `background:linear-gradient(135deg, ${mainColor}, ${color2});border-color:${mainColor};box-shadow:0 0 12px ${mainColor}66;`;
      return `<div class="${cls}" style="${style}" data-pos="${pos}"
                onclick="onFilledSlotClick('${pos}')">
        <span class="slot-player-name">${p.name.split('-').pop()}</span>
        <span class="slot-team-decade">${teamCN(p.team)} · ${p.decade}</span>
      </div>`;
    } else {
      return `<div class="${cls}" data-pos="${pos}"
                onclick="onEmptySlotClick('${pos}')">
        <span class="pos-label">${pos}</span>
      </div>`;
    }
  }
  
  let html = '<div class="pos-slots">';
  html += '<div class="pos-slots-row">';
  topRow.forEach(pos => { html += renderSlot(pos); });
  html += '</div>';
  html += '<div class="pos-slots-row">';
  bottomRow.forEach(pos => { html += renderSlot(pos); });
  html += '</div>';
  html += '</div>';
  
  bar.innerHTML = html;
  updateSkipBadges();
}

/** 自选模式：根据已选球员实时计算预估评分 */
function updateFunHeader() {
  var header = document.getElementById('gameHeaderText');
  if (!header) return;
  var slotted = ['PG','SG','SF','PF','C']
    .map(function(pos) { return game.slots[pos]; })
    .filter(Boolean);
  if (slotted.length === 0) {
    header.innerHTML = '<span style="font-size:0.78rem;">💪 自选 · 选择你的5名球员</span>';
    return;
  }
  var ratings = slotted.map(function(p) { return playerRating(p); });
  var product = ratings.reduce(function(a, b) { return a * b; }, 1);
  var geoMean = Math.pow(product, 1 / ratings.length);
  var teamOvr = Math.round(geoMean * 1.1 * 10) / 10;
  var wins = Math.round(82 * Math.pow(Math.min(teamOvr / 110, 1), 2.2));
  if (wins === 64) wins = 65; else if (wins === 18) wins = 17; else if (wins === 54) wins = 55;
  header.innerHTML = '<span style="font-size:0.78rem;">💪 自选 · 预估 <b style="color:var(--gold);">' + teamOvr + '</b> 分 ≈ <b style="color:var(--gold);">' + wins + '</b> 胜 (' + slotted.length + '/5)</span>';
}



// ===================================================================
//  ROUND PROGRESSION
// ===================================================================
function nextRound() {
  if (game.round >= MAX_ROUNDS) {
    runSimulation();
    return;
  }
  game.spun = false;
  game.currentTeam = null;
  game.currentDecade = null;

  document.getElementById('roundLabel').textContent = `第 ${game.round + 1} / ${MAX_ROUNDS} 轮`;
  document.getElementById('roundDesc').textContent = '';
  document.getElementById('roundDesc').style.display = 'none';
  document.getElementById('spinBtn').disabled = false;
  document.getElementById('spinBtn').textContent = '🎰  随机';
  document.getElementById('skipTeamBtn').disabled = true;
  document.getElementById('skipDecadeBtn').disabled = true;
  document.getElementById('playerSection').style.display = 'none';

  // Reset reel display
  document.getElementById('teamReelText').textContent = '???';
  document.getElementById('decadeReelText').textContent = '???';
  document.getElementById('teamReel').classList.remove('spinning');
  document.getElementById('decadeReel').classList.remove('spinning');

  renderRosterBar();
}

// ===================================================================
//  SLOT MACHINE
// ===================================================================
function spinSlot() {
  if (game.spun) return;
  const spinBtn = document.getElementById('spinBtn');
  spinBtn.disabled = true;
  spinBtn.textContent = '🎰 转动中...';

  const teamReel = document.getElementById('teamReel');
  const decadeReel = document.getElementById('decadeReel');
  const teamText = document.getElementById('teamReelText');
  const decadeText = document.getElementById('decadeReelText');

  teamReel.classList.add('spinning');
  decadeReel.classList.add('spinning');

  const allDecades = Object.keys(NBA_DATA).filter(d => d !== '1950s');

  let spinCount = 0;
  const spinInterval = setInterval(() => {
    // Pick a random decade first, then a team that EXISTS in that decade
    const randDecade = allDecades[Math.floor(Math.random() * allDecades.length)];
    const decadeTeams = Object.keys(NBA_DATA[randDecade] || {});
    const randTeam = decadeTeams[Math.floor(Math.random() * decadeTeams.length)];
    teamText.textContent = teamCN(randTeam);
    decadeText.textContent = randDecade;
    spinCount++;
    if (spinCount > 20) {
      clearInterval(spinInterval);
      // Final result
      const result = getSlotResult();
      game.currentTeam = result.team;
      game.currentDecade = result.decade;
      game.usedCombos.push(result.decade + '|' + result.team);

      teamText.textContent = teamCN(result.team);
      decadeText.textContent = result.decade;
      teamReel.classList.remove('spinning');
      decadeReel.classList.remove('spinning');
      teamReel.style.borderColor = 'var(--success)';
      decadeReel.style.borderColor = 'var(--success)';

      game.spun = true;
      spinBtn.textContent = '✓ 锁定';
      document.getElementById('roundDesc').textContent =
        `球队: ${teamCN(result.team)}     年代: ${result.decade}`;

      // Enable skips
      document.getElementById('skipTeamBtn').disabled = game.skipTeam <= 0;
      document.getElementById('skipDecadeBtn').disabled = game.skipDecade <= 0;

      // Wait a beat for spin to settle, then show players
      setTimeout(() => showPlayers(result.team, result.decade), 1000);
    }
  }, 80);
}

function getSlotResult() {
  // Collect all possible (decade, team) combos, excluding 1950s and already used ones
  const usedSet = new Set(game.usedCombos || []);
  const allCombos = [];
  for (const decade of Object.keys(NBA_DATA).filter(d => d !== '1950s')) {
    for (const team of Object.keys(NBA_DATA[decade])) {
      if (!usedSet.has(decade + '|' + team)) {
        allCombos.push({ team, decade });
      }
    }
  }
  // If all combos used (unlikely), pick any non-1950s combo
  if (allCombos.length === 0) {
    const decades = Object.keys(NBA_DATA).filter(d => d !== '1950s');
    const d = decades[0];
    const t = Object.keys(NBA_DATA[d])[0];
    return { team: t, decade: d };
  }
  return allCombos[Math.floor(Math.random() * allCombos.length)];
}

// ===================================================================
//  SKIP MECHANICS
// ===================================================================
function confirmSkip(type) {
  // If a draft confirmation is showing, clear it first
  if (pendingPick) {
    document.querySelectorAll('.player-card.selected,.fun-player-card.selected').forEach(c => c.classList.remove('selected'));
    pendingPick = null;
  }
  const modal = document.getElementById('skipModal');
  document.getElementById('skipModalTitle').textContent = type === 'team' ? '⏭️ 跳过球队？' : '⏭️ 跳过年代？';
  document.getElementById('skipModalDesc').textContent =
    type === 'team'
      ? '将在同一年代重新随机一支球队。剩余 ' + game.skipTeam + ' 次球队跳过。'
      : '将重新随机年代和球队。剩余 ' + game.skipDecade + ' 次年代跳过。';
  modal.style.display = 'flex';
  game.skipPending = type;
  document.getElementById('skipConfirmBtn').textContent = '是的，跳过';
  document.getElementById('skipConfirmBtn').onclick = executeSkip;
}

function directSkip(type) {
  game.skipPending = type;
  executeSkip();
}

function closeSkipModal() {
  document.getElementById('skipModal').style.display = 'none';
  // Only cleanup when cancelling, not when executeSkip calls it
  if (arguments.length === 0) {
    if (game.skipPending) {
      game.skipPending = null;
    } else {
      clearPending();
    }
  }
}

function executeSkip() {
  const type = game.skipPending;
  if (!type) return;
  // Hide modal without side effects
  closeSkipModal(true);
  game.skipPending = null;

  // Disable skip buttons during animation
  document.getElementById('skipTeamBtn').disabled = true;
  document.getElementById('skipDecadeBtn').disabled = true;
  document.getElementById('spinBtn').disabled = true;

  const teamReel = document.getElementById('teamReel');
  const decadeReel = document.getElementById('decadeReel');
  const teamText = document.getElementById('teamReelText');
  const decadeText = document.getElementById('decadeReelText');

  if (type === 'team' && game.skipTeam > 0) {
    game.skipTeam--;
    // Keep same decade, change team (avoid already-used combos)
    const decadeTeams = getTeams(game.currentDecade);
    const usedSet = new Set(game.usedCombos || []);
    const otherTeams = decadeTeams.filter(t => !usedSet.has(game.currentDecade + '|' + t));
    const finalTeam = otherTeams.length > 0
      ? otherTeams[Math.floor(Math.random() * otherTeams.length)]
      : decadeTeams.filter(t => t !== game.currentTeam)[Math.floor(Math.random() * (decadeTeams.length - 1))] || decadeTeams[0];

    teamReel.classList.add('spinning');
    let count = 0;
    const interval = setInterval(() => {
      teamText.textContent = teamCN(decadeTeams[Math.floor(Math.random() * decadeTeams.length)]);
      count++;
      if (count > 15) {
        clearInterval(interval);
        game.currentTeam = finalTeam;
        teamText.textContent = teamCN(finalTeam);
        teamReel.classList.remove('spinning');
        teamReel.style.borderColor = 'var(--success)';
        finishSkip();
      }
    }, 80);

  } else if (type === 'decade' && game.skipDecade > 0) {
    game.skipDecade--;
    // Keep same team, change to a different decade where this team exists (avoid already-used combos)
    const teamName = game.currentTeam;
    const teamDecades = Object.keys(NBA_DATA).filter(d =>
      d !== '1950s' && NBA_DATA[d] && NBA_DATA[d][teamName]
    );
    const usedSet = new Set(game.usedCombos || []);
    const otherDecades = teamDecades.filter(d => !usedSet.has(d + '|' + teamName));
    if (otherDecades.length === 0) { finishSkip(); return; }
    const finalDecade = otherDecades[Math.floor(Math.random() * otherDecades.length)];

    // Only animate the decade reel — team stays the same
    decadeReel.classList.add('spinning');
    let count = 0;
    const interval = setInterval(() => {
      const rd = teamDecades[Math.floor(Math.random() * teamDecades.length)];
      decadeText.textContent = rd;
      count++;
      if (count > 15) {
        clearInterval(interval);
        game.currentDecade = finalDecade;
        decadeText.textContent = finalDecade;
        decadeReel.classList.remove('spinning');
        teamReel.style.borderColor = 'var(--success)';
        decadeReel.style.borderColor = 'var(--success)';
        finishSkip();
      }
    }, 80);

  } else {
    closeSkipModal(true);
    return;
  }

  function finishSkip() {
    game.usedCombos.push(game.currentDecade + '|' + game.currentTeam);
    updateSkipBadges();
    document.getElementById('skipTeamBtn').disabled = game.skipTeam <= 0;
    document.getElementById('skipDecadeBtn').disabled = game.skipDecade <= 0;
    document.getElementById('roundDesc').textContent =
      `${teamCN(game.currentTeam)} · ${game.currentDecade} (已跳过)`;
    showPlayers(game.currentTeam, game.currentDecade);
  }
}

function updateSkipBadges() {
  document.getElementById('skipTeamCount').textContent = `${game.skipTeam}次`;
  document.getElementById('skipDecadeCount').textContent = `${game.skipDecade}次`;
}

// ===================================================================
//  PLAYER SELECTION
// ===================================================================
var _topPool = [];

function renderPlayerGrid(team, decade) {
  const grid = document.getElementById('playerGrid');

  // On first render (tab === 'all'), build the top-20 pool
  if (_filterTab === 'all') {
    const players = NBA_DATA[decade] ? (NBA_DATA[decade][team] || []) : [];
    const draftedNames = game.roster.map(r => r.name);
    let all = players.filter(p => !draftedNames.includes(p.name));
    // Sort by combined PTS+REB+AST, take top 20
    all.sort((a, b) => (b.stats.pts + b.stats.reb + b.stats.ast) - (a.stats.pts + a.stats.reb + a.stats.ast));
    _topPool = all.slice(0, 20);
  }

  // G/F/C tabs filter from the top-20 pool
  let display = _filterTab === 'all' ? _topPool : _topPool.filter(p => {
    const posList = p.positions && p.positions.length > 0 ? p.positions : (p.pos ? p.pos.split('/') : []);
    if (_filterTab === 'g') return posList.some(pos => pos === 'PG' || pos === 'SG');
    if (_filterTab === 'f') return posList.some(pos => pos === 'SF' || pos === 'PF');
    if (_filterTab === 'c') return posList.some(pos => pos === 'C');
    return false;
  });

  if (display.length === 0) {
    grid.innerHTML = `<div class="no-players">
      <div class="icon">😅</div>
      <p>该位置没有可用球员。</p>
    </div>`;
    document.getElementById('playerHint').textContent = '该位置没有可用球员';
    return;
  }

  // Shuffle for display
  display = [...display].sort(() => Math.random() - 0.5);

  document.getElementById('playerHint').textContent = '点击球员加入阵容';
  grid.innerHTML = display.map(p => {
    const posDisplay = p.pos || '??';
    const positionsArr = p.positions && p.positions.length > 0 ? p.positions : [posDisplay];
    const posBadges = positionsArr.map(pos => `<span class="pos-badge">${pos}</span>`).join('');
    const posDataAttr = encodeURIComponent(JSON.stringify(positionsArr));
    return `<div class="player-card" data-positions='${posDataAttr}' onclick="selectPlayer(this, '${p.name.replace(/'/g, "\\'")}', '${posDisplay}', ${p.stats.pts}, ${p.stats.reb}, ${p.stats.ast}, ${p.stats.stl ?? 0}, ${p.stats.blk ?? 0})">
      <div class="player-name">${p.name}</div>
      <div class="player-positions">${posBadges}</div>
      <div class="player-team">${teamCN(team)} · ${decade}</div>
    </div>`;
  }).join('');
}

function showPlayers(team, decade) {
  const section = document.getElementById('playerSection');
  section.style.display = 'block';
  // Reset filter tab to all
  _filterTab = 'all';
  document.querySelectorAll('.filter-tab').forEach(el => {
    el.classList.toggle('active', el.dataset.tab === 'all');
  });
  renderPlayerGrid(team, decade);
}

// ===================================================================
//  SELECT PLAYER
// ===================================================================
var pendingPick = null;
var moveState = null;

function clearPending() {
  pendingPick = null;
  moveState = null;
  document.querySelectorAll('.player-card.selected,.fun-player-card.selected').forEach(c => c.classList.remove('selected'));
  renderRosterBar();
  const hint = document.getElementById('playerHint');
  if (hint) hint.textContent = '点击球员加入阵容';
}

function selectPlayer(el, name, pos, pts, reb, ast, stl, blk) {
  // If there's a pending pick or move, cancel it
  if (pendingPick || moveState) { clearPending(); }
  
  document.querySelectorAll('.player-card,.fun-player-card').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');

  // Get eligible positions from data attribute
  let positions;
  try { positions = JSON.parse(decodeURIComponent(el.dataset.positions)); } catch(e) { positions = null; }
  if (!positions || positions.length === 0) positions = getPositions(pos);

  // Find which eligible positions are empty
  const emptyEligible = positions.filter(p => !game.slots[p]);

  if (emptyEligible.length === 0) {
    el.classList.remove('selected');
    document.getElementById('playerHint').textContent = `⚠️ ${name} 的可选位置 (${positions.join('/')}) 已满！`;
    return;
  }

  // Highlight empty eligible slots for the user to click
  pendingPick = { name, pos, pts, reb, ast, stl, blk, positions, team: game.currentTeam, decade: game.currentDecade };
  const posNames = emptyEligible.join('/');
  document.getElementById('playerHint').textContent = `点击上方闪烁的方框将 ${name} 放入 (${posNames})`;
  renderRosterBar();
}

function onEmptySlotClick(pos) {
  if (pendingPick && pendingPick.positions.includes(pos)) {
    // Place the player here
    confirmDraftWith({ ...pendingPick, assignedPos: pos });
    return;
  }
  if (moveState && moveState.targetPositions.includes(pos)) {
    // Move the player here
    const player = moveState.player;
    game.slots[pos] = player;
    game.slots[moveState.currentPos] = null;
    player.assignedPos = pos;
    moveState = null;
    renderRosterBar();
    document.getElementById('playerHint').textContent = `已移动 ${player.name} 到 ${pos}`;
    return;
  }
  // Clicked a non-highlighted slot — cancel
  clearPending();
}

function onFilledSlotClick(pos) {
  const player = game.slots[pos];
  if (!player) return;
  
  // If there's a pending pick, cancel it
  if (pendingPick) { clearPending(); return; }
  
  // If already in move mode and clicking the source, cancel
  if (moveState) {
    if (moveState.currentPos === pos) { clearPending(); return; }
    // Clicking a different filled slot — start new move
  }
  
  // Find other eligible empty positions for this player
  const playerPositions = player.positions || getPositions(player.pos);
  const emptyEligible = playerPositions.filter(p => p !== pos && !game.slots[p]);
  
  if (emptyEligible.length === 0) return; // nowhere to move
  
  moveState = { player, currentPos: pos, targetPositions: emptyEligible };
  document.getElementById('playerHint').textContent = `点击闪烁的方框移动 ${player.name.split('-').pop()}`;
  renderRosterBar();
}

function confirmDraftWith(pick) {
  const { name, pos, pts, reb, ast, stl, blk, assignedPos } = pick;
  pendingPick = null;
  moveState = null;

  document.querySelectorAll('.player-card.selected,.fun-player-card.selected').forEach(c => c.classList.remove('selected'));
  document.getElementById('skipModal').style.display = 'none';

  // Place in the assigned position slot
  const playerPositions = pick.positions || getPositions(pos);
  var selTeam = pick.team || game.currentTeam;
  var selDecade = pick.decade || game.currentDecade;
  game.slots[assignedPos] = { name, pos, positions: playerPositions, assignedPos, team: selTeam, decade: selDecade, pts, reb, ast, stl, blk };
  game.roster.push(game.slots[assignedPos]);
  game.usedDecades.push(game.currentDecade);
  game.round++;

  renderRosterBar();

  // 自选模式：实时更新预估评分
  if (_funMode) updateFunHeader();

  // Hide player section (自选模式保持可见)
  if (!_funMode) {
    document.getElementById('playerSection').style.display = 'none';
  }
  document.getElementById('spinBtn').disabled = true;
  document.getElementById('skipTeamBtn').disabled = true;
  document.getElementById('skipDecadeBtn').disabled = true;
  document.getElementById('playerHint').textContent = `✓ ${name} → ${assignedPos} 已选入！`;

  setTimeout(() => {
    if (_funMode) {
      // 自选模式：选满 5 人才显示模拟按钮
      if (game.round >= MAX_ROUNDS) {
        document.getElementById('playerHint').textContent = '✅ 5名球员已就绪！点击下方按钮开始模拟';
        document.getElementById('playerSection').style.display = 'none';
        document.getElementById('funSimRow').style.display = '';
      } else {
        document.getElementById('playerHint').textContent = '✓ ' + name + ' → ' + assignedPos + ' 已选入！还需 ' + (MAX_ROUNDS - game.round) + ' 人';
        document.getElementById('playerSection').style.display = '';
      }
      document.getElementById('teamReel').style.borderColor = '';
      document.getElementById('decadeReel').style.borderColor = '';
    } else if (game.round >= MAX_ROUNDS) {
      runSimulation();
    } else {
      document.getElementById('teamReel').style.borderColor = 'var(--gold)';
      document.getElementById('decadeReel').style.borderColor = 'var(--gold)';
      nextRound();
    }
  }, 800);
}

// ===================================================================
//  SIMULATION ENGINE (HoopIQ mode — geometric mean of positional ratings)
// ===================================================================

/** Check if a value is a non-null number. */
function isNum(v) {
  return typeof v === 'number' && !Number.isNaN(v);
}

/** Steals/blocks adjustment for rosters with null defensive data. */
function adjustDefensive(roster) {
  const scale = (vals) =>
    vals.reduce((a, b) => a + b, 0) * (vals.length > 0 ? 5 / vals.length : 1);
  const stls = roster.filter(p => isNum(p.stl) && p.stl > 0).map(p => p.stl);
  const blks = roster.filter(p => isNum(p.blk) && p.blk > 0).map(p => p.blk);
  return { stl: scale(stls), blk: scale(blks) };
}

/**
 * Individual player rating on a 0–100 scale using positional weighting
 * against era benchmarks.
 */
function playerRating(p) {
  const bench = ERA_BENCHMARKS[p.decade] || ERA_BENCHMARKS["2020s"];
  const baseKey = p.positions?.[0] || p.pos || "SF";
  const weights = { ...(POSITION_WEIGHTS[baseKey] || POSITION_WEIGHTS.SF) };

  // Older eras lack steals/blocks — redistribute that weight to categories we have
  const missing = ['stl', 'blk'].filter(k => !isNum(p[k]));
  if (missing.length > 0) {
    const kept = STAT_KEYS.filter(k => !missing.includes(k))
      .reduce((sum, k) => sum + weights[k], 0);
    const scale = kept > 0 ? 1 / kept : 1;
    ['pts','reb','ast'].forEach(k => { weights[k] *= scale; });
    missing.forEach(k => { weights[k] = 0; });
  }

  let n = 0;
  STAT_KEYS.forEach(k => {
    const v = p[k];
    if (isNum(v)) {
      let ratio = v / bench[k];
      if (ratio > 1) ratio = Math.pow(ratio, 1.25);
      n += weights[k] * ratio;
    }
  });

  const base = 60 + 40 * n;
  const posCount = p.positions?.length || 1;
  const versatility = (posCount - 1) * 3;
  const intangibles = INTANGIBLES.has((p.player ?? p.name ?? '').toLowerCase()) ? 2.5 : 0;

  return Math.min(100, Math.round((base + versatility + intangibles) * 10) / 10);
}

function runSimulation() {
  showScreen('screen-result');

  // Calculate player ratings using positional HoopIQ method
  const roster = ['PG','SG','SF','PF','C']
    .map(pos => game.slots[pos])
    .filter(Boolean);

  if (roster.length === 0) {
    document.getElementById('finalRecord').textContent = '0-82';
    document.getElementById('resultGrade').textContent = 'F';
    document.getElementById('resultGrade').style.color = '#ef4444';
    document.getElementById('resultTier').textContent = '摆烂大军';
    document.getElementById('resultTier').style.color = '#ef4444';
    return;
  }

  // Geometric mean of positional player ratings × 1.1
  const ratings = roster.map(p => playerRating(p));
  const product = ratings.reduce((a, b) => a * b, 1);
  const geoMean = Math.pow(product, 1 / ratings.length);
  const teamOvr = Math.round(geoMean * 1.1 * 10) / 10;

  // Win curve: wins = round(82 · min(rating / 110, 1) ^ 2.2)
  let wins = Math.round(82 * Math.pow(Math.min(teamOvr / 110, 1), 2.2));
  let losses = 82 - wins;

  // 特殊规则修正
  if (wins === 64 && losses === 18) { wins = 65; losses = 17; }
  else if (wins === 18 && losses === 64) { wins = 17; losses = 65; }
  if (wins === 54) { wins = 55; losses = 27; }
  else if (losses === 54) { wins = 27; losses = 55; }

  // Display results
  const record = document.getElementById('finalRecord');
  record.textContent = `${wins}-${losses}`;

  // Grade & tier based on wins (from TEAM_GRADE_BANDS)
  const band = TEAM_GRADE_BANDS.find(b => wins >= b.min) || TEAM_GRADE_BANDS[TEAM_GRADE_BANDS.length - 1];
  const grade = band.grade;
  const tier = band.label;
  const tierColor = band.color;

  if (wins >= 80) launchConfetti();

  // Save for poster generation
  game._posterGrade = grade;
  game._posterTier = tier;
  game._posterTierColor = tierColor;

  document.getElementById('resultGrade').textContent = grade;
  document.getElementById('resultGrade').style.color = tierColor;
  document.getElementById('resultTier').textContent = tier;
  document.getElementById('resultTier').style.color = tierColor;

  // Roster final — 2-3 slot layout with team colors
  const rosterDiv = document.getElementById('rosterFinal');
  const topRow = ['PG','SG'];
  const bottomRow = ['SF','C','PF'];

  function renderFinalSlot(pos) {
    const p = game.slots[pos];
    if (!p) return '';
    const colors = TEAM_COLORS[p.team] || ['#333','#555'];
    const mainColor = colors[0];
    const color2 = colors[1] || mainColor;
    const style = `background:linear-gradient(135deg, ${mainColor}, ${color2});border-color:${mainColor};box-shadow:0 0 12px ${mainColor}66;`;
    return `<div class="pos-slot filled" style="${style}">
      <span class="slot-player-name">${p.name.split('-').pop()}</span>
      <span class="slot-team-decade">${teamCN(p.team)} · ${p.decade}</span>
    </div>`;
  }

  let html = '<div class="pos-slots">';
  html += '<div class="pos-slots-row">';
  topRow.forEach(pos => { html += renderFinalSlot(pos); });
  html += '</div>';
  html += '<div class="pos-slots-row">';
  bottomRow.forEach(pos => { html += renderFinalSlot(pos); });
  html += '</div>';
  html += '</div>';
  rosterDiv.innerHTML = html;
}

// ===================================================================
//  CONFETTI
// ===================================================================
function launchConfetti() {
  const container = document.createElement('div');
  container.className = 'confetti-container';
  document.body.appendChild(container);

  const colors = ['#f39c12','#e74c3c','#27ae60','#3498db','#9b59b6','#f1c40f','#e67e22','#1abc9c'];
  const shapes = ['\u25A0','\u25CF','\u25B2','\u2605'];

  for (let i = 0; i < 150; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.textContent = shapes[Math.floor(Math.random() * shapes.length)];
    piece.style.left = Math.random() * 100 + '%';
    piece.style.color = colors[Math.floor(Math.random() * colors.length)];
    piece.style.fontSize = (Math.random() * 12 + 8) + 'px';
    piece.style.animationDuration = (Math.random() * 2 + 2) + 's';
    piece.style.animationDelay = (Math.random() * 2) + 's';
    container.appendChild(piece);
  }

  setTimeout(() => container.remove(), 5000);
}

// ===================================================================
//  TEST — 自动选取数据最好的5名球员直接模拟
// ===================================================================
function testBestPlayers() {
  // Reset game state
  game = {
    round: 0,
    roster: [],
    slots: { PG: null, SG: null, SF: null, PF: null, C: null },
    usedDecades: [],
    usedCombos: [],
    skipTeam: 1,
    skipDecade: 1,
    currentTeam: null,
    currentDecade: null,
    spun: false,
    skipPending: null,
  };

  // Collect all players across all decades & teams
  const allPlayers = [];
  for (const [decade, teams] of Object.entries(NBA_DATA)) {
    for (const [team, players] of Object.entries(teams)) {
      players.forEach(p => {
        allPlayers.push({
          name: p.name,
          pos: p.pos,
          positions: p.positions,
          pts: p.stats.pts,
          reb: p.stats.reb,
          ast: p.stats.ast,
          stl: p.stats.stl,
          blk: p.stats.blk,
          team,
          decade,
          total: p.stats.pts + p.stats.reb + p.stats.ast
        });
      });
    }
  }

  // Sort by combined PTS+REB+AST descending, take top 5
  allPlayers.sort((a, b) => b.total - a.total);
  const top5 = allPlayers.slice(0, 5);

  // Assign to position slots
  const posSlots = ['PG', 'SG', 'SF', 'PF', 'C'];
  top5.forEach((p, i) => {
    const pos = posSlots[i];
    game.slots[pos] = {
      name: p.name,
      pos: p.pos,
      positions: p.positions,
      assignedPos: pos,
      team: p.team,
      decade: p.decade,
      pts: p.pts,
      reb: p.reb,
      ast: p.ast,
      stl: p.stl,
      blk: p.blk
    };
    game.roster.push(game.slots[pos]);
    game.usedDecades.push(p.decade);
  });
  game.round = MAX_ROUNDS;

  // Force 82-0 result directly (skip random simulation)
  showScreen('screen-result');

  // Show roster on result screen — 2-3 slot layout with team colors
  const rosterDiv = document.getElementById('rosterFinal');
  const posOrder = ['PG','SG','SF','PF','C'];
  const topRow = ['PG','SG'];
  const bottomRow = ['SF','C','PF'];

  function renderFinalSlot(pos) {
    const p = game.slots[pos];
    if (!p) return '';
    const colors = TEAM_COLORS[p.team] || ['#333','#555'];
    const mainColor = colors[0];
    const color2 = colors[1] || mainColor;
    const style = `background:linear-gradient(135deg, ${mainColor}, ${color2});border-color:${mainColor};box-shadow:0 0 12px ${mainColor}66;`;
    return `<div class="pos-slot filled" style="${style}">
      <span class="slot-player-name">${p.name.split('-').pop()}</span>
      <span class="slot-team-decade">${teamCN(p.team)} · ${p.decade}</span>
    </div>`;
  }

  let html = '<div class="pos-slots">';
  html += '<div class="pos-slots-row">';
  topRow.forEach(pos => { html += renderFinalSlot(pos); });
  html += '</div>';
  html += '<div class="pos-slots-row">';
  bottomRow.forEach(pos => { html += renderFinalSlot(pos); });
  html += '</div>';
  html += '</div>';
  rosterDiv.innerHTML = html;

  const record = document.getElementById('finalRecord');
  game._posterGrade = 'S+';
  game._posterTier = '终极答案';
  game._posterTierColor = '#f1c40f';

  record.textContent = '82-0';
  document.getElementById('resultGrade').textContent = 'S+';
  document.getElementById('resultGrade').style.color = '#f1c40f';
  document.getElementById('resultTier').textContent = '终极答案';
  document.getElementById('resultTier').style.color = '#f1c40f';
  document.getElementById('thresholdNote').style.display = 'none';
  document.querySelector('.sim-bar-container').style.display = 'none';
  launchConfetti();
}

// ===================================================================
//  SAFE NAVIGATE & POSTER
// ===================================================================
function safeNavigate(url, target, eventName) {
  // Standalone mode — direct navigation
  if (url.startsWith('huputiyu://')) {
    // Hupu app deep link — open in new tab as fallback
    console.log('[Standalone] Deep link ignored:', url);
    return;
  }
  try {
    if (target === '_self') { window.location.href = url; }
    else { window.open(url, target || '_blank'); }
  } catch(e) {
    window.location.href = url;
  }
}
