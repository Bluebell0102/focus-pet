# Focus Pet 动画技术路线调研报告

> 调研日期: 2026-06-07 | 目标: 1-2 天落地，效果比静态贴图自然

---

## 一、三条技术路线对比

### 路线 A：Live2D Cubism 4 + pixi-live2d-display

| 维度 | 评价 |
|------|------|
| **动画自然度** | ⭐⭐⭐⭐⭐ 最佳 — 骨骼变形、物理模拟、呼吸、表情切换 |
| **实现难度** | ⭐⭐⭐ 中等 — 需了解 Cubism 模型结构 + PixiJS |
| **Electron 兼容** | ⭐⭐⭐⭐⭐ 完全兼容 — OpenDesktop-Pet 已验证 |
| **素材获取** | ⭐⭐⭐ 有免费官方模型 (Haru/Hiyori/Mao/Natori) |
| **包体积** | 中等 (Core ~600KB + 模型 2-5MB) |
| **许可证** | 年收入 <1000万日元 (~$66K) 免费；Core 为专有但免费使用 |

**核心依赖:**
```bash
npm install pixi-live2d-display pixi.js@^8
```
+ 手动下载 `live2dcubismcore.min.js` 放入 `public/libs/`

**免费模型来源:**
- Live2D Cubism SDK 自带 Haru, Hiyori, Mao, Natori, Mark, Rice（Free Material License）
- 下载 SDK: https://www.live2d.com/en/download/cubism-sdk/download-web/

