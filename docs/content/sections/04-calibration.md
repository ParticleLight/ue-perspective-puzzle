---
chapter: 4
title: 标定：正确视角的确定与数据表示
---

透视拼接谜题把一张图案拆成若干碎片，分别贴在不同深度的物体表面。只有当观察者处在某一个特定位置、朝某一个特定方向看去时，碎片才会在视野里拼合成完整图案。这意味着系统的第一项任务不是“检测”，而是把一个几何事实固定下来：**设计者认定的那个正确视角，究竟对应哪些可计算的量**。这个过程称为标定（calibration）。

标定只在场景确定后执行一次，产物是一份紧凑的数据表；运行期检测的全部工作，就是把实时相机状态与这份数据表逐项比对。因此标定的数据表示直接决定了检测判据的表达能力——少存一个量，就会有一整类错误姿势无法被排除。

### 4.1 标定的目标

标定需要回答两个问题：

1. **观察者应当站在哪里**——一个世界坐标，称为标定原点（`CalibratedOrigin`）；
2. **从这个位置看出去，各碎片呈现为何种几何关系**——为每个碎片保存一个方向与一个距离。

值得强调的是标定的输入：它读取的是**碎片在场景中的摆放位置**，而不是图案图像本身。碎片是被人为摆放到“在正确视角下恰好拼合”的位置上的，因此“正确视角”与“标定时所采样的那组几何关系”在系统中等价。这一等价关系带来两个直接后果：

- 判定基准完全由场景摆放决定，调整图案的视觉拼接效果不需要改动检测代码；
- 一旦碎片位置改变，旧标定立即失效，且失效是**静默**的——检测不会报错，只会永远不通过。

### 4.2 标定原点：为什么在 Manager 位置之上再加偏移

标定原点并不取 Manager Actor 自身的坐标，而是在其基础上做一次垂直抬升：

<p class="caption">代码 4-1 标定原点的计算（节选自 `PerspectivePuzzleManager.cpp`）</p>

```cpp
	CalibratedOrigin = GetActorLocation() + FVector(0, 0, CameraHeightOffset);
```

各量的含义如下：

<p class="eq">Origin = ManagerLocation + (0, 0, h)，h = CameraHeightOffset</p>

其中 `CameraHeightOffset` 的默认值是 160.0（单位与 UE 的世界单位一致，即厘米），并带有 `meta = (ClampMin = 0.0f)` 的下限约束。

**为什么要拆成两个量。** 把 Manager 放在地面上摆放，符合关卡编辑的直觉：地面是天然的参考平面，坐标水平方向的 X/Y 可以直接对着地砖网格拖拽，Z 保持在 0 便于判断“人站在哪一格”。真正需要精确控制的只是高度，于是把高度单独抽成一个可调标量。若把原点直接绑在 Actor 上，则需要把 Actor 悬空放置到视高，既难以对准地面网格，也让“水平站位”与“观察高度”两个互相独立的意图挤在同一个坐标里。

**高度偏移的语义是“玩家视高”。** 运行期的位置判据用的是玩家相机位置，因此 `CameraHeightOffset` 必须等于该角色实际的眼高，而不是一个想当然的经验值。一旦两者不一致，原点就会与相机存在一个固定的垂直偏差，这个偏差会**同时污染方向与距离**两项判据：相机沿着垂直方向偏离原点后，指向碎片的单位向量会整体倾斜，点积随之下降；同时相机到碎片的距离也会改变。

这种失效有一类特征明显的现象：水平站位完全正确、朝向也正确，但判定始终不通过，且日志中“相机到原点的距离”稳定停在一个非零值上。例如把 Manager 放在 Z=0 的地面、偏移取默认 160，而角色相机实际位于 Z=246 时：

<p class="caption">代码 4-2 高度不匹配时的典型日志</p>

```text
LogTemp: Cam=X=2644.057 Y=2669.098 Z=246.052 Origin=X=2635.150 Y=2667.804 Z=160.000 Offset=86.5
```

