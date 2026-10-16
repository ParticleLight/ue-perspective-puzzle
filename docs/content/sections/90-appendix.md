---
chapter: 90
title: 附录
---

本附录汇总三部分内容：附录 A 把管理类中所有可在编辑器中调整的属性汇总为参数速查表，并给出每个参数调整后的直接后果；附录 B 汇总构建期与运行期的常见故障、根因与处置；附录 C 给出从空工程到可运行谜题的完整操作序列。

**附录 A　参数速查表**

### A.1 拼图与标定参数

<p class="caption">表 A-1 Puzzle 分类参数（PerspectivePuzzleManager.h 中的公开 UPROPERTY）</p>

| 参数 | 类型 | 默认值 | 单位/量纲 | 取值范围（meta） |
|------|------|--------|-----------|------------------|
| `FragmentActors` | `TArray<AActor*>` | 空数组 | — | 无限制 |
| `CameraHeightOffset` | `float` | `160.0f` | 世界单位（厘米） | `ClampMin = 0.0f` |
| `GlowParameterName` | `FName` | `TEXT("GlowIntensity")` | — | 无限制 |

`FragmentActors` 是标定的输入：`Calibrate()` 遍历该数组逐个采集碎片的相对方向与距离。数组为空时采集到的点数为零，`CheckPuzzle` 在入口处即返回，整套检测不会执行。数组中出现空元素时该项被跳过，不会计入总数。

`CameraHeightOffset` 决定标定原点的抬升高度。标定原点由 `Calibrate()` 用 `GetActorLocation() + FVector(0, 0, CameraHeightOffset)` 计算，即把管理器放置在地面高度、由该参数抬到玩家眼睛高度。调大表示标定原点更高，运行时相机也必须更高才能匹配；调小则反之。该值应等于实际玩家相机在该站立点的高度，否则即使站位正确，方向点积也会系统性偏低。

`GlowParameterName` 是运行时写入碎片材质的标量参数名。取值为 `NAME_None` 时跳过整段发光控制，碎片材质保持不变；取值为材质中不存在的参数名时，写入调用不会报错，但不会有任何视觉变化——这是「对齐了却不发光」的第一排查点。

### A.2 检测参数

<p class="caption">表 A-2 Detection 分类参数及其调整后果</p>

| 参数 | 默认值 | 单位/量纲 | 取值范围（meta） | 调大的直接后果 | 调小的直接后果 |
|------|--------|-----------|------------------|----------------|----------------|
| `DotProductThreshold` | `0.996f`（≈ cos 5.13°） | 方向点积（余弦值，无量纲） | `ClampMin = 0.9, ClampMax = 1.0` | 允许的角度偏差变小，判定更严格 | 允许的角度偏差变大，判定更宽松；下限 0.9 对应约 25.84° |
| `ViewAngleThreshold` | `0.996f` | 方向点积（余弦值） | `ClampMin = 0.9, ClampMax = 1.0` | 对「看向图案中心」的要求更严格 | 更宽松；过小会放行低头、转头等姿态 |
| `DistanceTolerance` | `50.0f` | 世界单位（厘米） | `ClampMin = 0.0f` | 允许相机的前后偏差更大 | 更严格；取 0 时距离必须与标定值完全一致 |
| `RequiredPassRate` | `0.8f` | 通过比例（无量纲） | `ClampMin = 0.0, ClampMax = 1.0` | 需要更多碎片同时通过，判定更严格 | 更宽松；取 0 时任意位置都满足通过率条件 |
| `HoldDuration` | `1.5f` | 秒 | `ClampMin = 0.0f` | 需要保持对齐的时长增加，判定更严格 | 更快判定；取 0 时首次对齐即视为完成 |
| `DetectionInterval` | `0.1f` | 秒 | `ClampMin = 0.05f` | 检测周期变长，响应变慢、开销降低 | 检测更频繁；下限 0.05 秒对应约 20 Hz |

两类阈值的语义需要区分：`DotProductThreshold` 约束的是「相机到每个碎片的方向」与标定方向的一致性，是**位置**判据；`ViewAngleThreshold` 约束的是「相机自身朝向」与「标定原点指向图案几何中心的方向」的一致性，是**朝向**判据。二者都以单位向量点积表示，数值等于夹角余弦，因此 0.996 对应约 5.13°、0.98 对应约 11.48°、0.99 对应约 8.11°、0.9 对应约 25.84°。

<p class="caption">表 A-3 参考取值（技术说明中给出的调优结果）</p>