**参考项目:**
- [OpenDesktop-Pet](https://github.com/HanLoney/OpenDesktop-Pet) — Apache 2.0, Electron + Live2D Cubism 4 + PixiJS
- [pixi-live2d-display](https://github.com/guansss/pixi-live2d-display) — MIT, 1.4k stars

---

### 路线 B：GIF / APNG / 序列帧

| 维度 | 评价 |
|------|------|
| **动画自然度** | ⭐⭐ 有限 — 循环播放，无物理，过渡生硬 |
| **实现难度** | ⭐ 最简单 — 原生 `<img>` 或 CSS `background-image` 切换 |
| **Electron 兼容** | ⭐⭐⭐⭐⭐ 完全原生支持 |
| **素材获取** | ⭐⭐⭐⭐ 大量免费 GIF 资源 (itch.io, opengameart) |
| **包体积** | 大 (每段动画 500KB-5MB，4 状态 = 2-20MB) |
| **许可证** | 取决于素材来源 |

**实现方式:**
```tsx
// 最简单: 根据状态切换 GIF src
<img src={`/assets/pet-${mood}.gif`} />
```

**参考项目:**
- [Cody Desktop Pet](https://github.com/yangsyisabel-gif/cody-desktop-pet) — MIT, Electron + GIF
- [electron-desktop-cat](https://github.com/Liumingxun/electron-desktop-cat) — CC0, GIF 切换

---

### 路线 C：分层 PNG / CSS 动画（当前方案）

| 维度 | 评价 |
|------|------|
| **动画自然度** | ⭐ 僵硬 — 整体形变，无法局部动画 |
| **实现难度** | ⭐ 最简单 — 纯 CSS |
| **Electron 兼容** | ⭐⭐⭐⭐⭐ 完全兼容 |
| **素材获取** | ⭐⭐⭐⭐⭐ 任意 PNG |
| **包体积** | 最小 |

**本质问题:** 一张静态图 + CSS transform = 贴纸飘动效果，无法做到"局部动作"（摇头、眨眼、挥手）。

---

## 二、开源参考项目汇总

| 项目 | Stars | License | 技术栈 | 动画方案 | 适合参考 |
|------|-------|---------|--------|----------|----------|
| [pixi-live2d-display](https://github.com/guansss/pixi-live2d-display) | 1.4k | MIT | PixiJS | Live2D Cubism 2/3/4 | ⭐⭐⭐⭐⭐ Live2D 核心库 |
| [WindowPet](https://github.com/SeakMengs/WindowPet) | 617 | MIT | Tauri + React + Zustand | 多宠物动画系统 | ⭐⭐⭐⭐ 状态管理参考 |
| [OpenDesktop-Pet](https://github.com/HanLoney/OpenDesktop-Pet) | 5 | Apache 2.0 | Electron 33 + PixiJS | Live2D Cubism 4 | ⭐⭐⭐⭐⭐ 最直接参考 |
| [Claude Pet](https://github.com/Carliber/claude-pet) | 5 | AGPL-3.0 | Electron 33 + Canvas 2D | PNG Sprite Sheet | ⭐⭐⭐⭐ 状态机 + 精灵图 |
| [Cody Desktop Pet](https://github.com/yangsyisabel-gif/cody-desktop-pet) | - | MIT | Electron | GIF 切换 | ⭐⭐⭐ 简单 GIF 模式 |
| [electron-desktop-cat](https://github.com/Liumingxun/electron-desktop-cat) | 2 | CC0 | Electron | GIF 键盘切换 | ⭐⭐ 最简参考 |

---

## 三、重点方案详解

### 方案 A-1: pixi-live2d-display + React 集成

**React 组件模板:**
```tsx
// src/components/Live2DPet.tsx
import { useEffect, useRef, useState } from 'react';
import { Application } from '@pixi/app';
import { Live2DModel } from 'pixi-live2d-display/cubism4';
import type { MotionPriority } from 'pixi-live2d-display';

// 必须: 将 PIXI 暴露到 window，pixi-live2d-display 依赖它
import * as PIXI from 'pixi.js';
(window as any).PIXI = PIXI;

type PetState = 'idle' | 'focus' | 'cheer' | 'sleepy';

interface Props {
  state: PetState;
  modelPath: string; // e.g. '/assets/haru/haru.model3.json'
}

export default function Live2DPet({ state, modelPath }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const appRef = useRef<Application | null>(null);
  const modelRef = useRef<Live2DModel | null>(null);
  const [ready, setReady] = useState(false);

  // 初始化 PixiJS + Live2D
  useEffect(() => {
    const app = new Application();
    (async () => {
      await app.init({
        view: canvasRef.current!,
        backgroundAlpha: 0,          // 透明背景
        width: 300,
        height: 400,
      });
      const model = await Live2DModel.from(modelPath);
      model.scale.set(0.18);
      model.anchor.set(0.5, 0.5);
      model.x = 150;
      model.y = 230;
      app.stage.addChild(model);
      modelRef.current = model;
      appRef.current = app;
      setReady(true);
    })();
    return () => { app.destroy(true); };
  }, [modelPath]);

  // 状态切换 → 播放对应 Motion
  useEffect(() => {
    if (!modelRef.current || !ready) return;
    const model = modelRef.current;
    // 停止当前 motion，播放下一个
    const motionMap: Record<PetState, string> = {
      idle: 'Idle',       // 模型内定义的 Motion Group 名
      focus: 'TapBody',
      cheer: 'TapHead',
      sleepy: 'Sleep',
    };
    const motion = motionMap[state];
    try { model.motion(motion, undefined, MotionPriority.FORCE); } catch {}
  }, [state, ready]);

  return <canvas ref={canvasRef} />;
}
```

**关键点:**
- 必须手动下载 `live2dcubismcore.min.js`（不可 npm 安装，Live2D 专有）
- 必须在 HTML 中 `<script>` 加载 core，或在代码中动态加载
- `pixi-live2d-display` 的 API: `Live2DModel.from()`, `model.motion()`, `model.expression()`
- PixiJS v8 需要 `app.init()` 异步初始化

---

### 方案 B-1: Sprite Sheet + Canvas 2D（轻量替代）

适合不想引入 Live2D 全套依赖的场景。

**Sprite Sheet 结构:**
```
public/assets/sprites/
├── pet-sprite.png           # 精灵图 (4行 × N列)
└── pet-sprite.json          # 帧数据: {idle: [0,1,2,3], focus: [4,5,6], ...}
```

**Canvas 2D 组件:**
```tsx
// 使用 Canvas 2D + requestAnimationFrame 绘制精灵图
// 核心: ctx.drawImage(sprite, sx, sy, sw, sh, dx, dy, dw, dh)
// 按帧序号计算 (sx, sy) 位置
```

**参考实现:** [Carliber/claude-pet](https://github.com/Carliber/claude-pet) 的 `src/sprite/` 和 `src/behavior/` 目录

---

## 四、最终推荐

### 🏆 第一版推荐：路线 A — pixi-live2d-display + Live2D Cubism 4

**理由:**
1. **动画最自然** — 骨骼动画天然支持呼吸、头发摆动、眨眼等微动，天然"不僵硬"
2. **免费模型立即可用** — 官方 Haru/Hiyori 模型在 SDK 中，Free Material License
3. **2 天可落地** — 核心代码 ~100 行 React 组件
4. **许可证友好** — indie/年收<1000万日元完全免费
5. **有直接参考** — OpenDesktop-Pet (Apache 2.0) 就是 Electron + Live2D
6. **可扩展** — 后续可加新模型、新动作、语音口型同步

### 🥈 备选：路线 B — Canvas 2D Sprite Sheet

如果 Live2D 因为某些原因不可行（如无法注册下载 SDK），则退而求其次用 Canvas 2D 精灵图。

**何时选 B:**
- 你不想注册 Live2D 账号
- 你已有现成精灵图素材
- 你要极致轻量

---

## 五、给 Codex 的实现指令

### 目标
在 Focus Pet 中集成 Live2D Cubism 4 角色动画，实现 idle/focus/cheer/sleepy 四个状态。

### 安装依赖

```bash
cd D:\ding\focus-pet
npm install pixi.js@^8 pixi-live2d-display
```

### 获取 Live2D Core（必须手动操作）

1. 访问 https://www.live2d.com/en/download/cubism-sdk/download-web/
2. 注册/登录 Live2D 账号
3. 下载 "Cubism SDK for Web"
4. 解压后复制 `Core/live2dcubismcore.min.js` → `D:\ding\focus-pet\public\libs\live2dcubismcore.min.js`

### 获取免费模型

从 SDK 的 `Samples/Resources/Haru/` 目录复制模型文件：
```
public/assets/haru/
├── haru.model3.json
├── haru.moc3
├── textures/
│   └── texture_00.png
├── motions/
│   ├── Idle.motion3.json
│   ├── TapBody.motion3.json
│   └── ...
└── expressions/
    └── ...
```

### 文件改动清单

```
新增:
  public/libs/live2dcubismcore.min.js   # Live2D Core (手动复制)
  public/assets/haru/                   # Haru 模型文件 (手动复制)
  src/components/Live2DPet.tsx          # Live2D React 组件
  src/hooks/usePetState.ts              # 状态管理 Hook

修改:
  index.html                            # 加载 live2dcubismcore.min.js
  src/App.tsx                           # 用 <Live2DPet> 替换 <img>
  src/styles.css                        # 调整 companion 区域尺寸
```

### 状态定义

```ts
type PetMood = 'idle' | 'focus' | 'cheer' | 'sleepy'

const motionMap: Record<PetMood, string> = {
  idle:   'Idle',        // 待机呼吸动画
  focus:  'TapBody',     // 专注点头/握拳
  cheer:  'TapHead',     // 欢呼跳跃
  sleepy: 'Sleep',       // 打瞌睡
}
```

### 角色如何动起来

1. PixiJS Application 以 60fps 持续渲染 Canvas
2. Live2D Cubism Core 计算骨骼形变 + 物理模拟
3. pixi-live2d-display 将 Cubism 输出映射到 PixiJS Sprite
4. `model.motion()` 切换 Motion（带渐变过渡）
5. 状态变化时触发对应 Motion

### 不要做

- ❌ 不要自己造 Live2D 渲染引擎 — 用 pixi-live2d-display
- ❌ 不要尝试从 npm 安装 live2dcubismcore — 必须手动下载
- ❌ 不要做 AI 对话 / 语音口型同步 — 那是第二版的事
- ❌ 不要做模型编辑/导入功能 — 先用固定模型
- ❌ 不要在 CSS 里对 canvas 做 transform 动画 — 让 Live2D 引擎自己动
- ❌ 不要同时装 PixiJS v7 和 v8 — pixi-live2d-display 最新版用 v8
