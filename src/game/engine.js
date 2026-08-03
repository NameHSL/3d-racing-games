import * as THREE from 'three';

// 初始化 Three.js 引擎：场景、相机、渲染器、灯光
// 返回包含这些对象的容器，由 World 持有
export function createEngine(canvas) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9ed8ff);
  scene.fog = new THREE.Fog(0x9ed8ff, 300, 720);

  const camera = new THREE.PerspectiveCamera(
    62,
    window.innerWidth / window.innerHeight,
    0.1,
    1500
  );
  camera.position.set(0, 60, 80);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  // 灯光
  const hemi = new THREE.HemisphereLight(0xcfeeff, 0x4a7a3a, 0.85);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xfff4e0, 1.05);
  sun.position.set(80, 160, 60);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 10;
  sun.shadow.camera.far = 720;
  sun.shadow.camera.left = -280;
  sun.shadow.camera.right = 280;
  sun.shadow.camera.top = 280;
  sun.shadow.camera.bottom = -280;
  sun.shadow.bias = -0.0004;
  scene.add(sun);

  const amb = new THREE.AmbientLight(0xffffff, 0.25);
  scene.add(amb);

  const clock = new THREE.Clock();

  return { scene, camera, renderer, clock, sun };
}