| 参数 | 头文件默认值 | 调优取值 | 说明 |
|------|--------------|----------|------|
| `DotProductThreshold` | 0.996 | 0.98 | 放宽位置方向容差，解决「站位正确但不触发」 |
| `DistanceTolerance` | 50 | 100 | 放宽前后距离容差 |
| `ViewAngleThreshold` | 0.996 | 约 0.98–0.99 | 朝向判据最后调整，避免放行低头姿态 |
| `RequiredPassRate` | 0.8 | 0.8 | 保持默认；碎片数量增加时可下调以保留容错 |
| `HoldDuration` | 1.5 | 2.0 | 延长保持时长，避免路过即触发 |
| `DetectionInterval` | 0.1 | 0.1 | 保持默认 |

调参顺序建议为：先修正 `CameraHeightOffset`（消除系统性偏差），再放宽 `DotProductThreshold` 与 `DistanceTolerance`（消除随机站位偏差），随后按需要调整 `RequiredPassRate` 与 `HoldDuration`，最后才考虑 `ViewAngleThreshold`——它在默认值下已经能够排除低头姿态，放宽后会重新引入误触发。

### A.3 只读状态与可调用接口

<p class="caption">表 A-4 状态属性与函数接口</p>

| 名称 | 类型/签名 | 标记 | 说明 |
|------|-----------|------|------|
| `bIsSolved` | `bool`（默认 `false`） | `BlueprintReadOnly` | 是否已判定完成；为真时 `CheckPuzzle` 直接返回 |
| `SolveProgress` | `float`（默认 `0.0f`） | `BlueprintReadOnly` | 0–1 的对齐进度，由 `HoldTimer / HoldDuration` 截断得到 |
| `Calibrate()` | `void` | `BlueprintCallable`，`meta = (CallInEditor = "true")` | 重新采集碎片方向与距离；可在编辑器细节面板直接点击 |
| `ResetPuzzle()` | `void` | `BlueprintCallable` | 清除求解状态、重置计时并重新登记检测定时器 |
| `DrawDebugCalibration(float Duration = 5.0f)` | `void`（`const`） | `BlueprintCallable`，`meta = (CallInEditor = "true")` | 绘制标定原点、碎片位置与连线，图形保留 `Duration` 秒 |
| `OnPuzzleSolved()` | `void` | `BlueprintImplementableEvent` | 判定完成时触发一次 |
| `OnViewAligned()` | `void` | `BlueprintImplementableEvent` | 由未对齐变为对齐时触发一次 |
| `OnViewLost()` | `void` | `BlueprintImplementableEvent` | 由对齐变为未对齐时触发一次 |
| `OnProgressUpdated(float Progress)` | `void` | `BlueprintImplementableEvent` | 每次对齐状态下更新进度时触发 |

`CalibratedData`、`HoldTimer`、`bWasAligned`、`CalibratedOrigin`、`CalibratedViewTarget` 与 `FragmentMaterials` 均为受保护成员且不带 `UPROPERTY`（`FragmentMaterials` 除外，它标记为 `Transient`），因此标定结果不参与序列化，每次进入运行状态时都会由 `BeginPlay → Calibrate()` 重新计算。

**附录 B　常见错误与排查对照表**

### B.1 构建期与运行期故障对照

<p class="caption">表 B-1 常见错误、根因与处置</p>

