// ===================================================================
//  APP CHECK
// ===================================================================
function getIsInApp() {
  return /kanqiu|huputiyu/i.test(window.navigator.userAgent || "");
}

function closeAppIntercept() {
  document.getElementById('appInterceptOverlay').classList.remove('show');
}

function retryOpenApp() {
  closeAppIntercept();
  const currentUrl = window.location.href;
  const schemeUrl = 'huputiyu://webview/openencodeurl?fullscreen=0&url=' + encodeURIComponent(currentUrl);
  window.location.href = schemeUrl;
}

function handleStartGame() {
  startGame();
}

// ===================================================================
//  NBA_DATA — 从 nba-data.js 加载数据
// ===================================================================

var NBA_DATA = null;
var DATA_READY = Promise.resolve();

(function() {
  const data = NBA_DATA_RAW;
  const result = {};
  data.forEach(p => {
    const era = p.era;
    const team = p.team;
    if (!result[era]) result[era] = {};
    if (!result[era][team]) result[era][team] = [];
    result[era][team].push({
      name: p.cname || p.player,
      pos: p.pos,
      positions: p.positions || [],
      stats: {
        pts: p.ppg,
        reb: p.rpg,
        ast: p.apg,
        stl: p.spg,
        blk: p.bpg
      }
    });
  });
  NBA_DATA = result;
  console.log('NBA_DATA loaded from nba-data.js:', Object.keys(NBA_DATA).length, 'decades, total players:', data.length);
})();

// Cheat mode state
var _cheatMode = false;
var _cheatSearchQuery = '';
var _cheatSearchTimer = null;

// Filter tab for player selection
var _filterTab = 'all';

function setFilterTab(tab) {
  _filterTab = tab;
  document.querySelectorAll('.filter-tab').forEach(el => {
    el.classList.toggle('active', el.dataset.tab === tab);
  });
  // Re-render current player list with new filter
  if (game.currentTeam && game.currentDecade) {
    renderPlayerGrid(game.currentTeam, game.currentDecade);
  }
}

// Helper: get players for a team in a decade
function getPlayers(decade, team) {
  return NBA_DATA?.[decade]?.[team] || [];
}
// Helper: get all available teams in a decade
function getTeams(decade) {
  return Object.keys(NBA_DATA?.[decade] || {});
}

// Cheat mode: populate team dropdown filtered by selected decade
function populateCheatTeamSelect(selectedDecade) {
  var sel = document.getElementById('cheatTeamSelect');
  if (!sel) return;
  var currentVal = sel.value;
  sel.innerHTML = '<option value="">-- 选择球队 --</option>';
  var teams;
  if (selectedDecade) {
    teams = getTeams(selectedDecade);
  } else {
    var teamSet = {};
    ALL_DECADES.forEach(function(d) {
      getTeams(d).forEach(function(t) { teamSet[t] = true; });
    });
    teams = Object.keys(teamSet);
  }
  teams.sort();
  teams.forEach(function(t) {
    var opt = document.createElement('option');
    opt.value = t;
    opt.textContent = teamCN(t) + ' (' + t + ')';
    if (t === currentVal) opt.selected = true;
    sel.appendChild(opt);
  });
  if (!Array.from(sel.options).some(function(o) { return o.value === currentVal; })) {
    sel.value = '';
  }
}

// Cheat mode: populate decade dropdown filtered by selected team
function populateCheatDecadeSelect(selectedTeam) {
  var sel = document.getElementById('cheatDecadeSelect');
  if (!sel) return;
  var currentVal = sel.value;
  sel.innerHTML = '<option value="">-- 选择年代 --</option>';
  var decades;
  if (selectedTeam) {
    decades = ALL_DECADES.filter(function(d) {
      return NBA_DATA[d] && NBA_DATA[d][selectedTeam];
    });
  } else {
    decades = ALL_DECADES.slice();
  }
  decades.forEach(function(d) {
    var opt = document.createElement('option');
    opt.value = d;
    opt.textContent = d;
    if (d === currentVal) opt.selected = true;
    sel.appendChild(opt);
  });
  if (!decades.includes(currentVal)) {
    sel.value = '';
  }
}

// Cheat mode: initial population of both dropdowns (all options)
function populateCheatDropdowns() {
  populateCheatTeamSelect('');
  populateCheatDecadeSelect('');
}

