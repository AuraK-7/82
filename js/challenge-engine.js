class ChallengeEngine {
  constructor(config) {
    this.name = config.name;
    this.modeKey = config.modeKey;
    this.penaltyWins = config.penalty || 5;
    this.posOrder = ['PG','SG','SF','PF','C'];
    this.currentRound = 0;
    this.picks = {};
    this.mistakes = 0;
    this.setupData = config.setupData || {};
    this.allPlayers = buildCustomAllPlayers();
  }

  /** Generate 8 options for a position: 1 correct + 7 distractors */
  generateOptions(pos) {
    const correctPool = this.getCorrectPool(pos);
    if (correctPool.length === 0) return [];
    const correct = correctPool[Math.floor(Math.random() * correctPool.length)];

    const distractors = this.getDistractors(pos, correct);
    const options = [correct, ...distractors];
    // Shuffle
    for (let i = options.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [options[i], options[j]] = [options[j], options[i]];
    }
    return options;
  }

  /** Override in subclass */
  getCorrectPool(pos) { return []; }
  getDistractors(pos, correct) { return []; }

  /** Check if a pick is correct */
  isCorrect(pos, player) { return true; }

  /** Handle player selection */
  handlePick(pos, playerKey) {
    const player = this.allPlayers.find(p => playerKey(p) === playerKey);
    if (!player) return;

    const correct = this.isCorrect(pos, player);
    if (correct) {
      this.picks[pos] = player;
      this.afterPick(pos, true, player);
    } else {
      this.mistakes++;
      // Get a random correct player for this position
      const pool = this.getCorrectPool(pos);
      const fallback = pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : player;
      this.picks[pos] = fallback;
      this.afterPick(pos, false, fallback, player);
    }
  }

  afterPick(pos, wasCorrect, finalPlayer, wrongPick) {
    // Show result feedback
    const card = document.getElementById('posCard' + pos);
    const colors = TEAM_COLORS[finalPlayer.team] || ['#333','#555'];
    if (card) {
      card.classList.add('filled-slot');
      card.style.borderColor = wasCorrect ? 'var(--success)' : 'var(--danger)';
      card.style.background = wasCorrect ? 'rgba(39,174,96,0.08)' : 'rgba(231,76,60,0.08)';
      card.style.boxShadow = wasCorrect ? '0 0 14px rgba(39,174,96,0.3)' : '0 0 14px rgba(231,76,60,0.3)';
      card.innerHTML = `<div class="pos-badge ${pos}">${pos}</div>
        <div class="slot-player-name-card">${finalPlayer.name.split('-').pop()}</div>
        <div class="slot-player-meta">${teamCN(finalPlayer.team)} · ${finalPlayer.decade}</div>
        <div class="slot-player-rating">${wasCorrect ? '✅' : '❌'} ⭐${finalPlayer.rating}</div>`;
    }

    // Update round counter
    const label = document.getElementById('rosterCountLabel');
    if (label) {
      label.textContent = `第 ${this.currentRound + 1}/5 轮 | 失误: ${this.mistakes} 次`;
    }

    // Auto-advance after delay
    setTimeout(() => {
      this.currentRound++;
      if (this.currentRound >= 5) {
        this.finish();
      } else {
        this.renderRound(this.posOrder[this.currentRound]);
      }
    }, 1000);
  }

  renderRound(pos) {
    const options = this.generateOptions(pos);
    if (options.length === 0) {
      document.getElementById('playerListScroll').innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted);">没有可用的球员选项</div>';
      return;
    }

    // Update active position indicator
    const badge = document.getElementById('activePosBadge');
    if (badge) { badge.textContent = pos; badge.className = 'active-pos-indicator ' + pos; }

    // Update challenge header
    this.renderChallengeHeader(pos);

    // Render options as player cards
    const container = document.getElementById('playerListScroll');
    if (!container) return;

    container.innerHTML = options.map(p => {
      const key = playerKey(p);
      const colors = TEAM_COLORS[p.team] || ['#333','#555'];
      return `<div class="player-card" onclick="window._activeChallenge.handlePick('${pos}', '${key.replace(/'/g, "\\'")}')">
        <div class="player-name">${p.name}</div>
        <div class="player-positions">${fmtPositions(p.positions)}</div>
        <div class="player-team">${teamCN(p.team)} · ${p.decade}</div>
        <div class="player-stats">
          <span class="stat-pill"><span class="stat-label">PTS</span> ${p.pts}</span>
          <span class="stat-pill"><span class="stat-label">REB</span> ${p.reb}</span>
          <span class="stat-pill"><span class="stat-label">AST</span> ${p.ast}</span>
        </div>
      </div>`;
    }).join('');
  }

  renderChallengeHeader(pos) {
    const hint = document.getElementById('customHint');
    if (hint) {
      hint.innerHTML = `<span class="ch-round">第 ${this.currentRound + 1}/5 轮 — ${pos}</span>
        <span class="ch-mistakes">失误: <span>${this.mistakes}</span> 次 (每次 -${this.penaltyWins} 胜场)</span>`;
    }
    const sub = document.getElementById('browserSubtitle');
    if (sub) sub.textContent = this.getRoundHint(pos);
  }

  getRoundHint(pos) { return '选择你认为正确的球员'; }

  finish() {
    buildGameFromPicks(this.picks, this.name);
    game._mistakes = this.mistakes;
    game._penaltyWins = this.penaltyWins;
    saveToHistory();
    runSimulation();
  }

  /** Show setup overlay (modal) */
  showSetupOverlay(html, onConfirm) {
    const overlay = document.getElementById('challengeSetupOverlay');
    const body = document.getElementById('challengeSetupBody');
    const btn = document.getElementById('challengeSetupBtn');
    if (!overlay || !body) return;
    body.innerHTML = html;
    overlay.style.display = 'flex';
    btn.onclick = () => { overlay.style.display = 'none'; onConfirm(); };
  }
}

