// 配置常量
const GAME_WIDTH = 800;
const GAME_HEIGHT = 600;
const FIXED_DT = 1 / 60; // 固定物理步长
const MAX_STEPS = 5; // 防止长时间切回导致的迭代过多
const PLAYER_SPEED = 160; // 像素/秒
const BULLET_SPEED = 420; // 子弹速度 像素/秒
const BULLET_COOLDOWN = 0.25; // 射击冷却 秒
const TILE_SIZE = 40; // 地图网格尺寸
const BASE_BRICKS = 35; // 基础砖块数量
const BASE_ENEMIES = 5; // 基础敌人数
const RESPAWN_TIME = 1.0; // 玩家重生时间（秒）

// 敌人类型（颜色、速度、生命、得分）
const ENEMY_TYPES = [
  { name: 'scout', color: '#ff8a00', speed: 70, hp: 1, score: 80 },
  { name: 'trooper', color: '#ff5a5a', speed: 50, hp: 2, score: 120 },
  { name: 'heavy', color: '#d64dff', speed: 35, hp: 3, score: 200 },
];
// 旧常量已被 BASE_BRICKS/BASE_ENEMIES 替代

// 全局状态（仅框架占位，具体逻辑后续任务实现）
const GameState = {
  isRunning: false,
  score: 0,
  lives: 3,
  level: 1,
  highScore: 0,
  respawning: false,
};

// 画布与UI句柄（init 中赋值）
let canvas;
let ctx;
let hudScore;
let hudLives;
let panel;
let btnStart;
let btnRestart;
let btnMusic;
let player;
let bullets = [];
let lastShotAt = 0;
let obstacles = []; // 砖块：{x,y,w,h,hp}
let enemies = []; // 敌人：{x,y,w,h,alive,hp,speed,color,score}
let pickups = []; // 道具：{x,y,r,type,ttl}

// 音频
let audioCtx;
let musicNode;
let musicOn = false;

function fitCanvasToWindow() {
  const maxScaleX = Math.floor(window.innerWidth / GAME_WIDTH) || 1;
  const maxScaleY = Math.floor(window.innerHeight / GAME_HEIGHT) || 1;
  const scale = Math.max(1, Math.min(maxScaleX, maxScaleY));
  canvas.style.width = (GAME_WIDTH * scale) + 'px';
  canvas.style.height = (GAME_HEIGHT * scale) + 'px';
}

// 输入占位（不实现移动，后续任务完成）
const Keys = new Set();

// 主循环（固定步长）
let lastTime = 0;
let accumulator = 0;

function startGame() {
  if (GameState.isRunning) return;
  GameState.isRunning = true;
  panel.style.display = 'none';
  lastTime = performance.now() / 1000;
  requestAnimationFrame(loop);
}

function loop() {
  if (!GameState.isRunning) return;
  const now = performance.now() / 1000;
  let frameTime = Math.min(now - lastTime, 0.25);
  lastTime = now;
  accumulator += frameTime;

  let steps = 0;
  while (accumulator >= FIXED_DT && steps < MAX_STEPS) {
    update(FIXED_DT);
    accumulator -= FIXED_DT;
    steps++;
  }
  const alpha = accumulator / FIXED_DT;
  render(alpha);
  requestAnimationFrame(loop);
}

// 更新逻辑占位
function update(dt) {
  hudScore.textContent = GameState.score;
  hudLives.textContent = GameState.lives;
  updatePlayer(dt);
  updateBullets(dt);
  updateEnemies(dt);
  updatePickups(dt);
  if (GameState.isRunning && enemies.length > 0 && enemies.every(e => !e.alive)) {
    nextLevel();
  }
}

// 渲染逻辑占位
function render(alpha) {
  ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  drawGrid(40, '#1c1c1c');
  drawPlaceholderBase();
  drawObstacles();
  drawPickups();
  drawEnemies();
  drawBullets();
  drawPlayer();
}

function drawGrid(size, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  for (let x = 0; x <= GAME_WIDTH; x += size) {
    ctx.beginPath();
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, GAME_HEIGHT);
    ctx.stroke();
  }
  for (let y = 0; y <= GAME_HEIGHT; y += size) {
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(GAME_WIDTH, y + 0.5);
    ctx.stroke();
  }
  ctx.restore();
}

function drawPlaceholderBase() {
  ctx.save();
  ctx.fillStyle = '#0b5';
  ctx.fillRect(GAME_WIDTH - 120, GAME_HEIGHT - 80, 80, 40);
  ctx.fillStyle = '#083';
  ctx.fillRect(GAME_WIDTH - 100, GAME_HEIGHT - 70, 60, 30);
  ctx.restore();
}

