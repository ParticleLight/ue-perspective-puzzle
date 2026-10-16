---
chapter: 3
title: 系统架构与运行时对象模型
---

透视拼接谜题的判定目标只有一句话：**玩家是否站在标定过的那个视点上，并朝着标定过的方向观察**。这句话里没有任何"碎片自身的行为"，因此系统不需要为每个碎片写逻辑，只需要一个能在全局视角下比对"当前相机状态"与"标定状态"的宿主对象。

这一约束直接决定了整体形态：一个管理器 Actor 独占全部逻辑与状态，碎片只作为被引用的场景对象，玩家相机是唯一的运行时输入源。本章说明该划分的设计动机、两条数据链路，以及对外暴露的接口与生命周期。文中引用的源码片段保留原始标识符与注释，缩进统一按四空格归一。

### 3.1 设计目标与约束

系统需要同时满足四组约束，它们共同排除了若干看似更简单的实现方式。

**其一：碎片数量可变。** 一个图案可以被拆成 2 块、4 块或 9 块。任何形如"遍历两个固定对象"的写法都会在拆分数变化时失效，因此碎片必须以**列表**形式登记，且所有判定循环、通过率计算、发光遍历都只能以列表长度为准，不能出现与具体数量绑定的常数。

**其二：碎片摆放自由。** 碎片在场景中的位置由人工摆放决定，三维位置、朝向、承载物（柱子、墙面、悬浮平面）都不受系统约束。系统只能读取碎片的世界坐标，不能对摆放提出格式要求。

**其三：可重新标定。** "正确视角"不是预先写死在数据里的常量，而是在编辑期由人工把碎片摆好之后，由系统**现场测量并固化**的一组数据；摆放调整后可以重新执行同一次测量，覆盖旧数据。这意味着标定过程必须是幂等的、可重复调用的，且不能依赖于任何一次性的初始化路径。

**其四：判定是全局的，而表现是局部的。** 是否"拼合成功"取决于全部碎片的整体状态（通过比例），以及玩家视线是否落在图案整体上；而"成功后做什么"（开门、播放动画、显示提示）属于表现层，与判定算法无关，且改动频率远高于算法。两者必须解耦，否则每次调整表现都需要重新编译 C++。

### 3.2 角色划分：管理器、碎片、玩家相机

系统由三类参与者构成，彼此之间是单向引用关系。

<p class="caption">表 3-1 运行时角色与职责</p>

| 角色 | 类型 | 职责 | 数据来源 |
| --- | --- | --- | --- |
| 谜题管理器 | `APerspectivePuzzleManager`（继承 `AActor`） | 标定、周期检测、状态维护、事件派发、发光写入 | 自身的 `EditAnywhere` 参数 |
| 碎片 | `AActor*`，承载 `UDecalComponent` 或 `UStaticMeshComponent` | 仅提供世界坐标与材质；不含任何判定逻辑 | 人工在关卡中摆放，登记到 `FragmentActors` |
| 玩家相机 | `APlayerController` → `APlayerCameraManager` | 提供当前视点位置与朝向 | 引擎运行时查询，不由系统持有 |

三类参与者之间只有两条连线：管理器**读取**碎片的位置（标定期）与材质（初始化期），管理器**查询**玩家相机（运行期）。碎片与相机之间不存在任何直接依赖，管理器也不修改碎片的位置或变换。