| 编号 | 报错/现象 | 根因 | 处置 |
|------|-----------|------|------|
| B-1 | `E0842 模板参数 "T" 未在类模板 "UEStaticAssertCompleteType_Private::TUEStaticAssertTypeCheckerBase<<错误类型>>" 的模板参数列表中使用或无法从中推导` 与 `E0094 数组的大小必须大于零`，位置指向 `StaticAssertCompleteType.h` 第 34、35 行，并连带 `IsContiguousContainer.h` 第 41–44 行 | 容器模板实例化时元素类型不完整（只有前向声明）。本工程的触发条件是把成员写成 `TArray<TObjectPtr<T>>` 而 `T` 未定义 | 把该类成员改为裸指针数组（本工程为 `TArray<UMaterialInstanceDynamic*>`）；报错位置在引擎内部，不要修改引擎头文件 |
| B-2 | `无法打开 源 文件 "PerspectivePuzzleManager.generated.h"` | 生成头文件缺失：头文件名与类声明不匹配，或 UHT 未重新生成 | 核对文件名与 `#include` 中的名称一致；清理 `Intermediate/Build/Win64/UnrealEditor/Inc/CPP1` 后重新构建 |
| B-3 | `无法打开 源 文件 "SharedDefinitions.UnrealEd.Project.ValApi.ValExpApi.Cpp20.InclOrderUnreal5_6.h"` | 共享定义文件随中间目录一并被清理，或上一次构建中途失败留下不完整状态 | 关闭编辑器后执行一次完整重建，使构建系统重新生成全部中间文件 |
| B-4 | `The identifier 'GENERATED_BODY' was detected in a block being skipped. Was this intentional?` | `GENERATED_BODY()` 位于被条件编译跳过的代码块中，UHT 未处理该宏 | 把 `GENERATED_BODY()` 移出条件编译区，使其始终处于活动分支 |
| B-5 | `未找到 "OnPuzzleSolved" 的函数定义`（`OnViewAligned` / `OnViewLost` / `OnProgressUpdated` 同），或 `类 "UObject" 没有成员 "Tick"/"BeginPlay"` | `GENERATED_BODY()` 未生效，反射生成的声明缺失，基类被按最简类型解析 | 按 B-2、B-4 先修好生成阶段；不要逐个改动函数名或强制转换类型 |
| B-6 | 头文件改动后行为不更新，构建提示 `Unable to build while Live Coding is active` | 编辑器内置的 Live Coding 正在占用构建通道 | 关闭编辑器后构建，或在编辑器中使用 Live Coding 的编译快捷键（`Ctrl + Alt + F11`）触发补丁编译 |
| B-7 | 构建长时间无响应，或提示文件被占用 | 编辑器进程仍持有模块动态库，热重载后的改动未真正生效 | 完全关闭编辑器再构建；构建成功后由编辑器重新加载模块。改动涉及类布局（新增 `UPROPERTY`、改变基类）时，必须走完整重建而非补丁编译 |
| B-8 | 中文注释显示为乱码 | 源文件保存为无 BOM 的 UTF-8，编辑器按本地代码页（简体中文环境为 936）解码 | 以「UTF-8 with BOM」（代码页 65001）重新保存；或在构建配置中显式指定 UTF-8 源字符集，二者取其一并全工程统一 |
| B-9 | 加入注释后构建直接失败，并出现 B-4、B-5 一类连带报错 | 文件头出现双重 BOM（`EF BB BF EF BB BF`），UHT 解析失败 | 读取文件前三个字节确认 BOM 数量，仅保留一个；重新保存后再构建 |
| B-10 | Decal 图案的透明区域显示为黑色方块 | 材质未连接不透明度输入，或混合模式不是半透明；贴图透明区域在取样后仍参与了输出 | 把 Decal 材质的混合模式设为半透明（Translucent），并把贴图 Alpha 接入不透明度输入；确认贴图自身的 Alpha 通道完整 |
| B-11 | 在母材质中修改参数数值后，场景中的图案没有任何变化 | 参数值由材质实例覆盖：母材质决定「有哪些参数」，实例决定「参数取什么值」 | 在材质实例上设置参数值；需要运行时修改时，用 `UMaterialInstanceDynamic::Create(材质接口, 组件)` 创建动态实例并通过 `SetScalarParameterValue(参数名, 值)` 写入 |
| B-12 | 对齐了但图案不发光，或发光始终为最大亮度 | 参数名不匹配或发光链路接错：`GlowParameterName` 与材质中的标量参数名不一致时写入无效；发光接到基础色而非自发光时表现为颜色被漂白 | 核对参数名逐字符一致；发光接入自发光颜色输入，并用 `GlowIntensity = 0 → 亮度 ×1`、`= 1 → 亮度 ×(1+倍数)` 的关系核对节点连接 |
| B-13 | 站位正确但检测不触发，日志中的点积只有 0.86 左右 | 标定原点高度与实际相机高度不一致，方向存在系统性偏差 | 令 `CameraHeightOffset` 等于玩家相机在该站立点的高度；用 `CheckPuzzle` 打印的「相机位置 / 标定位置 / 距离」核对 |

### B.2 排查顺序

1. **先看构建是否真的成功。** 出现 B-2 至 B-5 中任意一条时，其余报错都不必阅读；生成阶段恢复正常后，多数错误会自行消失。
2. **再看热重载是否生效。** 构建成功而行为未变时，按 B-6、B-7 完全关闭编辑器并重建，排除补丁编译未落地的情况。
3. **随后处理编码。** 出现乱码或 B-4 类报错时，先按 B-8、B-9 统一编码，因为它会同时影响编辑器显示与构建系统解析。
4. **最后处理运行期表现。** 不发光、不触发、图案发黑分别对应 B-12、B-13、B-10；此类问题应通过日志中的实测值与阈值对照来定位，而不是直接改动多个参数。

