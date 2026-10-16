---
chapter: 7
title: 实现要点与工程问题
---

### 7.1 UE 的构建系统与 UHT：反射代码是怎样生成的

一个 UE C++ 类与普通 C++ 类最直观的差别，是头文件里那两样东西：末尾的 `#include "PerspectivePuzzleManager.generated.h"`，以及类体第一行的 `GENERATED_BODY()`。它们不是可选风格，而是反射系统能够识别这个类的前提。

UE 的 C++ 构建分为两层。第一层是 **UHT（Unreal Header Tool）**，它不编译代码，而是扫描头文件中出现的 `UCLASS`、`USTRUCT`、`UPROPERTY`、`UFUNCTION` 等标记，据此生成若干辅助文件，其中最主要的就是 `PerspectivePuzzleManager.generated.h`。第二层是 **UBT（Unreal Build Tool）** 调用平台编译器（本工程为 MSVC），把头文件、生成文件与源文件一起编译成模块动态库，由引擎在启动时加载。整个顺序如图 7-1 所示。

<figure>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="6 36 798 306" width="100%" role="img"><g><g/><g transform="translate(0,0) scale(1)"><g style="visibility: visible;"><rect x="20" y="50" width="200" height="68" rx="10.2" ry="10.2" fill="#ffffff" stroke="#000000" pointer-events="all" style="fill: light-dark(#ffffff, var(--ge-dark-color, #121212)); stroke: light-dark(rgb(0, 0, 0), rgb(255, 255, 255));"/></g><g style=""><g><foreignObject style="overflow: visible; text-align: left;" pointer-events="none" x="-9979" y="-9916" width="20196" height="20064"><div xmlns="http://www.w3.org/1999/xhtml" style="display: flex; align-items: unsafe center; justify-content: unsafe center; width: 198px; height: 1px; padding-top: 10000px; margin-left: 10000px;"><div style="box-sizing: border-box; font-size: 0; text-align: center; color: #000000; "><div style="display: inline-block; font-size: 12px; font-family: Helvetica; color: light-dark(#000000, #ffffff); line-height: 1.2; pointer-events: all; white-space: normal; word-wrap: normal; ">.h 中的<br />UCLASS / UPROPERTY / UFUNCTION</div></div></div></foreignObject></g></g><g style="visibility: visible;"><rect x="240" y="50" width="130" height="68" rx="10.2" ry="10.2" fill="#ffffff" stroke="#000000" pointer-events="all" style="fill: light-dark(#ffffff, var(--ge-dark-color, #121212)); stroke: light-dark(rgb(0, 0, 0), rgb(255, 255, 255));"/></g><g style=""><g><foreignObject style="overflow: visible; text-align: left;" pointer-events="none" x="-9759" y="-9916" width="20126" height="20064"><div xmlns="http://www.w3.org/1999/xhtml" style="display: flex; align-items: unsafe center; justify-content: unsafe center; width: 128px; height: 1px; padding-top: 10000px; margin-left: 10000px;"><div style="box-sizing: border-box; font-size: 0; text-align: center; color: #000000; "><div style="display: inline-block; font-size: 12px; font-family: Helvetica; color: light-dark(#000000, #ffffff); line-height: 1.2; pointer-events: all; white-space: normal; word-wrap: normal; ">UHT 扫描</div></div></div></foreignObject></g></g><g style="visibility: visible;"><rect x="390" y="50" width="170" height="68" rx="10.2" ry="10.2" fill="#f5f5f5" stroke="#333333" pointer-events="all" style="fill: light-dark(rgb(245, 245, 245), rgb(26, 26, 26)); stroke: light-dark(rgb(51, 51, 51), rgb(193, 193, 193));"/></g><g style=""><g><foreignObject style="overflow: visible; text-align: left;" pointer-events="none" x="-9609" y="-9916" width="20166" height="20064"><div xmlns="http://www.w3.org/1999/xhtml" style="display: flex; align-items: unsafe center; justify-content: unsafe center; width: 168px; height: 1px; padding-top: 10000px; margin-left: 10000px;"><div style="box-sizing: border-box; font-size: 0; text-align: center; color: #000000; "><div style="display: inline-block; font-size: 12px; font-family: Helvetica; color: light-dark(#000000, #ffffff); line-height: 1.2; pointer-events: all; white-space: normal; word-wrap: normal; ">生成 .generated.h</div></div></div></foreignObject></g></g><g style="visibility: visible;"><rect x="580" y="50" width="210" height="68" rx="10.2" ry="10.2" fill="#ffffff" stroke="#000000" pointer-events="all" style="fill: light-dark(#ffffff, var(--ge-dark-color, #121212)); stroke: light-dark(rgb(0, 0, 0), rgb(255, 255, 255));"/></g><g style=""><g><foreignObject style="overflow: visible; text-align: left;" pointer-events="none" x="-9419" y="-9916" width="20206" height="20064"><div xmlns="http://www.w3.org/1999/xhtml" style="display: flex; align-items: unsafe center; justify-content: unsafe center; width: 208px; height: 1px; padding-top: 10000px; margin-left: 10000px;"><div style="box-sizing: border-box; font-size: 0; text-align: center; color: #000000; "><div style="display: inline-block; font-size: 12px; font-family: Helvetica; color: light-dark(#000000, #ffffff); line-height: 1.2; pointer-events: all; white-space: normal; word-wrap: normal; ">UBT + MSVC 编译<br />.h / .cpp / .generated.h</div></div></div></foreignObject></g></g><g style="visibility: visible;"><rect x="580" y="176" width="210" height="56" rx="8.4" ry="8.4" fill="#ffffff" stroke="#000000" pointer-events="all" style="fill: light-dark(#ffffff, var(--ge-dark-color, #121212)); stroke: light-dark(rgb(0, 0, 0), rgb(255, 255, 255));"/></g><g style=""><g><foreignObject style="overflow: visible; text-align: left;" pointer-events="none" x="-9419" y="-9796" width="20206" height="20052"><div xmlns="http://www.w3.org/1999/xhtml" style="display: flex; align-items: unsafe center; justify-content: unsafe center; width: 208px; height: 1px; padding-top: 10000px; margin-left: 10000px;"><div style="box-sizing: border-box; font-size: 0; text-align: center; color: #000000; "><div style="display: inline-block; font-size: 12px; font-family: Helvetica; color: light-dark(#000000, #ffffff); line-height: 1.2; pointer-events: all; white-space: normal; word-wrap: normal; ">模块 DLL</div></div></div></foreignObject></g></g><g style="visibility: visible;"><rect x="580" y="272" width="210" height="56" rx="8.4" ry="8.4" fill="#ffffff" stroke="#000000" pointer-events="all" style="fill: light-dark(#ffffff, var(--ge-dark-color, #121212)); stroke: light-dark(rgb(0, 0, 0), rgb(255, 255, 255));"/></g><g style=""><g><foreignObject style="overflow: visible; text-align: left;" pointer-events="none" x="-9419" y="-9700" width="20206" height="20052"><div xmlns="http://www.w3.org/1999/xhtml" style="display: flex; align-items: unsafe center; justify-content: unsafe center; width: 208px; height: 1px; padding-top: 10000px; margin-left: 10000px;"><div style="box-sizing: border-box; font-size: 0; text-align: center; color: #000000; "><div style="display: inline-block; font-size: 12px; font-family: Helvetica; color: light-dark(#000000, #ffffff); line-height: 1.2; pointer-events: all; white-space: normal; word-wrap: normal; ">引擎启动时加载</div></div></div></foreignObject></g></g><g style="visibility: visible;"><path d="M 220 84 L 233.63 84" fill="none" stroke="white" stroke-miterlimit="10" pointer-events="stroke" style="stroke: light-dark(rgb(0, 0, 0), rgb(255, 255, 255));" visibility="hidden" stroke-width="19" vector-effect="non-scaling-stroke"/><path d="M 220 84 L 233.63 84" fill="none" stroke="#000000" stroke-miterlimit="10" pointer-events="stroke" style="stroke: light-dark(rgb(0, 0, 0), rgb(255, 255, 255));"/><path d="M 238.88 84 L 231.88 87.5 L 233.63 84 L 231.88 80.5 Z" fill="#000000" stroke="#000000" stroke-miterlimit="10" pointer-events="all" style="fill: light-dark(rgb(0, 0, 0), rgb(255, 255, 255)); stroke: light-dark(rgb(0, 0, 0), rgb(255, 255, 255));"/></g><g style="visibility: visible;"><path d="M 370 84 L 383.63 84" fill="none" stroke="white" stroke-miterlimit="10" pointer-events="stroke" style="stroke: light-dark(rgb(0, 0, 0), rgb(255, 255, 255));" visibility="hidden" stroke-width="19" vector-effect="non-scaling-stroke"/><path d="M 370 84 L 383.63 84" fill="none" stroke="#000000" stroke-miterlimit="10" pointer-events="stroke" style="stroke: light-dark(rgb(0, 0, 0), rgb(255, 255, 255));"/><path d="M 388.88 84 L 381.88 87.5 L 383.63 84 L 381.88 80.5 Z" fill="#000000" stroke="#000000" stroke-miterlimit="10" pointer-events="all" style="fill: light-dark(rgb(0, 0, 0), rgb(255, 255, 255)); stroke: light-dark(rgb(0, 0, 0), rgb(255, 255, 255));"/></g><g style="visibility: visible;"><path d="M 560 84 L 573.63 84" fill="none" stroke="white" stroke-miterlimit="10" pointer-events="stroke" style="stroke: light-dark(rgb(0, 0, 0), rgb(255, 255, 255));" visibility="hidden" stroke-width="19" vector-effect="non-scaling-stroke"/><path d="M 560 84 L 573.63 84" fill="none" stroke="#000000" stroke-miterlimit="10" pointer-events="stroke" style="stroke: light-dark(rgb(0, 0, 0), rgb(255, 255, 255));"/><path d="M 578.88 84 L 571.88 87.5 L 573.63 84 L 571.88 80.5 Z" fill="#000000" stroke="#000000" stroke-miterlimit="10" pointer-events="all" style="fill: light-dark(rgb(0, 0, 0), rgb(255, 255, 255)); stroke: light-dark(rgb(0, 0, 0), rgb(255, 255, 255));"/></g><g style="visibility: visible;"><path d="M 685 118 L 685 169.63" fill="none" stroke="white" stroke-miterlimit="10" pointer-events="stroke" style="stroke: light-dark(rgb(0, 0, 0), rgb(255, 255, 255));" visibility="hidden" stroke-width="19" vector-effect="non-scaling-stroke"/><path d="M 685 118 L 685 169.63" fill="none" stroke="#000000" stroke-miterlimit="10" pointer-events="stroke" style="stroke: light-dark(rgb(0, 0, 0), rgb(255, 255, 255));"/><path d="M 685 174.88 L 681.5 167.88 L 685 169.63 L 688.5 167.88 Z" fill="#000000" stroke="#000000" stroke-miterlimit="10" pointer-events="all" style="fill: light-dark(rgb(0, 0, 0), rgb(255, 255, 255)); stroke: light-dark(rgb(0, 0, 0), rgb(255, 255, 255));"/></g><g style="visibility: visible;"><path d="M 685 232 L 685 265.63" fill="none" stroke="white" stroke-miterlimit="10" pointer-events="stroke" style="stroke: light-dark(rgb(0, 0, 0), rgb(255, 255, 255));" visibility="hidden" stroke-width="19" vector-effect="non-scaling-stroke"/><path d="M 685 232 L 685 265.63" fill="none" stroke="#000000" stroke-miterlimit="10" pointer-events="stroke" style="stroke: light-dark(rgb(0, 0, 0), rgb(255, 255, 255));"/><path d="M 685 270.88 L 681.5 263.88 L 685 265.63 L 688.5 263.88 Z" fill="#000000" stroke="#000000" stroke-miterlimit="10" pointer-events="all" style="fill: light-dark(rgb(0, 0, 0), rgb(255, 255, 255)); stroke: light-dark(rgb(0, 0, 0), rgb(255, 255, 255));"/></g><g style="visibility: visible;"><rect x="20" y="176" width="300" height="80" rx="12" ry="12" fill="#ffffff" stroke="#000000" stroke-dasharray="3 3" pointer-events="all" style="fill: light-dark(#ffffff, var(--ge-dark-color, #121212)); stroke: light-dark(rgb(0, 0, 0), rgb(255, 255, 255));"/></g><g style=""><g><foreignObject style="overflow: visible; text-align: left;" pointer-events="none" x="-9970" y="-9784" width="20288" height="20076"><div xmlns="http://www.w3.org/1999/xhtml" style="display: flex; align-items: unsafe center; justify-content: unsafe flex-start; width: 290px; height: 1px; padding-top: 10000px; margin-left: 10000px;"><div style="box-sizing: border-box; font-size: 0; text-align: left; color: #333333; "><div style="display: inline-block; font-size: 11px; font-family: Helvetica; color: light-dark(#333333, #c1c1c1); line-height: 1.2; pointer-events: all; white-space: normal; word-wrap: normal; ">生成阶段失败：UHT 未重新生成<br />→ 找不到 .generated.h / 未找到 XX 的函数定义<br />根因在生成阶段，而不在语法上</div></div></div></foreignObject></g></g><g style="visibility: visible;"><path d="M 390 84 L 180 84 Q 170 84 170 94 L 170 169.63" fill="none" stroke="white" stroke-miterlimit="10" pointer-events="stroke" style="stroke: light-dark(rgb(0, 0, 0), rgb(255, 255, 255));" visibility="hidden" stroke-width="19" vector-effect="non-scaling-stroke"/><path d="M 390 84 L 180 84 Q 170 84 170 94 L 170 169.63" fill="none" stroke="#000000" stroke-miterlimit="10" stroke-dasharray="3 3" pointer-events="stroke" style="stroke: light-dark(rgb(0, 0, 0), rgb(255, 255, 255));"/><path d="M 170 174.88 L 166.5 167.88 L 170 169.63 L 173.5 167.88 Z" fill="#000000" stroke="#000000" stroke-miterlimit="10" pointer-events="all" style="fill: light-dark(rgb(0, 0, 0), rgb(255, 255, 255)); stroke: light-dark(rgb(0, 0, 0), rgb(255, 255, 255));"/></g></g><g/><g/></g></svg>
<figcaption>图 7-1 UHT 与 UBT 的两层构建流程，以及生成阶段失败时的典型表现</figcaption>
</figure>