<figure>
<svg viewBox="0 0 820 300" width="100%" height="300" role="img" aria-label="管理器、碎片与玩家相机的关系">
  <defs>
    <marker id="ar" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto"><path d="M0,0 L9,4.5 L0,9 z" fill="#a99a80"/></marker>
    <marker id="ar2" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto"><path d="M0,0 L9,4.5 L0,9 z" fill="#7b93ad"/></marker>
  </defs>
  <rect x="300" y="16" width="230" height="74" rx="8" fill="#f3ecdf" stroke="#c0ad8c"/>
  <text x="415" y="44" text-anchor="middle" font-size="14" fill="#3a3226">APerspectivePuzzleManager</text>
  <text x="415" y="64" text-anchor="middle" font-size="11" fill="#6b6154">标定数据 · 状态 · 定时器</text>
  <text x="415" y="80" text-anchor="middle" font-size="11" fill="#6b6154">事件派发 · 发光写入</text>
  <rect x="40" y="170" width="180" height="66" rx="8" fill="#eef3ee" stroke="#9db39d"/>
  <text x="130" y="196" text-anchor="middle" font-size="13" fill="#3a3226">碎片 Actor A</text>
  <text x="130" y="216" text-anchor="middle" font-size="11" fill="#6b6154">Decal / StaticMesh</text>
  <rect x="250" y="170" width="180" height="66" rx="8" fill="#eef3ee" stroke="#9db39d"/>
  <text x="340" y="196" text-anchor="middle" font-size="13" fill="#3a3226">碎片 Actor B</text>
  <text x="340" y="216" text-anchor="middle" font-size="11" fill="#6b6154">不同纵深位置</text>
  <rect x="460" y="170" width="180" height="66" rx="8" fill="#eef3ee" stroke="#9db39d"/>
  <text x="550" y="196" text-anchor="middle" font-size="13" fill="#3a3226">碎片 Actor N</text>
  <text x="550" y="216" text-anchor="middle" font-size="11" fill="#6b6154">数量可变</text>
  <rect x="672" y="170" width="132" height="66" rx="8" fill="#eaeff5" stroke="#94a8bd"/>
  <text x="738" y="196" text-anchor="middle" font-size="12" fill="#2b4a6a">玩家相机</text>
  <text x="738" y="216" text-anchor="middle" font-size="11" fill="#2b4a6a">PlayerController</text>
  <line x1="360" y1="92" x2="150" y2="168" stroke="#a99a80" stroke-width="1.5" marker-end="url(#ar)"/>
  <line x1="415" y1="92" x2="350" y2="168" stroke="#a99a80" stroke-width="1.5" marker-end="url(#ar)"/>
  <line x1="470" y1="92" x2="540" y2="168" stroke="#a99a80" stroke-width="1.5" marker-end="url(#ar)"/>
  <line x1="700" y1="168" x2="500" y2="96" stroke="#7b93ad" stroke-width="1.5" stroke-dasharray="5 3" marker-end="url(#ar2)"/>
  <text x="150" y="130" font-size="11" fill="#6b6154">登记引用 / 读取世界坐标</text>
  <text x="520" y="146" font-size="11" fill="#2b4a6a">运行时查询视点</text>
  <text x="24" y="278" font-size="11" fill="#6b6154">实线：管理器对碎片的读取（标定期与初始化期各一次）　　虚线：运行期对相机的查询（每 DetectionInterval 一次）</text>
</svg>
<figcaption>图 3-1 运行时对象模型：管理器是唯一的逻辑宿主，碎片与相机只提供数据</figcaption>
</figure>

### 3.3 为什么把逻辑集中在管理器

把检测分散到各个碎片上（每个碎片自己判断"是否被正确观察"）在直觉上更"面向对象"，但在本问题里会立即遇到三处无法局部化的依赖。

**全局通过率无法由局部决定。** 判定条件之一是"通过检测的碎片占比不低于 `RequiredPassRate`"。单个碎片只能知道自己是否通过，无从知道总数与通过数。若把计数责任上移，碎片上的判定逻辑就只剩"方向点积与距离差"这一条，形同虚设。

**视线检测的参考点是全局量。** 视线判定使用的目标方向由"所有碎片位置的几何中心"决定：