水平方向只差约 10 个单位，垂直方向却差了 86 个单位——偏差几乎全部来自高度，足以让方向判据跌出容差。把 `CameraHeightOffset` 改为 246（即角色真实视高）后，原点与相机重合并恢复通过。这里的结论不是“某个数值错了”，而是：**该参数没有可继承的默认值，必须按角色实测**。

<p class="caption">表 4-1 标定原点的构成</p>

| 组成 | 来源 | 语义 | 约束 |
| --- | --- | --- | --- |
| ManagerLocation | Manager Actor 的关卡摆放位置 | 玩家应当站立的水平位置 | 关卡编辑时确定 |
| CameraHeightOffset | 类默认值 160.0，可实例覆盖 | 从地面到玩家视高的垂直距离 | `ClampMin = 0.0f` |
| CalibratedOrigin | 两者相加 | 位置判据与视线判据的共同基准点 | 每次 `Calibrate()` 重算 |

### 4.3 单碎片标定量：方向与距离的极坐标分解

每个碎片对应一条标定条目，其数据表示是一个带反射标记的结构体：

<p class="caption">代码 4-3 `FCalibratedMarkPoint` 的四个字段（节选自 `PerspectivePuzzleManager.h`）</p>

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

<p class="caption">表 4-2 `FCalibratedMarkPoint` 字段与用途</p>

| 字段 | 类型 | 含义 | 运行期用途 |
| --- | --- | --- | --- |
| `FragmentActor` | `AActor*` | 场景中的碎片 Actor，带 `UPROPERTY(EditAnywhere, BlueprintReadWrite)` | 关联关系；不参与数值比对 |
| `WorldLocation` | `FVector` | 标定时刻碎片的真实世界坐标 | 运行期计算“相机→碎片”的当前方向与距离；调试图元中的橙色球 |
| `TargetDirection` | `FVector` | 由原点指向碎片的**单位**方向向量 | 方向判据的比较基准 |
| `TargetDistance` | `float` | 原点到碎片的直线距离（标量） | 距离判据的比较基准 |

**为什么存“方向 + 距离”而不是只存位置。** 只存位置在原理上也能恢复方向与距离（做减法即可），但把二者显式分解出来会带来两点实质差别。

其一，判据可以直接建立在“相对相机”的量上，无需在每次检测里重复推导基准。更关键的是第二点：**方向与距离在几何上互补，各自存在一整类无法分辨的退化情形**。

- **方向对“沿射线的前后位置”完全不敏感。** 设标定原点为 $O$、碎片为 $P$，令 $\hat{d} = (P - O)/|P - O|$ 为标定方向。若把相机沿同一条射线前后移动，即 $C = O + t\hat{d}$（$t > 0$），则当前方向

<p class="eq">(P − C)/|P − C| = ((1 − t)·(P − O))/|1 − t|·|P − O| = ±d̂</p>

  始终与标定方向平行，点积恒为 1。但沿射线前后移动会直接改变观察距离，使其在不同深度上的碎片产生不同比例的缩放，图案因**视差**而散开。仅靠方向判据，这条射线上的任意位置都会通过。

- **距离对“绕碎片的横向位置”不敏感。** 若相机在以碎片为球心、`TargetDistance` 为半径的球面上移动，相机到碎片的距离保持不变，但方向已经改变。

两者合起来才构成一个完整的约束：方向锁住“从原点看出去的角位置”，距离锁住“沿该方向的尺度”。这在几何上正是把 $(P - O)$ 做了**极坐标分解**——一个单位方向加一个半径。检测侧的对偶形式是：

<p class="eq">Dot = Ĉ·d̂ ≥ DotProductThreshold，DistDiff = |&#124;C − P&#124; − TargetDistance| ≤ DistanceTolerance</p>