// ===================================================================
//  ERA CHALLENGE — 年代穿越
// ===================================================================
class EraChallenge extends ChallengeEngine {
  constructor() {
    super({ name: '年代穿越', modeKey: 'era-cross', penalty: 5 });
    this.targetEras = {}; // {PG: '1980s', SG: '2000s', ...}
    this._setupEras = [];
  }

  start() {
    // Reset
    this.currentRound = 0;
    this.picks = {};
    this.mistakes = 0;
    this._setupEras = [];
    this.targetEras = {};

    showScreen('screen-custom');
    document.getElementById('customHeaderText').textContent = '🏆 年代穿越';
    // toggle removed
    document.getElementById('customDecadeTabs').innerHTML = '';
    document.getElementById('customSearchBar').style.display = 'none';
    window._activeChallenge = this;

    // Render empty roster cards
    this.renderEmptyRoster();

    // Show setup overlay
    this.showEraSetup();
  }

  showEraSetup() {
    const decades = ALL_DECADES.filter(function(d) { return this.allPlayers.some(function(p) { return p.decade === d; }); }.bind(this));
    let html = '<h3 style="color:var(--gold);margin-bottom:8px;">🏆 选择 5 个目标年代</h3>';
    html += '<p style="color:var(--text-muted);font-size:0.75rem;margin-bottom:12px;">为 5 个位置各分配一个年代，答题者需从选项中找出该年代的球员</p>';
    html += '<div style="display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin-bottom:8px;">';
    decades.forEach(d => {
      html += `<span class="decade-pill" id="eraSetup_${d}" onclick="window._activeChallenge.toggleSetupEra('${d}')" style="cursor:pointer;">${d}</span>`;
    });
    html += '</div>';
    html += '<p style="font-size:0.7rem;color:var(--text-muted);margin:8px 0;">已选: <span id="eraSetupCount" style="color:var(--gold-light);">0</span>/5</p>';
    html += '<div style="display:flex;gap:8px;justify-content:center;">';
    html += '<button class="btn btn-secondary btn-sm" onclick="window._activeChallenge.randomEras()">🎲 随机分配</button>';
    html += '<button class="btn btn-gold btn-sm" id="challengeSetupBtn">确认 → 开始挑战</button>';
    html += '</div>';
    this.showSetupOverlay(html, () => this.beginEraChallenge());
  }