// AABB 工具
function aabbIntersect(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

function collidesRectList(x, y, w, h, rects) {
  for (let i = 0; i < rects.length; i++) {
    const r = rects[i];
    if (r && aabbIntersect(x, y, w, h, r.x, r.y, r.w, r.h)) return true;
  }
  return false;
}

// 障碍物生成与绘制
function generateObstacles() {
  obstacles = [];
  const cols = Math.floor(GAME_WIDTH / TILE_SIZE);
  const rows = Math.floor(GAME_HEIGHT / TILE_SIZE);
  const reserved = [];
  const px = Math.floor(80 / TILE_SIZE);
  const py = Math.floor((GAME_HEIGHT - 100) / TILE_SIZE);
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      reserved.push(`${px+dx},${py+dy}`);
    }
  }
  for (let gx = cols - 4; gx < cols - 1; gx++) {
    for (let gy = rows - 3; gy < rows; gy++) {
      reserved.push(`${gx},${gy}`);
    }
  }
  const used = new Set(reserved);
  let placed = 0;
  const target = BASE_BRICKS + Math.floor((GameState.level - 1) * 5);
  let safety = target * 10;
  while (placed < target && safety-- > 0) {
    const gx = Math.floor(Math.random() * cols);
    const gy = Math.floor(Math.random() * rows);
    const key = `${gx},${gy}`;
    if (used.has(key)) continue;
    used.add(key);
    obstacles.push({ x: gx * TILE_SIZE, y: gy * TILE_SIZE, w: TILE_SIZE, h: TILE_SIZE, hp: 1 });
    placed++;
  }
}

function drawObstacles() {
  if (obstacles.length === 0) return;
  ctx.save();
  for (let i = 0; i < obstacles.length; i++) {
    const b = obstacles[i];
    ctx.fillStyle = '#7a3f2b';
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = '#a25a40';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
  }
  ctx.restore();
}

// 道具：生成/更新/绘制/拾取
function spawnPickups(n) {
  const types = ['speed','shield','multishot'];
  const w = 16, h = 16;
  let tries = n * 20;
  while (n > 0 && tries-- > 0) {
    const x = 20 + Math.random() * (GAME_WIDTH - 40);
    const y = 20 + Math.random() * (GAME_HEIGHT - 40);
    if (collidesRectList(x - w/2, y - h/2, w, h, obstacles)) continue;
    const type = types[Math.floor(Math.random()*types.length)];
    pickups.push({ x, y, r: 8, type, ttl: 20 });
    n--;
  }
}

function updatePickups(dt) {
  if (!GameState.isRunning) return;
  for (let i = 0; i < pickups.length; i++) {
    const p = pickups[i];
    p.ttl -= dt;
    if (p.ttl <= 0) { pickups.splice(i,1); i--; continue; }
    // 玩家拾取
    const halfW = player.width / 2;
    const halfH = player.height / 2;
    if (aabbIntersect(player.x - halfW, player.y - halfH, player.width, player.height, p.x - p.r, p.y - p.r, p.r*2, p.r*2)) {
      applyPickup(p.type);
      pickups.splice(i,1); i--;
    }
  }
}

