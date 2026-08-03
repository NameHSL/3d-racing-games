import * as THREE from 'three';
import { CFG } from './config.js';
import { clamp, lerp } from './utils.js';
import { applyKartTransform } from './kart.js';

// 单车物理：油门/刹车/摩擦/限速/转向/积分/贴地/计时器/漂移氮气
export function updateKartPhysics(world, kart, dt) {
  if (kart.locked) {
    kart.speed = 0;
    return;
  }

  const samples = world.track.samples;
  const nearest = world.nearestSample(world, kart);
  const s = samples[nearest];

  // 是否偏离到草地
  const toCenter = new THREE.Vector3(kart.pos.x - s.pos.x, 0, kart.pos.z - s.pos.z);
  const sideDist = Math.abs(toCenter.dot(s.side));
  const onGrass = sideDist > CFG.roadWidth / 2 + 0.5;
  kart._onGrass = onGrass;

  // 当前极速（增益 / 被击中减速覆盖）
  let mx = CFG.maxSpeed;
  if (kart.boostTime > 0) mx = Math.max(mx, CFG.boostSpeed);
  if (kart.nitroTime > 0) mx = Math.max(mx, CFG.nitroSpeed);
  if (kart.turboTime > 0) mx = Math.max(mx, CFG.turboSpeed);
  if (kart.slowTime > 0) mx = CFG.maxSpeed * CFG.slowFactor;
  const curMax = onGrass ? mx * CFG.grassMaxSpeed : mx;

  if (kart.throttle > 0) kart.speed += CFG.accel * kart.throttle * dt;
  if (kart.brake > 0) {
    if (kart.speed > 0.2) kart.speed -= CFG.brake * kart.brake * dt;
    else kart.speed -= CFG.accel * 0.6 * kart.brake * dt; // 倒车
  }
  // 摩擦
  kart.speed -= kart.speed * CFG.drag * dt;
  kart.speed -= Math.sign(kart.speed) * CFG.rollFriction * dt * (onGrass ? CFG.grassDrag : 1);
  kart.speed = clamp(kart.speed, -CFG.reverseSpeed, curMax);
  if (Math.abs(kart.speed) < 0.05) kart.speed = 0;

  // 转向（低速也保留一定能力，起步/弯道更灵活）
  const speedFactor = clamp((Math.abs(kart.speed) + 5) / 18, 0.35, 1);
  let turn = CFG.turnRate * kart.steer * speedFactor;
  if (kart.drifting) turn *= CFG.driftTurnBoost;
  if (kart.speed < 0) turn = -turn;
  if (kart.spinTime > 0) turn = 7 * (kart.spinDir || 1); // 被击中打转
  kart.heading += turn * dt;

  // 位置积分
  kart.pos.x += Math.sin(kart.heading) * kart.speed * dt;
  kart.pos.z += Math.cos(kart.heading) * kart.speed * dt;

  // 贴地：跟随赛道高度 + 按切线坡度俯仰
  const ns = samples[nearest];
  kart.pos.y = ns.pos.y;
  const tlen = Math.sqrt(ns.tangent.x * ns.tangent.x + ns.tangent.z * ns.tangent.z);
  kart.pitch = -Math.atan2(ns.tangent.y, tlen);

  // 计时器衰减
  if (kart.boostTime > 0) kart.boostTime -= dt;
  if (kart.turboTime > 0) kart.turboTime -= dt;
  if (kart.nitroTime > 0) kart.nitroTime -= dt;
  if (kart.slowTime > 0) kart.slowTime -= dt;
  if (kart.shieldTime > 0) kart.shieldTime -= dt;
  if (kart.spinTime > 0) kart.spinTime -= dt;

  // 漂移积累氮气
  if (kart.drifting && kart.speed > 9)
    kart.nitro = clamp(kart.nitro + CFG.nitroDriftRate * dt, 0, CFG.nitroMax);

  // 视觉漂移偏角
  const targetDrift = kart.drifting ? clamp(kart.steer, -1, 1) * CFG.driftVisualMax : 0;
  kart.driftVisual = lerp(kart.driftVisual, targetDrift, dt * 8);

  // 轮子滚动
  kart.wheelsSpin += kart.speed * dt * 0.4;

  applyKartTransform(kart);
}

// 车辆两两弹性碰撞：动量传递 + 位置分离 + 车头偏转
export function resolveCollisions(world) {
  const karts = world.karts;
  const minD = 3.6;
  for (let i = 0; i < karts.length; i++) {
    for (let j = i + 1; j < karts.length; j++) {
      const a = karts[i];
      const b = karts[j];
      const dx = b.pos.x - a.pos.x;
      const dz = b.pos.z - a.pos.z;
      const d2 = dx * dx + dz * dz;
      if (d2 >= minD * minD || d2 <= 0.001) continue;
      const d = Math.sqrt(d2);
      const nx = dx / d;
      const nz = dz / d; // a→b 法线
      // 1) 位置分离
      const overlap = (minD - d) / 2;
      a.pos.x -= nx * overlap;
      a.pos.z -= nz * overlap;
      b.pos.x += nx * overlap;
      b.pos.z += nz * overlap;
      // 2) 法向相对速度
      const vax = Math.sin(a.heading) * a.speed;
      const vaz = Math.cos(a.heading) * a.speed;
      const vbx = Math.sin(b.heading) * b.speed;
      const vbz = Math.cos(b.heading) * b.speed;
      const vrel = (vbx - vax) * nx + (vbz - vaz) * nz;
      if (vrel >= 0) continue; // 远离：只分开
      // 3) 弹性冲量（等质量）
      const e = 0.35;
      const J = (-(1 + e) * vrel) / 2; // >0
      a.speed = clamp(
        a.speed - J * (nx * Math.sin(a.heading) + nz * Math.cos(a.heading)),
        -CFG.reverseSpeed,
        CFG.maxSpeed * 1.25
      );
      b.speed = clamp(
        b.speed + J * (nx * Math.sin(b.heading) + nz * Math.cos(b.heading)),
        -CFG.reverseSpeed,
        CFG.maxSpeed * 1.25
      );
      // 4) 侧向冲量 → 车头偏转
      const sideA = nz * Math.sin(a.heading) - nx * Math.cos(a.heading);
      const sideB = nz * Math.sin(b.heading) - nx * Math.cos(b.heading);
      a.heading += clamp(J * sideA * 0.015, -0.12, 0.12);
      b.heading += clamp(-J * sideB * 0.015, -0.12, 0.12);
      // 5) 撞击音效
      if (vrel < -2.5 && (a.isPlayer || b.isPlayer)) world.audio.blip(150, 0.12, 'square', 0.18);
    }
  }
}