三个宏各自的职责如下表。

<p class="caption">表 7-1 反射宏的职责与运行时效果</p>

| 标记 | UHT 据此生成什么 | 运行时/编辑器中的效果 |
|------|------------------|------------------------|
| `UCLASS()` | 类的反射信息与注册代码 | 该类可被引擎实例化、放进关卡、被蓝图引用 |
| `USTRUCT(BlueprintType)` | 结构体的反射信息 | 结构体可作为蓝图变量类型，成员按 `UPROPERTY` 规则暴露 |
| `UPROPERTY(...)` | 属性注册与序列化描述 | 参与序列化（保存/加载）、可在细节面板编辑、可被蓝图读写 |
| `UFUNCTION(...)` | 函数注册与调用封装 | 可被蓝图调用（`BlueprintCallable`）或被蓝图实现（`BlueprintImplementableEvent`） |
| `GENERATED_BODY()` | 在此处插入上述注册代码 | 缺少它时，宏定义的成员与函数指针不会被声明，随之出现「未找到某函数定义」一类报错 |

工程中的头文件正是按这一顺序组织的：先 `#pragma once`，再 `CoreMinimal.h` 与 `GameFramework/Actor.h`，最后才是生成头文件。

<p class="caption">代码 7-1 头文件的顶部与类声明（节选自 PerspectivePuzzleManager.h 第 1–9、33–36 行）</p>

