// 游戏配置：物理参数、赛道控制点、道具、难度、车手配色

// 赛道控制点（闭合环形，y 为高低起伏；已用 Taubin 保形平滑消除急弯）
export const TRACK_POINTS = [
  [0.0, 0.0, 0.0],
  [60.0, 2.0, -8.0],
  [106.2, 6.5, -58.6],
  [133.8, 10.5, -106.6],
  [130.3, 7.0, -149.4],
  [93.4, 3.0, -183.7],
  [30.4, 0.8, -205.7],
  [-44.3, 4.2, -211.6],
  [-114.1, 9.0, -198.1],
  [-164.4, 12.0, -165.1],
  [-186.4, 8.5, -116.7],
  [-179.7, 4.2, -61.1],
  [-151.6, 1.4, -9.1],
  [-113.7, 0.0, 30.0],
  [-77.0, 3.5, 51.0],
  [-47.9, 7.5, 54.0],
  [-27.2, 4.2, 43.0],
  [-12.3, 1.4, 23.4]
];

export const CFG = {
  totalLaps: 3,
  roadWidth: 18,
  // 物理
  maxSpeed: 60,
  boostSpeed: 94,
  accel: 48,
  brake: 78,
  reverseSpeed: 22,
  drag: 0.42,
  rollFriction: 3.5,
  turnRate: 2.95,
  driftTurnBoost: 1.62,
  driftVisualMax: 0.55,
  steerLerp: 0.2,
  grassMaxSpeed: 0.42,
  grassDrag: 3.0,
  // AI
  aiBase: 0.93,
  // 镜头
  camDist: 9.5,
  camHeight: 4.6,
  camLookAhead: 7,
  // 起跑网格
  gridCount: 4,
  // 道具 / 氮气
  itemBoxRespawn: 7,
  turboSpeed: 112,
  nitroSpeed: 96,
  slowFactor: 0.4,
  slowTime: 2.6,
  spinTime: 0.9,
  shieldTime: 6,
  nitroMax: 100,
  nitroDriftRate: 32,
  nitroReleaseTime: 1.3,
  missileSpeed: 82,
  missileTurn: 3.2,
  mineLife: 18,
  // 碰撞
  kartRadius: 1.8
};

// 道具池（氮气权重更高）
export const ITEM_POOL = ['nitro', 'nitro', 'missile', 'mine', 'shield'];

export const ITEM_INFO = {
  nitro: { icon: '💨', name: '氮气瓶' },
  missile: { icon: '🚀', name: '追踪弹' },
  mine: { icon: '💣', name: '地雷' },
  shield: { icon: '🛡️', name: '护盾' }
};

export const DIFF = {
  easy: { aiSpeed: 0.86, aiAgg: 0.9, names: ['小蓝', '阿绿', '黄宝'] },
  normal: { aiSpeed: 0.95, aiAgg: 1.0, names: ['小蓝', '阿绿', '黄宝'] },
  hard: { aiSpeed: 1.04, aiAgg: 1.08, names: ['蓝魔', '绿影', '金箭'] }
};

// 车手配色（玩家始终红色）
export const KART_COLORS = [
  { name: '你', main: 0xff4757, accent: 0xffffff, dark: 0xc0392b },
  { name: 'AI1', main: 0x3742fa, accent: 0xffffff, dark: 0x1e2bd1 },
  { name: 'AI2', main: 0x2ed573, accent: 0xffffff, dark: 0x1f9b54 },
  { name: 'AI3', main: 0xffd93b, accent: 0x5a4a00, dark: 0xc9a90f }
];
