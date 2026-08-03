import * as THREE from 'three';
import { CFG, DIFF, KART_COLORS } from './config.js';

// 卡丁车 3D 模型（朝 +Z）
export function createKartMesh(color) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: color.main, roughness: 0.45, metalness: 0.15 });
  const darkMat = new THREE.MeshStandardMaterial({ color: color.dark, roughness: 0.6 });
  const blackMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.8 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x223044, roughness: 0.2, metalness: 0.4 });
  const accMat = new THREE.MeshStandardMaterial({ color: color.accent, roughness: 0.5 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.7, 3.4), bodyMat);
  body.position.y = 0.7;
  body.castShadow = true;
  g.add(body);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.5, 0.9), bodyMat);
  nose.position.set(0, 0.55, 2.0);
  nose.castShadow = true;
  g.add(nose);
  const cock = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.7, 1.6), darkMat);
  cock.position.set(0, 1.35, -0.2);
  cock.castShadow = true;
  g.add(cock);
  const shield = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.55, 0.15), glassMat);
  shield.position.set(0, 1.4, 0.65);
  shield.rotation.x = -0.35;
  g.add(shield);
  // 后扰流
  const wing = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.12, 0.6), darkMat);
  wing.position.set(0, 1.2, -1.8);
  wing.castShadow = true;
  g.add(wing);
  const wsL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.6, 0.5), darkMat);
  wsL.position.set(0.9, 0.95, -1.8);
  const wsR = wsL.clone();
  wsR.position.x = -0.9;
  g.add(wsL);
  g.add(wsR);
  // 车头装饰圆
  const badge = new THREE.Mesh(new THREE.CircleGeometry(0.32, 16), accMat);
  badge.position.set(0, 0.7, 2.46);
  g.add(badge);
  // 轮子
  const wheelGeo = new THREE.CylinderGeometry(0.65, 0.65, 0.5, 14);
  const wfl = new THREE.Mesh(wheelGeo, blackMat);
  wfl.rotation.z = Math.PI / 2;
  wfl.position.set(1.2, 0.65, 1.3);
  wfl.castShadow = true;
  const wfr = wfl.clone();
  wfr.position.x = -1.2;
  const wbl = wfl.clone();
  wbl.position.z = -1.3;
  const wbr = wfl.clone();
  wbr.position.set(-1.2, 0.65, -1.3);
  g.add(wfl);
  g.add(wfr);
  g.add(wbl);
  g.add(wbr);
  g.userData.wheels = [wfl, wfr, wbl, wbr];

  // 护盾罩
  const shieldMesh = new THREE.Mesh(
    new THREE.SphereGeometry(2.4, 16, 12),
    new THREE.MeshBasicMaterial({ color: 0x70a1ff, transparent: true, opacity: 0.28 })
  );
  shieldMesh.position.y = 1.0;
  shieldMesh.visible = false;
  g.add(shieldMesh);
  g.userData.shieldMesh = shieldMesh;

  g.rotation.order = 'YXZ';
  return g;
}

// 起跑排位：返回 { karts, player }
export function setupRacers(scene, track, difficulty) {
  const karts = [];
  const diff = DIFF[difficulty];
  let player = null;

  for (let i = 0; i < CFG.gridCount; i++) {
    const col = i % 2;
    const row = (i / 2) | 0;
    const isPlayer = i === 0;
    const color = KART_COLORS[i];
    const mesh = createKartMesh(color);
    scene.add(mesh);

    const startU = 0.002 + row * 0.013;
    const sIdx = Math.floor(startU * track.samples.length) % track.samples.length;
    const s = track.samples[sIdx];
    const sideOff = (col === 0 ? 1 : -1) * (CFG.roadWidth * 0.18);
    const pos = s.pos.clone().addScaledVector(s.side, sideOff);
    const heading = Math.atan2(s.tangent.x, s.tangent.z);
    const tlen = Math.sqrt(s.tangent.x * s.tangent.x + s.tangent.z * s.tangent.z);
    const pitch = -Math.atan2(s.tangent.y, tlen);

    mesh.position.set(pos.x, pos.y, pos.z);
    mesh.rotation.y = heading;

    const kart = {
      mesh,
      isPlayer,
      colorIdx: i,
      name: isPlayer ? '你' : diff.names[i - 1],
      pos: new THREE.Vector3(pos.x, pos.y, pos.z),
      heading,
      pitch,
      speed: 0,
      driftVisual: 0,
      steer: 0,
      throttle: 0,
      brake: 0,
      drifting: false,
      progress: startU,
      prevProgress: startU,
      lap: 0,
      totalProgress: 0,
      finished: false,
      finishTime: null,
      canCountLap: false,
      lastNearest: sIdx,
      rank: i + 1,
      aiSide: (Math.random() - 0.5) * (CFG.roadWidth * 0.5),
      aiSkill: diff.aiSpeed * (0.97 + Math.random() * 0.08),
      aiAgg: diff.aiAgg,
      boostTime: 0,
      turboTime: 0,
      nitroTime: 0,
      slowTime: 0,
      spinTime: 0,
      spinDir: 1,
      shieldTime: 0,
      item: null,
      nitro: 0,
      aiItemDelay: 0,
      wheelsSpin: 0,
      locked: true,
      _onGrass: false
    };
    if (isPlayer) player = kart;
    karts.push(kart);
  }
  return { karts, player };
}

// 把卡丁车状态同步到 mesh
export function applyKartTransform(kart) {
  kart.mesh.position.set(kart.pos.x, kart.pos.y || 0, kart.pos.z);
  kart.mesh.rotation.y = kart.heading + kart.driftVisual;
  kart.mesh.rotation.x = kart.pitch || 0; // 上下坡俯仰
  kart.mesh.rotation.z = -kart.steer * 0.06 * Math.min(1, Math.abs(kart.speed / CFG.maxSpeed));
  if (kart.turboTime > 0 || kart.boostTime > 0 || kart.nitroTime > 0) {
    kart.mesh.position.y = (kart.pos.y || 0) + Math.abs(Math.sin(performance.now() * 0.04)) * 0.14;
  }
  const wheels = kart.mesh.userData.wheels;
  if (wheels) {
    for (const w of wheels) w.rotation.x = kart.wheelsSpin;
  }
  const sm = kart.mesh.userData.shieldMesh;
  if (sm) {
    const show = kart.shieldTime > 0;
    if (show !== sm.visible) sm.visible = show;
    if (show) sm.rotation.y += 0.04;
  }
}