<p class="caption">代码 3-1 图案中心的定义与计算（节选自 Calibrate 实现）</p>
```cpp
    FVector CenterAccum = FVector::ZeroVector;
    int32 Count = 0;

    for (AActor* Actor : FragmentActors)
    {
        if (!Actor) continue;

        FCalibratedMarkPoint Point;
        Point.FragmentActor = Actor;
        Point.WorldLocation = Actor->GetActorLocation();

        FVector Dir = Point.WorldLocation - CalibratedOrigin;
        Point.TargetDistance = Dir.Size();
        Point.TargetDirection = Dir.GetSafeNormal();

        CalibratedData.Add(Point);
        CenterAccum += Point.WorldLocation;
        Count++;
    }

    // 图案中心 = 所有碎片的几何中心，作为视线检测的参考点
    CalibratedViewTarget = (Count > 0) ? CenterAccum / Count : CalibratedOrigin;
```

这个中心是全部碎片位置的算术平均，任何一个碎片都无法单独计算；它也不等于任何一个碎片的位置。把视线检测放到碎片上，就必须把中心作为额外数据下发，等于把耦合显式化而没有消除。

**状态必须是单点。** `bIsSolved`、`SolveProgress`、`HoldTimer`、`bWasAligned` 描述的是"整个谜题"的状态。若每个碎片各持一份，就会出现"碎片的成功标记不一致"这类无法收敛的问题；事件派发（`OnViewAligned` / `OnViewLost` / `OnPuzzleSolved`）也必须是唯一的边沿触发点，否则一次对齐会触发 N 次事件。

此外还有两条工程上的收益：检测只需要**一个**定时器句柄（`DetectionTimerHandle`），而不是每个碎片一个；判定逻辑集中在约百行的单个函数内，便于整体替换判定策略。

需要说明的是，"集中"并不意味着管理器侵入碎片的行为。它对碎片的接触只有三类：读取世界坐标、为碎片组件创建动态材质实例、向该实例写入标量参数。碎片的位置、旋转与缩放始终由人工维护，管理器从不修改任何变换。

### 3.4 数据流：标定期与运行期

系统的数据流分为两条彼此独立的链路，分别在不同的时间尺度上运行。

**标定期链路**把"场景事实"转换成"判定依据"。输入是登记在 `FragmentActors` 中的碎片列表与管理器自身的位置；输出是两类标定数据：逐碎片的 `CalibratedData`，以及供视线判定使用的 `CalibratedViewTarget`；标定视点本身（`CalibratedOrigin`）也在这一步确定。

每个碎片的数据被组织为一个 `USTRUCT`，把"哪个 Actor、标定时在哪、相对标定点的方向与距离"聚合在同一结构内，避免使用多个平行数组而在增删碎片时错位：

<p class="caption">代码 3-2 FCalibratedMarkPoint：单碎片的标定数据（节选）</p>
```cpp
//单个碎片的标定数据
 
USTRUCT(BlueprintType)
struct FCalibratedMarkPoint
{
    GENERATED_BODY()

    //场景中的碎片 Actor 
    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    AActor* FragmentActor = nullptr;

    //标定时记录的碎片世界坐标 
    FVector WorldLocation;

    //从标定位置指向碎片的单位方向向量 
    FVector TargetDirection;

    // 从标定位置到碎片的直线距离 
    float TargetDistance;
};
```

选择"方向 + 距离"而不是"相对坐标"，是因为运行期的比对对象正好是这两个量：方向用点积比较（对角度敏感），距离用绝对差比较（对尺度敏感）。若存相对坐标，检测时仍需先算出长度与单位向量，等于把同一份计算做了两遍。

**运行期链路**以固定的时间间隔采样玩家相机，把"当前相机状态"与标定数据比对，产生状态迁移与对外消息。

