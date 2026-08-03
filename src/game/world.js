import * as THREE from 'three';
import { CFG, ITEM_INFO, DIFF } from './config.js';
import { clamp, formatTime } from './utils.js';
import { createAudio } from './audio.js';
import { createEngine } from './engine.js';
import { buildTrack } from './track.js';
import { setupRacers, applyKartTransform } from './kart.js';
import { nearestSample, updateProgress, updateRanks } from './race.js';
import { updateKartPhysics, resolveCollisions } from './physics.js';
import { updateAI } from './ai.js';
import { spawnMissile, spawnMine, updateProjectiles } from './projectiles.js';
import {
  buildItemBoxes,
  updateItemBoxes,
  useItem,
  findMissileTarget,
  releaseNitro,
  hitKart,
  checkBoostPads
} from './items.js';

// World：游戏核心，持有所有命令式状态与 Three.js 对象，React 仅通过 getState() 读快照
export class World {
  constructor(canvas) {
    this.canvas = canvas;
    this.audio = createAudio();

    const eng = createEngine(canvas);
    this.scene = eng.scene;
    this.camera = eng.camera;
    this.renderer = eng.renderer;
    this.clock = eng.clock;

    const built = buildTrack(this.scene);
    this.track = built.track;
    this.boostPads = built.boostPads;

    // 动态实体
    this.karts = [];
    this.player = null;
    this.projectiles = [];
    this.mines = [];
    this.itemBoxes = [];
    buildItemBoxes(this);

    // 流程状态
    this.gameState = 'menu'; // menu | countdown | racing | finished
    this.paused = false;
    this.difficulty = 'normal';
    this.raceTime = 0;
    this.countdownTimer = 0;
    this.countdownPhase = 0;
    this.goFlashTimer = 0;
    this.menuAngle = 0;
    this.hitFlashTimer = 0;
    this.lapMsgTimer = 0;
    this.lapMsgText = '';
    this.endRaceScheduled = false;
    this.results = [];
    this.resultsTitle = '';

    this.keys = {};
    this.minimapCanvas = null;
    this.rafId = null;

    // 装配跨模块函数（避免循环 import；调用约定 fn(world, ...)）
    this.nearestSample = nearestSample;
    this.updateProgress = updateProgress;
    this.updateRanks = updateRanks;
    this.updateKartPhysics = updateKartPhysics;
    this.resolveCollisions = resolveCollisions;
    this.updateAI = updateAI;
    this.spawnMissile = spawnMissile;
    this.spawnMine = spawnMine;
    this.updateProjectiles = updateProjectiles;
    this.updateItemBoxes = updateItemBoxes;
    this.useItem = useItem;
    this.findMissileTarget = findMissileTarget;
    this.releaseNitro = releaseNitro;
    this.hitKart = hitKart;
    this.checkBoostPads = checkBoostPads;

    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
    this._onResize = this._onResize.bind(this);
    this._loop = this._loop.bind(this);
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('resize', this._onResize);

    this.rafId = requestAnimationFrame(this._loop);
  }

  // ---------- 输入 ----------
  _onKeyDown(e) {
    this.keys[e.code] = true;
    if (e.code === 'KeyR' && this.gameState === 'racing' && !this.paused) this.resetPlayerToTrack();
    if (!e.repeat && this.gameState === 'racing' && !this.paused && this.player) {
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.useItem(this, this.player);
      else if (e.code === 'ControlLeft' || e.code === 'ControlRight') this.releaseNitro(this, this.player);
    }
    if (e.code === 'Escape' && this.gameState === 'racing') this.togglePause();
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  }
  _onKeyUp(e) {
    this.keys[e.code] = false;
  }
  _onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  _readPlayerInput() {
    const k = this.keys;
    const p = this.player;
    if (!p) return;
    p.throttle = k.ArrowUp || k.KeyW ? 1 : 0;
    p.brake = k.ArrowDown || k.KeyS ? 1 : 0;
    let target = 0;
    if (k.ArrowLeft || k.KeyA) target += 1;
    if (k.ArrowRight || k.KeyD) target -= 1;
    p.steer += (target - p.steer) * CFG.steerLerp;
    p.drifting = !!k.Space && Math.abs(target) > 0 && Math.abs(p.speed) > 9;
  }

  // ---------- 相机 ----------
  _updateRacingCamera(dt) {
    const p = this.player;
    const behind = new THREE.Vector3(
      -Math.sin(p.heading) * CFG.camDist,
      CFG.camHeight,
      -Math.cos(p.heading) * CFG.camDist
    );
    const target = p.pos.clone().add(behind);
    if (p.boostTime > 0) {
      target.x += (Math.random() - 0.5) * 0.5;
      target.y += (Math.random() - 0.5) * 0.5;
    }
    this.camera.position.lerp(target, clamp(dt * 5.5, 0, 1));
    const look = new THREE.Vector3(
      p.pos.x + Math.sin(p.heading) * CFG.camLookAhead,
      p.pos.y + 1.2,
      p.pos.z + Math.cos(p.heading) * CFG.camLookAhead
    );
    this.camera.lookAt(look);
  }
  _updateMenuCamera(dt) {
    this.menuAngle += dt * 0.12;
    const cx = -33;
    const cz = -76;
    const r = 240;
    this.camera.position.set(
      cx + Math.cos(this.menuAngle) * r,
      140 + Math.sin(this.menuAngle * 0.5) * 25,
      cz + Math.sin(this.menuAngle) * r
    );
    this.camera.lookAt(cx, 8, cz);
  }

