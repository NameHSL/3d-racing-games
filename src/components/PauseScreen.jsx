export default function PauseScreen({ onResume, onQuit }) {
  return (
    <div id="pause-screen" className="screen">
      <div className="menu-card" style={{ textAlign: 'center' }}>
        <div className="title" style={{ fontSize: '44px' }}>
          已暂停
        </div>
        <p style={{ color: '#c8d4ee', margin: '22px 0', letterSpacing: '1px' }}>按 ESC 继续比赛</p>
        <div className="row-btns" style={{ justifyContent: 'center' }}>
          <button className="big-btn" onClick={onResume}>
            继续比赛
          </button>
          <button className="big-btn secondary" onClick={onQuit}>
            放弃返回菜单
          </button>
        </div>
      </div>
    </div>
  );
}
