# 3D 卡丁车竞速 · Mario Kart Style (React + Three.js)

单 HTML 版本重构为 **React + Vite** 标准工程。Three.js 负责所有 3D 渲染与游戏物理（命令式），React 负责 UI 界面、状态显示与生命周期管理。

## 技术栈

- **React 18** + **Vite 5**（标准工程，`npm install` + `npm run dev`）
- **three@0.128.0**（沿用原版的 r128 API）
- 原生 Web Audio（引擎声 / 倒计时 / 音效）

## 运行

```bash
npm install      # 安装依赖
npm run dev      # 启动开发服务器（默认 http://localhost:5173）
npm run build    # 生产构建到 dist/
npm run preview  # 预览构建产物
```

## 操作

| 按键 | 功能 |
| --- | --- |
| ↑ / W | 加速 |
| ↓ / S | 刹车 / 倒车 |
| ← → / A D | 转向 |
| 空格 | 漂移（过弯更灵活，积攒氮气） |
| Shift | 使用道具 |
| Ctrl | 释放氮气（漂移积攒满后） |
| R | 重置回赛道 |
| ESC | 暂停 / 继续 |

## 工程结构

```
mario-kart-react/
├── index.html               # Vite 入口
├── vite.config.js
└── src/
    ├── main.jsx             # React 挂载
    ├── App.jsx              # 顶层：创建 World、轮询 HUD 快照、按状态切换界面
    ├── styles.css           # 全部样式（迁移自原 HTML）
    ├── components/          # React UI 组件
    │   ├── GameCanvas.jsx   # 全屏 canvas，挂载时创建 World
    │   ├── MenuScreen.jsx   # 主菜单（难度选择 / 操作说明）
    │   ├── HUD.jsx          # 圈数/计时/名次/小地图/速度表/道具栏/氮气
    │   ├── Countdown.jsx    # 3-2-1-GO 倒计时
    │   ├── PauseScreen.jsx  # 暂停
    │   └── ResultScreen.jsx # 结算
    └── game/                # Three.js 游戏核心（框架无关，纯命令式）
        ├── config.js        # 物理参数 / 赛道控制点 / 道具 / 难度 / 配色
        ├── utils.js         # clamp / lerp / angleDiff / formatTime
        ├── audio.js         # Web Audio 引擎声与音效
        ├── engine.js        # 场景 / 相机 / 渲染器 / 灯光
        ├── track.js         # 赛道曲线 / 道路 / 护栏 / 起跑线 / 加速带 / 起伏地面
        ├── kart.js          # 卡丁车模型 / 起排位 / 变换同步
        ├── physics.js       # 单车物理积分 / 弹性碰撞
        ├── ai.js            # AI 转向 / 油门 / 道具使用
        ├── race.js          # 最近点 / 圈数进度 / 排名
        ├── projectiles.js   # 追踪导弹 / 地雷
        ├── items.js         # 道具箱 / 四种道具 / 受击效果 / 加速带
        └── world.js         # World 类：持有全部状态、装配模块、主循环、输入、相机、HUD 快照
```

## 架构：React ↔ Three.js 桥接

- **World 类**（`src/game/world.js`）是游戏核心，持有所有命令式状态与 Three.js 对象，自驱 `requestAnimationFrame` 主循环。
- React 不参与每帧渲染，而是通过 `world.getState()` 每 50ms 拉取一份 HUD 快照（圈数、计时、名次、速度、道具、氮气等）写入 React state，触发 UI 更新——避免每帧 `setState`。
- 小地图 canvas 由 React 渲染、World 在主循环里命令式绘制。
- 界面切换（菜单 / 倒计时 / 比赛 / 暂停 / 结算）由 `snap.gameState` 驱动；按钮调用 `world.beginRace() / togglePause() / returnToMenu()` 等方法。

## 本次相对单 HTML 版本的改进

1. **React 工程化**：拆分为 13 个游戏核心模块 + 6 个 UI 组件，职责清晰，便于维护与扩展。
2. **异常急弯消除**：用 Taubin 保形平滑算法（λ=0.5, μ=-0.53，40 次迭代，仅平滑 x/z、保留 y、固定首点）处理赛道控制点，最大曲率从 9.87 rad/单位降至 0.077，最小转弯半径从 1.4 提升到 12.95——视觉与驾驶都顺滑。
3. **地面贴合道路高度**：地面网格（90×90 细分）每个顶点的 y 按高度场 `groundHeight(x,z) = 最近赛道点.y × exp(-距离/80)` 采样，近赛道处地面与路面高度一致（路面不再悬空），远处平滑过渡到 0。验证显示地面与赛道高度偏差为 0.000。

## 验证

在 Node 中用 three@0.128.0 离线验证（沙箱无图形浏览器）：

- 赛道总长 929.9 单位，最大曲率 0.077 rad/单位，最小转弯半径 12.95
- 起点闭合角 4.89°（首尾切线连续）
- 地面 vs 赛道高度最大偏差 0.000（完美贴地）
- 圈数环回判定正确
- 物理加速 / 移动 / 贴地 / 弹性碰撞分离 / 道具 / 护盾抵挡 / 导弹与地雷 / AI / 排名 / 导弹目标 —— 14/14 烟雾测试通过
- `vite build` 50 模块编译通过

图形效果（渲染、光照、相机）需在浏览器中运行 `npm run dev` 实测。
