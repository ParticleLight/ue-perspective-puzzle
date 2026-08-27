# PerspectivePuzzleManager 代码详解
## —— 头文件（.h）与源文件（.cpp）逐段教学解析

> 面向 UE 小白。把 `PerspectivePuzzleManager.h` 和 `PerspectivePuzzleManager.cpp` 从头到尾、逐段讲透：
> 每一行在干嘛、为什么这么写、有哪些 UE 专属的 C++ 语法。
> 建议对着代码文件一起看。行号以当前文件为准。

---

## 目录

1. [阅读前须知](#1-阅读前须知)
2. [总览：.h 和 .cpp 是怎么配合的](#2-总览h-和-cpp-是怎么配合的)
3. [头文件逐段解析](#3-头文件逐段解析)
4. [源文件逐段解析](#4-源文件逐段解析)
5. [数据流全景：一次完整的检测过程](#5-数据流全景一次完整的检测过程)
6. [常见疑惑点问答](#6-常见疑惑点问答)

---

## 1. 阅读前须知

**两个文件在哪**
```
F:\ue5_project\CPP1\Source\CPP1\Public\PerspectivePuzzleManager.h      ← 头文件（声明）
F:\ue5_project\CPP1\Source\CPP1\Private\PerspectivePuzzleManager.cpp   ← 源文件（实现）
```

**C++ 的"声明与实现分离"规矩**（贯穿全文的核心）
- **头文件 .h**：只"宣布"有哪些变量、哪些函数（不写函数内部代码）。
- **源文件 .cpp**：把头文件里宣布的函数"真正实现"（写内部代码）。
- 好处：别的文件想用这个类，`#include` 头文件就知道"有什么"，不用看实现。

**怎么编译**
UE 的 C++ 不是双击就能跑的：
1. **UHT**（Unreal Header Tool）扫描头文件里的 `UCLASS / UPROPERTY / UFUNCTION`，生成 `PerspectivePuzzleManager.generated.h`。
2. **UBT + 编译器** 把 .cpp 编译成 DLL，引擎加载。
所以改了头文件后，第一步要保证 UHT 重新跑（有时要清 `Intermediate/.../Inc/CPP1`）。

---

## 2. 总览：.h 和 .cpp 是怎么配合的

```
┌─ 头文件 .h（宣布）─────────────────────────────┐
│  • 结构体 FCalibratedMarkPoint                  │
│  • 类 APerspectivePuzzleManager                │
│    – 一堆 UPROPERTY 变量（细节面板能调的参数）    │
│    – 一堆 UFUNCTION 函数（声明，没实现）          │
└────────────────────────────────────────────────┘
                       │   #include
                       ▼
┌─ 源文件 .cpp（实现）────────────────────────────┐
│  APerspectivePuzzleManager::构造函数()          │
│  APerspectivePuzzleManager::Calibrate() 等      │
│  ← 每个函数用"类名::函数名"来实现头文件里的声明    │
└────────────────────────────────────────────────┘
```

**记住这个格式**：`.cpp` 里每个函数都写成
```cpp
返回类型 APerspectivePuzzleManager::函数名(参数)
```
`类名::` 表示"这是属于这个类的函数"。漏掉 `类名::` 就成普通函数了，编译不过。

---

## 3. 头文件逐段解析

### 3.1 顶部：头文件保护与 include

```cpp
// Fill out your copyright notice in the Description page of Project Settings.
// （这行是模板自带注释，提示你把版权信息填到 Project Settings，不影响功能）

#pragma once
```
- `#pragma once`：**头文件保护**。防止同一个头文件被 `#include` 两次导致重复定义错误。就是告诉编译器"这个文件每份只处理一次"。

```cpp
#include "CoreMinimal.h"
```
- UE 的"最小核心库"头文件。里面塞满了最常用的东西：`FVector`、`TArray`、`FString`、`FMath`……几乎所有 UE 代码都要先 include 它。

```cpp
#include "GameFramework/Actor.h"
```
- 我们要让 `APerspectivePuzzleManager` **继承** `AActor`（场景里的物体），必须知道 `AActor` 长什么样，所以包含它。

```cpp
#include "PerspectivePuzzleManager.generated.h"
```
- **UHT 生成的头文件**。包含反射（UCLASS/UPROPERTY）相关的宏定义和辅助代码。规则：**必须放在所有 include 的最后一行**，否则报错。

```cpp
class UMaterialInstanceDynamic;
```
- **前向声明（Forward Declaration）**：只告诉编译器"有一个类叫 `UMaterialInstanceDynamic`"，不告诉它内部细节。
- **为什么用**：后面的成员 `TArray<UMaterialInstanceDynamic*>` 只是用**指针**，指针大小固定，不需要知道类细节。前向声明比 `#include` 快（减少编译依赖）。真正的细节在 .cpp 里 include。

### 3.2 结构体 FCalibratedMarkPoint

```cpp
USTRUCT(BlueprintType)              // 让结构体也能被蓝图表单/节点使用
struct FCalibratedMarkPoint         // 一个"碎片"需要记住的所有信息，打包成一个结构体
{
    GENERATED_BODY()                // 和 UCLASS 的 GENERATED_BODY() 同款，UHT 生成辅助代码
    ...
};
```

**为什么用结构体**：我们有"很多个碎片"，每个碎片都要记"哪个 Actor、在哪、方向、距离"。如果不用结构体，就要 4 个数组平行放着（`FragmentActor` 数组、`WorldLocation` 数组……），又乱又容易对错位。结构体把它们**绑成一条记录**，一个数组 `TArray<FCalibratedMarkPoint>` 就装下所有碎片。

字段解析：

```cpp
UPROPERTY(EditAnywhere, BlueprintReadWrite)
AActor* FragmentActor = nullptr;    // 场景中的碎片 Actor（Decal / 任意 Actor）
```
- `AActor*`：指向场景里某个 Actor 的**指针**。
- `= nullptr`：默认空指针。`nullptr` 表示"没指向任何东西"。
- 为什么用 `AActor*`（裸指针）而不是 `TObjectPtr`：本项目踩过坑——`TArray<TObjectPtr<T>>` 配**前向声明的类型**会触发模板编译错误（StaticAssert）。裸指针简单可靠。

```cpp
FVector WorldLocation;              // 标定时记录的碎片世界坐标
```
- `FVector` = 一个三维向量 `(X, Y, Z)`。这里存碎片在**世界坐标**里的位置。

```cpp
FVector TargetDirection;            // 从标定位置指向碎片的单位方向向量
float TargetDistance;               // 从标定位置到碎片的直线距离
```
- 一对"方向 + 距离" = 用**极坐标**描述"碎片相对标定点在哪"。比存相对坐标更稳：检测时直接拿方向和距离去比对。

### 3.3 类声明骨架

```cpp
UCLASS()
class CPP1_API APerspectivePuzzleManager : public AActor
{
    GENERATED_BODY()
    ...
};
```
- `UCLASS()`：告诉引擎"这是个 UE 类"，可以放进场景、被实例化。
- `class CPP1_API ...`：`CPP1_API` 是导出宏，让这个类能从模块（DLL）导出给别人用。每个项目的模块名不一样，这里是 CPP1。
- `: public AActor`：**继承**。`APerspectivePuzzleManager` 是 `AActor` 的一种，拥有 Actor 的一切能力。
- **命名约定**：Actor 类前缀 `A`（如 `APerspectivePuzzleManager`），结构体前缀 `F`（如 `FCalibratedMarkPoint`），接口前缀 `I`，普通 UObject 前缀 `U`。看到前缀就知道是什么。
- `GENERATED_BODY()`：每个 UCLASS/USTRUCT 必须有，UHT 靠它插代码。

### 3.4 public 区：可以在细节面板调的"拼图"参数

```cpp
public:
    APerspectivePuzzleManager();    // 构造函数：对象创建时自动调用一次
```

```cpp
UPROPERTY(EditAnywhere, Category = "Puzzle")
TArray<AActor*> FragmentActors;     // 碎片列表
```
- `UPROPERTY(EditAnywhere)`：**细节面板里能编辑**。数组在面板里显示成列表，你把场景里的碎片 Actor 一个个拖进去。
- `TArray<AActor*>`：UE 版的"动态数组"，能装任意数量个 `AActor*`。
- `Category = "Puzzle"`：在细节面板里归到 "Puzzle" 分类下，方便找。

```cpp
UPROPERTY(EditAnywhere, Category = "Puzzle", meta = (ClampMin = 0.0f))
float CameraHeightOffset = 160.0f;  // 相机高度偏移
```
- `meta = (ClampMin = 0.0f)`：面板里的滑块/输入框**最小只能填 0**，防止填负数。
- 默认 `= 160.0f`：值默认 160（玩家眼睛大概这个高度）。`f` 后缀表示 float 类型字面量。

```cpp
UPROPERTY(EditAnywhere, Category = "Puzzle")
FName GlowParameterName = TEXT("GlowIntensity");  // 发光材质参数名
```
- `FName`：引擎的"名字"类型，比 string 轻量、适合做参数名/标签。
- `TEXT("...")`：UE 里字符串字面量的标准写法（跨平台字符）。不加 TEXT 在某些平台会出问题。

### 3.5 检测参数（全是"判定严不严"的旋钮）

```cpp
UPROPERTY(EditAnywhere, Category = "Detection", meta = (ClampMin = 0.9, ClampMax = 1.0))
float DotProductThreshold = 0.996f;   // 方向容差
```
- `ClampMin = 0.9, ClampMax = 1.0`：面板里**只能填 0.9~1.0**。点积范围本来就该在 [-1,1]，但这里只要接近 1 才合理，所以钳制。
- `0.996` ≈ `cos(5°)`，意思是"方向偏差超过 5° 就判不通过"。

```cpp
UPROPERTY(EditAnywhere, Category = "Detection", meta = (ClampMin = 0.9, ClampMax = 1.0))
float ViewAngleThreshold = 0.996f;    // 视线容差（防低头）
```
- 和上面同款，但管的是**视线方向**。单独一个参数，方便只调视线、不动位置。

```cpp
UPROPERTY(EditAnywhere, Category = "Detection", meta = (ClampMin = 0.0f))
float DistanceTolerance = 50.0f;      // 距离容差（世界单位）
...
float RequiredPassRate = 0.8f;        // 通过比例
float HoldDuration = 1.5f;            // 持续对齐时间（秒）
float DetectionInterval = 0.1f;       // 检测间隔（秒）
```

这些参数的**作用**在《透视拼接谜题技术文档》第 9 节有调优表，这里不重复。

### 3.6 protected / public 混合区：生命周期与状态

```cpp
protected:
    virtual void BeginPlay() override;   // 游戏开始时调用一次
public:
    virtual void Tick(float DeltaTime) override;  // 每帧调用（但本项目关掉了，见 cpp）
```
- `BeginPlay` / `Tick` 是 Actor 的"生命周期函数"。
- `virtual ... override`：**虚函数覆盖**。父类 Actor 定义了这些函数，我们重写它们，加上 `override` 让编译器检查"父类确实有这函数"。
- `Tick` 为什么放着不实现：本来我们不用每帧检测（用定时器），但声明保留，将来想用随时实现。

```cpp
UPROPERTY(BlueprintReadOnly, Category = "State")
bool bIsSolved = false;      // 是否已解密
UPROPERTY(BlueprintReadOnly, Category = "State")
float SolveProgress = 0.0f;  // 对齐进度 0~1
```
- `BlueprintReadOnly`：**蓝图里能读，不能写**（只有 C++ 能改）。防止蓝图乱改状态破坏逻辑。
- `bool bIsSolved`：UE 布尔变量习惯加 `b` 前缀。

### 3.7 可调用的函数（BlueprintCallable）

```cpp
UFUNCTION(BlueprintCallable, Category = "Puzzle", meta = (CallInEditor = "true"))
void Calibrate();                    // 标定
```
- `BlueprintCallable`：蓝图能调用这个函数。
- `meta = (CallInEditor = "true")`：**细节面板里显示成按钮**，在编辑器里直接点按钮执行（不用进游戏）。我们标定就靠点这个按钮。

```cpp
UFUNCTION(BlueprintCallable, Category = "Puzzle")
void ResetPuzzle();                  // 重置
...
UFUNCTION(BlueprintCallable, Category = "Debug", meta = (CallInEditor = "true"))
void DrawDebugCalibration(float Duration = 5.0f) const;  // 调试绘制
```
- `float Duration = 5.0f`：参数有默认值，调用时可省略。
- `const`：这个函数**不修改对象内部状态**（只读），编译器保证。

### 3.8 蓝图事件（BlueprintImplementableEvent）

```cpp
UFUNCTION(BlueprintImplementableEvent, Category = "Events")
void OnPuzzleSolved();               // 解密成功
UFUNCTION(BlueprintImplementableEvent, Category = "Events")
void OnViewAligned();                // 开始对齐
UFUNCTION(BlueprintImplementableEvent, Category = "Events")
void OnViewLost();                   // 失去对齐
UFUNCTION(BlueprintImplementableEvent, Category = "Events")
void OnProgressUpdated(float Progress);  // 进度更新
```

**这是本项目"C++ 与蓝图协作"的核心机制**：
- `BlueprintImplementableEvent`：C++ **只声明、不实现**，实现在蓝图里（Blueprint 的 Event 节点）。
- C++ 负责"什么时候调用"（比如解密成功时 `OnPuzzleSolved()`），蓝图负责"调用后干什么"（打印文字、开门……）。
- 好处：**逻辑留在 C++，表现留在蓝图**。想加音效、动画，纯在蓝图改，不用重编译 C++。

### 3.9 内部成员（protected 区）

```cpp
protected:
    TArray<FCalibratedMarkPoint> CalibratedData;  // 标定结果：每个碎片一条记录
    float HoldTimer = 0.0f;            // 已连续对齐的时间累积
    bool bWasAligned = false;          // 上一次检测是否对齐（用于触发 OnViewAligned/Lost 只触发一次）
    mutable TObjectPtr<class APlayerController> CachedPC;  // 缓存玩家控制器
    FVector CalibratedOrigin;          // 标定原点（相机高度）
    FVector CalibratedViewTarget;      // 图案中心（视线检测参考点）
    FTimerHandle DetectionTimerHandle; // 定时器句柄（用来停掉定时器）
    void CheckPuzzle();                // 核心检测函数（内部用，不对外）

    UPROPERTY(Transient)
    TArray<UMaterialInstanceDynamic*> FragmentMaterials;  // 缓存每个碎片的动态材质

    void CacheFragmentMaterials();     // 建动态材质
```

- `protected`：这些只有类自己（和子类）能访问，外面摸不到。
- `mutable TObjectPtr<class APlayerController> CachedPC`：
  - `TObjectPtr`：引擎的智能指针，自动管 GC（垃圾回收）。
  - `class APlayerController` 内联前向声明。
  - `mutable`：允许在 `const` 函数里修改它（其实本项目没用到，是个遗留字段，可删）。
- `UPROPERTY(Transient)`：这个数组**不保存到磁盘**（运行时装一次就行）。动态材质实例是运行时生成的，不需要存档。

---

## 4. 源文件逐段解析

### 4.1 include 区

```cpp
#include "PerspectivePuzzleManager.h"     // 自己的头文件（必须第一个）
#include "Engine/World.h"                 // GetWorld() 相关
#include "GameFramework/PlayerController.h" // 拿玩家控制器
#include "Kismet/GameplayStatics.h"       // UGameplayStatics::GetPlayerController 等静态工具
#include "Components/ArrowComponent.h"     // 根组件箭头
#include "Components/DecalComponent.h"     // 处理 Decal（贴画）
#include "Components/StaticMeshComponent.h" // 处理静态网格体
#include "Materials/MaterialInstanceDynamic.h" // 动态材质实例
#include "Materials/MaterialInterface.h"   // 材质基类
#include "DrawDebugHelpers.h"              // 画调试球/线
```
- 第一个 include **必须是自己类的头文件**：编译器先知道类的声明，才能实现。
- 其余是"用到了哪些类型/API 就 include 哪个"。头文件里用前向声明，就是希望把大头的 include 留在这里（.cpp 只编译一次，影响小）。

### 4.2 构造函数

```cpp
APerspectivePuzzleManager::APerspectivePuzzleManager()
{
    PrimaryActorTick.bCanEverTick = false;                     // 关掉每帧 Tick
    RootComponent = CreateDefaultSubobject<UArrowComponent>(TEXT("Root")); // 建根组件
}
```
- 构造函数在**对象创建时**自动执行一次，用来搭初始结构。
- `PrimaryActorTick.bCanEverTick = false`：**告诉引擎这个 Actor 不用每帧 Tick**，省性能。我们靠定时器检测，不需要 Tick。（所以 `Tick` 函数空着。）
- `CreateDefaultSubobject<UArrowComponent>(TEXT("Root"))`：创建**根组件**并指定类型。
  - 为什么用 `UArrowComponent`：它带一个箭头可视化，编辑器里能看到"这个 Manager 在哪、朝哪"，方便摆放。
  - `RootComponent = ...`：让这个组件成为根。所有组件都要有根。
  - 创建在构造函数里 = 这个组件**属于蓝图模板**，每个实例都有。

### 4.3 BeginPlay（游戏开始）

```cpp
void APerspectivePuzzleManager::BeginPlay()
{
    Super::BeginPlay();            // 先调父类版本的 BeginPlay（必须）
    Calibrate();                   // 1. 标定：记住所有碎片位置
    CacheFragmentMaterials();      // 2. 缓存发光材质
    ResetPuzzle();                 // 3. 重置状态 + 开检测定时器
    DrawDebugCalibration(100000.0f); // 4. 调试：一直画标定位置（10 万秒≈永远）
}
```
- `Super::BeginPlay()`：**调用父类（AActor）的 BeginPlay**。几乎所有覆盖函数第一行都要调 `Super::...`，否则父类的初始化被跳过。
- 顺序有讲究：先标定（有数据了）→ 再缓存材质（遍历碎片）→ 再开定时器（定时器第一声检测时数据已就绪）。

### 4.4 Tick

```cpp
void APerspectivePuzzleManager::Tick(float DeltaTime)
{
    Super::Tick(DeltaTime);
}
```
- 空实现。因为构造函数关了 Tick，这个函数永远不会被调用，留着是为了"万一以后要开"。

### 4.5 标定 Calibrate()

```cpp
void APerspectivePuzzleManager::Calibrate()
{
    CalibratedData.Empty();          // 清空旧标定数据（重标定用）
    CalibratedOrigin = GetActorLocation() + FVector(0, 0, CameraHeightOffset);
```
- `CalibratedData.Empty()`：把数组清空，避免重复标定累积。
- `GetActorLocation()`：Manager 在世界里的位置。
- `+ FVector(0, 0, CameraHeightOffset)`：**抬升 Z 轴**到玩家眼睛高度。
  - 思路：Manager 放地上（方便摆放），但玩家眼睛在高处，所以标定原点 = Manager 位置 + 身高偏移。

```cpp
    FVector CenterAccum = FVector::ZeroVector;   // 累加器（存所有碎片位置之和）
    int32 Count = 0;                              // 碎片计数

    for (AActor* Actor : FragmentActors)          // 遍历每个碎片
    {
        if (!Actor) continue;                     // 空指针就跳过

        FCalibratedMarkPoint Point;
        Point.FragmentActor = Actor;
        Point.WorldLocation = Actor->GetActorLocation();  // 碎片的世界坐标

        FVector Dir = Point.WorldLocation - CalibratedOrigin; // 从原点到碎片
        Point.TargetDistance = Dir.Size();        // 距离 = 向量的长度
        Point.TargetDirection = Dir.GetSafeNormal();  // 方向 = 归一化成单位向量

        CalibratedData.Add(Point);                // 塞进数组
        CenterAccum += Point.WorldLocation;       // 累加位置（求中心用）
        Count++;
    }
```
- `for (AActor* Actor : FragmentActors)`：**范围 for 循环**，逐个取出数组里的 Actor。
- `if (!Actor) continue;`：如果拖进来的槽位是空的（nullptr），跳过，防崩溃。
- `Dir.Size()`：向量长度 = 两点距离（勾股定理三维版）。
- `Dir.GetSafeNormal()`：**归一化**成单位向量（长度 1）。如果 Dir 是零向量（碎片正好在原点），GetSafeNormal 返回安全默认值，不会除零崩溃。
- `CenterAccum += ...` / `Count++`：累加求**几何中心**。

```cpp
    CalibratedViewTarget = (Count > 0) ? CenterAccum / Count : CalibratedOrigin;
```
- 三元运算符 `条件 ? 结果A : 结果B`：有碎片就取平均位置，没有就退回原点。
- **图案中心**是视线检测的参考点（防低头用）。

```cpp
    UE_LOG(LogTemp, Log, TEXT("Calibrate: %d points recorded, view target %s"), CalibratedData.Num(), *CalibratedViewTarget.ToString());
}
```
- `UE_LOG`：输出到输出日志。`%d` 是整数占位符，`%s` 是字符串占位符。
- `*CalibratedViewTarget.ToString()`：`ToString()` 把向量转成字符串，`*` 取字符串的字符指针（`%s` 需要的格式）。
- 调试好帮手：标定后看日志确认数据对不对。

### 4.6 缓存材质 CacheFragmentMaterials()

```cpp
void APerspectivePuzzleManager::CacheFragmentMaterials()
{
    FragmentMaterials.Empty();

    for (AActor* Actor : FragmentActors)
    {
        UMaterialInstanceDynamic* DynMat = nullptr;  // 默认空

        if (UDecalComponent* Decal = Actor->FindComponentByClass<UDecalComponent>())
        {
            if (UMaterialInterface* DecalMat = Decal->GetDecalMaterial())
            {
                DynMat = UMaterialInstanceDynamic::Create(DecalMat, Decal);
                Decal->SetDecalMaterial(DynMat);
            }
        }
        else if (UStaticMeshComponent* SM = Actor->FindComponentByClass<UStaticMeshComponent>())
        {
            DynMat = SM->CreateAndSetMaterialInstanceDynamic(0);
        }

        FragmentMaterials.Add(DynMat);
    }
}
```
- `Actor->FindComponentByClass<UDecalComponent>()`：在这个 Actor 身上**找一个指定类型的组件**。返回 nullptr 表示没有。
  - 语法小技巧：`if (UDecalComponent* Decal = ...)` 在 if 里声明变量，同时判断"不是空指针"。非空才进 if。
- Decal 分支：
  - `GetDecalMaterial()`：拿到 Decal 当前的材质。
  - `UMaterialInstanceDynamic::Create(...)`：**创建一个动态材质实例**（运行时能改参数的材质）。
  - `SetDecalMaterial(DynMat)`：把动态实例装回 Decal，让 Decal 实际用它显示。
- 网格体分支：`CreateAndSetMaterialInstanceDynamic(0)`：给静态网格体**元素 0** 建动态材质并设置。一次搞定。
- **为什么 Decal 要两步、网格体一步**：API 不同，Decal 没有"创建并设置"的合并接口，5.8 里 `CreateDynamicMaterialInstance(0)` 签名还变了，所以用 `Get + Create + Set` 组合最稳。

### 4.7 重置 ResetPuzzle()

```cpp
void APerspectivePuzzleManager::ResetPuzzle()
{
    bIsSolved = false;
    bWasAligned = false;
    HoldTimer = 0.0f;
    SolveProgress = 0.0f;

    GetWorldTimerManager().ClearTimer(DetectionTimerHandle);     // 先清掉旧定时器
    GetWorldTimerManager().SetTimer(
        DetectionTimerHandle, this, &APerspectivePuzzleManager::CheckPuzzle,
        DetectionInterval, true);   // 每 DetectionInterval 秒循环调用 CheckPuzzle
}
```
- `ClearTimer` + `SetTimer`：先清再开，保证不重复开。
- `SetTimer(句柄, 对象, 函数指针, 间隔, 是否循环)`：
  - `this`：谁执行（本类）。
  - `&APerspectivePuzzleManager::CheckPuzzle`：**成员函数指针**，表示"到时间调用 CheckPuzzle"。
  - `DetectionInterval`：0.1 秒一次。
  - `true`：循环执行（false 就只执行一次）。
- **为什么用定时器而不是 Tick**：Tick 每帧（~16ms）跑太浪费，0.1 秒一次足够且省性能。

### 4.8 调试绘制 DrawDebugCalibration()

```cpp
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
- 在编辑器/游戏里画**调试几何体**，肉眼看到标定位置（青色球=标定原点，橙色球=碎片位置，黄色线=连接线）。
- `DrawDebugSphere(世界, 圆心, 半径, 段数, 颜色, 是否持久, 持续时间)`。
- `const auto& Point`：`const` 只读，`auto` 自动推断类型，`&` 引用（不复制，省内存）。

### 4.9 核心：CheckPuzzle()（重点中的重点）

**① 入口保护与取相机**
```cpp
void APerspectivePuzzleManager::CheckPuzzle()
{
    if (bIsSolved || CalibratedData.Num() == 0) return;   // 已解密或没标定，直接走人

    APlayerController* PC = UGameplayStatics::GetPlayerController(GetWorld(), 0);
    if (!PC || !PC->PlayerCameraManager) return;          // 拿不到玩家控制器/相机就跳过

    FVector CamLoc;
    FRotator CamRot;
    PC->GetPlayerViewPoint(CamLoc, CamRot);   // 玩家眼睛位置 CamLoc + 朝向 CamRot
    FVector CamForward = CamRot.Vector();     // 朝向转成单位方向向量
```
- `UGameplayStatics::GetPlayerController(GetWorld(), 0)`：拿 0 号玩家的控制器。
- `GetPlayerViewPoint`：一次拿到相机**位置和旋转**（输出参数用引用传递）。
- `FRotator.Vector()`：把旋转（Pitch/Yaw/Roll 角度）转成**前进方向的单位向量**，后面算点积用。

**② 视线检测（防低头）**
```cpp
    FVector ViewTargetDir = (CalibratedViewTarget - CalibratedOrigin).GetSafeNormal();
    float ViewDot = FVector::DotProduct(CamForward, ViewTargetDir);
    bool bViewMatch = (ViewDot >= ViewAngleThreshold);
```
- `ViewTargetDir`：从标定原点指向**图案中心**的方向。
- `DotProduct(CamForward, ViewTargetDir)`：相机朝向和"应看方向"的点积。
- 点积接近 1 = 视线正好对准图案中心。低于阈值 = 没看向图案 → 不算对齐。

**③ 逐个碎片位置检测**
```cpp
    int32 PassCount = 0;
    for (const auto& Point : CalibratedData)
    {
        FVector ToFragment = Point.WorldLocation - CamLoc;   // 相机→碎片
        float CurrentDist = ToFragment.Size();               // 当前距离
        FVector CurrentDir = ToFragment.GetSafeNormal();     // 当前方向

        float Dot = FVector::DotProduct(CurrentDir, Point.TargetDirection);  // 方向比
        float DistDiff = FMath::Abs(CurrentDist - Point.TargetDistance);     // 距离差

        if (Dot >= DotProductThreshold && DistDiff <= DistanceTolerance)
            PassCount++;
    }
```
- 对每个碎片：算"相机现在看它的方向/距离"和"标定时的方向/距离"的差异。
- `FMath::Abs`：绝对值（距离差取正）。
- 方向点积 ≥ 阈值 **且** 距离差 ≤ 容差 → 这个碎片通过。

**④ 汇总判定**
```cpp
    float Rate = (float)PassCount / (float)CalibratedData.Num();  // 通过率
    bool bAlignedNow = (Rate >= RequiredPassRate) && bViewMatch;  // 位置+视线都过
```
- `(float)` 强转：两个 int 相除会得整数（整除），强转成 float 才能得小数（0.8 这种）。
- 位置通过率达标 **并且** 视线通过 → 才算"对齐"。

**⑤ 对齐分支：计时、进度、触发**
```cpp
    if (bAlignedNow)
    {
        if (!bWasAligned) OnViewAligned();          // 从"没对齐"变"对齐"时触发一次

        HoldTimer += DetectionInterval;             // 累积已对齐的时间
        SolveProgress = FMath::Clamp(HoldTimer / HoldDuration, 0.0f, 1.0f);
        OnProgressUpdated(SolveProgress);           // 进度告诉蓝图

        if (HoldTimer >= HoldDuration)              // 连续够了
        {
            bIsSolved = true;
            SolveProgress = 1.0f;
            OnProgressUpdated(1.0f);
            OnPuzzleSolved();                        // ★ 成功！
            GetWorldTimerManager().ClearTimer(DetectionTimerHandle); // 停止检测
        }
    }
```
- `FMath::Clamp(值, 最小, 最大)`：把值钳制在 0~1（进度不可能超 1）。
- `HoldTimer / HoldDuration`：已对齐时间 / 要求时间 = 进度（0~1）。
- `OnViewAligned / OnProgressUpdated / OnPuzzleSolved` 都是蓝图事件，C++ 只管**在正确的时机调用**。

**⑥ 失焦分支**
```cpp
    else
    {
        if (bWasAligned) OnViewLost();    // 从"对齐"变"没对齐"时触发一次
        HoldTimer = 0.0f;                 // 计时清零（重新来）
        SolveProgress = 0.0f;
    }
```
- 一失去对齐，进度清零——玩家必须**连续**保持 2 秒，中途移开就重来。

**⑦ 发光更新**
```cpp
    if (GlowParameterName != NAME_None)
    {
        float GlowValue = bAlignedNow ? SolveProgress : 0.0f;   // 对齐=进度，失焦=0
        for (UMaterialInstanceDynamic* DynMat : FragmentMaterials)
            if (DynMat) DynMat->SetScalarParameterValue(GlowParameterName, GlowValue);
    }
```
- `NAME_None`：空名字（用户没填 GlowParameterName 就跳过）。
- `SetScalarParameterValue(参数名, 值)`：把动态材质里的标量参数（GlowIntensity）改成 GlowValue。
- 效果：对齐时随进度亮，失焦时熄灭。

**⑧ 收尾**
```cpp
    bWasAligned = bAlignedNow;
}
```
- 记录本次结果，供下次判断"是不是刚转变状态"（只触发一次 OnViewAligned/Lost）。

---

## 5. 数据流全景：一次完整的检测过程

```
玩家站在拼图点附近
        │
        ▼（每 0.1 秒，定时器触发）
CheckPuzzle()
   │ ① 取相机位置/朝向
   ├─ ② 视线检测：看没看图案中心？（点积 vs ViewAngleThreshold）
   ├─ ③ 位置检测：每个碎片的方向/距离 和 标定值比
   ├─ ④ Rate >= RequiredPassRate 且 视线过 → bAlignedNow
   │
   ├─ 对齐 → HoldTimer 累加 → SolveProgress 上涨 → 发光增强
   │        └ 满 HoldDuration → OnPuzzleSolved() → 蓝图开门
   └─ 失焦 → HoldTimer 清零 → SolveProgress=0 → 发光熄灭
```

**三个"怎么选"的关键设计**
1. 用**定时器**不是 Tick → 省性能。
2. 用**蓝图事件**不是 C++ 写死 → 表现层随便改。
3. 用**持续计时**不是一进就算 → 防止一晃而过。

---

## 6. 常见疑惑点问答

**Q1：为什么头文件里 `UMaterialInstanceDynamic` 只前向声明，cpp 里才 include？**
为了**加快编译**。头文件只要知道"这是个类"（因为只用指针），不用知道细节。细节（Create、SetScalarParameterValue）在 .cpp 里才需要，所以 include 放 .cpp。大量 include 会连锁拖慢整个项目的编译。

**Q2：为什么 `FragmentMaterials` 是裸指针数组，别的项目看人用 TObjectPtr？**
本项目实测：`TArray<TObjectPtr<T>>` 当 `T` 是**前向声明类型**时触发引擎模板静态断言编译错误（StaticAssertCompleteType）。裸指针 `TArray<T*>` 无此问题。这里动态材质实例还被 Decal/网格体组件引用着（不会提前被 GC），所以裸指针安全。

**Q3：`BlueprintImplementableEvent` 和普通函数有什么区别？**
普通函数 = C++ 写好实现。`BlueprintImplementableEvent` = C++ 只声明，蓝图里出现一个对应的事件节点，由你在蓝图里连线实现。C++ 在需要时调用它。本项目四个事件都用它，所以加音效/开门都在蓝图做。

**Q4：`CallInEditor` 的 `meta = (CallInEditor = "true")` 是干嘛的？**
让函数在**细节面板**显示成可点击按钮。这样标定（Calibrate）和画调试线（DrawDebugCalibration）不用进游戏，在编辑器里点按钮就执行。

**Q5：`mutable`、`const` 这些平时用得到吗？**
`const` 常用来表示"这个函数不改对象状态"（如 DrawDebugCalibration）。`mutable` 是"在 const 函数里也允许改"的例外标记，本项目里 `CachedPC` 是遗留字段，实际没用到 mutable 的特性，可以删。

**Q6：改了头文件，为什么老报"未找到某函数定义"或"无法打开 generated.h"？**
UHT 没有重新生成辅助文件。头文件改动会触发 UHT，但如果 `Intermediate/Build/Win64/UnrealEditor/Inc/CPP1` 缓存了旧文件，就会卡住。删掉那个文件夹重新编译即可。

**Q7：中文注释为什么有时乱码，还编译报错？**
源文件必须用 **UTF-8 带 BOM**（utf-8-sig）保存。UHT 对编码敏感：无 BOM 会乱码，双 BOM 会直接破坏解析导致报错。用支持 BOM 的编辑器（VS 保存时选"UTF-8 with BOM"）。

**Q8：检测是每 0.1 秒一次，玩家移动很快会不会漏掉？**
会，但没关系。拼图需要玩家**停留 2 秒**，0.1 秒采样足够捕捉"人站在那"的状态。即使偶发漏一帧，下一次 0.1 秒后又会检测到。

---

*本文档配套《透视拼接谜题技术文档》阅读效果更佳——那份讲"整个项目怎么做"，这份讲"这两个文件怎么读"。*
