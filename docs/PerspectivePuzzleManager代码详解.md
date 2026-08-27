# PerspectivePuzzleManager 代码导读

对应文件：

```text
Source/CPP1/Public/PerspectivePuzzleManager.h
Source/CPP1/Private/PerspectivePuzzleManager.cpp
```

这不是逐行教程，而是阅读和改动这两个文件时需要先知道的结构、数据和边界。

## 文件职责

| 文件 | 内容 |
|---|---|
| `.h` | 反射声明、可调参数、蓝图事件、运行时状态和私有辅助函数 |
| `.cpp` | 生命周期、标定、定时检测、动态材质创建、调试绘制 |

类继承 `AActor`，因此能放入关卡。它没有使用 Tick；检测通过 `FTimerHandle` 每 `DetectionInterval` 秒执行一次。

## 头文件：公开接口

### `FCalibratedMarkPoint`

```cpp
struct FCalibratedMarkPoint
{
    AActor* FragmentActor;
    FVector WorldLocation;
    FVector TargetDirection;
    float TargetDistance;
};
```

一条记录对应一个碎片：标定时的位置、从标定原点指向该位置的单位向量，以及距离。`CheckPuzzle()` 运行时会用同一套计算生成当前值，再与这里保存的值比较。

### 可编辑参数

- `FragmentActors`：场景中的碎片 Actor 列表。
- `CameraHeightOffset`：Manager 在地面时，用这个值构造相机高度的标定原点。
- `GlowParameterName`：动态材质中被写入进度的标量参数名。
- `DotProductThreshold` / `DistanceTolerance`：位置判定容差。
- `ViewAngleThreshold`：相机前向与图案中心目标方向的夹角容差。
- `RequiredPassRate`：通过碎片比例。
- `HoldDuration`：连续对齐时间。
- `DetectionInterval`：定时器周期。

`EditAnywhere` 让变量显示在 Details 面板；`BlueprintReadOnly` 的状态值可被蓝图读取，但不应由蓝图改写。

### 蓝图边界

```cpp
OnPuzzleSolved()
OnViewAligned()
OnViewLost()
OnProgressUpdated(float Progress)
```

这些是 `BlueprintImplementableEvent`。C++ 决定触发时机，蓝图决定触发后做什么。关卡机关、音效和 UI 不应写死在 Manager 中。

### 私有状态

- `CalibratedData`：标定结果。
- `CalibratedOrigin`：Manager 位置加相机高度偏移。
- `CalibratedViewTarget`：全部碎片的几何中心，用于视线检测。
- `HoldTimer` / `bWasAligned`：连续对齐和状态边沿检测。
- `FragmentMaterials`：运行时创建的动态材质实例。
- `DetectionTimerHandle`：用于启动/停止检测定时器。

`CachedPC` 当前未使用，是遗留字段；若不计划缓存控制器，可以删除。

## 生命周期

### 构造函数

```cpp
PrimaryActorTick.bCanEverTick = false;
RootComponent = CreateDefaultSubobject<UArrowComponent>(TEXT("Root"));
```

ArrowComponent 只是编辑器里的可视化根组件。Tick 被关闭，因为检测走定时器。

### `BeginPlay()`

```cpp
Calibrate();
CacheFragmentMaterials();
ResetPuzzle();
DrawDebugCalibration(100000.0f);
```

顺序不能随意换：先得到标定数据，再创建动态材质，最后开始定时检测。最后一行是调试用途；发布前通常应删除，或改成可开关的调试选项。

### `ResetPuzzle()`

重置状态并重新设置循环定时器：

```cpp
SetTimer(DetectionTimerHandle, this,
    &APerspectivePuzzleManager::CheckPuzzle,
    DetectionInterval, true);
```

如果有重置机制，调用该函数会重新允许解谜。

## 标定：`Calibrate()`

```cpp
CalibratedOrigin = GetActorLocation() + FVector(0, 0, CameraHeightOffset);
```

Manager 常放在地面，判定却应以相机高度为准，所以先构造 `CalibratedOrigin`。

对每个碎片：

```cpp
Dir = FragmentLocation - CalibratedOrigin;
TargetDistance = Dir.Size();
TargetDirection = Dir.GetSafeNormal();
```

随后累加碎片位置并求平均，得到 `CalibratedViewTarget`。这里的中心只是视线目标，并不参与碎片位置检测。

## 检测：`CheckPuzzle()`

顺序如下：

1. 取得 `CamLoc`、`CamRot` 和 `CamForward`。
2. 计算视线是否朝向图案中心。
3. 逐碎片比较当前方向/距离和标定方向/距离。
4. 用通过率和视线结果得出 `bAlignedNow`。
5. 累积/清除进度，并触发蓝图事件。
6. 将进度写入动态材质。

### 位置检测

```cpp
ToFragment = Point.WorldLocation - CamLoc;
CurrentDist = ToFragment.Size();
CurrentDir = ToFragment.GetSafeNormal();

Dot = DotProduct(CurrentDir, Point.TargetDirection);
DistDiff = Abs(CurrentDist - Point.TargetDistance);
```

`CurrentDir` 和 `TargetDirection` 都是“观察点到同一碎片”的方向。点积接近 1，表示当前相机位置与标定点相对这个碎片的方位接近；距离差限制前后偏移。两者一起使用才可区分观察位置。

### 视线检测

```cpp
ViewTargetDir = Normalize(CalibratedViewTarget - CalibratedOrigin);
ViewDot = DotProduct(CamForward, ViewTargetDir);
```

这里的 `CamForward` 来自相机旋转，和位置检测不同。它负责排除“站对位置但没有看图案”的情况。目标是碎片几何中心，不是某一个碎片。

### 进度和事件

`bWasAligned` 用来检测状态边沿：刚进入对齐调用 `OnViewAligned`，刚离开调用 `OnViewLost`。在对齐状态内，`HoldTimer` 累积，`SolveProgress` 被限制在 0 到 1。达到 `HoldDuration` 后调用 `OnPuzzleSolved` 并清除定时器。

## 动态材质

`CacheFragmentMaterials()` 优先寻找 `UDecalComponent`，其次处理 `UStaticMeshComponent`。

Decal 的路径是：

```cpp
GetDecalMaterial()
→ UMaterialInstanceDynamic::Create()
→ SetDecalMaterial()
```

静态网格体可以直接用 `CreateAndSetMaterialInstanceDynamic(0)`。

检测期间：

```cpp
DynMat->SetScalarParameterValue(GlowParameterName, GlowValue);
```

材质中必须存在同名 Scalar Parameter。该参数应影响 EmissiveColor，而不是直接放大 BaseColor。

## 调试

- `DrawDebugCalibration()`：青色球为标定原点，橙色球为碎片位置，黄色线为标定连线。
- `CheckPuzzle()`：输出相机位置、方向点积、距离差和通过率；同时画红色当前视线与绿色目标视线。

调试完成后，建议降低 `UE_LOG` 频率或用开关包起来，避免持续刷日志。

## UE 5.8 兼容备注

- `PerspectivePuzzleManager.generated.h` 必须是头文件最后一个 include。
- 本项目源文件以 UTF-8 with BOM 保存。曾出现过双 BOM 导致 UHT 解析异常。
- 前向声明类型放进 `TArray<TObjectPtr<T>>` 曾触发模板静态断言；当前使用 `TArray<UMaterialInstanceDynamic*>`。
- 当前 UE 版本中，`UDecalComponent::CreateDynamicMaterialInstance(0)` 不适合直接使用，使用 `GetDecalMaterial + Create + SetDecalMaterial`。
- Live Coding 开启时，命令行构建可能被拒绝。
