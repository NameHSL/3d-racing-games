import { useEffect, useRef } from 'react';
import { World } from '../game/world.js';

// 仅渲染全屏 canvas 并在挂载后创建 World；卸载时 dispose 释放监听与 rAF
export default function GameCanvas({ onReady }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const world = new World(canvasRef.current);
    onReady(world);
    return () => world.dispose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <canvas id="game-canvas" ref={canvasRef} />;
}
