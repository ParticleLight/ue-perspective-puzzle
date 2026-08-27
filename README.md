# UE C++ 透视拼接谜题检测

用 Unreal Engine 5 C++ 实现《鬼泣5 / 异环》式**透视拼接谜题**的可复用检测组件。

玩家从特定位置观察分布在不同深度物体上的图案碎片；当碎片在视野中拼合、玩家视线对准图案并持续保持一段时间后，谜题触发成功。示例包含**动态发光反馈**和**蓝图开门机关**的接入思路。

> 本仓库提供检测代码与中文技术文档，**不包含完整 UE 工程、第三方 Fab 资产、贴图或关卡文件**。

## 实现效果

- 多个图案碎片分布在柱子、墙面等不同深度的物体上。
- 玩家站到正确位置时，碎片在透视视角中对齐。
- 图案发光会随持续对齐进度逐渐增强。
- 视线移开、低头或站位偏离时进度清零。
- 持续对齐指定时间后触发 `OnPuzzleSolved` 蓝图事件，可连接开门、音效、动画等机关。

## 检测原理

检测由三层组成：

1. **位置检测**：标定时记录每个碎片相对正确观察点的方向与距离；运行时重新计算相机到每个碎片的方向与距离，分别比较。
   - 方向使用单位向量点积判断；
   - 距离使用绝对差判断；
   - 按通过碎片比例得出位置是否有效。
2. **视线检测**：相机前向向量与「标定原点 → 所有碎片几何中心」的目标方向做点积，防止玩家站对位置却低头或转头也触发。
3. **持续时间检测**：只有连续保持对齐达到 `HoldDuration`，才会触发成功事件。

详细解释请看 [透视拼接谜题技术文档](docs/透视拼接谜题技术文档.md)。

## 目录

```text
.
├── Source/CPP1/
│   ├── Public/PerspectivePuzzleManager.h     # 组件声明与可调参数
│   └── Private/PerspectivePuzzleManager.cpp  # 标定、检测、发光实现
├── docs/
│   ├── 透视拼接谜题技术文档.md                 # 从零搭建完整机制
│   ├── PerspectivePuzzleManager代码详解.md    # .h / .cpp 逐段解析
│   └── 视频文案_UE透视拼接检测.md              # 配套技术视频口播文案
├── LICENSE
└── README.md
```

## 快速接入

### 1. 导入代码

将以下两个文件复制到你的 UE C++ 项目模块中：

```text
Source/<你的模块名>/Public/PerspectivePuzzleManager.h
Source/<你的模块名>/Private/PerspectivePuzzleManager.cpp
```

将代码中的 `CPP1_API` 替换为你的项目模块导出宏，例如项目模块叫 `MyGame`，则替换为 `MYGAME_API`。重新编译项目。

### 2. 创建蓝图

1. 在内容浏览器中，以 `PerspectivePuzzleManager` 为父类创建蓝图，例如 `BP_PuzzleManager`。
2. 把该蓝图放进关卡，并摆在正确观察位置的地面上。
3. 在 Details 面板的 **Puzzle → Fragment Actors** 中，依次拖入所有图案碎片的 Actor（如 Decal Actor）。
4. 把 `Camera Height Offset` 设为玩家相机相对地面的高度。
5. 点击 **Calibrate** 按钮记录正确观察点。

### 3. 连接成功事件

在 `BP_PuzzleManager` 事件图中实现 `OnPuzzleSolved`：

```text
OnPuzzleSolved → 你的机关逻辑
```

例如通过 `GetActorOfClass → Cast → OpenDoor` 调用门蓝图的开门事件。

### 4. 接入发光反馈（可选）

碎片材质中创建名为 `GlowIntensity` 的标量参数，并将其接入 **EmissiveColor**，不要接入 BaseColor。管理器会在对齐过程中自动向该参数写入 0→1 的进度值。

建议为场景添加 Post Process Volume，开启 Bloom 以获得光晕。

## 默认可调参数

| 参数 | 作用 | 建议起点 |
|---|---|---:|
| `DotProductThreshold` | 位置方向容差 | `0.98` |
| `DistanceTolerance` | 相机到碎片的距离容差 | `100` |
| `ViewAngleThreshold` | 视线对准图案中心的容差 | `0.98 ~ 0.99` |
| `RequiredPassRate` | 需要通过的碎片比例 | `0.8` |
| `HoldDuration` | 需连续保持对齐的秒数 | `2.0` |
| `DetectionInterval` | 检测间隔 | `0.1` |

## 重要说明

- `Calibrate()` 会在 `BeginPlay` 自动调用。如果你在运行前手动移动了碎片或 Manager，需要重新标定。
- 碎片深度差异越明显，透视拼接的视觉效果与位置辨识度越强。
- 项目源文件使用 **UTF-8 with BOM** 编码，避免 UHT 处理中文注释时产生问题。
- 本实现将 `FragmentMaterials` 写成 `TArray<UMaterialInstanceDynamic*>`，以规避前向声明类型与 `TObjectPtr` 容器组合在此项目版本中产生的 UHT/模板错误。

## 文档

- [完整技术文档：从图案、材质、Decal 到检测与开门](docs/透视拼接谜题技术文档.md)
- [代码详解：PerspectivePuzzleManager 头文件与源文件逐段解析](docs/PerspectivePuzzleManager代码详解.md)
- [视频文案：《UE，用C++还原鬼泣5/异环中的透视拼接检测》](docs/视频文案_UE透视拼接检测.md)

## License

[MIT](LICENSE) © ParticleLight