<figure>
<svg viewBox="0 0 840 420" width="100%" height="420" role="img" aria-label="标定期与运行期数据流">
  <text x="20" y="26" font-size="13" fill="#8a5a2b">标定期（编辑期或 BeginPlay 触发一次）</text>
  <rect x="20" y="40" width="170" height="52" rx="7" fill="#f6f1e7" stroke="#c3b69c"/>
  <text x="105" y="62" text-anchor="middle" font-size="12" fill="#3a3226">FragmentActors</text>
  <text x="105" y="79" text-anchor="middle" font-size="10" fill="#6b6154">人工登记的碎片列表</text>
  <rect x="250" y="36" width="150" height="60" rx="7" fill="#f3ecdf" stroke="#c0ad8c"/>
  <text x="325" y="60" text-anchor="middle" font-size="12" fill="#3a3226">Calibrate()</text>
  <text x="325" y="78" text-anchor="middle" font-size="10" fill="#6b6154">测量方向与距离</text>
  <rect x="460" y="20" width="180" height="46" rx="7" fill="#eef3ee" stroke="#9db39d"/>
  <text x="550" y="40" text-anchor="middle" font-size="12" fill="#3a3226">CalibratedData[]</text>
  <text x="550" y="57" text-anchor="middle" font-size="10" fill="#6b6154">逐碎片：方向 + 距离</text>
  <rect x="460" y="76" width="180" height="46" rx="7" fill="#eef3ee" stroke="#9db39d"/>
  <text x="550" y="96" text-anchor="middle" font-size="12" fill="#3a3226">CalibratedViewTarget</text>
  <text x="550" y="113" text-anchor="middle" font-size="10" fill="#6b6154">碎片几何中心</text>
  <rect x="690" y="48" width="130" height="46" rx="7" fill="#f6f1e7" stroke="#c3b69c"/>
  <text x="755" y="68" text-anchor="middle" font-size="12" fill="#3a3226">CalibratedOrigin</text>
  <text x="755" y="85" text-anchor="middle" font-size="10" fill="#6b6154">标定视点</text>
  <line x1="190" y1="66" x2="248" y2="66" stroke="#a99a80" stroke-width="1.5"/>
  <line x1="400" y1="60" x2="458" y2="46" stroke="#a99a80" stroke-width="1.5"/>
  <line x1="400" y1="66" x2="458" y2="96" stroke="#a99a80" stroke-width="1.5"/>
  <line x1="400" y1="72" x2="688" y2="72" stroke="#a99a80" stroke-width="1.5"/>
  <line x1="20" y1="140" x2="820" y2="140" stroke="#ddd4c2" stroke-width="1"/>
  <text x="20" y="168" font-size="13" fill="#2b4a6a">运行期（每 DetectionInterval 采样一次）</text>
  <rect x="20" y="184" width="170" height="52" rx="7" fill="#eaeff5" stroke="#94a8bd"/>
  <text x="105" y="206" text-anchor="middle" font-size="12" fill="#2b4a6a">玩家相机</text>
  <text x="105" y="223" text-anchor="middle" font-size="10" fill="#2b4a6a">位置 + 朝向</text>
  <rect x="250" y="180" width="150" height="60" rx="7" fill="#f3ecdf" stroke="#c0ad8c"/>
  <text x="325" y="204" text-anchor="middle" font-size="12" fill="#3a3226">CheckPuzzle()</text>
  <text x="325" y="222" text-anchor="middle" font-size="10" fill="#6b6154">逐碎片比对 + 视线比对</text>
  <rect x="460" y="164" width="180" height="46" rx="7" fill="#f7ecec" stroke="#c08a8a"/>
  <text x="550" y="184" text-anchor="middle" font-size="12" fill="#7a3232">bAlignedNow</text>
  <text x="550" y="201" text-anchor="middle" font-size="10" fill="#7a3232">通过率 ≥ 阈值 且 视线对准</text>
  <rect x="460" y="222" width="180" height="46" rx="7" fill="#eef3ee" stroke="#9db39d"/>
  <text x="550" y="242" text-anchor="middle" font-size="12" fill="#3a3226">HoldTimer / SolveProgress</text>
  <text x="550" y="259" text-anchor="middle" font-size="10" fill="#6b6154">持续计时与进度</text>
  <rect x="690" y="164" width="130" height="46" rx="7" fill="#eef3ee" stroke="#9db39d"/>
  <text x="755" y="184" text-anchor="middle" font-size="12" fill="#3a3226">bIsSolved</text>
  <text x="755" y="201" text-anchor="middle" font-size="10" fill="#6b6154">终止条件</text>
  <rect x="250" y="300" width="180" height="52" rx="7" fill="#f2eeee" stroke="#bfa0a0"/>
  <text x="340" y="322" text-anchor="middle" font-size="12" fill="#7a3232">蓝图事件</text>
  <text x="340" y="339" text-anchor="middle" font-size="10" fill="#7a3232">Aligned / Lost / Progress / Solved</text>
  <rect x="470" y="300" width="180" height="52" rx="7" fill="#f2eeee" stroke="#bfa0a0"/>
  <text x="560" y="322" text-anchor="middle" font-size="12" fill="#7a3232">材质标量参数</text>
  <text x="560" y="339" text-anchor="middle" font-size="10" fill="#7a3232">GlowIntensity</text>
  <line x1="190" y1="210" x2="248" y2="210" stroke="#7b93ad" stroke-width="1.5"/>
  <line x1="400" y1="200" x2="458" y2="186" stroke="#a99a80" stroke-width="1.5"/>
  <line x1="400" y1="216" x2="458" y2="240" stroke="#a99a80" stroke-width="1.5"/>
  <line x1="620" y1="245" x2="700" y2="200" stroke="#a99a80" stroke-width="1.5"/>
  <line x1="330" y1="240" x2="330" y2="298" stroke="#a99a80" stroke-width="1.5"/>
  <line x1="430" y1="326" x2="468" y2="326" stroke="#a99a80" stroke-width="1.5"/>
  <text x="20" y="392" font-size="11" fill="#6b6154">标定期只依赖场景摆放，运行期只依赖相机采样；两条链路之间唯一的接口是 CalibratedData 与标定原点、图案中心。</text>
  <text x="20" y="410" font-size="11" fill="#6b6154">对齐状态发生翻转时派发一次性事件；进度与发光则在每次采样后按当前值刷新。</text>