```cpp
// Fill out your copyright notice in the Description page of Project Settings.

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "PerspectivePuzzleManager.generated.h"

class UMaterialInstanceDynamic;

UCLASS()
class CPP1_API APerspectivePuzzleManager : public AActor
{
    GENERATED_BODY()
```

生成头文件必须位于所有 `#include` 的最后一行，原因有两层。其一，UHT 生成的代码需要引用本文件中已经出现的类型与宏状态，把 `generated.h` 放在中间，其后的 `#include` 会在生成代码之后才引入所需的类型声明。其二，`#pragma once` 之类的头文件保护与宏定义在包含顺序变化时会产生不同的展开结果，UE 的构建规则因此把「生成头文件在最后」固定为约定；违反该约定时会直接报错，而不是给出警告。

### 7.2 头文件与源文件的分工

在 UE 语境下，声明与实现的分工比通常的 C++ 更明确，因为「哪些内容必须让 UHT 看到」是一条硬约束：只要带反射标记，就必须写在头文件里。

<p class="caption">表 7-2 UE 工程中头文件与源文件的职责划分</p>

| 内容 | 位置 | 原因 |
|------|------|------|
| 类声明、基类、模块导出宏 `CPP1_API` | `.h` | UHT 只扫描头文件 |
| `UCLASS` / `USTRUCT` / `UPROPERTY` / `UFUNCTION` 及其 `meta` | `.h` | 反射信息由 UHT 从头文件采集 |
| `GENERATED_BODY()` | `.h` | 生成代码的插入点，必须出现在类体内首部 |
| `#include "PerspectivePuzzleManager.generated.h"` | `.h` 的最后一条 include | 见 7.1 节 |
| 纯 C++ 辅助类型的前向声明（如 `class UMaterialInstanceDynamic;`） | `.h` | 成员只用指针，不需要完整类型，可减少编译依赖 |
| 构造函数、成员函数实现、事件调用点 | `.cpp` | 与普通 C++ 相同，写成 `类名::函数名` |
| 引擎功能头文件（`Engine/World.h`、`DrawDebugHelpers.h` 等） | `.cpp` | 只有实现需要这些完整类型 |
| `#include "PerspectivePuzzleManager.h"` | `.cpp` 的第一条 include | 保证类声明与实现一致，并让反射宏先展开 |

