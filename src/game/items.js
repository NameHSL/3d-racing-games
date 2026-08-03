import * as THREE from 'three';
import { CFG, ITEM_POOL } from './config.js';
import { makeItemBoxTexture } from './track.js';

// 放置道具箱（沿赛道若干位置的 3 个一排）
export function buildItemBoxes(world) {
  const positions = [0.09, 0.27, 0.45, 0.62, 0.8, 0.93];
  const tex = makeItemBoxTexture();
  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    emissive: 0x553300,
    emissiveIntensity: 0.45,
    transparent: true,
    opacity: 0.95
  });
  const geo = new THREE.BoxGeometry(1.6, 1.6, 1.6);
  const samples = world.track.samples;
  for (const t of positions) {
    const idx = Math.floor(t * samples.length) % samples.length;
    const s = samples[idx];
    for (let k = -1; k <= 1; k++) {
      const mesh = new THREE.Mesh(geo, mat);
      const p = s.pos.clone().addScaledVector(s.side, k * 5);
      mesh.position.set(p.x, p.y + 1.2, p.z);
      mesh.castShadow = true;
      world.scene.add(mesh);
      world.itemBoxes.push({
        mesh,
        pos: p.clone(),
        baseY: p.y + 1.2,
        phase: Math.random() * 6.28,
        active: true,
        respawn: 0
      });
    }
  }
}

export function rollItem() {
  return ITEM_POOL[(Math.random() * ITEM_POOL.length) | 0];
}

// 道具箱旋转浮动 + 拾取 + 重生
export function updateItemBoxes(world, dt) {
  const now = performance.now() * 0.003;
  for (const box of world.itemBoxes) {
    if (box.active) {
      box.mesh.rotation.y += dt * 1.6;
      box.mesh.position.y = box.baseY + Math.sin(now + box.phase) * 0.18;
      for (const k of world.karts) {
        if (k.finished || k.locked || k.item) continue;
        const dx = k.pos.x - box.pos.x;
        const dz = k.pos.z - box.pos.z;
        if (dx * dx + dz * dz < 7) {
          k.item = rollItem();
          if (k.isPlayer) {
            world.audio.blip(720, 0.12, 'square', 0.22);
          } else {
            k.aiItemDelay = 0.6 + Math.random() * 2.4;
          }
          box.active = false;
          box.respawn = CFG.itemBoxRespawn;
          box.mesh.visible = false;
          break;
        }
      }
    } else {
      box.respawn -= dt;
      if (box.respawn <= 0) {
        box.active = true;
        box.mesh.visible = true;
      }
    }
  }
}

// 使用道具
export function useItem(world, kart) {
  if (!kart || !kart.item || kart.locked) return;
  const it = kart.item;
  kart.item = null;
  if (it === 'nitro') {
    kart.turboTime = 2.2;
    if (kart.isPlayer) world.audio.boost();
  } else if (it === 'shield') {
    kart.shieldTime = CFG.shieldTime;
    if (kart.isPlayer) world.audio.blip(540, 0.2, 'sine', 0.2);
  } else if (it === 'missile') {
    world.spawnMissile(world, kart);
    if (kart.isPlayer) world.audio.blip(1200, 0.12, 'sawtooth', 0.18);
  } else if (it === 'mine') {
    world.spawnMine(world, kart);
    if (kart.isPlayer) world.audio.blip(300, 0.15, 'square', 0.18);
  }
}

// 导弹目标：上一名，否则最近对手
export function findMissileTarget(world, owner) {
  world.updateRanks(world);
  let target = null;
  for (const k of world.karts) {
    if (k === owner || k.finished) continue;
    if (k.rank === owner.rank - 1) {
      target = k;
      break;
    }
  }
  if (!target) {
    let bd = Infinity;
    for (const k of world.karts) {
      if (k === owner || k.finished) continue;
      const dx = k.pos.x - owner.pos.x;
      const dz = k.pos.z - owner.pos.z;
      const d = dx * dx + dz * dz;
      if (d < bd) {
        bd = d;
        target = k;
      }
    }
  }
  return target;
}

// 释放漂移氮气
export function releaseNitro(world, kart) {
  if (!kart || kart.locked) return;
  if (kart.nitro >= CFG.nitroMax) {
    kart.nitro = 0;
    kart.nitroTime = CFG.nitroReleaseTime;
    if (kart.isPlayer) world.audio.boost();
  }
}

// 受击：护盾抵挡 / 否则减速+打转+清增益
export function hitKart(world, target, attacker) {
  if (!target || target.finished || target.locked) return;
  if (target.shieldTime > 0) {
    target.shieldTime = 0;
    if (target.isPlayer) {
      world.showLapMessage('护盾抵挡！');
      world.audio.blip(880, 0.2, 'sine', 0.2);
    }
    return;
  }
  target.slowTime = CFG.slowTime;
  target.spinTime = CFG.spinTime;
  target.spinDir = Math.random() < 0.5 ? -1 : 1;
  target.speed *= 0.3;
  target.boostTime = 0;
  target.turboTime = 0;
  target.nitroTime = 0;
  if (target.isPlayer) {
    world.flashHit();
    world.audio.blip(180, 0.4, 'sawtooth', 0.25);
  }
}

// 加速带检测
export function checkBoostPads(world, kart) {
  if (kart.boostTime > 0.3) return; // 冷却
  for (const pad of world.boostPads) {
    const dx = kart.pos.x - pad.pos.x;
    const dz = kart.pos.z - pad.pos.z;
    if (dx * dx + dz * dz < 12) {
      kart.boostTime = 1.3;
      if (kart.isPlayer) world.audio.boost();
      break;
    }
  }
}
