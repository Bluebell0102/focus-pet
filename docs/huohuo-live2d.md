# 霍霍 Live2D 资源说明

## 模型目录

```text
public/assets/huohuo/
```

## 主模型文件

```text
public/assets/huohuo/huohuo.model3.json
```

## 当前动作组

当前 `huohuo.model3.json` 已注册以下动作组。实际状态映射以 `src/components/Live2DPet.tsx` 里的 `MOTION_PREFERENCES` 为准。

| 动作组 | 当前用途 | 说明 |
| --- | --- | --- |
| Scene1 | idle / focusing / fallback | 默认待机、专注中稳定动作和兜底动作 |
| haoqi | ready / restComplete / distraction fallback | 轻微反应、好奇、休息结束提醒 |
| keshui | resting / sleepy | 休息、困倦、放松 |
| linghun | completed / cheer fallback | 完成或较明显反馈动作 |
| qizi | completed / cheer | 轻微积极反馈 |
| yaotou | distraction | 防分心提醒、轻微摇头 |
| zhentou | distraction / completed fallback | 轻微强调或完成反馈 |

## 状态映射原则

* `idle`：尽量安静，优先自然待机。
* `ready`：轻微反应，不要太吵。
* `focusing`：保持稳定，不频繁播放动作。
* `distraction`：用户专注中点击时，播放一次轻微提醒动作。
* `completed`：专注自然完成后，播放一次较积极动作。
* `resting`：使用放松、休息或困倦动作。
* `restComplete`：轻微提醒或回到 idle。
* `fallback`：找不到动作时安全跳过或回到默认待机。

## 待机生命感优化

当前生命感优化主要基于已有 motion 和外层轻微 idle 动画；脚部细节取决于模型原始动作文件。

### 待机 motion scheduler

* `idle`：长期停留时低频随机播放 `Scene1` / `haoqi` / `qizi` 等轻动作，并叠加很轻的呼吸浮动。
* `focusing`：长期专注中低频播放 `Scene1` / `keshui`，容器动画幅度更小，避免分心。
* `resting`：休息中低频播放 `keshui` / `Scene1`，容器动画更放松。
* `completed`：完成时播放一次较明显的 `qizi` / `linghun` / `zhentou`，不做循环庆祝。
* `distraction`：用户专注中点击时播放一次 `yaotou` / `haoqi` 类轻提醒，不进入循环。

脚部动作受限于模型原始 motion。本次不修改模型骨骼，不做伪走路，也不做强行大幅跳动。

### 外层轻微动画

Live2D 外层容器会叠加很轻的呼吸 / 重心浮动动画，用于增强待机生命感。

这不是模型骨骼编辑，也不是新增动作文件；它只是一层克制的视觉辅助。

## 鼠标视线交互

鼠标追踪只作为轻量互动。鼠标在桌宠可交互区域附近移动时，模型可以轻微看向鼠标。

* 鼠标离开 Live2D 容器、窗口失焦或鼠标离开文档后，会触发视线回正。
* 回正会短时间平滑回到默认正前方，避免停在最后一个鼠标方向。
* 专注中会降低或关闭追踪，保持低干扰。
* 透明区域鼠标穿透仍由窗口层控制，不为了视线追踪扩大可交互区域。

## 注意事项

* 不要随意替换 `huohuo.model3.json`。
* 如果重新下载或替换模型资源，需要重新确认 `FileReferences.Motions`。
* 如果新增动作文件，需要同步更新 `huohuo.model3.json`。
* 如果动作组改名，需要同步更新 `Live2DPet.tsx` 的动作偏好。
* 动作配置损坏可能导致状态动作不播放，但不应导致应用崩溃。
* 霍霍为现成角色资源，自用为主；如未来公开发布，需要注意版权/IP 授权问题。