源文件的第一条 include 必须是自身头文件，这条规则对本工程尤其重要：头文件里含有 `generated.h` 与反射宏，如果源文件先包含其他引擎头文件，就可能在这些头文件间接引入的类型声明之前展开生成代码，产生难以定位的连带错误。

<p class="caption">代码 7-2 源文件的 include 区（节选自 PerspectivePuzzleManager.cpp 第 1–12 行）</p>

```cpp
// Fill out your copyright notice in the Description page of Project Settings.

#include "PerspectivePuzzleManager.h"
#include "Engine/World.h"
#include "GameFramework/PlayerController.h"
#include "Kismet/GameplayStatics.h"
#include "Components/ArrowComponent.h"
#include "Components/DecalComponent.h"
#include "Components/StaticMeshComponent.h"
#include "Materials/MaterialInstanceDynamic.h"
#include "Materials/MaterialInterface.h"
#include "DrawDebugHelpers.h"
```

头文件中只前向声明 `UMaterialInstanceDynamic`，完整定义放在源文件，理由是成员 `TArray<UMaterialInstanceDynamic*> FragmentMaterials` 只用到指针；指针大小固定，无需完整类型。把重量级的 `Materials/MaterialInstanceDynamic.h` 放在源文件，可避免该头文件被任何包含本头文件的翻译单元连锁引入。这一取舍在 7.3 节还会再次出现，因为前向声明与模板组合时会触发另一类错误。