  // ---------- 小地图 ----------
  setMinimapCanvas(canvas) {
    this.minimapCanvas = canvas;
  }
  _drawMinimap() {
    const cv = this.minimapCanvas;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    const W = cv.width;
    const H = cv.height;
    ctx.clearRect(0, 0, W, H);
    const b = this.track.bbox;
    const pad = 18;
    const sx = (W - pad * 2) / (b.mxx - b.mnx);
    const sz = (H - pad * 2) / (b.mxz - b.mnz);
    const sc = Math.min(sx, sz);
    const ox = pad - b.mnx * sc + ((W - pad * 2) - (b.mxx - b.mnx) * sc) / 2;
    const oz = pad - b.mnz * sc + ((H - pad * 2) - (b.mxz - b.mnz) * sc) / 2;
    const projX = (x) => x * sc + ox;
    const projY = (z) => z * sc + oz;
    const samples = this.track.samples;
    ctx.lineWidth = 6;
    ctx.strokeStyle = 'rgba(255,255,255,.85)';
    ctx.beginPath();
    for (let i = 0; i <= samples.length; i++) {
      const s = samples[i % samples.length];
      const X = projX(s.pos.x);
      const Y = projY(s.pos.z);
      if (i === 0) ctx.moveTo(X, Y);
      else ctx.lineTo(X, Y);
    }
    ctx.stroke();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#4a4a52';
    ctx.stroke();
    const sp = samples[0].pos;
    ctx.fillStyle = '#ffe66d';
    ctx.beginPath();
    ctx.arc(projX(sp.x), projY(sp.z), 4, 0, Math.PI * 2);
    ctx.fill();
    for (const k of this.karts) {
      ctx.fillStyle = '#' + this._colorHex(k.colorIdx);
      ctx.beginPath();
      ctx.arc(projX(k.pos.x), projY(k.pos.z), k.isPlayer ? 5 : 4, 0, Math.PI * 2);
      ctx.fill();
      if (k.isPlayer) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
  }
  _colorHex(i) {
    return KART_MAIN_HEX[i] || 'ff4757';
  }

  // ---------- 流程 ----------
  showLapMessage(text) {
    this.lapMsgText = text;
    this.lapMsgTimer = 1.6;
  }
  flashHit() {
    this.hitFlashTimer = 0.35;
  }

  startCountdown() {
    this.gameState = 'countdown';
    this.countdownTimer = 0;
    this.countdownPhase = 0;
    this.raceTime = 0;
    this.audio.count();
  }
  _tickCountdown(dt) {
    this.countdownTimer += dt;
    if (this.countdownTimer >= 1.0) {
      this.countdownTimer = 0;
      this.countdownPhase++;
      if (this.countdownPhase === 1) this.audio.count();
      else if (this.countdownPhase === 2) this.audio.count();
      else if (this.countdownPhase === 3) {
        this.audio.go();
        for (const k of this.karts) k.locked = false;
        this.gameState = 'racing';
        this.goFlashTimer = 0.8;
      }
    }
  }

  endRace() {
    this.gameState = 'finished';
    this.audio.setEngine(0, false);
    this.updateRanks(this);
    const sorted = this.karts.slice().sort((a, b) => {
      if (a.finished && b.finished) return a.finishTime - b.finishTime;
      if (a.finished) return -1;
      if (b.finished) return 1;
      return b.totalProgress - a.totalProgress;
    });
    const medals = ['🥇', '🥈', '🥉', '4️⃣'];
    this.results = sorted.map((k, i) => ({
      rank: i + 1,
      medal: medals[i],
      name: k.name,
      time: k.finished ? formatTime(k.finishTime) : '未完赛',
      isPlayer: k.isPlayer
    }));
    this.resultsTitle = sorted[0].isPlayer
      ? '冠军！🎉'
      : '你的名次：第 ' + this.player.rank + ' 名';
  }

  resetPlayerToTrack() {
    const p = this.player;
    if (!p) return;
    const idx = this.nearestSample(this, p);
    const s = this.track.samples[idx];
    p.pos.set(s.pos.x, s.pos.y, s.pos.z);
    p.heading = Math.atan2(s.tangent.x, s.tangent.z);
    const tlen = Math.sqrt(s.tangent.x * s.tangent.x + s.tangent.z * s.tangent.z);
    p.pitch = -Math.atan2(s.tangent.y, tlen);
    p.speed = 0;
    p.driftVisual = 0;
    applyKartTransform(p);
  }

  togglePause() {
    if (this.gameState !== 'racing') return;
    this.paused = !this.paused;
  }

  beginRace(difficulty) {
    this.audio.init();
    this.difficulty = difficulty || this.difficulty;
    this.paused = false;
    // 清除上一局
    for (const k of this.karts) this.scene.remove(k.mesh);
    for (const m of this.projectiles) this.scene.remove(m.mesh);
    this.projectiles = [];
    for (const m of this.mines) this.scene.remove(m.mesh);
    this.mines = [];
    for (const box of this.itemBoxes) {
      box.active = true;
      box.respawn = 0;
      box.mesh.visible = true;
    }
    const { karts, player } = setupRacers(this.scene, this.track, this.difficulty);
    this.karts = karts;
    this.player = player;
    this.endRaceScheduled = false;
    this.results = [];
    this.startCountdown();
    // 相机立即定位
    const behind = new THREE.Vector3(
      -Math.sin(player.heading) * CFG.camDist,
      CFG.camHeight,
      -Math.cos(player.heading) * CFG.camDist
    );
    this.camera.position.copy(player.pos.clone().add(behind));
    this.camera.lookAt(player.pos);
  }

  returnToMenu() {
    this.gameState = 'menu';
    this.paused = false;
    for (const k of this.karts) this.scene.remove(k.mesh);
    for (const m of this.projectiles) this.scene.remove(m.mesh);
    this.projectiles = [];
    for (const m of this.mines) this.scene.remove(m.mesh);
    this.mines = [];
    this.hitFlashTimer = 0;
    this.lapMsgTimer = 0;
    this.karts = [];
    this.player = null;
  }

  // ---------- 主循环 ----------
  _loop() {
    this.rafId = requestAnimationFrame(this._loop);
    let dt = this.clock.getDelta();
    dt = Math.min(dt, 0.05);

    if (this.paused) {
      this.renderer.render(this.scene, this.camera);
      return;
    }

    if (this.gameState === 'menu') {
      this._updateMenuCamera(dt);
    } else if (this.gameState === 'countdown') {
      this._tickCountdown(dt);
      this._updateRacingCamera(dt);
    } else if (this.gameState === 'racing') {
      this.raceTime += dt;
      this._readPlayerInput();
      this.updateKartPhysics(this, this.player, dt);
      for (const k of this.karts) if (!k.isPlayer) this.updateAI(this, k, dt);
      this.resolveCollisions(this);
      for (const k of this.karts) {
        this.updateProgress(this, k);
        if (!k.finished) this.checkBoostPads(this, k);
      }
      this.updateItemBoxes(this, dt);
      this.updateProjectiles(this, dt);
      if (this.hitFlashTimer > 0) this.hitFlashTimer -= dt;
      if (this.lapMsgTimer > 0) this.lapMsgTimer -= dt;
      if (this.goFlashTimer > 0) this.goFlashTimer -= dt;
      this.updateRanks(this);
      this._updateRacingCamera(dt);
      this._drawMinimap();
      this.audio.setEngine(Math.abs(this.player.speed) / CFG.maxSpeed, !this.player.locked && !this.player.finished);
      if (this.player.finished && !this.endRaceScheduled) {
        this.endRaceScheduled = true;
        setTimeout(() => this.endRace(), 2200);
      }
    } else if (this.gameState === 'finished') {
      this._updateMenuCamera(dt);
    }

    this.renderer.render(this.scene, this.camera);
  }

  // ---------- React 读取的 HUD 快照 ----------
  getState() {
    const p = this.player;
    const countdownText = ['3', '2', '1', 'GO!'][this.countdownPhase] || '';
    return {
      gameState: this.gameState,
      paused: this.paused,
      countdownText,
      countdownPhase: this.countdownPhase,
      countdownGo: this.countdownPhase >= 3,
      showGo: this.goFlashTimer > 0,
      lap: p ? clamp(p.lap + 1, 1, CFG.totalLaps) : 1,
      totalLaps: CFG.totalLaps,
      time: formatTime(this.raceTime),
      rank: p ? p.rank || 1 : 1,
      totalRacers: this.karts.length || CFG.gridCount,
      speed: p ? Math.round(Math.abs(p.speed) * 2.4) : 0,
      speedFrac: p ? clamp(Math.abs(p.speed) / CFG.boostSpeed, 0, 1) : 0,
      item: p ? p.item : null,
      nitro: p ? p.nitro : 0,
      nitroMax: CFG.nitroMax,
      nitroReady: p ? p.nitro >= CFG.nitroMax : false,
      boostActive: p ? p.boostTime > 0 || p.turboTime > 0 || p.nitroTime > 0 : false,
      lapMsgText: this.lapMsgText,
      lapMsgVisible: this.lapMsgTimer > 0,
      hitFlash: this.hitFlashTimer > 0,
      results: this.results,
      resultsTitle: this.resultsTitle,
      difficulty: this.difficulty,
      itemInfo: ITEM_INFO
    };
  }

  dispose() {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('resize', this._onResize);
    try {
      this.renderer.dispose();
    } catch (e) {
      /* ignore */
    }
  }
}

// 小地图用的配色（与 KART_COLORS.main 对应）
const KART_MAIN_HEX = ['ff4757', '3742fa', '2ed573', 'ffd93b'];
