import * as THREE from 'three';
import { CFG } from './config.js';
import { clamp, angleDiff } from './utils.js';

// 追踪导弹
export function spawnMissile(world, owner) {
  const target = world.findMissileTarget(world, owner);
  const group = new THREE.Group();
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(0.45, 1.8, 10),
    new THREE.MeshStandardMaterial({ color: 0xff4757, emissive: 0xff2200, emissiveIntensity: 0.85 })
  );
  cone.rotation.x = Math.PI / 2; // 尖端朝 +Z
  group.add(cone);
  const tail = new THREE.Mesh(
    new THREE.ConeGeometry(0.3, 1.0, 8),
    new THREE.MeshBasicMaterial({ color: 0xffd93b })
  );
  tail.rotation.x = -Math.PI / 2;
  tail.position.z = -1.3;
  group.add(tail);
  const px = owner.pos.x + Math.sin(owner.heading) * 2.6;
  const pz = owner.pos.z + Math.cos(owner.heading) * 2.6;
  group.position.set(px, owner.pos.y + 1.0, pz);
  group.rotation.y = owner.heading;
  world.scene.add(group);
  world.projectiles.push({
    mesh: group,
    owner,
    target,
    pos: new THREE.Vector3(px, owner.pos.y + 1.0, pz),
    heading: owner.heading,
    life: 4.5
  });
}

// 地雷（留在车主后方）
export function spawnMine(world, owner) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.9, 12, 8),
    new THREE.MeshStandardMaterial({ color: 0x1a1a1a, emissive: 0x880000, emissiveIntensity: 0.6 })
  );
  const px = owner.pos.x - Math.sin(owner.heading) * 4;
  const pz = owner.pos.z - Math.cos(owner.heading) * 4;
  mesh.position.set(px, owner.pos.y + 0.5, pz);
  mesh.castShadow = true;
  world.scene.add(mesh);
  world.mines.push({
    mesh,
    owner,
    pos: new THREE.Vector3(px, owner.pos.y + 0.5, pz),
    life: CFG.mineLife
  });
}

// 更新所有投射物：导弹追踪/撞击，地雷触发/过期
export function updateProjectiles(world, dt) {
  const projectiles = world.projectiles;
  const mines = world.mines;
  const karts = world.karts;

  for (let i = projectiles.length - 1; i >= 0; i--) {
    const m = projectiles[i];
    m.life -= dt;
    if (m.target && !m.target.finished) {
      const dx = m.target.pos.x - m.pos.x;
      const dz = m.target.pos.z - m.pos.z;
      const desired = Math.atan2(dx, dz);
      const d = angleDiff(desired, m.heading);
      m.heading += clamp(d, -CFG.missileTurn * dt, CFG.missileTurn * dt);
    }
    m.pos.x += Math.sin(m.heading) * CFG.missileSpeed * dt;
    m.pos.z += Math.cos(m.heading) * CFG.missileSpeed * dt;
    m.mesh.position.set(m.pos.x, (m.target ? m.target.pos.y : m.owner.pos.y) + 1.0, m.pos.z);
    m.mesh.rotation.y = m.heading;
    let hit = false;
    if (m.target && !m.target.finished) {
      const dx = m.target.pos.x - m.pos.x;
      const dz = m.target.pos.z - m.pos.z;
      if (dx * dx + dz * dz < 6) {
        world.hitKart(world, m.target, m.owner);
        hit = true;
      }
    }
    if (!hit) {
      for (const k of karts) {
        if (k === m.owner || k.finished) continue;
        const dx = k.pos.x - m.pos.x;
        const dz = k.pos.z - m.pos.z;
        if (dx * dx + dz * dz < 5) {
          world.hitKart(world, k, m.owner);
          hit = true;
          break;
        }
      }
    }
    if (hit || m.life <= 0) {
      world.scene.remove(m.mesh);
      projectiles.splice(i, 1);
    }
  }

  for (let i = mines.length - 1; i >= 0; i--) {
    const mn = mines[i];
    mn.life -= dt;
    mn.mesh.rotation.y += dt * 1.2;
    let triggered = false;
    for (const k of karts) {
      if (k === mn.owner || k.locked) continue;
      const dx = k.pos.x - mn.pos.x;
      const dz = k.pos.z - mn.pos.z;
      if (dx * dx + dz * dz < 6) {
        world.hitKart(world, k, mn.owner);
        triggered = true;
        break;
      }
    }
    if (triggered || mn.life <= 0) {
      world.scene.remove(mn.mesh);
      mines.splice(i, 1);
    }
  }
}