关于反射标记还有一个容易忽略的细节：四个字段中只有 `FragmentActor` 带有 `UPROPERTY` 宏，`WorldLocation`、`TargetDirection`、`TargetDistance` 都是普通成员。这意味着后三者不参与引擎的反射与序列化，不会出现在细节面板中，也不能直接被蓝图读写。它们被当作纯运行期数据使用——这是有意的取舍，但也意味着标定结果无法在编辑器里逐项目视检查，只能依赖 4.6 的调试绘制。

### 4.4 图案中心：视线判据的单一参考点

除逐碎片的条目外，标定还产出第二个量——所有碎片位置的几何中心：

<p class="caption">代码 4-4 图案中心的累加与求平均（节选自 `PerspectivePuzzleManager.cpp` 的 `Calibrate()`）</p>

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

其定义即等权算术平均：

<p class="eq">CalibratedViewTarget = (1/N) Σᵢ pᵢ，N 为有效碎片数</p>

**为什么不用“各碎片方向的平均”。** 一个自然的替代方案是先把每个碎片的单位方向向量求平均，用结果作为视线参考方向。这种做法有三个问题，且第一个是致命的：

1. **可能退化为零向量。** 若两个碎片相对原点近似相反（例如一前一后），单位向量的平均长度趋近于 0；`GetSafeNormal()` 对零长度向量返回零向量，随后与相机朝向的点积恒为 0，视线判据将**永远**无法通过。这类失败既不报错也无法通过调参救回。
2. **丢失“看向何处”的语义。** 方向平均把距离完全不同的碎片当作等权样本，得到的既不对应任何碎片，也不对应图案的视觉中心。
3. **与位置判据的职责重叠。** 位置判据已经是“逐碎片比方向”的多路比较；视线判据需要回答的是另一个问题——观察者是否正看着**图案整体**。几何中心正是拼合后图案的视觉中心，与“看向图案”这一行为直接对应。

由此形成职责分离：**位置判据逐碎片比较（多路方向 + 多路距离），视线判据只比较一个方向（原点 → 几何中心）**。

需要留意一个退化分支：当 `Count` 为 0 时，代码把 `CalibratedViewTarget` 直接取为 `CalibratedOrigin`。此时“几何中心减原点”是零向量，视线方向无定义，判据恒不通过。实际上 `CheckPuzzle()` 在 `CalibratedData.Num() == 0` 时会提前返回，因此该分支属于防御性写法，而不是可运行的正常路径。

### 4.5 标定流程与调用时机

标定在 `BeginPlay()` 中与材质缓存、状态重置一起构成初始化序列：

<p class="caption">代码 4-5 初始化序列（节选自 `PerspectivePuzzleManager.cpp`）</p>

```cpp
void APerspectivePuzzleManager::BeginPlay()
{
	Super::BeginPlay();

	Calibrate();
	CacheFragmentMaterials();
	ResetPuzzle();
	DrawDebugCalibration(100000.0f); // 调试：运行时持续显示目标位置和碎片位置
}
```

四步的顺序不是随意的：

1. `Calibrate()` **必须最先**。`ResetPuzzle()` 会开启一个以 `DetectionInterval`（0.1 秒）为周期的循环定时器，而 `CheckPuzzle()` 的第一句就是“已解出或标定数据为空则返回”。如果定时器先于标定启动，最初的若干个检测周期会静默地在空数据上返回——功能上无害，但会掩盖“标定失败”这一真实故障。
2. `CacheFragmentMaterials()` 在标定之后执行，为每个碎片建立可供运行时改参的动态材质实例；检测通过时写入发光参数的就是这批实例。
3. `ResetPuzzle()` 清零状态并启动定时器，从此进入运行期检测。
4. `DrawDebugCalibration(100000.0f)` 以约 27.8 小时的存活时间绘制标定图元，等效于常驻显示。

`Calibrate()` 自身的副作用同样值得注意。它以 `CalibratedData.Empty()` 开头，因此重复调用是幂等的——先清空再重建，不会累积旧条目。这正是它能够被挂到编辑器按钮上（`CallInEditor = "true"`）反复执行的前提：改动碎片位置后重新标定，得到的一定是当前场景的完整快照。

