# UE C++ 透视拼接谜题检测

一个 UE5 C++ 透视拼接谜题的实现记录与可复用检测组件。

碎片被放在不同深度的物体上。玩家位于标定位置、视线指向图案中心并保持一段时间后，`APerspectivePuzzleManager` 触发 `OnPuzzleSolved`。项目使用 Decal 显示碎片，用动态材质实例驱动发光。

> 仓库只包含 C++ 代码和文档，不包含完整 UE 工程、关卡、贴图或 Fab 资产。

## 机制

判定分三步：

1. **位置**：标定时记录每个碎片相对于观察点的方向和距离。运行时对每个碎片重新计算，方向用点积比较，距离用绝对差比较；通过碎片的比例达到阈值才算位置有效。
2. **视线**：相机前向向量与“标定点到图案几何中心”的方向做点积。位置正确但低头或转头不会通过。
3. **持续时间**：对齐状态持续到 `HoldDuration` 后触发 `OnPuzzleSolved`。中断时进度归零。

这不是屏幕图像识别，也不依赖具体贴图内容；它只比较相机与碎片之间的几何关系。

## 接入

### 代码

复制以下文件到项目模块：

```text
Source/<Module>/Public/PerspectivePuzzleManager.h
Source/<Module>/Private/PerspectivePuzzleManager.cpp
```

将 `CPP1_API` 替换为项目模块导出宏。例如模块名为 `MyGame` 时，替换为 `MYGAME_API`。

### 场景配置

1. 以 `APerspectivePuzzleManager` 创建蓝图，例如 `BP_PuzzleManager`，放到正确观察位置的地面。
2. 在 **Puzzle → Fragment Actors** 中填入全部碎片 Actor。当前实现优先处理带 `UDecalComponent` 的 Actor，也兼容静态网格体组件。
3. 设置 `Camera Height Offset`，使 Manager 的标定原点与玩家相机高度一致。
4. 点击 **Calibrate** 记录当前观察点；运行时 `BeginPlay` 也会自动标定一次。
5. 在蓝图中实现 `OnPuzzleSolved`，连接门、音效或其他关卡逻辑。

### 发光（可选）

碎片母材质需要一个名为 `GlowIntensity` 的 Scalar Parameter。将它用于 **EmissiveColor**，不要直接叠到 BaseColor；对齐进度会写入 0 到 1。需要光晕时，在 Post Process Volume 中启用 Bloom。

## 参数起点

| 参数 | 起点 | 说明 |
|---|---:|---|
| `DotProductThreshold` | `0.98` | 相机位置相对碎片方向的容差 |
| `DistanceTolerance` | `100` | 相机到碎片距离的容差（cm） |
| `ViewAngleThreshold` | `0.98 ~ 0.99` | 相机前向与图案中心方向的容差 |
| `RequiredPassRate` | `0.8` | 需要通过的碎片比例 |
| `HoldDuration` | `2.0` | 连续对齐秒数 |
| `DetectionInterval` | `0.1` | 定时检测间隔 |

## 实现备注

- 碎片深度差越大，视觉视差和位置区分度越明显。
- 移动碎片、Manager 或改变相机高度后，需要重新标定。
- 源文件以 UTF-8 with BOM 保存。此项目曾因 UHT 对中文/BOM 的处理出现生成代码错误。
- `FragmentMaterials` 使用 `TArray<UMaterialInstanceDynamic*>`。在该项目环境里，前向声明类型与 `TArray<TObjectPtr<T>>` 的组合触发过模板静态断言。
- `CachedPC` 目前是未使用的遗留字段，不参与检测。

## 文档

- [在线技术文档：视角检测系统的设计与实现](https://particlelight.github.io/ue-perspective-puzzle/) — 标定、判据、材质与参数标定的完整论述（源文件在 [docs/](docs/)）
- [实现笔记：场景、材质、检测与机关](docs/透视拼接谜题技术文档.md)
- [代码：PerspectivePuzzleManager](docs/PerspectivePuzzleManager代码详解.md)

## License

[MIT](LICENSE) © ParticleLight