  toggleSetupEra(decade) {
    if (this._setupEras.includes(decade)) {
      this._setupEras = this._setupEras.filter(d => d !== decade);
      document.getElementById('eraSetup_' + decade).classList.remove('active');
    } else if (this._setupEras.length < 5) {
      this._setupEras.push(decade);
      document.getElementById('eraSetup_' + decade).classList.add('active');
    }
    const el = document.getElementById('eraSetupCount');
    if (el) el.textContent = this._setupEras.length;
    const btn = document.getElementById('challengeSetupBtn');
    if (btn) btn.disabled = this._setupEras.length !== 5;
  }

  randomEras() {
    const decades = ALL_DECADES.filter(function(d) { return this.allPlayers.some(function(p) { return p.decade === d; }); }.bind(this));
    // Shuffle and pick 5
    for (let i = decades.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [decades[i], decades[j]] = [decades[j], decades[i]];
    }
    this._setupEras = decades.slice(0, 5);
    // Update UI
    document.querySelectorAll('[id^="eraSetup_"]').forEach(el => el.classList.remove('active'));
    this._setupEras.forEach(d => {
      const el = document.getElementById('eraSetup_' + d);
      if (el) el.classList.add('active');
    });
    const c = document.getElementById('eraSetupCount');
    if (c) c.textContent = '5';
    const btn = document.getElementById('challengeSetupBtn');
    if (btn) btn.disabled = false;
  }

  beginEraChallenge() {
    if (this._setupEras.length !== 5) { this.randomEras(); }
    // Assign eras to positions
    this.posOrder.forEach((pos, i) => { this.targetEras[pos] = this._setupEras[i]; });

    // Update page hint
    document.getElementById('customPageHint').textContent =
      `年代: ${this.posOrder.map(p => this.targetEras[p]).join(' · ')}`;

    this.renderRound('PG');
  }

  getCorrectPool(pos) {
    const era = this.targetEras[pos];
    return this.allPlayers.filter(p => p.positions.includes(pos) && p.decade === era);
  }

  getDistractors(pos, correct) {
    const era = this.targetEras[pos];
    // Get players from same position but DIFFERENT eras, similar rating
    return this.allPlayers
      .filter(p => p.positions.includes(pos) && p.decade !== era && p.name !== correct.name)
      .sort((a, b) => Math.abs(a.rating - correct.rating) - Math.abs(b.rating - correct.rating))
      .slice(0, 7);
  }

  isCorrect(pos, player) {
    return player.decade === this.targetEras[pos];
  }

  getRoundHint(pos) {
    return `找出属于 ${this.targetEras[pos]} 年代的球员！`;
  }

  renderEmptyRoster() {
    this.posOrder.forEach(pos => {
      const card = document.getElementById('posCard' + pos);
      if (card) {
        card.classList.remove('active-slot', 'filled-slot');
        card.style.borderColor = ''; card.style.background = ''; card.style.boxShadow = '';
        card.innerHTML = `<div class="pos-badge ${pos}">${pos}</div><span class="slot-status">?</span>`;
      }
    });
  }
}

// ===================================================================
//  TEAM CHALLENGE — 同队传奇
// ===================================================================
class TeamChallenge extends ChallengeEngine {
  constructor() {
    super({ name: '同队传奇', modeKey: 'same-team', penalty: 5 });
    this.lockedTeam = null;
  }

