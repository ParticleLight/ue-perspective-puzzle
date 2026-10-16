---
chapter: 5
title: 运行期检测：方向—距离联合判据与状态机
---

标定给出一份静态基准：原点、每个碎片的方向与距离、以及图案中心。运行期的任务是把实时相机状态与这份基准逐项比对，并把“连续多个周期都成立”这一时间维度纳入判定。整个检测由两部分构成：一组**空间判据**（方向、距离、通过率、视线），以及一个**状态机**（边沿事件、保持计时、完成与重置）。

### 5.1 检测的时间模型：定时器轮询而非逐帧 Tick

检测的驱动方式在构造阶段就已确定，其中起决定作用的是这一行：

<p class="caption">代码 5-1 关闭 Actor 的逐帧 Tick（节选自 `PerspectivePuzzleManager.cpp`）</p>

```cpp
	PrimaryActorTick.bCanEverTick = false;
```

其语义是**引擎根本不会把这个 Actor 注册到逐帧更新列表**。类中虽然仍有一个 `Tick()` 覆写，但它只调用 `Super::Tick(DeltaTime)`，不含任何逻辑——检测与帧循环完全解耦。检测改由循环定时器驱动，在重置时建立：

<p class="caption">代码 5-2 循环定时器的建立（节选自 `PerspectivePuzzleManager.cpp` 的 `ResetPuzzle()`）</p>

```cpp
	GetWorldTimerManager().ClearTimer(DetectionTimerHandle);
	GetWorldTimerManager().SetTimer(DetectionTimerHandle, this, &APerspectivePuzzleManager::CheckPuzzle, DetectionInterval, true);
```

`SetTimer` 的最后一个实参 `true` 表示循环触发，周期为 `DetectionInterval`（默认 0.1 秒），即 **10 Hz** 的检测频率。

**为什么不用逐帧 Tick。** 判据处理的是玩家的空间位置，而人移动的速度在量级上是每帧若干厘米；把采样率从 60 Hz 降到 10 Hz，检测的最坏延迟是 0.1 秒，远低于“玩家察觉到判定没响应”的阈值。反过来，逐帧检测会把同一套“逐碎片求差 + 点积”的计算量放大约 6 倍，而收益为零——判据本身是幂等的纯比较，不存在需要逐帧积分的状态。

这一选择有两个附带语义：其一，计时以**检测周期**为单位（见 5.6），“持续 1.5 秒”等价于“连续 15 个检测周期都判定为对齐”；其二，定时器仍运行在游戏线程上，受调度粒度约束，极长的单帧同样会推迟回调。

### 5.2 相机状态的获取

单次检测首先取得玩家视点，并对空指针做保护：

<p class="caption">代码 5-3 取玩家控制器与视点（节选自 `PerspectivePuzzleManager.cpp` 的 `CheckPuzzle()`）</p>

```cpp
	if (bIsSolved || CalibratedData.Num() == 0) return;

	APlayerController* PC = UGameplayStatics::GetPlayerController(GetWorld(), 0);
	if (!PC || !PC->PlayerCameraManager) return;

	FVector CamLoc;
	FRotator CamRot;
	PC->GetPlayerViewPoint(CamLoc, CamRot);
	FVector CamForward = CamRot.Vector();
```

三个环节各自有明确意图：`GetPlayerController(GetWorld(), 0)` 取本地玩家 0 号控制器，索引 0 意味着单机单玩家假设，分屏或多玩家场景需要另行扩展；`if (!PC || !PC->PlayerCameraManager) return;` 是必要的防御，因为 `GetPlayerViewPoint` 的实现内部依赖 `PlayerCameraManager`，不先判空则可能在相机管理器尚未建立的瞬间崩溃；`GetPlayerViewPoint(CamLoc, CamRot)` 返回的是**相机**的世界位置与旋转而非 Pawn 的位置——相机可能带有弹簧臂滞后、震动或视角混合，判定必须建立在“玩家实际看到的视点”上，而非角色的逻辑坐标。

`CamRot.Vector()` 取旋转的前向单位向量；旋转中的 Roll 分量不影响前向向量，因此相机翻滚不会干扰视线判据。同一样本内，位置判据使用 `CamLoc`，视线判据使用 `CamForward`，二者来自同一次采样，保证两项判据考察的是同一瞬间的状态，不会出现位置与朝向错帧。