function drawPickups() {
  if (pickups.length === 0) return;
  ctx.save();
  for (let i = 0; i < pickups.length; i++) {
    const p = pickups[i];
    if (p.type === 'speed') ctx.fillStyle = '#00d1b2';
    else if (p.type === 'shield') ctx.fillStyle = '#5bc0de';
    else ctx.fillStyle = '#f6c12a';
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function applyPickup(type) {
  // 统一时长
  const DURATION = 8;
  if (type === 'speed') {
    player.speedMul = 1.8;
    addOrRefreshEffect('speed', DURATION);
  } else if (type === 'shield') {
    player.shieldActive = true;
    addOrRefreshEffect('shield', DURATION);
  } else if (type === 'multishot') {
    player.multishot = true;
    addOrRefreshEffect('multishot', DURATION);
  }
}

function addOrRefreshEffect(type, time) {
  const found = player.effects.find(e => e.type === type);
  if (found) {
    found.time = time;
  } else {
    player.effects.push({ type, time });
  }
}

// 敌人生成与绘制（静态目标）
function generateEnemies() {
  enemies = [];
  const w = 36, h = 36;
  let spawned = 0;
  const target = BASE_ENEMIES + Math.floor((GameState.level - 1) * 2);
  let safety = target * 20;
  while (spawned < target && safety-- > 0) {
    const x = 40 + Math.random() * (GAME_WIDTH - 80);
    const y = 40 + Math.random() * (GAME_HEIGHT * 0.35);
    // 基于关卡选择敌人类型
    const t = ENEMY_TYPES[Math.min(ENEMY_TYPES.length - 1, Math.floor(Math.random() * (1 + Math.floor(GameState.level/2))))] || ENEMY_TYPES[0];
    const rect = { x: x - w/2, y: y - h/2, w, h, alive: true, hp: t.hp, speed: t.speed, color: t.color, score: t.score };
    if (collidesRectList(rect.x, rect.y, rect.w, rect.h, obstacles)) continue;
    enemies.push(rect);
    spawned++;
  }
}

function drawEnemies() {
  if (enemies.length === 0) return;
  ctx.save();
  for (let i = 0; i < enemies.length; i++) {
    const e = enemies[i];
    if (!e.alive) continue;
    ctx.fillStyle = e.color || '#ff5a5a';
    ctx.fillRect(e.x, e.y, e.w, e.h);
    ctx.strokeStyle = '#ff9a9a';
    ctx.lineWidth = 2;
    ctx.strokeRect(e.x + 1, e.y + 1, e.w - 2, e.h - 2);
  }
  ctx.restore();
}

// 玩家：创建、更新与绘制
function createPlayer() {
  return {
    x: 80,
    y: GAME_HEIGHT - 100,
    width: 38,
    height: 42,
    speed: PLAYER_SPEED,
    angle: 0, // 初始朝上
    // 道具状态
    speedMul: 1,
    multishot: false,
    shieldActive: false,
    effects: [], // {type, time}
  };
}

function updatePlayer(dt) {
  if (!player) return;
  if (!GameState.isRunning) return;
  let moveX = 0;
  let moveY = 0;
  if (Keys.has('ArrowUp') || Keys.has('KeyW')) moveY -= 1;
  if (Keys.has('ArrowDown') || Keys.has('KeyS')) moveY += 1;
  if (Keys.has('ArrowLeft') || Keys.has('KeyA')) moveX -= 1;
  if (Keys.has('ArrowRight') || Keys.has('KeyD')) moveX += 1;

  if (moveX !== 0 || moveY !== 0) {
    // 方向：以主轴为准（避免对角旋转半角）
    if (Math.abs(moveX) > Math.abs(moveY)) {
      player.angle = moveX > 0 ? Math.PI / 2 : -Math.PI / 2; // 右: 90°, 左: -90°
    } else {
      player.angle = moveY > 0 ? Math.PI : 0; // 下: 180°, 上: 0°
    }
    // 归一化对角移动与逐轴碰撞
    const len = Math.hypot(moveX, moveY) || 1;
    const vx = (moveX / len) * (player.speed * (player.speedMul || 1)) * dt;
    const vy = (moveY / len) * (player.speed * (player.speedMul || 1)) * dt;
    const halfW = player.width / 2;
    const halfH = player.height / 2;
    // X 轴
    let nextX = player.x + vx;
    let nextY = player.y;
    if (!collidesRectList(nextX - halfW, nextY - halfH, player.width, player.height, obstacles)) {
      player.x = nextX;
    }
    // Y 轴
    nextX = player.x;
    nextY = player.y + vy;
    if (!collidesRectList(nextX - halfW, nextY - halfH, player.width, player.height, obstacles)) {
      player.y = nextY;
    }
    // 画布边界限制（基于中心点与半宽/半高）
    player.x = Math.max(halfW, Math.min(GAME_WIDTH - halfW, player.x));
    player.y = Math.max(halfH, Math.min(GAME_HEIGHT - halfH, player.y));
  }
  // 更新效果计时
  for (let i = 0; i < player.effects.length; i++) {
    const ef = player.effects[i];
    ef.time -= dt;
    if (ef.time <= 0) {
      if (ef.type === 'speed') player.speedMul = 1;
      if (ef.type === 'shield') player.shieldActive = false;
      if (ef.type === 'multishot') player.multishot = false;
      player.effects.splice(i,1); i--;
    }
  }
  // 与敌人碰撞：受击
  for (let i = 0; i < enemies.length; i++) {
    const e = enemies[i];
    if (!e.alive) continue;
    const halfW = player.width / 2;
    const halfH = player.height / 2;
    if (aabbIntersect(player.x - halfW, player.y - halfH, player.width, player.height, e.x, e.y, e.w, e.h)) {
      playerHit();
      break;
    }
  }
}

function drawPlayer() {
  if (!player) return;
  const w = player.width;
  const h = player.height;
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(player.angle);
  // 车体
  ctx.fillStyle = '#2e8bff';
  ctx.fillRect(-w/2, -h/2, w, h);
  // 炮塔
  ctx.fillStyle = '#90c3ff';
  ctx.fillRect(-12, -16, 24, 24);
  // 炮管（面向上方为基准，旋转已应用）
  ctx.fillStyle = '#c7e1ff';
  ctx.fillRect(-2, -30, 4, 18);
  // 护盾特效
  if (player.shieldActive) {
    ctx.strokeStyle = 'rgba(91,192,222,0.8)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(w,h)/1.6, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

// 子弹系统
function fireBullet() {
  if (!player || !GameState.isRunning || GameState.respawning) return;
  const now = performance.now() / 1000;
  if (now - lastShotAt < BULLET_COOLDOWN) return;
  lastShotAt = now;

  // 前向向量：从“向上”的本地基向量(0,-1)旋转 angle
  const dirX = Math.sin(player.angle);
  const dirY = -Math.cos(player.angle);
  const muzzleOffset = player.height / 2 + 16;
  const startX = player.x + dirX * muzzleOffset;
  const startY = player.y + dirY * muzzleOffset;
  const shots = player.multishot ? [0, -0.15, 0.15] : [0];
  for (let i = 0; i < shots.length; i++) {
    const ang = player.angle + shots[i];
    const vx = Math.sin(ang) * BULLET_SPEED;
    const vy = -Math.cos(ang) * BULLET_SPEED;
    bullets.push({ x: startX, y: startY, vx, vy, r: 3, alive: true });
  }
}

function updateBullets(dt) {
  for (let i = 0; i < bullets.length; i++) {
    const b = bullets[i];
    if (!b.alive) continue;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    // 击中敌人
    for (let j = 0; j < enemies.length; j++) {
      const e = enemies[j];
      if (!e.alive) continue;
      if (aabbIntersect(b.x - b.r, b.y - b.r, b.r * 2, b.r * 2, e.x, e.y, e.w, e.h)) {
        e.hp = (e.hp ?? 1) - 1;
        if (e.hp <= 0) {
          e.alive = false;
          GameState.score += e.score ?? 100;
        }
        b.alive = false;
        break;
      }
    }
    if (!b.alive) continue;
    // 击中障碍物
    for (let k = 0; k < obstacles.length; k++) {
      const o = obstacles[k];
      if (!o) continue;
      if (aabbIntersect(b.x - b.r, b.y - b.r, b.r * 2, b.r * 2, o.x, o.y, o.w, o.h)) {
        b.alive = false;
        o.hp -= 1;
        if (o.hp <= 0) {
          obstacles.splice(k, 1);
        }
        break;
      }
    }
    // 子弹击中玩家（自伤忽略，这里仅敌弹时使用；当前无敌弹）
    if (b.x < -b.r || b.x > GAME_WIDTH + b.r || b.y < -b.r || b.y > GAME_HEIGHT + b.r) {
      b.alive = false;
    }
  }
  bullets = bullets.filter(b => b.alive);
}

function drawBullets() {
  if (bullets.length === 0) return;
  ctx.save();
  ctx.fillStyle = '#ffd166';
  for (let i = 0; i < bullets.length; i++) {
    const b = bullets[i];
    ctx.beginPath();
    ctx.arc(b.x + 0.5, b.y + 0.5, b.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// 重置并回到菜单
function resetAndShowMenu() {
  GameState.isRunning = false;
  GameState.score = 0;
  GameState.lives = 3;
  GameState.level = 1;
  GameState.respawning = false;
  panel.style.display = 'flex';
  render(0);
}

// 初始渲染一次静态画面
// 由 init() 完成首次渲染

// 统一初始化入口
function init() {
  // 绑定 DOM
  canvas = document.getElementById('stage');
  ctx = canvas.getContext('2d');
  hudScore = document.getElementById('score');
  hudLives = document.getElementById('lives');
  panel = document.getElementById('panel');
  btnStart = document.getElementById('btn-start');
  btnRestart = document.getElementById('btn-restart');
  btnMusic = document.getElementById('btn-music');
  btnMusic = document.getElementById('btn-music');

  // 事件与缩放
  window.addEventListener('resize', fitCanvasToWindow);
  fitCanvasToWindow();

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Enter') {
      startGame();
    }
    if (e.code === 'Space') {
      // 按下空格立即尝试发射
      fireBullet();
    }
    Keys.add(e.code);
  });
  window.addEventListener('keyup', (e) => {
    Keys.delete(e.code);
  });

  btnStart?.addEventListener('click', () => startGame());
  btnRestart?.addEventListener('click', () => resetAndShowMenu());
  btnMusic?.addEventListener('click', toggleMusic);
  btnMusic?.addEventListener('click', toggleMusic);

  // 初始静态渲染
  loadHighScore();
  player = createPlayer();
  startLevel(1);
  render(0);
}

window.addEventListener('DOMContentLoaded', init);
// 关卡管理与持久化
function startLevel(levelNum) {
  GameState.level = levelNum;
  generateObstacles();
  generateEnemies();
  pickups = [];
  // 生成少量初始道具
  spawnPickups(3);
}

function nextLevel() {
  startLevel(GameState.level + 1);
}

function playerHit() {
  if (GameState.respawning) return;
  if (player.shieldActive) return; // 护盾中无伤
  GameState.lives -= 1;
  if (GameState.lives <= 0) {
    endGame();
    return;
  }
  GameState.respawning = true;
  setTimeout(() => {
    player = createPlayer();
    GameState.respawning = false;
  }, RESPAWN_TIME * 1000);
}

function endGame() {
  GameState.isRunning = false;
  saveHighScore();
  panel.style.display = 'flex';
}

function loadHighScore() {
  try {
    const v = localStorage.getItem('tank_high_score');
    if (v) GameState.highScore = parseInt(v, 10) || 0;
  } catch {}
}

function saveHighScore() {
  try {
    if (GameState.score > GameState.highScore) {
      GameState.highScore = GameState.score;
      localStorage.setItem('tank_high_score', String(GameState.highScore));
    }
  } catch {}
}
// 敌人更新（简易AI：向玩家移动）
function updateEnemies(dt) {
  if (!GameState.isRunning) return;
  for (let i = 0; i < enemies.length; i++) {
    const e = enemies[i];
    if (!e.alive) continue;
    const targetX = player.x;
    const targetY = player.y;
    let dx = targetX - (e.x + e.w/2);
    let dy = targetY - (e.y + e.h/2);
    const len = Math.hypot(dx, dy) || 1;
    dx /= len; dy /= len;
    const vx = dx * (e.speed || 40) * dt;
    const vy = dy * (e.speed || 40) * dt;
    // X 轴尝试
    let nx = e.x + vx; let ny = e.y;
    if (!collidesRectList(nx, ny, e.w, e.h, obstacles)) e.x = nx;
    // Y 轴尝试
    nx = e.x; ny = e.y + vy;
    if (!collidesRectList(nx, ny, e.w, e.h, obstacles)) e.y = ny;
    // 边界
    e.x = Math.max(0, Math.min(GAME_WIDTH - e.w, e.x));
    e.y = Math.max(0, Math.min(GAME_HEIGHT - e.h, e.y));
  }
}

// 背景音乐（WebAudio 简易合成，循环）
function ensureAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
}

function startMusic() {
  ensureAudio();
  if (musicNode) return;
  const ctx = audioCtx;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'triangle';
  g.gain.value = 0.05;
  o.connect(g).connect(ctx.destination);
  o.start();
  musicNode = { o, g };
  // 简单循环：每 1.5s 改变一次音高
  let step = 0;
  const seq = [261.63, 293.66, 329.63, 392.00, 329.63, 293.66];
  function tick() {
    if (!musicNode) return;
    const f = seq[step % seq.length];
    o.frequency.setTargetAtTime(f, ctx.currentTime, 0.05);
    step++;
    musicNode.timer = setTimeout(tick, 1500);
  }
  tick();
}

function stopMusic() {
  if (!musicNode) return;
  try { clearTimeout(musicNode.timer); } catch {}
  try { musicNode.o.stop(); } catch {}
  try { musicNode.o.disconnect(); } catch {}
  musicNode = null;
}

function toggleMusic() {
  musicOn = !musicOn;
  const btn = btnMusic;
  if (btn) {
    btn.setAttribute('aria-pressed', musicOn ? 'true' : 'false');
    btn.textContent = musicOn ? '音乐：开' : '音乐：关';
  }
  if (musicOn) startMusic(); else stopMusic();
}