标定结束时写入的日志是判断“碎片有没有被正确挂上”的第一手证据：

<p class="caption">代码 4-6 标定结果日志（节选自 `PerspectivePuzzleManager.cpp`）</p>

```cpp
	UE_LOG(LogTemp, Log, TEXT("Calibrate: %d points recorded, view target %s"), CalibratedData.Num(), *CalibratedViewTarget.ToString());
```

标定条目数少于预期，通常意味着 `FragmentActors` 数组中有空槽或漏拖。这里存在一处需要留意的**容忍度不一致**：`Calibrate()` 用 `if (!Actor) continue;` 跳过空槽，并且只对有效碎片计数（因此通过率的分子分母始终自洽）；而 `CacheFragmentMaterials()` 没有任何空指针防护，它直接对数组的每个元素调用 `FindComponentByClass`。两者对同一份 `FragmentActors` 的健壮性不同，实践含义是：**`FragmentActors` 中不应保留未赋值的空槽**。

### 4.6 标定的可视化验证

标定把三维几何压缩成了几个浮点数，肉眼无法直接核对。系统为此提供了一组世界空间的调试图元：

<p class="caption">代码 4-7 `DrawDebugCalibration` 全文（节选自 `PerspectivePuzzleManager.cpp`）</p>

```cpp
// 调试绘制

void APerspectivePuzzleManager::DrawDebugCalibration(float Duration) const
{
	if (CalibratedData.Num() == 0) return;

	DrawDebugSphere(GetWorld(), CalibratedOrigin, 20.0f, 12, FColor::Cyan, false, Duration);

	for (const auto& Point : CalibratedData)
	{
		DrawDebugSphere(GetWorld(), Point.WorldLocation, 15.0f, 8, FColor::Orange, false, Duration);
		DrawDebugLine(GetWorld(), CalibratedOrigin, Point.WorldLocation, FColor::Yellow, false, Duration);
	}
}
```

<p class="caption">表 4-3 调试图元的语义</p>

| 图元 | 位置 | 尺寸与颜色 | 用于核对 |
| --- | --- | --- | --- |
| `DrawDebugSphere` | `CalibratedOrigin` | 半径 20，12 段，青色 | 标定原点是否落在预期视高上 |
| `DrawDebugSphere` | 每个 `Point.WorldLocation` | 半径 15，8 段，橙色 | 碎片是否被正确收录、位置是否与视觉一致 |
| `DrawDebugLine` | 原点 → 碎片 | 黄色 | 方向与距离的整体形态是否符合预期 |

**为什么用 DrawDebug 而不是运行时 UI。** 需要核对的三个量全部是**世界空间**的量，调试图元与它们处在同一坐标系中，可以用眼睛直接比较“球是否正好在视平线上”“连线是否穿过碎片中心”。而屏幕空间的 UMG 只能显示数值，无法回答“这个数在场景里对应哪里”。此外，调试绘制不需要新增任何资产，也不改变 Actor 的组件结构。

调用时机上有一处细节：函数签名的默认参数是 `Duration = 5.0f`，而初始化时传入的是 `100000.0f`，把临时可视化变成了常驻可视化。这也提示了一个使用要点——该函数同时被标记为 `CallInEditor`，可以在编辑器里手动触发一次短时绘制；若只依赖默认参数，图元会在 5 秒后消失，容易误判为“没有绘制”。

实际操作上，标定核对的方法是：站到预期位置，观察青色球是否恰好位于视平线上，同时查看日志里相机到原点的距离是否趋近 0。若两者都成立，则高度偏移正确；若球明显偏高或偏低，则应回到 4.2 修正 `CameraHeightOffset`，而不是去放松方向阈值来“凑”通过。