### 7.3 编译错误的分类与定位

UE 工程中的报错信息有一个显著特点：**最先出现的错误往往不是根因**。当生成阶段失败时，编译器看到的是一批缺少声明与宏展开的代码，于是从引擎模板内部到业务代码会连续报出十几条互不相关的错误。定位的关键是分清「生成阶段失败」与「真实语法错误」。

以引擎头文件 `StaticAssertCompleteType.h` 为例，报告中出现的是两条错误：

- `E0842 模板参数 "T" 未在类模板 "UEStaticAssertCompleteType_Private::TUEStaticAssertTypeCheckerBase<错误类型>>" 的模板参数列表中使用或无法从中推导`（位于 `StaticAssertCompleteType.h` 第 34 行）
- `E0094 数组的大小必须大于零`（位于同一文件第 35 行）
- 连带出现 `E0842 模板参数 "T" 未在类模板 "TIsContiguousContainer<错误类型>>" 的模板参数列表中使用或无法从中推导` 与多条 `E0094`（位于 `IsContiguousContainer.h` 第 41–44 行）

这些位置都在引擎内部，不可能由业务代码的直接改动引起。它们的实际含义是：某个容器模板在实例化时拿到了一个**不完整类型**（只有前向声明、没有定义的类），引擎为此准备的静态断言在展开时失败，错误于是被报告在断言所在的头文件里。在本工程中，触发条件是把容器元素写成 `TObjectPtr<T>` 而 `T` 只是前向声明；改用裸指针数组 `TArray<UMaterialInstanceDynamic*>` 后该组报错消失。这一取舍已在 7.2 节说明：成员 `FragmentMaterials` 使用裸指针，其生命周期由持有它的 Decal/网格体组件保证。