  start() {
    this.currentRound = 0;
    this.picks = {};
    this.mistakes = 0;
    this.lockedTeam = null;

    showScreen('screen-custom');
    document.getElementById('customHeaderText').textContent = '🦾 同队传奇';
    // toggle removed
    document.getElementById('customDecadeTabs').innerHTML = '';
    document.getElementById('customSearchBar').style.display = 'none';
    window._activeChallenge = this;

    const card = document.getElementById('posCardPG');
    if (card) {
      card.innerHTML = `<div class="pos-badge PG">PG</div><span class="slot-status">?</span>`;
    }
    ['SG','SF','PF','C'].forEach(pos => {
      const c = document.getElementById('posCard' + pos);
      if (c) { c.classList.remove('active-slot','filled-slot'); c.style.borderColor=''; c.style.background=''; c.style.boxShadow='';
        c.innerHTML = `<div class="pos-badge ${pos}">${pos}</div><span class="slot-status">?</span>`; }
    });

    this.showTeamSetup();
  }

  showTeamSetup() {
    const teams = [...new Set(this.allPlayers.map(p => p.team))].sort();
    let html = '<h3 style="color:var(--gold);margin-bottom:8px;">🦾 选择目标球队</h3>';
    html += '<p style="color:var(--text-muted);font-size:0.75rem;margin-bottom:12px;">答题者需从选项中找出该队的球员</p>';
    html += '<div style="display:flex;flex-wrap:wrap;gap:6px;justify-content:center;max-height:300px;overflow-y:auto;">';
    teams.forEach(t => {
      const colors = TEAM_COLORS[t] || ['#333','#555'];
      html += `<div class="team-card" style="background:linear-gradient(135deg,${colors[0]},${colors[1]||colors[0]});cursor:pointer;width:80px;padding:8px 4px;border-radius:8px;text-align:center;"
        id="teamSetup_${t}" onclick="window._activeChallenge.selectTeam('${t}')">
        <div style="font-size:0.65rem;color:#fff;font-weight:700;">${teamCN(t)}</div></div>`;
    });
    html += '</div>';
    html += '<div style="margin-top:12px;display:flex;gap:8px;justify-content:center;">';
    html += '<button class="btn btn-secondary btn-sm" onclick="window._activeChallenge.randomTeam()">🎲 随机球队</button>';
    html += '<button class="btn btn-gold btn-sm" id="challengeSetupBtn" disabled>确认 → 开始挑战</button>';
    html += '</div>';
    this.showSetupOverlay(html, () => this.beginTeamChallenge());
  }

  selectTeam(team) {
    this.lockedTeam = team;
    document.querySelectorAll('[id^="teamSetup_"]').forEach(el => el.style.outline = 'none');
    const el = document.getElementById('teamSetup_' + team);
    if (el) el.style.outline = '2px solid var(--gold-light)';
    const btn = document.getElementById('challengeSetupBtn');
    if (btn) btn.disabled = false;
  }

  randomTeam() {
    const teams = [...new Set(this.allPlayers.map(p => p.team))];
    this.selectTeam(teams[Math.floor(Math.random() * teams.length)]);
  }

  beginTeamChallenge() {
    if (!this.lockedTeam) { this.randomTeam(); }
    document.getElementById('customPageHint').textContent = `🔒 锁定: ${teamCN(this.lockedTeam)}`;
    this.renderRound('PG');
  }

  getCorrectPool(pos) {
    return this.allPlayers.filter(p => p.positions.includes(pos) && p.team === this.lockedTeam);
  }

  getDistractors(pos, correct) {
    return this.allPlayers
      .filter(p => p.positions.includes(pos) && p.team !== this.lockedTeam && p.name !== correct.name)
      .sort((a, b) => Math.abs(a.rating - correct.rating) - Math.abs(b.rating - correct.rating))
      .slice(0, 7);
  }

  isCorrect(pos, player) {
    return player.team === this.lockedTeam;
  }

  getRoundHint(pos) {
    return `找出 ${teamCN(this.lockedTeam)} 的球员！`;
  }
}