// Team names - no longer needed as we use full names directly
const TEAM_NAMES = {};

const ALL_DECADES = ["1960s","1970s","1980s","1990s","2000s","2010s","2020s"];
const MAX_ROUNDS = 5;
// TEAMS helper - computed dynamically since NBA_DATA is loaded async
function getTeamsList() {
  if (!NBA_DATA) return [];
  const teamSet = new Set();
  Object.values(NBA_DATA).forEach(decade => {
    Object.keys(decade).forEach(team => teamSet.add(team));
  });
  return [...teamSet];
}

// Game state
var game = {
  round: 0,
  roster: [],
  usedDecades: [],
  usedCombos: [],
  skipTeam: 1,
  skipDecade: 1,
  currentTeam: null,
  currentDecade: null,
  spun: false,
  skipPending: null, // 'team' or 'decade'
};

// ===================================================================
//  TEAM COLORS — extracted from 常用队徽/*.png
// ===================================================================
const TEAM_COLORS = {
  "ATL": ["#b42b33","#c76169"],"BKN": ["#c6c6c6","#505050"],"BOS": ["#488a50","#223425"],
  "CHA": ["#25225a","#384a7b"],"CHI": ["#d93831","#da2f2e"],"CLE": ["#860038","#BC945C"],
  "DAL": ["#2d6ab7","#c5cdd4"],"DEN": ["#418fde","#418fde"],"DET": ["#c42e47","#254f9d"],
  "GSW": ["#eeba4b","#283f85"],"HOU": ["#ad342c","#ffffff"],"IND": ["#eac962","#142356"],
  "LAC": ["#002650","#0b3666"],"LAL": ["#f1bc4b","#50247c"],"MEM": ["#14163b","#5d75ad"],
  "MIA": ["#a32a2e","#261c22"],"MIL": ["#dcd4b4","#304c38"],"MIN": ["#b6c8d3","#244f7d"],
  "NOP": ["#ae9b6d","#ae9b6d"],"NYK": ["#d86a34","#1c399f"],"OKC": ["#4876b6","#1c233d"],
  "ORL": ["#3053ad","#3053ae"],"PHI": ["#3063b0","#2f61af"],"PHX": ["#f6ca57","#c86d36"],
  "POR": ["#ab2f32","#6a1d1f"],"SAC": ["#55277f","#3a0e63"],"SAS": ["#c7cdd4","#34393d"],
  "TOR": ["#a2a2a4","#b12a32"],"UTA": ["#15203e","#14223e"],"WAS": ["#16213d","#bd2a33"]
};



// ===================================================================
//  ERA BENCHMARKS & POSITION WEIGHTS (from sim.ts / constants.ts)
// ===================================================================
const ERA_BENCHMARKS = {
  "1960s": { pts: 30, reb: 18, ast: 8, stl: 1.8, blk: 1.8 },
  "1970s": { pts: 28, reb: 13, ast: 9, stl: 2,   blk: 2 },
  "1980s": { pts: 28, reb: 11, ast: 11, stl: 2.2, blk: 2 },
  "1990s": { pts: 27, reb: 11, ast: 9,  stl: 2,   blk: 2 },
  "2000s": { pts: 27, reb: 11, ast: 9,  stl: 2,   blk: 2 },
  "2010s": { pts: 28, reb: 11, ast: 9,  stl: 1.8, blk: 1.8 },
  "2020s": { pts: 28, reb: 11, ast: 9,  stl: 1.8, blk: 1.8 },
};

const POSITION_WEIGHTS = {
  PG: { pts: 0.4, reb: 0.1, ast: 0.35, stl: 0.1, blk: 0.05 },
  SG: { pts: 0.45, reb: 0.1, ast: 0.2,  stl: 0.2, blk: 0.05 },
  SF: { pts: 0.45, reb: 0.15, ast: 0.2, stl: 0.15, blk: 0.05 },
  PF: { pts: 0.4,  reb: 0.3, ast: 0.1,  stl: 0.1, blk: 0.1 },
  C:  { pts: 0.4,  reb: 0.35, ast: 0.1, stl: 0.05, blk: 0.1 },
};

