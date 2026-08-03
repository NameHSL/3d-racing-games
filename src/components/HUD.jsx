import { useEffect, useRef } from 'react';

export default function HUD({ snap, registerMinimap }) {
  const minimapRef = useRef(null);

  // 把小地图 canvas 注册给 World（每帧由 World 命令式绘制）
  useEffect(() => {
    if (minimapRef.current) registerMinimap(minimapRef.current);
  }, [registerMinimap]);

  const arcLen = Math.round(snap.speedFrac * 188);
  const itemInfo = snap.item && snap.itemInfo ? snap.itemInfo[snap.item] : null;

  return (
    <div id="hud">
      <div id="lap-info" className="hud-panel">
        第 <span>{snap.lap}</span> / <span>{snap.totalLaps}</span> 圈
      </div>
      <div id="time-info" className="hud-panel">
        用时 <span>{snap.time}</span>
      </div>
      <div id="pos-info" className="hud-panel">
        <span>{snap.rank}</span>{' '}
        <span style={{ color: '#8ea0c8', fontSize: '14px' }}>/ {snap.totalRacers}</span>
      </div>

      <canvas id="minimap" width={170} height={170} ref={minimapRef} />

      <div id="speedometer">
        <svg width="150" height="150" viewBox="0 0 150 150">
          <path
            d="M 22 118 A 60 60 0 1 1 128 118"
            fill="none"
            stroke="rgba(255,255,255,.12)"
            strokeWidth="10"
            strokeLinecap="round"
          />
          <path
            d="M 22 118 A 60 60 0 1 1 128 118"
            fill="none"
            stroke="url(#sg)"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${arcLen} 999`}
          />
          <defs>
            <linearGradient id="sg" x1="0" x2="1">
              <stop offset="0" stopColor="#7bed9f" />
              <stop offset=".6" stopColor="#ffe66d" />
              <stop offset="1" stopColor="#ff4757" />
            </linearGradient>
          </defs>
        </svg>
        <div id="speed-val">{snap.speed}</div>
        <div className="speed-unit">KM/H</div>
      </div>

      <div id="nitro-label">N₂O 氮气</div>
      <div id="nitro-wrap">
        <div
          id="nitro-fill"
          className={snap.nitroReady ? 'ready' : ''}
          style={{ height: snap.nitro + '%' }}
        />
      </div>

      <div id="item-slot" className={snap.item ? 'has' : ''}>
        {snap.item ? (
          <>
            <span className="icon">{itemInfo ? itemInfo.icon : ''}</span>
            <span className="cap">Shift</span>
          </>
        ) : (
          <span className="cap">无道具</span>
        )}
      </div>

      <div id="hit-flash" className={snap.hitFlash ? 'show' : ''} />

      {!snap.boostActive ? null : <div id="boost-indicator">BOOST!</div>}

      <div id="lap-message" className={snap.lapMsgVisible ? 'show' : ''}>
        {snap.lapMsgText}
      </div>
    </div>
  );
}