// ===================================================================
//  NO-REPEAT CHALLENGE — 国际阵容
// ===================================================================
class NoRepeatChallenge extends ChallengeEngine {
  constructor() {
    super({ name: '国际阵容', modeKey: 'no-repeat', penalty: 5 });
    this.usedTeams = [];
  }

  start() {
    this.currentRound = 0;
    this.picks = {};
    this.mistakes = 0;
    this.usedTeams = [];

    showScreen('screen-custom');
    document.getElementById('customHeaderText').textContent = '🌍 国际阵容';
    // toggle removed
    document.getElementById('customDecadeTabs').innerHTML = '';
    document.getElementById('customSearchBar').style.display = 'none';
    window._activeChallenge = this;

    this.posOrder.forEach(pos => {
      const card = document.getElementById('posCard' + pos);
      if (card) { card.classList.remove('active-slot','filled-slot'); card.style.borderColor=''; card.style.background=''; card.style.boxShadow='';
        card.innerHTML = `<div class="pos-badge ${pos}">${pos}</div><span class="slot-status">?</span>`; }
    });

    document.getElementById('customPageHint').textContent = '不能选重复球队的球员！';
    this.renderRound('PG');
  }

  getCorrectPool(pos) {
    return this.allPlayers.filter(p => p.positions.includes(pos) && !this.usedTeams.includes(p.team));
  }

  getDistractors(pos, correct) {
    // Include some already-used team players as distractors
    const used = this.allPlayers.filter(p => p.positions.includes(pos) && this.usedTeams.includes(p.team) && p.name !== correct.name);
    const unused = this.allPlayers.filter(p => p.positions.includes(pos) && !this.usedTeams.includes(p.team) && p.name !== correct.name);
    const mixed = [...used.slice(0, 3), ...unused.slice(0, 4)];
    // Shuffle
    for (let i = mixed.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [mixed[i], mixed[j]] = [mixed[j], mixed[i]];
    }
    return mixed.slice(0, 7);
  }

  isCorrect(pos, player) {
    return !this.usedTeams.includes(player.team);
  }

  afterPick(pos, wasCorrect, finalPlayer, wrongPick) {
    if (wasCorrect) this.usedTeams.push(finalPlayer.team);
    super.afterPick(pos, wasCorrect, finalPlayer, wrongPick);
    // Update used teams display
    document.getElementById('customPageHint').textContent =
      `已选球队: ${this.usedTeams.map(t => teamCN(t)).join(' · ') || '无'}`;
  }

  getRoundHint(pos) {
    return `已用: ${this.usedTeams.map(t => teamCN(t)).join(', ') || '无'} | 不能重复！`;
  }
}

// ===================================================================
//  ENTRY POINTS — override enterChallengeMode
// ===================================================================
function enterEraChallenge() { (new EraChallenge()).start(); }
function enterTeamChallenge() { (new TeamChallenge()).start(); }
function enterNoRepeatChallenge() { (new NoRepeatChallenge()).start(); }

// ===================================================================
//  PENALTY HOOK — monkey-patch runSimulation
// ===================================================================
(function() {
  const _origSim = runSimulation;
  runSimulation = function() {
    _origSim();
    // Apply challenge penalties after original simulation
    if (game._mistakes && game._mistakes > 0) {
      const penaltyTotal = game._mistakes * (game._penaltyWins || 5);
      const recordEl = document.getElementById('finalRecord');
      if (recordEl) {
        const parts = recordEl.textContent.split('-');
        let wins = parseInt(parts[0]) || 0;
        let losses = parseInt(parts[1]) || 0;
        wins = Math.max(0, wins - penaltyTotal);
        losses = 82 - wins;
        recordEl.textContent = wins + '-' + losses;
        // Re-grade
        const band = TEAM_GRADE_BANDS.find(b => wins >= b.min) || TEAM_GRADE_BANDS[TEAM_GRADE_BANDS.length - 1];
        document.getElementById('resultGrade').textContent = band.grade;
        document.getElementById('resultGrade').style.color = band.color;
        document.getElementById('resultTier').textContent = band.label;
        document.getElementById('resultTier').style.color = band.color;
        if (wins >= 80) launchConfetti();
      }
    }
    updateHistoryAfterSim();
  };
})();