// Chinese team names (不带地名)
const TEAM_CN = {
  ATL:"老鹰",BKN:"篮网",BOS:"凯尔特人",CHA:"黄蜂",CHI:"公牛",
  CLE:"骑士",DAL:"独行侠",DEN:"掘金",DET:"活塞",GSW:"勇士",
  HOU:"火箭",IND:"步行者",LAC:"快船",LAL:"湖人",MEM:"灰熊",
  MIA:"热火",MIL:"雄鹿",MIN:"森林狼",NOP:"鹈鹕",NYK:"尼克斯",
  OKC:"雷霆",ORL:"魔术",PHI:"76人",PHX:"太阳",POR:"开拓者",
  SAC:"国王",SAS:"马刺",TOR:"猛龙",UTA:"爵士",WAS:"奇才"
};
function teamCN(abbr) { return TEAM_CN[abbr] || abbr; }

const STAT_KEYS = ['pts','reb','ast','stl','blk'];

const TEAM_GRADE_BANDS = [
  { min: 80, grade: "S",  label: "完美赛季", color: "#a855f7" },
  { min: 72, grade: "A+", label: "历史级强队", color: "#22c55e" },
  { min: 62, grade: "A",  label: "王朝球队", color: "#22c55e" },
  { min: 57, grade: "B",  label: "有力竞争者", color: "#3b82f6" },
  { min: 50, grade: "C",  label: "季后赛球队", color: "#f59e0b" },
  { min: 40, grade: "D",  label: "乐透球队", color: "#64748b" },
  { min: 0,  grade: "F",  label: "摆烂大军", color: "#ef4444" },
];

const INTANGIBLES = new Set([
  "larry bird","tim duncan","kevin durant","magic johnson",
  "shaquille o'neal","hakeem olajuwon","bill russell","kobe bryant",
  "oscar robertson","karl malone","kevin garnett","isiah thomas",
  "tony parker","manu ginobili","draymond green","scottie pippen",
  "dennis rodman","stephen curry","nikola jokic","dirk nowitzki",
]);

// ===================================================================
//  PARTICLES
// ===================================================================
function initParticles() {
  const canvas = document.getElementById('particles-canvas');
  const ctx = canvas.getContext('2d');
  let w, h, particles = [];

  function resize() {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  for (let i = 0; i < 60; i++) {
    particles.push({
      x: Math.random() * w,
      y: Math.random() * h,
      r: Math.random() * 2 + 0.5,
      dx: (Math.random() - 0.5) * 0.3,
      dy: (Math.random() - 0.5) * 0.3,
      o: Math.random() * 0.4 + 0.1
    });
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);
    particles.forEach(p => {
      p.x += p.dx;
      p.y += p.dy;
      if (p.x < 0) p.x = w;
      if (p.x > w) p.x = 0;
      if (p.y < 0) p.y = h;
      if (p.y > h) p.y = 0;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(243,156,18,${p.o})`;
      ctx.fill();
    });
    requestAnimationFrame(draw);
  }
  draw();
}

// ===================================================================
//  SCREEN MANAGEMENT
// ===================================================================
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  const header = document.querySelector('.header');
  const img = header.querySelector('.header-img');
  header.style.display = id === 'screen-result' ? 'none' : '';
  if (id === 'screen-menu') {
    header.style.background = 'transparent';
    header.style.padding = '0 0 4px';
    if (img) img.style.display = '';
    document.getElementById('gameHeaderText').style.display = 'none';
  } else if (id === 'screen-game') {
    header.style.background = '#110427';
    header.style.padding = '0';
    if (img) img.style.display = 'none';
    document.getElementById('gameHeaderText').style.display = 'block';
  } else if (id === 'screen-custom') {
    header.style.background = '#110427';
    header.style.padding = '0';
    if (img) img.style.display = 'none';
    document.getElementById('gameHeaderText').style.display = 'none';
  } else {
    header.style.background = '#110427';
    header.style.padding = '0 0 4px';
    if (img) img.style.display = 'none';
  }
  const container = document.querySelector('.app-container');
  container.classList.toggle('game-active', id === 'screen-game' || id === 'screen-custom');
}

function showMenu() {
  showScreen('screen-menu');
}

function toggleHowTo() {
  document.getElementById('howtoOverlay').classList.add('show');
}

function closeHowTo() {
  document.getElementById('howtoOverlay').classList.remove('show');
}

// ===================================================================