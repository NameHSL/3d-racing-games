import * as THREE from 'three';
import { CFG, TRACK_POINTS } from './config.js';

// 地面高度场：近赛道处贴赛道高度，远处指数衰减到 0
// 实现地面与道路高度一致（路面不再悬空）
function makeGroundHeight(samples) {
  const N = samples.length;
  return function (x, z) {
    let best = 0;
    let bd = Infinity;
    for (let i = 0; i < N; i++) {
      const s = samples[i].pos;
      const dx = s.x - x;
      const dz = s.z - z;
      const d2 = dx * dx + dz * dz;
      if (d2 < bd) {
        bd = d2;
        best = i;
      }
    }
    const trackY = samples[best].pos.y;
    const d = Math.sqrt(bd);
    const fade = Math.exp(-d / 80); // 80 单位衰减常数
    return trackY * fade;
  };
}

// 道具盒 "?" 纹理
function makeItemBoxTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ffe66d';
  ctx.fillRect(0, 0, 64, 64);
  ctx.strokeStyle = '#b27d10';
  ctx.lineWidth = 4;
  ctx.strokeRect(3, 3, 58, 58);
  ctx.fillStyle = '#b27d10';
  ctx.font = 'bold 44px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('?', 32, 34);
  const tex = new THREE.CanvasTexture(c);
  return tex;
}

function buildRoadMesh(scene, track) {
  const half = CFG.roadWidth / 2;
  const N = track.samples.length;
  const positions = [];
  const uvs = [];
  const indices = [];
  for (let i = 0; i < N; i++) {
    const s = track.samples[i];
    const left = s.pos.clone().addScaledVector(s.side, half);
    const right = s.pos.clone().addScaledVector(s.side, -half);
    positions.push(left.x, s.pos.y + 0.02, left.z, right.x, s.pos.y + 0.02, right.z);
    uvs.push(0, i / 8, 1, i / 8);
  }
  for (let i = 0; i < N; i++) {
    const a = i * 2;
    const b = i * 2 + 1;
    const c = ((i + 1) % N) * 2;
    const d = ((i + 1) % N) * 2 + 1;
    indices.push(a, c, b, b, c, d);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const mat = new THREE.MeshLambertMaterial({ color: 0x4a4a52, side: THREE.DoubleSide });
  const road = new THREE.Mesh(geo, mat);
  road.receiveShadow = true;
  scene.add(road);

  addEdgeLine(scene, track, half - 0.4, 0xffffff, 0.025);
  addEdgeLine(scene, track, -(half - 0.4), 0xffffff, 0.025);
  addCenterDashes(scene, track);
}

function addEdgeLine(scene, track, offset, color, yOff) {
  const N = track.samples.length;
  const positions = [];
  for (let i = 0; i <= N; i++) {
    const s = track.samples[i % N];
    const p = s.pos.clone().addScaledVector(s.side, offset);
    positions.push(p.x, p.y + 0.03 + yOff, p.z);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const mat = new THREE.LineBasicMaterial({ color });
  scene.add(new THREE.Line(geo, mat));
}

function addCenterDashes(scene, track) {
  const N = track.samples.length;
  const mat = new THREE.MeshBasicMaterial({ color: 0xfff7c2 });
  for (let i = 0; i < N; i += 8) {
    const s = track.samples[i];
    const s2 = track.samples[(i + 3) % N];
    const mid = s.pos.clone().add(s2.pos).multiplyScalar(0.5);
    const tan = s.tangent;
    const len = s.pos.distanceTo(s2.pos);
    const geo = new THREE.PlaneGeometry(0.5, len);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.rotation.z = -Math.atan2(tan.x, tan.z);
    mesh.position.set(mid.x, mid.y + 0.05, mid.z);
    scene.add(mesh);
  }
}

function buildBarriers(scene, track) {
  const half = CFG.roadWidth / 2 + 0.6;
  const N = track.samples.length;
  const step = 3;
  const matR = new THREE.MeshLambertMaterial({ color: 0xff4757 });
  const matW = new THREE.MeshLambertMaterial({ color: 0xf5f5f5 });
  const postGeo = new THREE.BoxGeometry(0.5, 1.0, 0.5);
  for (let i = 0; i < N; i += step) {
    const s = track.samples[i];
    const useRed = ((i / step) | 0) % 2 === 0;
    const mat = useRed ? matR : matW;
    const lp = s.pos.clone().addScaledVector(s.side, half);
    const rp = s.pos.clone().addScaledVector(s.side, -half);
    const a = new THREE.Mesh(postGeo, mat);
    a.position.set(lp.x, lp.y + 0.5, lp.z);
    a.castShadow = true;
    const b = new THREE.Mesh(postGeo, mat);
    b.position.set(rp.x, rp.y + 0.5, rp.z);
    b.castShadow = true;
    scene.add(a);
    scene.add(b);
  }
}

function buildStartLine(scene, track) {
  const s = track.samples[0];
  track.startDir = s.tangent.clone();
  track.startSide = s.side.clone();
  track.startPos = s.pos.clone();
  const half = CFG.roadWidth / 2;
  const cells = 10;
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < cells; c++) {
      const black = (r + c) % 2 === 0;
      const geo = new THREE.PlaneGeometry(CFG.roadWidth / cells, 1.2);
      const mat = new THREE.MeshBasicMaterial({ color: black ? 0x111111 : 0xffffff });
      const m = new THREE.Mesh(geo, mat);
      m.rotation.x = -Math.PI / 2;
      m.rotation.z = -Math.atan2(s.tangent.x, s.tangent.z);
      const offX = (c - cells / 2 + 0.5) * (CFG.roadWidth / cells);
      const offZ = (r - 0.5) * 1.2;
      m.position.set(
        s.pos.x + s.side.x * offX + s.tangent.x * offZ,
        s.pos.y + 0.06,
        s.pos.z + s.side.z * offX + s.tangent.z * offZ
      );
      scene.add(m);
    }
  }
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
  for (const sign of [-1, 1]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 5), poleMat);
    const pp = s.pos.clone().addScaledVector(s.side, half * sign);
    pole.position.set(pp.x, pp.y + 2.5, pp.z);
    pole.castShadow = true;
    scene.add(pole);
    const banner = new THREE.Mesh(
      new THREE.BoxGeometry(4, 1.4, 0.2),
      new THREE.MeshBasicMaterial({ color: 0xffe66d })
    );
    banner.position.set(pp.x, pp.y + 4.6, pp.z);
    scene.add(banner);
  }
}