</svg>
<figcaption>图 3-2 标定期与运行期两条数据链路</figcaption>
</figure>

<p class="caption">表 3-2 运行时数据结构与生命周期</p>

| 数据项 | 产生时机 | 更新方式 | 消费方 |
| --- | --- | --- | --- |
| `FragmentActors` | 编辑期人工登记 | 仅编辑期 | `Calibrate`、`CacheFragmentMaterials` |
| `CalibratedData` | 标定 | 每次标定整体重建 | `CheckPuzzle`、`DrawDebugCalibration` |
| `CalibratedOrigin` | 标定 | 每次标定重算 | `CheckPuzzle` 的视线判定、调试绘制 |
| `CalibratedViewTarget` | 标定 | 每次标定重算 | `CheckPuzzle` 的视线判定 |
| `HoldTimer` / `SolveProgress` | 运行期 | 每次采样累加或清零 | 蓝图事件、发光写入 |
| `bIsSolved` | 运行期 | 单向置位，仅重置可清除 | 采样入口保护、蓝图读取 |
| `FragmentMaterials` | `BeginPlay` | 初始化期建立，之后只写参数 | 发光写入 |

### 3.5 对外接口设计

对外接口按"谁能改、谁能调、谁能实现"分成三组，全部通过 UE 的反射宏声明，因此无需修改 C++ 即可在编辑器中完成配置与表现层接线。

<p class="caption">表 3-3 对外接口清单</p>