**附录 C　复现清单**

### C.1 从空工程到可运行谜题

1. **创建 C++ 工程。** 在引擎启动器中以「游戏 → 空白」模板创建 C++ 工程，工程名 `CPP1`，路径不包含中文与空格。确认使用的引擎版本为 5.8。
2. **新建管理类。** 在编辑器的 C++ 类向导中以 `AActor` 为父类创建 `PerspectivePuzzleManager`，生成头文件与源文件。
3. **写入实现。** 按 `Source/CPP1/Public/PerspectivePuzzleManager.h` 与对应源文件的内容写入声明与实现；两个文件均以「UTF-8 with BOM」保存。
4. **首次构建。** 关闭 Live Coding 或以补丁编译方式构建，确认构建成功、编辑器正常加载模块。此步若失败，按附录 B 的 B-1 至 B-5 排查，不要进入下一步。
5. **准备图案。** 用矢量绘图软件绘制完整图案（例如五角星与圆环），导出为背景透明的 PNG；导入内容浏览器，检查其 sRGB 与 Alpha 设置。图案需保持为整块大图，不在图片层面切分。
6. **建立母材质。** 新建材质 `M_BStar`，设为不受光照（Unlit）与半透明 Decal 混合模式。取样链为：纹理坐标 → 乘以向量参数 `UVTiling` → 加上向量参数 `UVOffset` → 贴图的 UV 输入。发光链为：标量参数 `GlowIntensity` → 乘以固定倍数 → 加 1 → 乘以贴图颜色 → 自发光颜色输入。两条链路的参数都要在母材质中声明。
7. **建立材质实例。** 复制母材质得到两个实例：上半部分取 `UVTiling = (1, 0.5)`、`UVOffset = (0, 0)`；下半部分取 `UVTiling = (1, 0.5)`、`UVOffset = (0, 0.5)`。
8. **摆放碎片。** 在关卡中放置两个 Decal 组件，分别指定两个材质实例，调整其大小与位置使图案只覆盖目标表面。一个放在较近的柱子上，一个放在较远的墙面上，形成深度差——深度差是视差成立的前提。
9. **放置管理器。** 把 `PerspectivePuzzleManager` 拖入关卡，位置放在预期站立点的地面处。
10. **登记碎片。** 在管理器的细节面板中，把两个 Decal Actor 依次加入 `FragmentActors` 数组。
11. **创建管理器蓝图。** 以 C++ 类为父类创建蓝图 `BP_PuzzleManager`，在其中实现四个蓝图事件：`OnPuzzleSolved`（打印提示并触发开门等表现）、`OnViewAligned`、`OnViewLost`、`OnProgressUpdated`（可接进度条或音效）。C++ 侧只负责调用，表现层全部放在蓝图。
12. **标定。** 用调试绘制确认标定原点与碎片位置：运行后 `BeginPlay` 会自动标定并调用 `DrawDebugCalibration`；也可在编辑器细节面板点击对应按钮手动触发。调整 `CameraHeightOffset`，使其等于玩家相机在该站立点的高度。
13. **调参。** 按附录 A.2 的顺序调整检测参数：先 `CameraHeightOffset`，再 `DotProductThreshold` 与 `DistanceTolerance`，然后 `RequiredPassRate` 与 `HoldDuration`，`ViewAngleThreshold` 最后动。每次只改一个参数并立即验证。
14. **配置光晕。** 在关卡中放置后期处理体积并勾选「无边界」，把泛光强度设为 1.5–3；否则自发光只表现为图案变亮，没有扩散的光晕。
15. **验证检测链路。** 运行并观察输出日志：相机位置与标定位置的距离、逐碎片的 `Dot` 与 `DistDiff`、以及 `Pass/Num/Rate/ViewDot/Aligned` 汇总行。当站位正确而某项不通过时，该行会直接给出实测值与阈值之差。
16. **验证反馈与事件。** 站到标定位并朝向图案：碎片发光应随进度由暗到亮；移开视线或离开位置时发光归零；持续保持达到 `HoldDuration` 后触发 `OnPuzzleSolved`，蓝图侧的表现（提示、开门动画等）随之执行。
17. **留存可复现配置。** 把最终的参数取值、材质实例的 UV 取值、Decal 的尺寸与变换汇总成表，便于在其他关卡复用同一套材质与逻辑。