function buildBoostPads(scene, track) {
  const pads = [];
  const padTs = [0.18, 0.36, 0.55, 0.72, 0.88];
  const padGeo = new THREE.BoxGeometry(5, 0.25, 3);
  const padMat = new THREE.MeshStandardMaterial({
    color: 0xff8c1a,
    emissive: 0xff5500,
    emissiveIntensity: 0.7
  });
  const stripeMat = new THREE.MeshBasicMaterial({ color: 0xffe66d });
  for (const t of padTs) {
    const idx = Math.floor(t * track.samples.length);
    const s = track.samples[idx];
    const mesh = new THREE.Mesh(padGeo, padMat);
    mesh.rotation.y = -Math.atan2(s.tangent.x, s.tangent.z) + Math.PI / 2;
    mesh.position.set(s.pos.x, s.pos.y + 0.18, s.pos.z);
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    scene.add(mesh);
    for (let k = -1; k <= 1; k++) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.06, 0.35), stripeMat);
      const fwd = s.tangent.clone().multiplyScalar(k * 0.9);
      stripe.position.set(s.pos.x + fwd.x, s.pos.y + 0.32, s.pos.z + fwd.z);
      stripe.rotation.y = mesh.rotation.y;
      scene.add(stripe);
    }
    pads.push({ t, pos: s.pos.clone(), mesh });
  }
  return pads;
}