| 接口 | 反射宏 | 分类 | 用途 |
| --- | --- | --- | --- |
| `FragmentActors` | `EditAnywhere` | `Puzzle` | 登记全部碎片 Actor，数量任意 |
| `CameraHeightOffset` | `EditAnywhere` + `ClampMin=0` | `Puzzle` | 把管理器位置抬升到观察者眼睛高度 |
| `GlowParameterName` | `EditAnywhere` | `Puzzle` | 发光用的材质标量参数名；留空则跳过发光 |
| `DotProductThreshold` | `EditAnywhere` + `ClampMin/ClampMax` | `Detection` | 单碎片的**方向**容差，语义为夹角余弦 |
| `ViewAngleThreshold` | `EditAnywhere` + `ClampMin/ClampMax` | `Detection` | **视线**容差，独立于位置判定 |
| `DistanceTolerance` | `EditAnywhere` + `ClampMin=0` | `Detection` | 单碎片的距离容差（世界单位） |
| `RequiredPassRate` | `EditAnywhere` + `ClampMin/ClampMax` | `Detection` | 通过比例阈值 |
| `HoldDuration` | `EditAnywhere` + `ClampMin=0` | `Detection` | 需要连续保持对齐的时长 |
| `DetectionInterval` | `EditAnywhere` + `ClampMin=0.05` | `Detection` | 采样间隔，同时充当时长累加的步长 |
| `bIsSolved` / `SolveProgress` | `BlueprintReadOnly` | `State` | 供蓝图读取的状态快照 |
| `Calibrate()` | `BlueprintCallable` + `CallInEditor` | `Puzzle` | 建立标定数据；可在编辑器细节面板直接执行 |
| `ResetPuzzle()` | `BlueprintCallable` | `Puzzle` | 状态复位并重开检测定时器 |
| `DrawDebugCalibration(float)` | `BlueprintCallable` + `CallInEditor` | `Debug` | 绘制标定原点、碎片位置与连线 |
| `OnPuzzleSolved()` | `BlueprintImplementableEvent` | `Events` | 判定成功时派发一次 |
| `OnViewAligned()` | `BlueprintImplementableEvent` | `Events` | 由未对齐进入对齐时派发一次 |
| `OnViewLost()` | `BlueprintImplementableEvent` | `Events` | 由对齐进入未对齐时派发一次 |
| `OnProgressUpdated(float)` | `BlueprintImplementableEvent` | `Events` | 每次采样后派发当前进度 |

三个分组的设计意图各不相同。

**参数（`EditAnywhere`）承担调参职责。** 方向容差、距离容差、通过比例、保持时长都属于手感参数，需要在运行时反复试凑。把它们暴露为可编辑属性，调参过程就不需要重新编译；`ClampMin` / `ClampMax` 元数据同时起到范围保护作用——例如方向容差被约束在 <span class="eq">[0.9, 1.0]</span>，而余弦值只有落在该区间才对应"小角度偏差"这一物理含义。

**状态（`BlueprintReadOnly`）只读不写。** 状态由判定逻辑单方面维护，若同时开放写权限，蓝图侧的任何误写都会让状态机与判定结果脱节；只读暴露既满足了表现层读取进度的需求，又保持了状态的单一来源。

**表现（`BlueprintImplementableEvent`）只在 C++ 中声明。** 这四个函数没有 C++ 实现体，蓝图侧以事件节点形式出现，实现内容完全由表现层决定。这样划分的收益是双向的：C++ 侧只需保证"在正确的时机调用一次"，不必知道成功后要开门还是播放音效；表现侧则可以在不触碰判定算法的前提下增删逻辑，且不需要重新编译 C++ 模块。

值得注意的是事件语义被刻意设计为两种形态。`OnViewAligned` / `OnViewLost` 属于**边沿触发**：由 `bWasAligned` 保存上一次采样结果，只有状态发生翻转时才各触发一次，适合播放一次性的音效或动画。`OnProgressUpdated` 则属于**电平刷新**：它在对齐期间随每次采样派发，携带连续变化的进度值，适合驱动进度条或渐强效果。

两者在"失去对齐"这一情形下的分工需要特别留意：失焦分支把 `HoldTimer` 与 `SolveProgress` 清零，但**不派发** `OnProgressUpdated`，归零通知完全由 `OnViewLost` 承担。表现层若只在 `OnProgressUpdated` 中更新进度显示，就会在失焦瞬间停留在上一次的进度值上；正确做法是在 `OnViewLost` 中同步复位显示。

成功分支在置位 `bIsSolved` 之后又显式派发了一次 `OnProgressUpdated(1.0f)`。由于该次采样的进度值经 `Clamp` 后已经是 1.0，这次派发在数值上是重复的；它的实际作用是把"成功即进度为 1"这一契约写在成功路径上，而不是依赖钳制的边界行为。