另一类报错来自生成阶段本身，形态与处置如表 7-3。

<p class="caption">表 7-3 生成阶段失败的典型报错与处置</p>

| 报错文本 | 实际含义 | 处置 |
|----------|----------|------|
| `无法打开 源 文件 "PerspectivePuzzleManager.generated.h"` | 生成头文件不存在或未被生成 | 确认头文件名与类声明一致；清理 `Intermediate/Build/Win64/UnrealEditor/Inc/CPP1` 后重新构建，强制 UHT 重新生成 |
| `无法打开 源 文件 "SharedDefinitions.UnrealEd.Project.ValApi.ValExpApi.Cpp20.InclOrderUnreal5_6.h"` | 构建配置中的共享定义文件缺失，通常伴随生成目录被清理或构建中途失败 | 关闭编辑器后做一次完整重建，让 UBT 重新生成全部中间文件 |
| `未找到 "OnPuzzleSolved" 的函数定义`（`OnViewAligned` / `OnViewLost` / `OnProgressUpdated` 同） | `BlueprintImplementableEvent` 的实现位于蓝图侧，C++ 只负责调用点；当 `GENERATED_BODY()` 未生效时，这些调用点找不到对应声明 | 检查 `GENERATED_BODY()` 是否位于类体首部、生成头文件是否为最后一条 include |
| `The identifier 'GENERATED_BODY' was detected in a block being skipped. Was this intentional?` | 宏出现在被条件编译跳过的代码块内，UHT 未能处理 | 移除包裹类声明的条件编译，使 `GENERATED_BODY()` 始终处于活动分支 |
| `类 "UObject" 没有成员 "Tick"` / `类 "UObject" 没有成员 "BeginPlay"` | 基类声明未生效，编译器按最简基类解析 | 与上一条同源，先修好生成阶段，不要逐个修改函数名 |

由此可以得到一条稳定的排查顺序：**先看是否存在 “无法打开 …generated.h” 或 “未找到…的函数定义”，再决定是否需要阅读后面的模板报错**。前者是生成阶段问题，后者绝大多数是其连带结果。把头文件改动之后的一整批报错都当作语法错误逐条修改，是最容易走偏的路径。

### 7.4 源码编码与中文注释

UE 的构建系统对源文件编码敏感，本工程采用的约定是：**含中文注释的头文件与源文件一律保存为 UTF-8 with BOM（带签名的 UTF-8，代码页 65001）**。三种编码状态的表现如表 7-4。

<p class="caption">表 7-4 源文件编码状态与表现</p>

| 编码状态 | 编辑器中的表现 | 构建表现 |
|----------|----------------|----------|
| UTF-8 with BOM | 中文注释正常显示 | 正常构建 |
| UTF-8 无 BOM | 以本地代码页（简体中文环境为 936）解码，中文显示为乱码 | 视构建系统的处理方式而定，可能正常构建，也可能因字符无法表示而告警 |
| 双重 BOM（文件头出现两个 BOM 字节序列） | 注释可能正常 | UHT 解析失败，随后出现 7.3 节的连带报错 |

产生双重 BOM 的常见原因是：文件本身已带 BOM，而编辑流程又按「带签名保存」写入一次。校验方式很直接——读取文件前三个字节，若为 `EF BB BF` 则已有 BOM，出现两次即为双重 BOM。修复只需保留一个 BOM：

```bash
python -c "p='F:/ue5_project/CPP1/Source/CPP1/Public/PerspectivePuzzleManager.h'; raw=open(p,'rb').read(); b=b'\xef\xbb\xbf'; print('BOM count =', 2 if raw.startswith(b+b) else 1 if raw.startswith(b) else 0)"
```

另一条等效路线是统一保存为无 BOM 的 UTF-8，并向编译器显式声明源文件字符集（MSVC 的 `/utf-8` 选项等价于同时指定源字符集与执行字符集为 UTF-8）。两条路线不能混用：同一个模块内一部分文件带 BOM、另一部分不带，是最容易产生「有的文件乱码、有的正常」这种局部现象的原因。本工程选择带 BOM 路线，原因是它在编辑器与构建系统两侧的行为最一致，且无需修改构建配置。