function buildDecorations(scene, track) {
  const treeMat = new THREE.MeshLambertMaterial({ color: 0x2a7a2a });
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6b3f1d });
  const leafGeo = new THREE.ConeGeometry(2.2, 6, 8);
  const trunkGeo = new THREE.CylinderGeometry(0.5, 0.7, 3, 6);
  const N = track.samples.length;
  for (let i = 0; i < N; i += 12) {
    const s = track.samples[i];
    for (const dir of [1, -1]) {
      const dist = CFG.roadWidth / 2 + 8 + Math.random() * 14;
      const p = s.pos.clone().addScaledVector(s.side, dist * dir);
      const tree = new THREE.Group();
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.y = 1.5;
      trunk.castShadow = true;
      const leaf = new THREE.Mesh(leafGeo, treeMat);
      leaf.position.y = 5.5;
      leaf.castShadow = true;
      tree.add(trunk);
      tree.add(leaf);
      tree.position.set(p.x, p.y, p.z);
      tree.rotation.y = Math.random() * Math.PI;
      scene.add(tree);
    }
  }
  // 云朵
  const cloudMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.9
  });
  for (let i = 0; i < 12; i++) {
    const cloud = new THREE.Group();
    const n = 3 + ((Math.random() * 3) | 0);
    for (let j = 0; j < n; j++) {
      const r = 5 + Math.random() * 5;
      const s = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), cloudMat);
      s.position.set(j * 5 - n * 1.5, (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 4);
      cloud.add(s);
    }
    cloud.position.set(-160 + Math.random() * 320, 55 + Math.random() * 25, -180 + Math.random() * 220);
    scene.add(cloud);
  }
}

// 起伏地面：细分网格，顶点 y 按高度场采样
function buildGround(scene, getHeight) {
  const size = 900;
  const seg = 90;
  const geo = new THREE.PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    pos.setY(i, getHeight(x, z) - 0.3);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  const mat = new THREE.MeshLambertMaterial({ color: 0x5fa84a });
  const ground = new THREE.Mesh(geo, mat);
  ground.receiveShadow = true;
  scene.add(ground);
}

// 主构建入口：返回 track 数据 + boostPads
export function buildTrack(scene) {
  const track = {
    samples: [],
    curve: null,
    length: 0,
    startPos: null,
    startDir: null,
    startSide: null,
    groundHeight: null
  };

  const pts = TRACK_POINTS.map((p) => new THREE.Vector3(p[0], p[1], p[2]));
  const curve = new THREE.CatmullRomCurve3(pts, true, 'catmullrom', 0.5);
  curve.arcLengthDivisions = 1200;
  track.curve = curve;
  track.length = curve.getLength();

  // 弧长均匀采样
  const N = 600;
  track.samples = [];
  for (let i = 0; i < N; i++) {
    const u = i / N;
    track.samples.push({ u, pos: curve.getPointAt(u) });
  }
  // 切线与侧向（3D，含 y 分量用于俯仰）
  for (let i = 0; i < N; i++) {
    const s = track.samples[i];
    const next = track.samples[(i + 1) % N].pos;
    const prev = track.samples[(i - 1 + N) % N].pos;
    const tan = new THREE.Vector3().subVectors(next, prev).normalize();
    const side = new THREE.Vector3().crossVectors(tan, new THREE.Vector3(0, 1, 0)).normalize();
    s.tangent = tan;
    s.side = side;
  }

  // 高度场（用于地面顶点）
  track.groundHeight = makeGroundHeight(track.samples);

  // 包围盒（小地图用）
  let mnx = 1e9;
  let mxx = -1e9;
  let mnz = 1e9;
  let mxz = -1e9;
  for (const s of track.samples) {
    mnx = Math.min(mnx, s.pos.x);
    mxx = Math.max(mxx, s.pos.x);
    mnz = Math.min(mnz, s.pos.z);
    mxz = Math.max(mxz, s.pos.z);
  }
  track.bbox = { mnx, mxx, mnz, mxz };

  buildGround(scene, track.groundHeight);
  buildRoadMesh(scene, track);
  buildBarriers(scene, track);
  buildStartLine(scene, track);
  const boostPads = buildBoostPads(scene, track);
  buildDecorations(scene, track);

  return { track, boostPads };
}

export { makeItemBoxTexture };