console.log('[82-0] ChallengeEngine + 3 challenge modes + penalties loaded');

// ===================================================================
function buildGameFromPicks(picks, modeName) {
  game = {
    round: MAX_ROUNDS, roster: [],
    slots: { PG: null, SG: null, SF: null, PF: null, C: null },
    usedDecades: [], usedCombos: [],
    skipTeam: 0, skipDecade: 0,
    currentTeam: null, currentDecade: null,
    spun: false, skipPending: null,
  };
  ['PG','SG','SF','PF','C'].forEach(pos => {
    const pick = picks[pos];
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
  if (modeName) game._modeName = modeName;
}

// Simplify runSalarySimulation using shared builder
runSalarySimulation = function() {
  const allFilled = ['PG','SG','SF','PF','C'].every(pos => _salaryPicks[pos] !== null);
  if (!allFilled || getSalaryRemaining() < 0) {
    document.getElementById('customHint').textContent = '⚠️ 阵容不完整或薪资超帽';
    return;
  }
  buildGameFromPicks(_salaryPicks, '工资帽模式');
  saveToHistory();
  runSimulation();
};

// Simplify runChallengeSimulation


// Simplify runCustomSimulation (override)
const _origRunCustomSim2 = runCustomSimulation;
runCustomSimulation = function() {
  if (_salaryMode) { runSalarySimulation(); return; }
  const allFilled = ['PG','SG','SF','PF','C'].every(pos => _customPicks[pos] !== null);
  if (!allFilled) { document.getElementById('customHint').textContent = '⚠️ 阵容不完整'; return; }
  buildGameFromPicks(_customPicks, '自选模式');
  saveToHistory();
  runSimulation();
};

console.log('[82-0] Refactored: buildGameFromPicks unified, all modes use shared simulation builder');

// Override custom panel interactions based on active mode
const _origSetActivePos = setActivePosition;
setActivePosition = function(pos) {
  if (_salaryMode) {
    _salaryActivePos = pos;
    renderSalaryRosterCards();
    renderActivePosBadgeForMode(pos);
    renderDecadePillsForMode('salary');
    renderSalaryTopRecs();
    renderSalaryPlayerList();
    document.getElementById('customSearchBar').value = '';
    _salarySearchQuery = '';
    updateSalaryBar();
    return;
  }
  _origSetActivePos(pos);
};

// Override custom search to dispatch to correct mode
const _origOnCustomSearch = onCustomSearch;
onCustomSearch = function() {
  if (_salaryMode) { onModeSearch('salary'); return; }
  _origOnCustomSearch();
};

// Override random fill for challenge/salary modes
const _origRandomFill = randomFillRemaining;
randomFillRemaining = function() {
  if (_salaryMode) {
    const all = buildCustomAllPlayers();
    const emptyPositions = ['PG','SG','SF','PF','C'].filter(pos => !_salaryPicks[pos]);
    if (emptyPositions.length === 0) return;
    emptyPositions.forEach(pos => {
      const pickedKeys = getSalaryPickedKeys(pos);
      const remaining = getSalaryRemaining();
      const eligible = all.filter(p => p.positions.includes(pos) && !pickedKeys.has(playerKey(p)) && getPlayerSalary(p) <= remaining + getSalaryUsed());
      if (eligible.length > 0) {
        const pool = eligible.slice(0, Math.min(10, eligible.length));
        _salaryPicks[pos] = pool[Math.floor(Math.random() * pool.length)];
      }
    });
    _salaryActivePos = 'PG';
    renderSalaryRosterCards();
    updateSalaryBar();
    updateSalarySimButton();
    return;
  }
  _origRandomFill();
};

// Override reset for challenge/salary modes
const _origReset = resetAllPicks;
resetAllPicks = function() {
  if (_salaryMode) {
    _salaryPicks = { PG: null, SG: null, SF: null, PF: null, C: null };
    _salaryActivePos = 'PG';
    _salaryDecadeFilter = 'all';
    _salarySearchQuery = '';
    document.getElementById('customSearchBar').value = '';
    renderSalaryRosterCards();
    renderActivePosBadgeForMode('PG');
    renderDecadePillsForMode('salary');
    renderSalaryTopRecs();
    renderSalaryPlayerList();
    updateSalaryBar();
    updateSalarySimButton();
    return;
  }
  _origReset();
};

// Also override enterCustomMode to reset salary mode
const _origEnterCustom = enterCustomMode;
enterCustomMode = function() {
  _salaryMode = false;
  // toggle removed
  document.getElementById('customSearchBar').oninput = function() { onCustomSearch(); };
  _origEnterCustom();
};

// Override showMenu to reset salary mode
const _origShowMenu = showMenu;
showMenu = function() {
  _salaryMode = false;
  // toggle removed
  document.getElementById('customSearchBar').oninput = function() { onCustomSearch(); };
  _origShowMenu();
};

console.log('[82-0] Enhanced modes loaded: Salary Cap, Challenge, History');

// ===================================================================
//  HISTORY — localStorage persistence
// ===================================================================
function saveToHistory() {
  try {
    const history = JSON.parse(localStorage.getItem('bb82_history') || '[]');
    const entry = {
      time: new Date().toISOString(),
      mode: game._modeName || '未知模式',
      record: '',
      players: ['PG','SG','SF','PF','C'].map(pos => {
        const p = game.slots[pos];
        return p ? `${pos}:${p.name.split('-').pop()}(${p.decade})` : '';
      }).filter(Boolean),
      grade: ''
    };
    history.unshift(entry);
    if (history.length > 20) history.length = 20;
    localStorage.setItem('bb82_history', JSON.stringify(history));
    window._pendingHistoryEntry = entry;
    window._pendingHistory = history;
  } catch(e) { console.warn('History save failed:', e); }
}

function updateHistoryAfterSim() {
  if (!window._pendingHistoryEntry) return;
  const recordEl = document.getElementById('finalRecord');
  const gradeEl = document.getElementById('resultGrade');
  window._pendingHistoryEntry.record = recordEl ? recordEl.textContent : '?-?';
  window._pendingHistoryEntry.grade = gradeEl ? gradeEl.textContent : '?';
  try { localStorage.setItem('bb82_history', JSON.stringify(window._pendingHistory)); } catch(e) {}
  renderHistorySection();
  window._pendingHistoryEntry = null;
}

function renderHistorySection() {
  const section = document.getElementById('historySection');
  const list = document.getElementById('historyList');
  if (!section || !list) return;
  try {
    const history = JSON.parse(localStorage.getItem('bb82_history') || '[]');
    if (history.length === 0) { section.style.display = 'none'; return; }
    section.style.display = 'block';
    list.innerHTML = history.slice(0, 10).map((h, i) => {
      const time = new Date(h.time);
      const timeStr = `${time.getMonth()+1}/${time.getDate()} ${time.getHours()}:${String(time.getMinutes()).padStart(2,'0')}`;
      const isPerfect = h.record === '82-0';
      return `<div class="history-entry">
        <span class="hist-result" style="color:${isPerfect ? '#f1c40f' : 'var(--text-light)'}">${h.record || '?-?'}</span>
        <span class="hist-players">${(h.players || []).slice(0,3).join(', ')}${(h.players||[]).length > 3 ? '...' : ''}</span>
        <span class="hist-mode">${h.mode || '?'}</span>
        <span class="hist-time">${timeStr}</span>
      </div>`;
    }).join('');
  } catch(e) {}
}