### 5.3 位置判据：方向与距离的联合约束

对每个碎片，代码计算两个偏差量，并要求二者同时落入容差：

<p class="caption">代码 5-4 逐碎片的位置判据（节选自 `PerspectivePuzzleManager.cpp` 的 `CheckPuzzle()`）</p>

```cpp
	for (const auto& Point : CalibratedData)
	{
		FVector ToFragment = Point.WorldLocation - CamLoc;
		float CurrentDist = ToFragment.Size();
		FVector CurrentDir = ToFragment.GetSafeNormal();

		// 位置检测：相机到碎片的方向 / 距离 是否匹配标定值
		float Dot = FVector::DotProduct(CurrentDir, Point.TargetDirection);
		float DistDiff = FMath::Abs(CurrentDist - Point.TargetDistance);

		if (Dot >= DotProductThreshold && DistDiff <= DistanceTolerance)
		{
			PassCount++;
		}
		else
		{
			UE_LOG(LogTemp, Log, TEXT("  Mismatch: Dot=%.4f(need>=%.4f) DistDiff=%.1f(need<=%.1f)"),
				Dot, DotProductThreshold, DistDiff, DistanceTolerance);
		}
	}
```

两项判据的数学形式为：

<p class="eq">Dot = ((P − C)/&#124;P − C&#124;) · d̂ ≥ DotProductThreshold</p>
<p class="eq">DistDiff = &#124;&#124;P − C&#124; − TargetDistance&#124; ≤ DistanceTolerance</p>

其中 C 为相机位置，P 为碎片世界坐标，d̂ 为标定方向。由于 d̂ 与当前方向都是单位向量，`Dot` 即二者夹角的余弦 `cos θ`。由此可把阈值翻译成角度：默认值 `DotProductThreshold = 0.996` 对应约 5.13°，即工程表述中的"cos(5°)"；属性上的 `ClampMin = 0.9` 与 `ClampMax = 1.0` 把取值范围限制在 0° 到约 25.8° 之间。

<p class="caption">表 5-1 方向阈值与角度容差的对应</p>

| `DotProductThreshold` | 对应角度 | 语义 |
| --- | --- | --- |
| 0.996（默认） | 约 5.1° | “站得很准”的量级 |
| 0.900（ClampMin） | 约 25.8° | 参数允许的最松值 |

距离判据是**绝对差**而非相对误差：`DistanceTolerance = 50` 的含义是“相机到碎片的距离与标定距离相差不超过 50 个世界单位（厘米）”。绝对差有一个直接后果——同一个容差对不同距离的碎片严格程度并不相同：对 300 单位外的碎片，50 单位相当于约 17% 的相对误差；对 1500 单位外的碎片则只有约 3%。当场景中碎片的标定距离相差悬殊时，若需要等价的相对严格度，应把这一项改为按比例判定。

两项判据缺一不可：**方向对“沿标定射线的前后位移”完全不敏感**（沿该射线移动时 cos θ 恒为 1），只有距离项能约束它；而**距离对“绕碎片球面的横向位移”不敏感**，只有方向项能约束它（详见 4.3）。日志中“点积很高但距离差很大”与“距离差很小但点积很低”这两类条目，正对应两种单侧偏差。

<figure>
<svg viewBox="0 0 780 270" width="780" height="270" role="img" aria-label="位置判据的几何示意">
<defs><marker id="arw5a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#6b6b6b"/></marker></defs>
<polygon points="70,150 740,55 740,193" fill="#c8c8c8"/>
<line x1="70" y1="150" x2="740" y2="124" stroke="#262626" stroke-width="1.4" stroke-dasharray="7 4"/>
<line x1="70" y1="150" x2="740" y2="55" stroke="#bbbbbb"/><line x1="70" y1="150" x2="740" y2="193" stroke="#bbbbbb"/>
<circle cx="70" cy="150" r="7" fill="#838383"/><text x="18" y="176" font-size="12.5" fill="#1f1f1f">相机 C</text>
<ellipse cx="520" cy="128" rx="58" ry="44" fill="none" stroke="#6b6b6b" stroke-width="1.4" stroke-dasharray="5 4"/>
<circle cx="520" cy="128" r="6" fill="#262626"/><text x="534" y="122" font-size="12.5" fill="#1f1f1f">碎片 P</text>
<text x="330" y="196" font-size="12" fill="#6b6b6b">距离容差 ±50 世界单位</text>
<line x1="70" y1="150" x2="620" y2="117" stroke="#6c6c6c" stroke-width="1.6" marker-end="url(#arw5a)"/>
<text x="250" y="106" font-size="12" fill="#6c6c6c">当前方向 (P − C) 归一化</text>
<text x="176" y="140" font-size="12" fill="#262626">标定方向 d̂（Dot = cos θ）</text>
<text x="600" y="52" font-size="12" fill="#262626">±5° 角锥</text>
<text x="60" y="228" font-size="12.5" fill="#3a3a3a">通过条件：cos(当前方向, d̂) ≥ 0.996 且 ||P − C| − TargetDistance| ≤ 50</text>
</svg>
<figcaption>图 5-1 位置判据的几何构成：角锥与距离容差</figcaption>
</figure>

### 5.4 通过率判据：允许个别碎片不达标

逐碎片比较的结果被汇总为一个通过比例，再与门限比较：

<p class="eq">Rate = PassCount / CalibratedData.Num() ≥ RequiredPassRate</p>

`RequiredPassRate` 默认 0.8，取值范围被限制在 0 到 1。它的工程意义是**容忍个别碎片失配**：碎片数量多时，总会有某个碎片因遮挡、贴花偏移或摆放误差而略微超标，若要求 100% 通过，谜题会变得脆弱且难以调优。但比例判据是离散的——通过率只能取 k/N 这些值，因此 0.8 的实际效果取决于碎片数量：

<p class="caption">表 5-2 `RequiredPassRate = 0.8` 时实际需要的通过数</p>

| 碎片数 N | 需要通过数 ⌈0.8N⌉ | 允许失配数 | 说明 |
| --- | --- | --- | --- |
| 2 | 2 | 0 | 比例判据退化为“全部通过” |
| 4 | 4 | 0 | 0.75 已低于门限 |
| 5 | 4 | 1 | 容错开始生效 |

这张表揭示了一个容易误判的点：在碎片数小于 5 的场景里，把 `RequiredPassRate` 设为 0.8 与设为 1.0 的效果完全相同，容错并未真正启用；若要获得“允许一半碎片失配”的语义，需把门限降到 0.5，但那样在两个碎片时就会退化为“只要一个碎片对上”，判定强度大幅下降。

### 5.5 视线判据：为什么位置判据单独不够

位置判据只依赖相机**位置**，与相机**朝向**无关。玩家站在正确位置、低头看着地面时，指向碎片的单位向量与标定值仍然一致，位置相关的两项判据照常通过。要排除这类姿势，必须额外引入朝向约束：

<p class="caption">代码 5-5 视线判据（节选自 `PerspectivePuzzleManager.cpp` 的 `CheckPuzzle()`）</p>

```cpp
	// 朝向检测：玩家视线是否对准图案中心方向（独立于单个碎片）
	FVector ViewTargetDir = (CalibratedViewTarget - CalibratedOrigin).GetSafeNormal();
	float ViewDot = FVector::DotProduct(CamForward, ViewTargetDir);
	bool bViewMatch = (ViewDot >= ViewAngleThreshold);
```

其中参考方向由标定产物直接给出：

<p class="eq">ViewTargetDir = normalize(CalibratedViewTarget − CalibratedOrigin)</p>
<p class="eq">ViewDot = CamForward · ViewTargetDir ≥ ViewAngleThreshold</p>

`ViewAngleThreshold` 默认同样为 0.996，即约 5.1°。它回答“玩家是否正看着图案整体”，与位置判据回答的“玩家是否站在正确位置”正交。

**为什么参考方向取图案中心而不是某个碎片。** 碎片有两个以上时，从原点看向各个碎片的方向互不相同，而相机前向只能有一个方向；若要求视线同时对准每一个碎片，判据在数学上不可满足——除非这些碎片在屏幕上恰好重合，而那正是拼合成功的特例。取几何中心则给出**唯一一个**参考方向，并与“玩家在看完整图案”这一行为直接对应（几何中心的选取理由详见 4.4）。

有一点必须明确：`ViewTargetDir` 是标定阶段算出的**固定方向**，与相机的当前位置无关。因此视线判据单独并不构成位置约束——玩家站在任何地方，只要朝向恰好等于该方向，视线判据同样通过；反之，站在正确位置但朝向偏离超过约 5°，视线判据就会失败。两条判据必须取逻辑与，才同时约束“站在哪”与“朝哪看”。

### 5.6 联合判定、保持计时与完成

两条判据的结果被合并为一个瞬时布尔量，并进入计时状态机：

<p class="caption">代码 5-6 联合判定与保持计时（节选自 `PerspectivePuzzleManager.cpp` 的 `CheckPuzzle()`）</p>

```cpp
	float Rate = (float)PassCount / (float)CalibratedData.Num();
	bool bAlignedNow = (Rate >= RequiredPassRate) && bViewMatch;

	// 调试：打印当前检测状态
	UE_LOG(LogTemp, Log, TEXT("CheckPuzzle: Pass=%d/%d Rate=%.2f ViewDot=%.4f Aligned=%s"),
		PassCount, CalibratedData.Num(), Rate, ViewDot, bAlignedNow ? TEXT("true") : TEXT("false"));

	if (bAlignedNow)
	{
		if (!bWasAligned) OnViewAligned();

		HoldTimer += DetectionInterval;
		SolveProgress = FMath::Clamp(HoldTimer / HoldDuration, 0.0f, 1.0f);
		OnProgressUpdated(SolveProgress);

		if (HoldTimer >= HoldDuration)
		{
			bIsSolved = true;
			SolveProgress = 1.0f;
			OnProgressUpdated(1.0f);
			OnPuzzleSolved();
			GetWorldTimerManager().ClearTimer(DetectionTimerHandle);
		}
	}
	else
	{
		if (bWasAligned) OnViewLost();
		HoldTimer = 0.0f;
		SolveProgress = 0.0f;
	}
```

判定链条可以概括为：

<p class="eq">bAlignedNow = (Rate ≥ RequiredPassRate) ∧ bViewMatch</p>
<p class="eq">HoldTimer ← bAlignedNow ? HoldTimer + DetectionInterval : 0</p>
<p class="eq">SolveProgress = clamp(HoldTimer / HoldDuration, 0, 1)</p>

几个关键语义：

- **固定步长累加。** `HoldTimer` 每次增加的是 `DetectionInterval` 这一标称值，而不是回调的真实时间差。因此“保持时长”被量化为“连续对齐的检测周期数”：`HoldDuration = 1.5`、`DetectionInterval = 0.1` 时需要连续 15 个对齐周期。
- **进度是归一化的保持量，不是“接近程度”。** `SolveProgress` 只反映对齐已经持续了多久，不反映站位的精确程度。`HoldDuration` 取非正值时，首个对齐周期即满足 `HoldTimer >= HoldDuration`，等价于“一对齐即解出”。
- **失配立即清零。** 未对齐的分支不做任何衰减，直接把 `HoldTimer` 与 `SolveProgress` 归零，因此保持窗口内不允许中断，谜题是“全有或全无”的；进度回退也因此是瞬时的，视觉上会出现跳变。
- **完成即停止检测。** 解出时把 `bIsSolved` 置真、`SolveProgress` 固定为 1.0、触发事件，最后清掉循环定时器；此后 `CheckPuzzle` 即便被调用，函数开头的守卫也会立刻返回。

### 5.7 状态机与事件：边沿检测的语义

事件不是每个对齐周期都触发，而是通过 `bWasAligned` 做边沿检测：

<p class="caption">表 5-3 事件触发条件与语义</p>

| 事件 | 触发条件 | 触发次数 | 语义 |
| --- | --- | --- | --- |
| `OnViewAligned` | 本周期对齐 且 上一周期未对齐 | 每次对齐过程一次 | 上升沿：开始对齐 |
| `OnViewLost` | 本周期未对齐 且 上一周期已对齐 | 每次对齐过程一次 | 下降沿：失去对齐 |
| `OnProgressUpdated(Progress)` | 每个对齐周期 | 每周期一次，另加完成时的一次 1.0 | 进度反馈，驱动发光 |
| `OnPuzzleSolved` | `HoldTimer >= HoldDuration` | 一次 | 解出，随后定时器被清除 |

四个事件都是 `BlueprintImplementableEvent`：C++ 只负责“什么时候触发”，具体表现（开门、播放动画、音效）由蓝图实现，这是算法与表现分离的常规做法。此外，`bWasAligned = bAlignedNow` 写在函数的**最后一行**，位于事件触发与发光写入之后——这保证同一周期内所有读取 `bWasAligned` 的分支看到的都是上一周期的值，边沿判定不会被本周期中途改写。

`ResetPuzzle()` 的重置语义是“回到未解出、未对齐的初始状态并重新开始检测”：清零 `bIsSolved`、`bWasAligned`、`HoldTimer`、`SolveProgress`，清除并重建定时器。需要注意它**不会重新标定**——`CalibratedData`、`CalibratedOrigin`、`CalibratedViewTarget` 被完整保留，因此在碎片位置未变的前提下重置是可重复的；若要改变判定基准，必须显式调用 `Calibrate()`。

### 5.8 完整判定流程与分段索引

`CheckPuzzle()` 在源码中占据连续的一段（约 96 行），结构可拆为七个段落。前六段已在 5.2 至 5.6 中逐段展开，下表给出索引：

<p class="caption">表 5-4 `CheckPuzzle()` 的分段结构</p>

| 段落 | 作用 | 关键语句 | 相关小节 |
| --- | --- | --- | --- |
| 守卫与取视点 | 已解出或无标定数据即返回；取得 `CamLoc` 与 `CamForward` | `if (bIsSolved &#124;&#124; CalibratedData.Num() == 0) return;` | 5.2 |
| 视线判据 | 朝向是否对准图案中心 | `ViewDot >= ViewAngleThreshold` | 5.5 |
| 位置判据 | 逐碎片比对方向与距离 | `Dot >= DotProductThreshold && DistDiff 10代码 5-7 发光参数写入（节选自 `PerspectivePuzzleManager.cpp` 的 `CheckPuzzle()`）</p>

```cpp
	// 更新碎片发光：对齐时随 SolveProgress 逐渐增强，失焦时归零
	if (GlowParameterName != NAME_None)
	{
		float GlowValue = bAlignedNow ? SolveProgress : 0.0f;
		for (UMaterialInstanceDynamic* DynMat : FragmentMaterials)
		{
			if (DynMat) DynMat->SetScalarParameterValue(GlowParameterName, GlowValue);
		}
	}

```

发光值的定义是 `GlowValue = bAlignedNow ? SolveProgress : 0.0`：对齐时随进度从 0 递增到 1，失焦瞬间归零。它被写入每个碎片的动态材质实例，因此所有碎片**同步发光**；若需要“逐个点亮”，需为每个碎片单独维护进度值。整个过程由 `GlowParameterName != NAME_None` 守卫，把参数名留空即可整体关闭发光，且不产生任何材质写入开销。

<figure>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="44 44 822 226" width="100%" role="img"><g><g/><g transform="translate(0,0) scale(1)"><g style="visibility: visible;"><rect x="60" y="60" width="200" height="70" rx="10.5" ry="10.5" fill="#ffffff" stroke="#000000" pointer-events="all" style="fill: light-dark(#ffffff, var(--ge-dark-color, #121212)); stroke: light-dark(rgb(0, 0, 0), rgb(255, 255, 255));"/></g><g style=""><g><foreignObject style="overflow: visible; text-align: left;" pointer-events="none" x="-9939" y="-9905" width="20196" height="20066"><div xmlns="http://www.w3.org/1999/xhtml" style="display: flex; align-items: unsafe center; justify-content: unsafe center; width: 198px; height: 1px; padding-top: 10000px; margin-left: 10000px;"><div style="box-sizing: border-box; font-size: 0; text-align: center; color: #000000; "><div style="display: inline-block; font-size: 12px; font-family: Helvetica; color: light-dark(#000000, #ffffff); line-height: 1.2; pointer-events: all; white-space: normal; word-wrap: normal; ">未对齐<br />bWasAligned = false</div></div></div></foreignObject></g></g><g style="visibility: visible;"><rect x="340" y="60" width="240" height="70" rx="10.5" ry="10.5" fill="#f5f5f5" stroke="#333333" pointer-events="all" style="fill: light-dark(rgb(245, 245, 245), rgb(26, 26, 26)); stroke: light-dark(rgb(51, 51, 51), rgb(193, 193, 193));"/></g><g style=""><g><foreignObject style="overflow: visible; text-align: left;" pointer-events="none" x="-9659" y="-9905" width="20236" height="20066"><div xmlns="http://www.w3.org/1999/xhtml" style="display: flex; align-items: unsafe center; justify-content: unsafe center; width: 238px; height: 1px; padding-top: 10000px; margin-left: 10000px;"><div style="box-sizing: border-box; font-size: 0; text-align: center; color: #000000; "><div style="display: inline-block; font-size: 12px; font-family: Helvetica; color: light-dark(#000000, #ffffff); line-height: 1.2; pointer-events: all; white-space: normal; word-wrap: normal; ">对齐中<br />HoldTimer 累加 / SolveProgress 归一</div></div></div></foreignObject></g></g><g style="visibility: visible;"><rect x="660" y="60" width="190" height="70" rx="10.5" ry="10.5" fill="#ffffff" stroke="#000000" pointer-events="all" style="fill: light-dark(#ffffff, var(--ge-dark-color, #121212)); stroke: light-dark(rgb(0, 0, 0), rgb(255, 255, 255));"/></g><g style=""><g><foreignObject style="overflow: visible; text-align: left;" pointer-events="none" x="-9339" y="-9905" width="20186" height="20066"><div xmlns="http://www.w3.org/1999/xhtml" style="display: flex; align-items: unsafe center; justify-content: unsafe center; width: 188px; height: 1px; padding-top: 10000px; margin-left: 10000px;"><div style="box-sizing: border-box; font-size: 0; text-align: center; color: #000000; "><div style="display: inline-block; font-size: 12px; font-family: Helvetica; color: light-dark(#000000, #ffffff); line-height: 1.2; pointer-events: all; white-space: normal; word-wrap: normal; ">已解出<br />bIsSolved = true</div></div></div></foreignObject></g></g><g style="visibility: visible;"><path d="M 260 95 L 333.63 95" fill="none" stroke="white" stroke-miterlimit="10" pointer-events="stroke" style="stroke: light-dark(rgb(0, 0, 0), rgb(255, 255, 255));" visibility="hidden" stroke-width="19" vector-effect="non-scaling-stroke"/><path d="M 260 95 L 333.63 95" fill="none" stroke="#000000" stroke-miterlimit="10" pointer-events="stroke" style="stroke: light-dark(rgb(0, 0, 0), rgb(255, 255, 255));"/><path d="M 338.88 95 L 331.88 98.5 L 333.63 95 L 331.88 91.5 Z" fill="#000000" stroke="#000000" stroke-miterlimit="10" pointer-events="all" style="fill: light-dark(rgb(0, 0, 0), rgb(255, 255, 255)); stroke: light-dark(rgb(0, 0, 0), rgb(255, 255, 255));"/></g><g style=""><g><foreignObject style="overflow: visible; text-align: left;" pointer-events="none" x="-9700" y="-9905" width="20000" height="20000"><div xmlns="http://www.w3.org/1999/xhtml" style="display: flex; align-items: unsafe center; justify-content: unsafe center; width: 1px; height: 1px; padding-top: 10000px; margin-left: 10000px;"><div style="box-sizing: border-box; font-size: 0; text-align: center; color: #000000; background-color: #ffffff; "><div style="display: inline-block; font-size: 11px; font-family: Helvetica; color: light-dark(#000000, #ffffff); line-height: 1.2; pointer-events: all; background-color: light-dark(#ffffff, var(--ge-dark-color, #121212)); white-space: nowrap; ">bAlignedNow = true：OnViewAligned</div></div></div></foreignObject></g></g><g style="visibility: visible;"><path d="M 580 95 L 653.63 95" fill="none" stroke="white" stroke-miterlimit="10" pointer-events="stroke" style="stroke: light-dark(rgb(0, 0, 0), rgb(255, 255, 255));" visibility="hidden" stroke-width="19" vector-effect="non-scaling-stroke"/><path d="M 580 95 L 653.63 95" fill="none" stroke="#000000" stroke-miterlimit="10" pointer-events="stroke" style="stroke: light-dark(rgb(0, 0, 0), rgb(255, 255, 255));"/><path d="M 658.88 95 L 651.88 98.5 L 653.63 95 L 651.88 91.5 Z" fill="#000000" stroke="#000000" stroke-miterlimit="10" pointer-events="all" style="fill: light-dark(rgb(0, 0, 0), rgb(255, 255, 255)); stroke: light-dark(rgb(0, 0, 0), rgb(255, 255, 255));"/></g><g style=""><g><foreignObject style="overflow: visible; text-align: left;" pointer-events="none" x="-9380" y="-9905" width="20000" height="20000"><div xmlns="http://www.w3.org/1999/xhtml" style="display: flex; align-items: unsafe center; justify-content: unsafe center; width: 1px; height: 1px; padding-top: 10000px; margin-left: 10000px;"><div style="box-sizing: border-box; font-size: 0; text-align: center; color: #000000; background-color: #ffffff; "><div style="display: inline-block; font-size: 11px; font-family: Helvetica; color: light-dark(#000000, #ffffff); line-height: 1.2; pointer-events: all; background-color: light-dark(#ffffff, var(--ge-dark-color, #121212)); white-space: nowrap; ">HoldTimer ≥ HoldDuration：OnPuzzleSolved</div></div></div></foreignObject></g></g><g style="visibility: visible;"><path d="M 340 95 L 266.37 95" fill="none" stroke="white" stroke-miterlimit="10" pointer-events="stroke" style="stroke: light-dark(rgb(0, 0, 0), rgb(255, 255, 255));" visibility="hidden" stroke-width="19" vector-effect="non-scaling-stroke"/><path d="M 340 95 L 266.37 95" fill="none" stroke="#000000" stroke-miterlimit="10" stroke-dasharray="3 3" pointer-events="stroke" style="stroke: light-dark(rgb(0, 0, 0), rgb(255, 255, 255));"/><path d="M 261.12 95 L 268.12 91.5 L 266.37 95 L 268.12 98.5 Z" fill="#000000" stroke="#000000" stroke-miterlimit="10" pointer-events="all" style="fill: light-dark(rgb(0, 0, 0), rgb(255, 255, 255)); stroke: light-dark(rgb(0, 0, 0), rgb(255, 255, 255));"/></g><g style=""><g><foreignObject style="overflow: visible; text-align: left;" pointer-events="none" x="-9700" y="-9905" width="20000" height="20000"><div xmlns="http://www.w3.org/1999/xhtml" style="display: flex; align-items: unsafe center; justify-content: unsafe center; width: 1px; height: 1px; padding-top: 10000px; margin-left: 10000px;"><div style="box-sizing: border-box; font-size: 0; text-align: center; color: #000000; background-color: #ffffff; "><div style="display: inline-block; font-size: 11px; font-family: Helvetica; color: light-dark(#000000, #ffffff); line-height: 1.2; pointer-events: all; background-color: light-dark(#ffffff, var(--ge-dark-color, #121212)); white-space: nowrap; ">失去对齐：OnViewLost，HoldTimer 归零</div></div></div></foreignObject></g></g><g style="visibility: visible;"><rect x="60" y="220" width="790" height="34" fill="none" stroke="white" pointer-events="stroke" visibility="hidden" stroke-width="19" vector-effect="non-scaling-stroke"/><rect x="60" y="220" width="790" height="34" fill="none" stroke="none" pointer-events="all"/></g><g style=""><g><foreignObject style="overflow: visible; text-align: left;" pointer-events="none" x="-9938" y="-9773" width="20786" height="20030"><div xmlns="http://www.w3.org/1999/xhtml" style="display: flex; align-items: unsafe flex-start; justify-content: unsafe flex-start; width: 1px; height: 1px; padding-top: 10000px; margin-left: 10000px;"><div style="box-sizing: border-box; font-size: 0; text-align: left; color: #555555; "><div style="display: inline-block; font-size: 11px; font-family: Helvetica; color: light-dark(#555555, #a4a4a4); line-height: 1.2; pointer-events: all; white-space: nowrap; ">每个检测周期（0.1 秒）执行一次 CheckPuzzle：先算 bAlignedNow，再据此选择分支；已解出后清除定时器，检测停止</div></div></div></foreignObject></g></g></g><g/><g/></g></svg>
<figcaption>图 5-2 判定状态机：对齐边沿、保持计时与完成</figcaption>
</figure>

### 5.9 小结与调参含义

检测系统的整体形态是：**一个 10 Hz 的采样器 + 一组空间判据 + 一个保持计时器**。空间判据由四层构成，每层排除一类错误姿势——方向判据排除“横向偏离”；距离判据排除“沿射线前后偏离”造成的视差错位；视线判据排除“位置正确但没看图案”（低头、转头）；通过率判据吸收个别碎片的噪声。四层之上，保持计时器排除“一晃而过”。任何一层被调松，都会重新引入它原本负责排除的那类姿势。

<p class="caption">表 5-5 检测参数、语义与调整后果</p>

| 参数 | 默认值 | 约束 | 语义 | 放宽的后果 | 收紧的后果 |
| --- | --- | --- | --- | --- | --- |
| `DotProductThreshold` | 0.996 | 0.9 ~ 1.0 | 位置方向容差（cos θ） | 站位偏移也通过，判定变钝 | 难以站准，可能出现“站对了却不触发” |
| `DistanceTolerance` | 50 | ≥ 0 | 距离容差（世界单位） | 沿射线前后移动也通过，视差错位被容忍 | 需要距离也精确，前后误差立刻失配 |
| `ViewAngleThreshold` | 0.996 | 0.9 ~ 1.0 | 视线方向容差 | 放低头进入判定，破坏“必须看图案”的约束 | 正常注视也可能不达标（碎片有大小，视线未必精确瞄准中心） |
| `RequiredPassRate` | 0.8 | 0 ~ 1 | 需要通过的碎片比例 | 允许更多碎片失配；N 小时语义会突变 | 接近“全部通过”，对摆放误差敏感 |
| `HoldDuration` | 1.5 | ≥ 0 | 需要持续对齐的秒数 | 更易解出，可能被路过触发 | 需要长时间保持，操作负担上升 |
| `DetectionInterval` | 0.1 | ≥ 0.05 | 检测周期 | 响应更快、进度更细，但检测开销上升 | 响应变迟钝，保持时间的量化粒度变粗 |

**关于“站位要求太严格”的机制解释。** 这类现象最常见的成因并不是阈值太紧，而是标定原点的高度与角色实际视高不一致（见 4.2）。此时方向与距离会**同时**产生系统性偏差，表现为水平站位看起来完全正确却无论如何都不通过。若此时去放松 `DotProductThreshold`，等于用一个错误的基准去迁就一个错误的站位：不仅要把阈值放到很松才可能通过，还会让判据在“实际错误的站立位置”上也成立，从而破坏谜题的核心机制。

因此调参的正确顺序是：先看日志中“相机到标定原点的距离”（`Offset`），它应当趋近 0；再看逐碎片的 `Dot` 与 `DistDiff` 中哪一项超标。若 `Offset` 明显偏大，应先修正 `CameraHeightOffset`，而不是动阈值。只有当 `Offset` 已经很小、而 `Dot` 或 `DistDiff` 仍稳定略微超标时，才说明容差本身需要放宽——这时也应逐个参数调整并单独验证，避免多个参数同时改动后无法判断是哪一项生效。

**边界与已知取舍：** 检测基于单个玩家的相机且索引固定为 0；保持时长以检测周期为单位量化，最小分辨率等于 `DetectionInterval`；失配即清零，没有渐进回退；通过率是比例而非加权，所有碎片权重相同；距离容差是绝对量，其相对严格程度随碎片距离变化；解出后检测完全停止，同一 Manager 若要复用必须调用 `ResetPuzzle()`，若要改变基准还需重新 `Calibrate()`。