### 7.5 定时器与生命周期

检测逻辑没有放在 `Tick` 中。构造函数把 `PrimaryActorTick.bCanEverTick` 设为 `false`，时间基准完全交给定时器：检测按固定间隔触发，而不是每帧触发。

<p class="caption">代码 7-3 构造、BeginPlay 与 ResetPuzzle（节选自 PerspectivePuzzleManager.cpp 第 14–28、103–112 行）</p>

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

void APerspectivePuzzleManager::ResetPuzzle()
{
	bIsSolved = false;
	bWasAligned = false;
	HoldTimer = 0.0f;
	SolveProgress = 0.0f;

	GetWorldTimerManager().ClearTimer(DetectionTimerHandle);
	GetWorldTimerManager().SetTimer(DetectionTimerHandle, this, &APerspectivePuzzleManager::CheckPuzzle, DetectionInterval, true);
}
```

四点在工程上值得注意：

1. **`BeginPlay` 的调用顺序有依赖关系。** `Calibrate()` 先建立标定数据，`CacheFragmentMaterials()` 再为每个碎片创建动态材质实例，最后 `ResetPuzzle()` 启动定时器；若先启动定时器，第一次检测会在标定数据为空时执行，虽然 `CheckPuzzle` 有 `CalibratedData.Num() == 0` 的提前返回作为兜底，但那属于防御性写法而非常规路径。
2. **`FTimerHandle` 是定时器的句柄，不是定时器本身。** `SetTimer` 把定时器登记到世界（`UWorld`）的定时器管理器上，句柄只是访问它的凭据。因此 `ClearTimer(DetectionTimerHandle)` 是「取消这个句柄登记的那个定时器」，而 `SetTimer` 的第五个参数为 `true` 表示按 `DetectionInterval` 反复触发，而不是只触发一次。
3. **`ResetPuzzle` 是先清后设。** 它既用于初始化，也用于求解后的重新开始：先 `ClearTimer` 取消可能存在的旧定时器，再 `SetTimer` 重新登记，这样重复调用不会叠加出多个定时器。
4. **求解后停止检测有两条保障。** 一是 `CheckPuzzle` 开头的 `if (bIsSolved || CalibratedData.Num() == 0) return;`，二是 `bIsSolved = true` 之后立即 `ClearTimer`。前者保证即使定时器仍存在也不会继续运算，后者则彻底释放定时器。

还有一处与「保持时长」语义相关：持续时间由 `HoldTimer += DetectionInterval` 累加，而不是累加实测帧间隔。这意味着 `HoldDuration` 是以「检测次数 × 名义间隔」度量的；当「定时器的实际触发周期」与 `DetectionInterval` 不一致（例如帧率极低导致定时器被推迟）时，实际保持时长会与设定值有偏差。若需要严格的时间语义，应改为累加实测时间或使用时间戳差值。在头文件默认值 `DetectionInterval = 0.1`、`HoldDuration = 1.5` 下，约 15 次连续检测即视为保持成功；若按附录 A.2 的参考取值把 `HoldDuration` 调整为 2.0 秒，则需要约 20 次。

### 7.6 日志与运行期调试

定位「为什么没触发」依赖两类手段：日志与调试绘制。日志的输出位置在引擎的输出日志（Output Log）中，按详细程度分为若干级别；本工程用到的三种及相关语句如表 7-5。

<p class="caption">表 7-5 本工程的日志与调试绘制手段</p>

| 手段 | 代码位置 | 作用 |
|------|----------|------|
| `UE_LOG(LogTemp, Log, …)` 输出标定结果 | `Calibrate()` | 输出采集到的碎片数量与视线参考点坐标，确认标定是否取到了数据 |
| `UE_LOG(LogTemp, Log, …)` 输出材质缓存数量 | `CacheFragmentMaterials()` | 输出动态材质实例的创建数量，确认发光链路是否建立 |
| `UE_LOG(LogTemp, Log, …)` 打印「相机位置 / 标定位置 / 二者距离」 | `CheckPuzzle()` 开头 | 判断相机高度是否与标定高度一致——这是「站对了也不触发」的首要原因 |
| `UE_LOG(LogTemp, Log, …)` 打印 `Mismatch` 行 | `CheckPuzzle()` 的碎片循环内 | 逐条列出未通过判据的碎片及其 `Dot` 与 `DistDiff` 实测值，直接指出是哪一条判据没通过 |
| `UE_LOG(LogTemp, Log, …)` 打印 `Pass/Num/Rate/ViewDot/Aligned` | `CheckPuzzle()` 末尾 | 给出该次检测的汇总状态，用于判断是「通过率不够」还是「视线未对准」 |
| `DrawDebugCalibration(float Duration)` | 可由编辑器按钮调用 | 用青色球体标出标定原点、橙色球体标出各碎片位置、黄色连线标出二者关系 |
| `DrawDebugLine(…, FColor::Red/Green, …)` | `CheckPuzzle()` | 红色线段表示相机当前朝向，绿色线段表示「标定原点指向图案中心」的目标方向，两者夹角即视线偏差 |

日志语句的关键在于把**阈值与实测值一起打印**。例如碎片未通过时输出的格式串为：

```cpp
			UE_LOG(LogTemp, Log, TEXT("  Mismatch: Dot=%.4f(need>=%.4f) DistDiff=%.1f(need<=%.1f)"),
				Dot, DotProductThreshold, DistDiff, DistanceTolerance);
