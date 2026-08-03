import { useCallback, useEffect, useRef, useState } from 'react';
import GameCanvas from './components/GameCanvas.jsx';
import MenuScreen from './components/MenuScreen.jsx';
import HUD from './components/HUD.jsx';
import Countdown from './components/Countdown.jsx';
import PauseScreen from './components/PauseScreen.jsx';
import ResultScreen from './components/ResultScreen.jsx';

function LoadingScreen() {
  return (
    <div id="loading-screen" className="screen">
      <div className="spinner" />
      <div style={{ fontSize: '18px', letterSpacing: '2px' }}>正在构建赛道…</div>
    </div>
  );
}

export default function App() {
  const worldRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [snap, setSnap] = useState(null);
  const [difficulty, setDifficulty] = useState('normal');

  // GameCanvas 挂载后回调：保存 world 并开始轮询
  const handleReady = useCallback((world) => {
    worldRef.current = world;
    setReady(true);
  }, []);

  // 50ms 轮询 HUD 快照（避免每帧 setState）
  useEffect(() => {
    if (!ready) return;
    setSnap(worldRef.current.getState());
    const id = setInterval(() => setSnap(worldRef.current.getState()), 50);
    return () => clearInterval(id);
  }, [ready]);

  // HUD 挂载时把小地图 canvas 注册给 World
  const registerMinimap = useCallback((canvas) => {
    if (worldRef.current) worldRef.current.setMinimapCanvas(canvas);
  }, []);

  const gs = snap ? snap.gameState : 'menu';
  const showHud = ready && snap && (gs === 'countdown' || gs === 'racing' || snap.showGo);

  return (
    <>
      {/* Three.js 画布，全程唯一实例 */}
      <GameCanvas onReady={handleReady} />

      {!ready || !snap ? (
        <LoadingScreen />
      ) : (
        <>
          {gs === 'menu' && (
            <MenuScreen
              difficulty={difficulty}
              setDifficulty={setDifficulty}
              onStart={() => worldRef.current.beginRace(difficulty)}
            />
          )}
          {showHud && (
            <>
              <HUD snap={snap} registerMinimap={registerMinimap} />
              {(gs === 'countdown' || snap.showGo) && <Countdown snap={snap} />}
            </>
          )}
          {gs === 'racing' && snap.paused && (
            <PauseScreen
              onResume={() => worldRef.current.togglePause()}
              onQuit={() => worldRef.current.returnToMenu()}
            />
          )}
          {gs === 'finished' && (
            <ResultScreen
              snap={snap}
              onRestart={() => worldRef.current.beginRace(difficulty)}
              onMenu={() => worldRef.current.returnToMenu()}
            />
          )}
        </>
      )}
    </>
  );
}
