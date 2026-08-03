import { CFG } from './config.js';

// 在上次索引附近搜索最近采样点（赛道闭合连续，局部搜索即可）
export function nearestSample(world, kart) {
  const samples = world.track.samples;
  const N = samples.length;
  let best = kart.lastNearest;
  let bestD = Infinity;
  const range = 40;
  for (let off = -range; off <= range; off++) {
    const i = (((kart.lastNearest + off) % N) + N) % N;
    const s = samples[i].pos;
    const dx = s.x - kart.pos.x;
    const dz = s.z - kart.pos.z;
    const d2 = dx * dx + dz * dz;
    if (d2 < bestD) {
      bestD = d2;
      best = i;
    }
  }
  kart.lastNearest = best;
  return best;
}

// 更新单车的圈数/进度（跨过起点线判定）
export function updateProgress(world, kart) {
  const idx = nearestSample(world, kart);
  const u = idx / world.track.samples.length;
  // 必须先跑到赛道中段，防止起点附近抖动误判
  if (u > 0.5) kart.canCountLap = true;
  const dp = u - kart.prevProgress;
  if (kart.canCountLap && dp < -0.5) {
    kart.lap += 1;
    kart.canCountLap = false;
    if (kart.isPlayer) {
      if (kart.lap < CFG.totalLaps) {
        world.audio.lap();
        world.showLapMessage('第 ' + (kart.lap + 1) + ' 圈！');
      }
    }
    if (kart.lap >= CFG.totalLaps && !kart.finished) {
      kart.finished = true;
      kart.finishTime = world.raceTime;
    }
  }
  kart.prevProgress = u;
  kart.progress = u;
  kart.totalProgress = kart.lap + u;
}

// 重算排名（按完赛时间或总进度）
export function updateRanks(world) {
  const sorted = world.karts.slice().sort((a, b) => {
    if (a.finished && b.finished) return a.finishTime - b.finishTime;
    if (a.finished) return -1;
    if (b.finished) return 1;
    return b.totalProgress - a.totalProgress;
  });
  for (let i = 0; i < sorted.length; i++) sorted[i].rank = i + 1;
}