```

该行同时给出实测的方向点积、要求的阈值、实测的距离差与允许的容差，因此不需要额外推算即可判断应当放宽哪一项参数。同理，汇总行同时给出通过数量、总数、通过率与视线点积，可以直接区分「碎片数量多导致通过率不足」与「视线方向不满足」这两种失败原因。

调试绘制中的 `Duration` 参数表示图形在场景中保留的秒数。工程在一处用了两个极端的取值，二者的用途不同：

- `BeginPlay()` 中的 `DrawDebugCalibration(100000.0f)` 传入一个极大的时长，使标定球体与连线在整个运行期内持续可见，作为常驻的参照物；
- `CheckPuzzle()` 中的视线线段传入 `DetectionInterval * 2.0f`，即约为两个检测周期。线段每周期被重绘一次，因此视觉上连续，同时避免了大量图形对象长期堆积。

需要注意的是，调试绘制只在开发构建中可用：打包后的运行版本不会绘制这些图形，因此它们适合作为定位手段，而不能作为面向玩家的反馈——面向玩家的反馈应通过材质发光参数与蓝图事件实现。

`DrawDebugCalibration` 声明为 `const` 成员函数，表示它不修改对象状态；对只读的调试函数而言，这类限定同时是给调用方的保证。语言层面还有一类与之互补的契约表达：C++17 的 `[[nodiscard]]` 属性要求调用方必须使用返回值，否则编译器给出告警。本工程的对外接口以 `void` 函数与蓝图事件为主，未使用该属性；当某个查询函数返回值本身具有语义（例如「当前是否处于对齐状态」）时，该属性是把调用约定写进类型系统的常用手段，而「按常量引用传递只读参数」则是对应的参数侧写法。

### 7.7 小结

1. **反射代码由 UHT 生成，生成失败会伪装成满屏语法错误。** `.generated.h` 与 `GENERATED_BODY()` 是反射的前提；排查时应先确认生成阶段是否成功，再阅读模板与语法报错。
2. **头文件承载声明与反射标记，源文件承载实现与引擎依赖。** 生成头文件置于所有 include 之后、源文件首条 include 为自身头文件，这两条约定共同保证宏展开顺序稳定。
3. **模板静态断言报错通常指向一个不完整类型。** `E0842` / `E0094` 出现在引擎头文件中时，应回头检查容器元素的书写方式（如 `TObjectPtr<T>` 与前向声明类型组合），而不是修改引擎侧代码。
4. **编码约定必须全工程统一。** 带 BOM 与不带 BOM 两条路线各自成立，混用会产生局部乱码；双重 BOM 会直接破坏 UHT 解析。
5. **定时器使检测频率与帧率解耦，但也带来时间语义上的近似。** `SetTimer` 的循环触发配合 `bIsSolved` 提前返回与求解后 `ClearTimer`，构成了停止检测的双重保障；而保持时长按名义间隔累加，是需要知晓的实现细节。
6. **可用的调试手段应把「阈值」与「实测值」一并暴露。** 这样一条日志就能回答「哪条判据没通过、差多少」，避免在参数面板中反复试错。
