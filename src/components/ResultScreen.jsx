export default function ResultScreen({ snap, onRestart, onMenu }) {
  return (
    <div id="results-screen" className="screen">
      <h2 id="results-title">{snap.resultsTitle || '完赛！'}</h2>
      <div id="results-list">
        {snap.results.map((r) => (
          <div key={r.rank} className={'result-row' + (r.isPlayer ? ' you' : '')}>
            <span className="result-rank">{r.medal}</span>
            <span className="result-name">{r.name}</span>
            <span className="result-time">{r.time}</span>
          </div>
        ))}
      </div>
      <div className="row-btns">
        <button className="big-btn" onClick={onRestart}>
          再来一局
        </button>
        <button className="big-btn secondary" onClick={onMenu}>
          返回菜单
        </button>
      </div>
    </div>
  );
}
