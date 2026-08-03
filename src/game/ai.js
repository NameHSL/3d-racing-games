import * as THREE from 'three';
import { CFG } from './config.js';
import { clamp, angleDiff } from './utils.js';
import { updateKartPhysics } from './physics.js';

// AI：前瞻赛道点 + 横向偏好，按曲率/方向差调节油门，自动用道具/氮气
export function updateAI(world, kart, dt) {
  if (kart.locked || kart.finished) {
    kart.speed = 0;
    return;
  }
  const samples = world.track.samples;
  const N = samples.length;

  // 目标点：前方一段距离的中心 + 横向偏好
  const look = 0.012 + clamp(kart.speed / CFG.maxSpeed, 0, 1) * 0.04;
  const targetU = (kart.progress + look) % 1;
  const tgtIdx = Math.floor(targetU * N) % N;
  const ts = samples[tgtIdx];
  const target = ts.pos.clone().addScaledVector(ts.side, kart.aiSide);

  const toTarget = new THREE.Vector3().subVectors(target, kart.pos);
  toTarget.y = 0;
  const dist = toTarget.length();
  const desiredHeading = Math.atan2(toTarget.x, toTarget.z);

  // 转向
  const d = angleDiff(desiredHeading, kart.heading);
  kart.steer = clamp(d * 2.0, -1, 1);

  // 油门：按前方曲率与方向差减速
  const curveIdx = Math.floor((kart.progress + 0.03) * N) % N;
  const cs1 = samples[curveIdx];
  const cs2 = samples[(curveIdx + 12) % N];
  const curveAngle = Math.abs(
    angleDiff(Math.atan2(cs2.tangent.x, cs2.tangent.z), Math.atan2(cs1.tangent.x, cs1.tangent.z))
  );
  let throttle = kart.aiSkill * kart.aiAgg;
  if (curveAngle > 0.18 || Math.abs(d) > 0.7) throttle *= 0.62;
  kart.throttle = clamp(throttle, 0, 1);
  kart.brake = Math.abs(d) > 1.1 && kart.speed > CFG.maxSpeed * 0.6 ? 0.35 : 0;

  // 道具 / 氮气
  if (kart.item) {
    kart.aiItemDelay -= dt;
    if (kart.aiItemDelay <= 0) world.useItem(world, kart);
  }
  if (kart.nitro >= CFG.nitroMax) world.releaseNitro(world, kart);

  updateKartPhysics(world, kart, dt);
}