### 3.6 生命周期

Actor 的生命周期钩子只有两个被使用：构造函数负责建立组件结构，`BeginPlay` 负责按固定顺序完成一次性初始化。

<p class="caption">代码 3-3 构造函数与 BeginPlay 的初始化顺序（节选，中间的空 Tick 实现已省略）</p>
```cpp
APerspectivePuzzleManager::APerspectivePuzzleManager()
{
    PrimaryActorTick.bCanEverTick = false;
    RootComponent = CreateDefaultSubobject<UArrowComponent>(TEXT("Root"));
}

void APerspectivePuzzleManager::BeginPlay()
{
    Super::BeginPlay();

    Calibrate();
    CacheFragmentMaterials();
    ResetPuzzle();
    DrawDebugCalibration(100000.0f); // 调试：运行时持续显示目标位置和碎片位置
}
```

**构造函数只做两件事。** 其一是**关闭逐帧 Tick**（`bCanEverTick = false`）：检测由定时器按 `DetectionInterval` 驱动，逐帧回调（约 16 ms 一次）既无必要也浪费性能，关闭后 `Tick` 的实现体保持为空且不会被调用。其二是**指定根组件**。根组件是 Actor 组件树的锚点，`RootComponent` 必须被赋值，否则组件无法参与变换层级。此处选择 `UArrowComponent` 而非更"通用"的 `USceneComponent`，原因是箭头在编辑器中自带方向可视化：管理器在关卡里同时表达"标定位置"和"观察朝向"两个信息，箭头使两者都能被肉眼确认，摆放阶段不必依赖调试绘制。

**`BeginPlay` 的四步顺序不可交换。** `Calibrate()` 必须先于 `CacheFragmentMaterials()`，因为标定可能因空指针等原因跳过部分碎片，而材质缓存遍历的是同一份 `FragmentActors` 列表，两者共享同一轮人工登记结果；若先建材质再标定，一旦中途调整了列表就会出现索引错位。`ResetPuzzle()` 必须在标定之后，因为它除了复位状态，还负责**启动检测定时器**——定时器的第一次回调会立即使用标定数据，若数据尚未建立，首次采样会因 `CalibratedData.Num() == 0` 直接返回。最后的 `DrawDebugCalibration(100000.0f)` 传入一个极大的持续时长，使调试几何体在整个运行期间保持可见，便于在游玩过程中确认标定位置是否与预期一致。

**重置与初始化共用同一条路径。** `ResetPuzzle()` 同时承担"首次启动"与"重复调用"两种语义：它先清除既有的定时器句柄再重新注册，因此重复调用不会叠加多个定时器；状态字段被显式复位为初值，`bIsSolved` 也随之清除。这一设计使系统天然支持"谜题重新开始"，代价是解谜成功后若再次调用重置会重新开启检测，该行为是否符合预期取决于使用场景，需要在关卡逻辑中明确约定。

### 3.7 小结

- 判定目标的全局性决定了架构形态：碎片只提供世界坐标与材质，相机只提供视点采样，全部状态与判定逻辑集中在单一的管理器 Actor 中。
- 碎片数量可变这一约束贯穿实现：所有循环、通过率、材质遍历都以列表长度为准，判定结果由"通过比例"而非"全部通过"给出，使拆分数量变化时无需修改任何常数。
- 数据被明确划分为两条链路：标定期把场景事实固化为 `CalibratedData`、`CalibratedOrigin` 与 `CalibratedViewTarget`；运行期只做采样比对，产生状态迁移与对外消息。
- 接口按职责三分：可编辑属性承担调参，只读属性暴露状态，`BlueprintImplementableEvent` 把表现层完全外置，使判定算法与表现形式可以独立演进。
- 生命周期上关闭了逐帧 Tick，改由固定间隔的定时器驱动；`BeginPlay` 中标定、材质缓存、重置与调试绘制四步的先后顺序由数据依赖决定，不可交换。

