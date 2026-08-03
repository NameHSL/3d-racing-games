// 通用工具函数

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;

// 角度差（-PI..PI），用于平滑转向
export function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function formatTime(sec) {
  if (sec == null || !isFinite(sec)) return '--:--';
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  return m + ':' + s.toFixed(1).padStart(4, '0');
}