<figure>
<svg viewBox="0 0 780 320" width="780" height="320" role="img" aria-label="标定几何示意">
<defs><marker id="arw4a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#6b6b6b"/></marker></defs>
<line x1="30" y1="272" x2="750" y2="272" stroke="#b3b3b3" stroke-width="2"/>
<text x="700" y="292" font-size="12" fill="#6b6b6b">地面 Z = 0</text>
<rect x="78" y="244" width="30" height="28" rx="3" fill="#c8c8c8" stroke="#9a9a9a"/>
<text x="60" y="262" font-size="12" fill="#3a3a3a">Manager</text>
<line x1="93" y1="244" x2="93" y2="152" stroke="#6b6b6b" stroke-dasharray="4 3" marker-end="url(#arw4a)"/>
<text x="100" y="205" font-size="12" fill="#262626">CameraHeightOffset = 160</text>
<circle cx="93" cy="148" r="7" fill="#838383"/>
<text x="106" y="140" font-size="12.5" fill="#1f1f1f">CalibratedOrigin（标定原点 = 玩家视高）</text>
<rect x="404" y="176" width="22" height="96" fill="#c8c8c8" stroke="#9a9a9a"/>
<circle cx="415" cy="140" r="6" fill="#262626"/>
<text x="352" y="130" font-size="12.5" fill="#1f1f1f">碎片 A（近，柱面）</text>
<rect x="636" y="120" width="18" height="152" fill="#c8c8c8" stroke="#9a9a9a"/>
<circle cx="645" cy="104" r="6" fill="#262626"/>
<text x="596" y="94" font-size="12.5" fill="#1f1f1f">碎片 B（远，墙面）</text>
<line x1="93" y1="148" x2="409" y2="140" stroke="#999999" stroke-width="1.6"/>
<line x1="93" y1="148" x2="639" y2="104" stroke="#999999" stroke-width="1.6"/>
<circle cx="530" cy="122" r="6" fill="#6b6b6b"/>
<text x="440" y="150" font-size="12.5" fill="#1f1f1f">CalibratedViewTarget</text>
<text x="440" y="167" font-size="12" fill="#6b6b6b">（碎片几何中心）</text>
<line x1="93" y1="148" x2="524" y2="122" stroke="#6b6b6b" stroke-width="1.6" stroke-dasharray="6 4"/>
<text x="150" y="120" font-size="12" fill="#6b6b6b">视线判据方向 = 归一点（中心 − 原点）</text>
</svg>
<figcaption>图 4-1 标定的几何构成：原点、碎片方向/距离与图案中心</figcaption>
</figure>

### 4.7 小结与边界

标定的实质是**一次性采样**：把“正确视角”固化为原点坐标、每碎片的方向与距离、以及图案中心三项产物。运行期不再重新推导任何基准，只做比对。这种设计的代价与收益都很明确：判据简单、稳定、可解释，但基准与场景摆放严格绑定。

<p class="caption">表 4-4 标定产物的运行期去向</p>

| 产物 | 类型 | 运行期使用位置 |
| --- | --- | --- |
| `CalibratedOrigin` | `FVector` | 视线判据的方向计算；调试绘制（青色球）；位置偏差日志 |
| `CalibratedData` | `TArray45` | 逐碎片的方向与距离比对；通过率的分母 |
| `CalibratedViewTarget` | `FVector` | 视线判据的参考点；调试绘制中不单独显示 |

边界与注意事项：

1. **改变碎片位置后必须重新标定。** 运行期不会读取碎片的实时位置来更新基准，旧标定的失配是静默的。
2. **标定与运行期必须共享同一套坐标与同一视高。** `CameraHeightOffset` 与实际相机高度的偏差会同时污染方向与距离两项判据，且无法通过调阈值可靠补偿。
3. **`FragmentActors` 不应留空槽。** `Calibrate()` 会跳过空槽而 `CacheFragmentMaterials()` 不会，两者的健壮性不一致。
4. **一份标定只对应一个正确视角。** 需要多个解法的谜题应使用多个 Manager 实例，各自持有独立的 `FragmentActors` 与标定结果。
5. **标定数据不包含朝向信息。** 观察者朝向由 `CalibratedViewTarget` 单独承担，二者缺一不可——这也是位置判据与视线判据必须同时成立的原因。
