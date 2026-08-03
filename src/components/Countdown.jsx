export default function Countdown({ snap }) {
  const isGo = snap.showGo;
  const text = isGo ? 'GO!' : snap.countdownText;
  // key 随阶段变化 → 元素重挂载 → 重放 pop 动画
  const phaseKey = isGo ? 'go' : String(snap.countdownPhase);
  return (
    <div
      key={phaseKey}
      id="countdown"
      className={'pop' + (isGo ? ' go' : '')}
    >
      {text}
    </div>
  );
}
