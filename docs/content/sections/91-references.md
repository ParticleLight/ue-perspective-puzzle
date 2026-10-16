---
chapter: 91
title: 参考文献
---

### 91.1 参考资料

下列资料均为引擎官方文档或语言标准文档站点中的稳定条目，用于支撑正文中的机制性结论。每条之后附「对应结论」，说明其被引用的位置。

1. Epic Games. **Unreal Engine Actor Lifecycle**[EB/OL]. Epic Developer Community. <https://dev.epicgames.com/documentation/en-us/unreal-engine/unreal-engine-actor-lifecycle>
   对应结论：Actor 从生成到销毁的各阶段顺序；第 7.5 节关于 `BeginPlay` 中初始化顺序与生命周期的讨论依据此文档。

2. Epic Games. **Unreal Engine UProperties（UPROPERTY 说明符）**[EB/OL]. Epic Developer Community. <https://dev.epicgames.com/documentation/en-us/unreal-engine/unreal-engine-uproperties>
   对应结论：`UPROPERTY` 的可见性说明符（`EditAnywhere` / `VisibleAnywhere` / `BlueprintReadOnly` 等）与序列化语义；第 7.1 节与附录 A 的参数表依据此文档。

3. Epic Games. **UFunctions in Unreal Engine（含 BlueprintCallable 与 BlueprintImplementableEvent）**[EB/OL]. Epic Developer Community. <https://dev.epicgames.com/documentation/en-us/unreal-engine/ufunctions-in-unreal-engine>
   对应结论：`UFUNCTION` 的函数说明符语义，特别是「C++ 只声明、蓝图负责实现」的事件机制；第 7.1 节与附录 A.3 依据此文档。

4. Epic Games. **Metadata Specifiers in Unreal Engine**[EB/OL]. Epic Developer Community. <https://dev.epicgames.com/documentation/en-us/unreal-engine/metadata-specifiers-in-unreal-engine>
   对应结论：`meta = (ClampMin / ClampMax / CallInEditor / ToolTip)` 等元数据说明符的含义；附录 A 中的取值范围一列依据此文档。

5. Epic Games. **UMaterialInstanceDynamic**[EB/OL]. Epic Developer Community. <https://dev.epicgames.com/documentation/en-us/unreal-engine/API/Runtime/Engine/Materials/UMaterialInstanceDynamic>
   对应结论：动态材质实例的创建方式与标量参数写入接口；第 7.2 节的前向声明取舍与附录 B-11、B-12 依据此文档。

6. Epic Games. **UDecalComponent**[EB/OL]. Epic Developer Community. <https://dev.epicgames.com/documentation/en-us/unreal-engine/API/Runtime/Engine/UDecalComponent>
   对应结论：贴花组件的材质设置与尺寸语义；附录 C 中碎片摆放与材质指定步骤依据此文档。

7. Epic Games. **Decal Materials in Unreal Engine**[EB/OL]. Epic Developer Community. <https://dev.epicgames.com/documentation/en-us/unreal-engine/decal-materials-in-unreal-engine>
   对应结论：贴花材质的混合模式与不透明度要求；附录 B-10 关于透明区域显示为黑色的判断依据此文档。

8. Epic Games. **DrawDebugLine**[EB/OL]. Epic Developer Community. <https://dev.epicgames.com/documentation/en-us/unreal-engine/API/Runtime/Engine/DrawDebugLine>
   对应结论：调试线段的参数含义，包括颜色、持续时长与线宽；第 7.6 节关于 `Duration` 参数的说明依据此文档。

9. Epic Games. **FTimerManager**[EB/OL]. Epic Developer Community. <https://dev.epicgames.com/documentation/en-us/unreal-engine/API/Runtime/Engine/FTimerManager>
   对应结论：`SetTimer` / `ClearTimer` 的语义与句柄 `FTimerHandle` 的作用；第 7.5 节依据此文档。

10. Epic Games. **Gameplay Timers in Unreal Engine**[EB/OL]. Epic Developer Community. <https://dev.epicgames.com/documentation/en-us/unreal-engine/gameplay-timers-in-unreal-engine>
   对应结论：定时器的循环触发与「用定时器替代逐帧检测」的适用场景；第 7.5 节的时间基准讨论依据此文档。

11. Epic Games. **TVector（含 DotProduct 与 GetSafeNormal 等成员）**[EB/OL]. Epic Developer Community. <https://dev.epicgames.com/documentation/en-us/unreal-engine/API/Runtime/Core/TVector>
   对应结论：向量点积与安全归一化的接口语义；检测判据中方向一致性的计算方式依据此文档。

12. Epic Games. **Logging in Unreal Engine**[EB/OL]. Epic Developer Community. <https://dev.epicgames.com/documentation/en-us/unreal-engine/logging-in-unreal-engine>
   对应结论：`UE_LOG` 的用法、日志类别与详细程度级别；第 7.6 节的日志手段与附录 C 的验证步骤依据此文档。

13. cppreference. **C++ attribute: nodiscard (since C++17)**[EB/OL]. cppreference.com. <https://en.cppreference.com/w/cpp/language/attributes/nodiscard>
   对应结论：`[[nodiscard]]` 的标准语义；第 7.6 节关于「把调用约定写进类型系统」的说明依据此文档。

14. cppreference. **Reference declaration（含常量引用）**[EB/OL]. cppreference.com. <https://en.cppreference.com/w/cpp/language/reference>
   对应结论：常量引用的语义，以及在只读遍历与只读传参中的用法；第 7.6 节与代码中的 `const auto&` 遍历依据此文档。

### 91.2 实现依据说明

本文描述的系统由两个 C++ 类型构成：`APerspectivePuzzleManager`（头文件与源文件位于工程的 `Source/CPP1/Public` 与 `Source/CPP1/Private` 目录）负责标定与检测，`ABasePawn` 用于演示反射说明符与可见性控制。正文中出现的代码段均取自这两组文件的最终版本，节选处已标注所对应的行范围；参数默认值、取值范围与函数签名以头文件为准，行为描述以源文件为准。工程使用的引擎版本为 Unreal Engine 5.8，开发环境为 Windows。

上列资料与本文结论的对应关系可以分三类：

- **引擎机制类结论**（反射与生成头文件的角色、属性说明符的可见性语义、定时器与句柄的行为、动态材质实例的参数写入方式、贴花材质的混合模式要求、调试绘制的持续时长语义）均可由上列 Epic Games 官方文档直接支撑，正文相应位置已给出指向。
- **语言层面的结论**（常量引用的语义、`[[nodiscard]]` 的契约含义）由语言标准文档支撑。
- **工程取舍类结论**（容器元素使用裸指针而非对象指针模板、编码统一为带 BOM 的 UTF-8、检测改为定时器驱动而非逐帧、保持时长以名义间隔累加）来自对上述两个类型实际实现方式的归纳：这些取舍在文档中没有对错结论，只有与具体约束（前向声明的使用、构建系统对编码的敏感性、检测频率与精度的权衡）的匹配关系，正文在提出处均已说明所依据的机制。

凡正文中未标注来源、且不能由上述文档直接推出的表述，均属基于已知机制作出的推导或工程建议，不构成对引擎行为的普遍性断言；涉及具体数值与阈值时，应以实际工程的头文件与编辑器中的取值为准。
