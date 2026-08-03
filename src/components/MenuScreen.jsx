export default function MenuScreen({ difficulty, setDifficulty, onStart }) {
  const diffs = [
    { key: 'easy', label: '简单' },
    { key: 'normal', label: '普通' },
    { key: 'hard', label: '困难' }
  ];
  return (
    <div id="menu-screen" className="screen">
      <div className="menu-card">
        <div className="title">3D 卡丁车竞速</div>
        <div className="subtitle">Mario Kart Style Racing</div>
        <div className="panel-label">操作说明</div>
        <div className="controls-grid">
          <div><b>↑ / W</b> 加速</div>
          <div><b>↓ / S</b> 刹车 / 倒车</div>
          <div><b>← → / A D</b> 转向</div>
          <div><b>空格</b> 漂移（过弯更灵活）</div>
          <div><b>R</b> 重置回赛道</div>
          <div><b>ESC</b> 暂停 / 菜单</div>
          <div><b>Shift</b> 使用道具</div>
          <div><b>Ctrl</b> 释放氮气（漂移积攒）</div>
        </div>
        <div className="panel-label">AI 难度</div>
        <div className="diff-row">
          {diffs.map((d) => (
            <button
              key={d.key}
              className={'diff-btn' + (difficulty === d.key ? ' active' : '')}
              onClick={() => setDifficulty(d.key)}
            >
              {d.label}
            </button>
          ))}
        </div>
        <button className="big-btn" onClick={onStart}>
          开始比赛
        </button>
      </div>
    </div>
  );
}
