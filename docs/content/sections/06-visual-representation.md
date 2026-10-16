---
chapter: 6
title: 图案的表示与视觉反馈
---

透视拼接谜题的视觉部分要解决两个问题：**一张完整图案如何被拆成若干块并各自显示其中一部分**，以及**判定结果如何被玩家看见**。前者决定碎片的表现形态，后者决定反馈是否可感知。

两者的共同约束是“运行时可改”：拆分方案要能随碎片数量变化而调整，发光强度要能随判定进度连续变化。这一约束把方案推向“材质参数化 + 动态材质实例”的组合，而不是把图案预先切成多张贴图。文中引用的源码片段保留原始标识符与注释，缩进统一按四空格归一。

### 6.1 图案的几何拆分

图案的拆分不发生在图像层面，而发生在**纹理坐标层面**。所有碎片共用同一张源贴图，每个碎片只在自己的材质里声明“取这张贴图的哪一块矩形”，因此拆分块数变化时不需要重新导出任何图像资源。

纹理坐标空间是一个单位正方形，两个轴都取值于 <span class="eq">[0, 1]</span>。取子区域由一次仿射变换完成：

<p class="eq">UV<sub>sample</sub> = UV<sub>texcoord</sub> × Tiling + Offset</p>

其中 <span class="eq">Tiling</span> 控制缩放（取多大一块），<span class="eq">Offset</span> 控制平移（从哪个位置开始取）。子区域在纹理空间中的覆盖范围为：

<p class="eq">u ∈ [Offset.u, Offset.u + Tiling.u]，v ∈ [Offset.v, Offset.v + Tiling.v]</p>

把图案上下二等分，就是保持横向完整、纵向压缩一半并施加纵向偏移：上半部分取 <span class="eq">Tiling = (1, 0.5)</span>、<span class="eq">Offset = (0, 0)</span>；下半部分取同样的 Tiling，但 <span class="eq">Offset = (0, 0.5)</span>，使取样窗口从纵向中点开始。

<figure>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="26 18 878 366" width="100%" role="img"><g><g/><g transform="translate(0,0) scale(1)"><g style="visibility: visible;"><rect x="60" y="60" width="260" height="200" fill="#ffffff" stroke="#333333" pointer-events="all" style="fill: light-dark(rgb(255, 255, 255), rgb(18, 18, 18)); stroke: light-dark(rgb(51, 51, 51), rgb(193, 193, 193));"/></g><g style="visibility: visible;"><rect x="60" y="32" width="200" height="20" fill="none" stroke="white" pointer-events="stroke" visibility="hidden" stroke-width="19" vector-effect="non-scaling-stroke"/><rect x="60" y="32" width="200" height="20" fill="none" stroke="none" pointer-events="all"/></g><g style=""><g><foreignObject style="overflow: visible; text-align: left;" pointer-events="none" x="-9938" y="-9958" width="20196" height="20016"><div xmlns="http://www.w3.org/1999/xhtml" style="display: flex; align-items: unsafe center; justify-content: unsafe flex-start; width: 1px; height: 1px; padding-top: 10000px; margin-left: 10000px;"><div style="box-sizing: border-box; font-size: 0; text-align: left; color: #16181a; "><div style="display: inline-block; font-size: 12px; font-family: Helvetica; color: light-dark(#16181a, #d8d9db); line-height: 1.2; pointer-events: all; white-space: nowrap; ">源贴图（UV 空间）</div></div></div></foreignObject></g></g><g style="visibility: visible;"><rect x="60" y="268" width="220" height="18" fill="none" stroke="white" pointer-events="stroke" visibility="hidden" stroke-width="19" vector-effect="non-scaling-stroke"/><rect x="60" y="268" width="220" height="18" fill="none" stroke="none" pointer-events="all"/></g><g style=""><g><foreignObject style="overflow: visible; text-align: left;" pointer-events="none" x="-9938" y="-9723" width="20216" height="20014"><div xmlns="http://www.w3.org/1999/xhtml" style="display: flex; align-items: unsafe center; justify-content: unsafe flex-start; width: 1px; height: 1px; padding-top: 10000px; margin-left: 10000px;"><div style="box-sizing: border-box; font-size: 0; text-align: left; color: #555555; "><div style="display: inline-block; font-size: 11px; font-family: Helvetica; color: light-dark(#555555, #a4a4a4); line-height: 1.2; pointer-events: all; white-space: nowrap; ">u ∈ [0, 1] 全宽保留</div></div></div></foreignObject></g></g><g style="visibility: visible;"><rect x="60" y="60" width="260" height="100" fill="#e6e6e6" stroke="#666666" pointer-events="all" style="fill: light-dark(rgb(230, 230, 230), rgb(39, 39, 39)); stroke: light-dark(rgb(102, 102, 102), rgb(149, 149, 149));"/></g><g style="visibility: visible;"><rect x="60" y="160" width="260" height="100" fill="#f0f0f0" stroke="#666666" pointer-events="all" style="fill: light-dark(rgb(240, 240, 240), rgb(31, 31, 31)); stroke: light-dark(rgb(102, 102, 102), rgb(149, 149, 149));"/></g><g style="visibility: visible;"><rect x="336" y="92" width="250" height="36" fill="none" stroke="white" pointer-events="stroke" visibility="hidden" stroke-width="19" vector-effect="non-scaling-stroke"/><rect x="336" y="92" width="250" height="36" fill="none" stroke="none" pointer-events="all"/></g><g style=""><g><foreignObject style="overflow: visible; text-align: left;" pointer-events="none" x="-9662" y="-9890" width="20246" height="20032"><div xmlns="http://www.w3.org/1999/xhtml" style="display: flex; align-items: unsafe center; justify-content: unsafe flex-start; width: 1px; height: 1px; padding-top: 10000px; margin-left: 10000px;"><div style="box-sizing: border-box; font-size: 0; text-align: left; color: #16181a; "><div style="display: inline-block; font-size: 12px; font-family: Helvetica; color: light-dark(#16181a, #d8d9db); line-height: 1.2; pointer-events: all; white-space: nowrap; ">碎片 1 取样窗口（上带）<br />Tiling (1, 0.5) · Offset (0, 0)</div></div></div></foreignObject></g></g><g style="visibility: visible;"><rect x="336" y="192" width="250" height="36" fill="none" stroke="white" pointer-events="stroke" visibility="hidden" stroke-width="19" vector-effect="non-scaling-stroke"/><rect x="336" y="192" width="250" height="36" fill="none" stroke="none" pointer-events="all"/></g><g style=""><g><foreignObject style="overflow: visible; text-align: left;" pointer-events="none" x="-9662" y="-9790" width="20246" height="20032"><div xmlns="http://www.w3.org/1999/xhtml" style="display: flex; align-items: unsafe center; justify-content: unsafe flex-start; width: 1px; height: 1px; padding-top: 10000px; margin-left: 10000px;"><div style="box-sizing: border-box; font-size: 0; text-align: left; color: #16181a; "><div style="display: inline-block; font-size: 12px; font-family: Helvetica; color: light-dark(#16181a, #d8d9db); line-height: 1.2; pointer-events: all; white-space: nowrap; ">碎片 2 取样窗口（下带）<br />Tiling (1, 0.5) · Offset (0, 0.5)</div></div></div></foreignObject></g></g><g style="visibility: visible;"><rect x="700" y="150" width="50" height="130" fill="#e6e6e6" stroke="#666666" pointer-events="all" style="fill: light-dark(rgb(230, 230, 230), rgb(39, 39, 39)); stroke: light-dark(rgb(102, 102, 102), rgb(149, 149, 149));"/></g><g style="visibility: visible;"><ellipse cx="718" cy="136" rx="8" ry="8" fill="#16181a" stroke="#16181a" pointer-events="all" style="fill: light-dark(rgb(22, 24, 26), rgb(216, 217, 219)); stroke: light-dark(rgb(22, 24, 26), rgb(216, 217, 219));"/></g><g style="visibility: visible;"><ellipse cx="814" cy="96" rx="8" ry="8" fill="#16181a" stroke="#16181a" pointer-events="all" style="fill: light-dark(rgb(22, 24, 26), rgb(216, 217, 219)); stroke: light-dark(rgb(22, 24, 26), rgb(216, 217, 219));"/></g><g style="visibility: visible;"><rect x="690" y="292" width="200" height="36" fill="none" stroke="white" pointer-events="stroke" visibility="hidden" stroke-width="19" vector-effect="non-scaling-stroke"/><rect x="690" y="292" width="200" height="36" fill="none" stroke="none" pointer-events="all"/></g><g style=""><g><foreignObject style="overflow: visible; text-align: left;" pointer-events="none" x="-9308" y="-9690" width="20196" height="20032"><div xmlns="http://www.w3.org/1999/xhtml" style="display: flex; align-items: unsafe center; justify-content: unsafe flex-start; width: 1px; height: 1px; padding-top: 10000px; margin-left: 10000px;"><div style="box-sizing: border-box; font-size: 0; text-align: left; color: #16181a; "><div style="display: inline-block; font-size: 12px; font-family: Helvetica; color: light-dark(#16181a, #d8d9db); line-height: 1.2; pointer-events: all; white-space: nowrap; ">场景中的两个碎片<br />位于不同纵深位置</div></div></div></foreignObject></g></g><g style="visibility: visible;"><rect x="40" y="350" width="520" height="20" fill="none" stroke="white" pointer-events="stroke" visibility="hidden" stroke-width="19" vector-effect="non-scaling-stroke"/><rect x="40" y="350" width="520" height="20" fill="none" stroke="none" pointer-events="all"/></g><g style=""><g><foreignObject style="overflow: visible; text-align: left;" pointer-events="none" x="-9958" y="-9640" width="20516" height="20016"><div xmlns="http://www.w3.org/1999/xhtml" style="display: flex; align-items: unsafe center; justify-content: unsafe flex-start; width: 1px; height: 1px; padding-top: 10000px; margin-left: 10000px;"><div style="box-sizing: border-box; font-size: 0; text-align: left; color: #555555; "><div style="display: inline-block; font-size: 11px; font-family: Helvetica; color: light-dark(#555555, #a4a4a4); line-height: 1.2; pointer-events: all; white-space: nowrap; ">仅在特定视点视觉对齐；贴图本身不参与检测</div></div></div></foreignObject></g></g><g style="visibility: visible;"><path d="M 320 110 L 701.9 135.46" fill="none" stroke="white" stroke-miterlimit="10" pointer-events="stroke" style="stroke: light-dark(rgb(51, 51, 51), rgb(193, 193, 193));" visibility="hidden" stroke-width="19" vector-effect="non-scaling-stroke"/><path d="M 320 110 L 701.9 135.46" fill="none" stroke="#333333" stroke-miterlimit="10" pointer-events="stroke" style="stroke: light-dark(rgb(51, 51, 51), rgb(193, 193, 193));"/><path d="M 708.88 135.93 L 701.67 138.95 L 702.13 131.97 Z" fill="#333333" stroke="#333333" stroke-miterlimit="10" pointer-events="all" style="fill: light-dark(rgb(51, 51, 51), rgb(193, 193, 193)); stroke: light-dark(rgb(51, 51, 51), rgb(193, 193, 193));"/></g><g style="visibility: visible;"><path d="M 320 210 L 798.1 97.85" fill="none" stroke="white" stroke-miterlimit="10" pointer-events="stroke" style="stroke: light-dark(rgb(51, 51, 51), rgb(193, 193, 193));" visibility="hidden" stroke-width="19" vector-effect="non-scaling-stroke"/><path d="M 320 210 L 798.1 97.85" fill="none" stroke="#333333" stroke-miterlimit="10" stroke-dasharray="3 3" pointer-events="stroke" style="stroke: light-dark(rgb(51, 51, 51), rgb(193, 193, 193));"/><path d="M 804.91 96.26 L 798.9 101.26 L 797.3 94.45 Z" fill="#333333" stroke="#333333" stroke-miterlimit="10" pointer-events="all" style="fill: light-dark(rgb(51, 51, 51), rgb(193, 193, 193)); stroke: light-dark(rgb(51, 51, 51), rgb(193, 193, 193));"/></g></g><g/><g/></g></svg>
<figcaption>图 6-1 图案拆分：同一张贴图按 UV 子区域取样，碎片再被摆到不同纵深</figcaption>
</figure>

两个碎片的取样窗口互补且不重叠，合起来覆盖完整图案。由于采样窗口由材质参数给出，把图案拆成四块或九块时，只需要新增材质实例并填入对应的 Tiling 与 Offset，源贴图与节点网络都不必改动。

碎片在场景中的位置是另一个独立维度：它们被摆放在**不同的纵深**上，彼此之间存在视差。玩家横向移动时，近处碎片在视野中的位移大于远处碎片，两块因此错开；只有回到标定视点，两个取样窗口才在屏幕上重新拼合。拆分方案负责“每块显示什么”，纵深摆放负责“何时能拼合”，两者互不干涉。

<p class="caption">表 6-1 二等分方案下两个材质实例的参数取值</p>

| 材质实例 | UVTiling | UVOffset | 覆盖的纹理区域 | 承载位置 |
| --- | --- | --- | --- | --- |
| `MI_Star_Top` | (1, 0.5) | (0, 0) | 纵向上半 | 近处（柱面） |
| `MI_Star_Bot` | (1, 0.5) | (0, 0.5) | 纵向下半 | 远处（墙面） |

### 6.2 材质侧的 UV 变换：节点结构与参数化

UV 变换在材质图中由三个节点完成：一个纹理坐标节点、一个乘法节点、一个加法节点。参数以向量形式接入，再经过通道裁剪后参与运算。

<p class="caption">代码 6-1 UV 变换的节点连接（节选）</p>
```text
TexCoord ──▶ Multiply(A) ──▶ Add(A) ──▶ TextureSample.UVs
                 ▲              ▲
                 │(B)           │(B)
        UVTiling ─┴─ Mask(RG)   │
        UVOffset ───────────────┴─ Mask(RG)
```

链条的语义十分直接：先按 Tiling 缩放原始纹理坐标，再按 Offset 平移，结果送入纹理采样的坐标输入。节点顺序不可交换——先平移后缩放会得到 <span class="eq">(UV + Offset) × Tiling</span>，与目标式 <span class="eq">UV × Tiling + Offset</span> 不等价。

**参数为什么用向量类型。** `UVTiling` 与 `UVOffset` 各自需要两个分量（u、v），声明为向量参数后，一组数值可以在细节面板上一次填完，且在材质实例中作为整体被覆盖。若改用两个标量参数，参数数量翻倍，实例侧需要维护的条目也随之翻倍。

**为什么必须做通道裁剪。** 向量参数的默认通道数是四（RGBA），而纹理坐标只有两个通道。UE 的算术节点要求两侧通道数一致，直接相连会在材质编译时得到类型错误：

<p class="caption">代码 6-2 通道数不匹配时的编译诊断</p>
```text
SM6 (Node Multiply) Arithmetic between types float2 and float3 are undefined
```

这条报错的字面含义是“两个操作数的通道数不同，且不存在这样的算术定义”。它的成因有三种可能，需要逐个排查：一是向量参数本身是四通道；二是向量参数后接了通道裁剪节点，但裁剪后仍保留了三个通道（例如 B 通道未关闭），输出为 `float3`；三是未做裁剪而直接用四通道参数参与运算。把裁剪节点配置为**只保留 R 与 G**（B、A 均关闭）后，两侧都是 `float2`，运算即可成立。

该问题的排查路径值得说明：错误信息只给出节点名与两个类型，并不指出哪一侧“多余”。实际定位时，需要检查裁剪节点的通道勾选状态——它决定了输出通道数，而在细节面板中，多勾一个通道并不会立即报错，直到该节点的下游参与算术运算才暴露。

**为什么在材质实例中调参，而不是修改材质本体。** 母材质负责“有哪些参数、节点如何连接”，材质实例负责“这些参数取什么值”。两者分离带来三点收益：其一，一份母材质配多个实例即可表达任意数量的碎片，不需要复制节点网络；其二，实例只覆盖被显式勾选的参数，其余参数继续继承母材质，因此调整母材质中的公共逻辑会自动传播到全部实例；其三，实例是轻量资产，复制与改名不涉及图结构，新增一个碎片的表现成本接近于零。

### 6.3 承载方式的选择：贴画与网格体

碎片的载体在实现上并不唯一：可以是贴合表面的贴画组件（`UDecalComponent`），也可以是独立的网格体组件（`UStaticMeshComponent`，例如一块平板）。前者沿表面弯曲、天然贴合柱面与墙面；后者是一个独立几何体，位置与朝向完全自由，可用于悬浮碎片。

系统不要求所有碎片采用同一种载体，因此在初始化时按组件类型**分支处理**：

<p class="caption">代码 6-3 材质缓存的承载分支与优先级（节选，末尾的日志输出已省略）</p>
```cpp
void APerspectivePuzzleManager::CacheFragmentMaterials()
{
    FragmentMaterials.Empty();

    for (AActor* Actor : FragmentActors)
    {
        UMaterialInstanceDynamic* DynMat = nullptr;

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

这段分支逻辑包含三层判定，每层都有明确的语义。

**第一层是载体优先级。** `FindComponentByClass<UDecalComponent>()` 在 Actor 的组件集合中查找指定类型的组件，找不到时返回空指针。分支采用 `if / else if` 而非两个并列的 `if`，因此**贴画优先于网格体**：当一个 Actor 同时挂载了两种组件时，只有贴画会被处理，网格体分支不会执行。这一优先级与视觉语义一致——贴画是显式声明“此处用于贴合展示”的组件，而网格体是通用组件，可能仅作为碰撞体或占位体存在。

**第二层是材质是否存在。** 贴画分支内部还有一次判空：`GetDecalMaterial()` 在未指定材质时返回空指针。此处的处理方式是“不创建动态实例”，而不是中断或报错，使未配置材质的碎片被安静跳过。

**第三层是空项容忍。** 无论走哪个分支，`DynMat` 最后都会被压入 `FragmentMaterials`，即使它仍为空指针。这保证了 `FragmentMaterials` 与 `FragmentActors` **严格等长且按下标一一对应**：索引 i 的材质项永远对应索引 i 的碎片。数组因此可以在需要时按索引关联回碎片，也避免了在下游用“跳过计数”的方式推算对应关系。空项由写入端容忍——发光循环在调用前检查指针是否为空。

<p class="caption">表 6-2 两种承载方式的对照</p>

| 维度 | 贴画（`UDecalComponent`） | 网格体（`UStaticMeshComponent`） |
| --- | --- | --- |
| 几何行为 | 投影盒沿表面贴合，图案随表面起伏弯曲 | 独立平面，不随表面弯曲 |
| 材质取用 | `GetDecalMaterial()` 取当前材质，替换需显式回写 | 直接按材质元素索引创建并设置 |
| 动态实例创建 | 三步：取材质 → 创建实例 → 回写组件 | 一步：`CreateAndSetMaterialInstanceDynamic(0)` |
| 摆放自由度 | 受投影方向与深度限制，需避免投影溢出到相邻表面 | 位置与朝向完全自由，可悬浮 |
| 材质域要求 | 必须使用 `Deferred Decal` 域，混合模式受限 | 使用常规表面材质域，混合模式自由 |
| 适用场景 | 图案需贴在柱面、墙面等既有表面上 | 图案需悬浮于空中，或需要精确控制朝向 |

贴画分支的三步写法还有一个版本相关的理由。网格体组件提供了“创建并设置”的合并接口，贴画组件在 UE 5.8 中并没有等价的一步式调用：按网格体的习惯传入材质索引会得到编译错误 `C2660 "UDecalComponent::CreateDynamicMaterialInstance": 函数不接受 1 个参数`。取材质、创建实例、回写组件这三步虽然更长，但不依赖该组件特有的便捷接口，跨版本更稳定。

选择贴画路线时还需注意材质域的限制：`Deferred Decal` 域只接受有限的混合模式，使用常规域材质会直接编译失败，提示信息列出了允许的混合模式集合（`TranslucentGreyTransmittance`、`TranslucentColorTransmittance`、`AlphaComposite`、`ColoredTransmittanceOnly`）。本方案采用 `Translucent`，配合深色背景贴图实现“只显示图案本身”的效果。

### 6.4 动态材质实例

材质参数有两类存在形式：资产中保存的材质实例（含母材质）其参数值是**静态**的，作为资产数据被序列化；只有运行时创建的**动态材质实例**（`UMaterialInstanceDynamic`）才提供写入接口。使用 `SetScalarParameterValue` 之类的方法改变参数，前提是目标必须是动态实例，否则调用无从作用于渲染。

因此系统在初始化阶段一次性建立动态实例，并在整个运行期复用：

<p class="caption">代码 6-4 动态实例的保存与后续写入（节选）</p>
```cpp
    //每个碎片对应的动态材质实例（用于控制发光） 
    UPROPERTY(Transient)
    TArray<UMaterialInstanceDynamic*> FragmentMaterials;
```

该数组被标记为 `Transient`，即不参与序列化：动态实例是运行时对象，没有必要写入存档，也不应在关卡加载时被反序列化。数组的元素类型为裸指针而非智能指针，其生命周期由组件侧的引用保证——每个实例在创建后立即被回写到对应的贴画或网格体组件上，组件持有引用即意味着实例不会被提前回收。

**创建时机被安排在初始化阶段，而不是判定循环中。** 判定循环以固定间隔反复执行，若在其中创建材质实例，每次采样都会产生一批新对象，既浪费内存也会失去“参数可在帧间累积”的前提——发光参数的写入依赖同一个实例被持续复用。把创建集中在 `CacheFragmentMaterials()` 中执行一次，后续只做写入，是整个发光链路能够平滑连续的前提。

两条创建路径的差异值得单独说明：

- **网格体路径**：`CreateAndSetMaterialInstanceDynamic(0)` 一步完成“创建实例并将它设置到第 0 个材质元素”。参数 0 表示材质元素索引，网格体可以有多个材质槽，此处固定使用第一个。
- **贴画路径**：先 `GetDecalMaterial()` 取得当前材质接口，再 `UMaterialInstanceDynamic::Create(DecalMat, Decal)` 以该材质为母本创建实例，第二个参数指定外层对象（Owner），最后 `SetDecalMaterial(DynMat)` 把实例回写到组件。若不执行最后一步，实例虽然存在却不会被渲染使用——这是该路径最容易遗漏的一环。

### 6.5 发光反馈

发光反馈把判定进度映射为材质参数，再由材质把参数映射为亮度。整条链路跨越 C++ 与材质两个领域，接口只有一个标量参数。

C++ 侧在每次采样结束时写入：

<p class="caption">代码 6-5 发光参数的写入（节选）</p>
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

参数名由 `GlowParameterName` 决定，默认值为 `GlowIntensity`。它被设计为可编辑属性，是为了让材质侧的命名不被 C++ 写死；而当该属性被置为空名（`NAME_None`）时，整段发光逻辑被跳过，系统退化为“无视觉反馈”的纯判定模式。

写入值 `GlowValue` 的取值规则是**渐进语义**：处于对齐状态时取当前进度 `SolveProgress`，否则取 0。进度本身由保持时长归一化而来（<span class="eq">clamp(HoldTimer / HoldDuration, 0, 1)</span>），因此发光强度与“玩家已经正确保持了多久”成正比；一旦失去对齐，`SolveProgress` 被清零，发光随之熄灭。玩家因此可以从亮度直接读出进度，而不必依赖额外 UI。

材质侧把该标量转换为自发光亮度：

<figure>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="26 26 598 558" width="100%" role="img"><g><g/><g transform="translate(0,0) scale(1)"><g style="visibility: visible;"><rect x="300" y="40" width="190" height="60" rx="9" ry="9" fill="#ffffff" stroke="#000000" pointer-events="all" style="fill: light-dark(#ffffff, var(--ge-dark-color, #121212)); stroke: light-dark(rgb(0, 0, 0), rgb(255, 255, 255));"/></g><g style=""><g><foreignObject style="overflow: visible; text-align: left;" pointer-events="none" x="-9699" y="-9930" width="20186" height="20056"><div xmlns="http://www.w3.org/1999/xhtml" style="display: flex; align-items: unsafe center; justify-content: unsafe center; width: 188px; height: 1px; padding-top: 10000px; margin-left: 10000px;"><div style="box-sizing: border-box; font-size: 0; text-align: center; color: #000000; "><div style="display: inline-block; font-size: 12px; font-family: Helvetica; color: light-dark(#000000, #ffffff); line-height: 1.2; pointer-events: all; white-space: normal; word-wrap: normal; ">GlowIntensity<br />标量参数 0 → 1</div></div></div></foreignObject></g></g><g style="visibility: visible;"><rect x="300" y="140" width="190" height="60" rx="9" ry="9" fill="#ffffff" stroke="#000000" pointer-events="all" style="fill: light-dark(#ffffff, var(--ge-dark-color, #121212)); stroke: light-dark(rgb(0, 0, 0), rgb(255, 255, 255));"/></g><g style=""><g><foreignObject style="overflow: visible; text-align: left;" pointer-events="none" x="-9699" y="-9830" width="20186" height="20056"><div xmlns="http://www.w3.org/1999/xhtml" style="display: flex; align-items: unsafe center; justify-content: unsafe center; width: 188px; height: 1px; padding-top: 10000px; margin-left: 10000px;"><div style="box-sizing: border-box; font-size: 0; text-align: center; color: #000000; "><div style="display: inline-block; font-size: 12px; font-family: Helvetica; color: light-dark(#000000, #ffffff); line-height: 1.2; pointer-events: all; white-space: normal; word-wrap: normal; ">Multiply × K<br />K 为发光倍数</div></div></div></foreignObject></g></g><g style="visibility: visible;"><rect x="300" y="240" width="190" height="60" rx="9" ry="9" fill="#ffffff" stroke="#000000" pointer-events="all" style="fill: light-dark(#ffffff, var(--ge-dark-color, #121212)); stroke: light-dark(rgb(0, 0, 0), rgb(255, 255, 255));"/></g><g style=""><g><foreignObject style="overflow: visible; text-align: left;" pointer-events="none" x="-9699" y="-9730" width="20186" height="20056"><div xmlns="http://www.w3.org/1999/xhtml" style="display: flex; align-items: unsafe center; justify-content: unsafe center; width: 188px; height: 1px; padding-top: 10000px; margin-left: 10000px;"><div style="box-sizing: border-box; font-size: 0; text-align: center; color: #000000; "><div style="display: inline-block; font-size: 12px; font-family: Helvetica; color: light-dark(#000000, #ffffff); line-height: 1.2; pointer-events: all; white-space: normal; word-wrap: normal; ">Add + 1<br />零点保持原亮度</div></div></div></foreignObject></g></g><g style="visibility: visible;"><rect x="300" y="340" width="190" height="60" rx="9" ry="9" fill="#ffffff" stroke="#000000" pointer-events="all" style="fill: light-dark(#ffffff, var(--ge-dark-color, #121212)); stroke: light-dark(rgb(0, 0, 0), rgb(255, 255, 255));"/></g><g style=""><g><foreignObject style="overflow: visible; text-align: left;" pointer-events="none" x="-9699" y="-9630" width="20186" height="20056"><div xmlns="http://www.w3.org/1999/xhtml" style="display: flex; align-items: unsafe center; justify-content: unsafe center; width: 188px; height: 1px; padding-top: 10000px; margin-left: 10000px;"><div style="box-sizing: border-box; font-size: 0; text-align: center; color: #000000; "><div style="display: inline-block; font-size: 12px; font-family: Helvetica; color: light-dark(#000000, #ffffff); line-height: 1.2; pointer-events: all; white-space: normal; word-wrap: normal; ">Multiply<br />与贴图 RGB 相乘</div></div></div></foreignObject></g></g><g style="visibility: visible;"><rect x="300" y="440" width="190" height="60" rx="9" ry="9" fill="#f5f5f5" stroke="#333333" pointer-events="all" style="fill: light-dark(rgb(245, 245, 245), rgb(26, 26, 26)); stroke: light-dark(rgb(51, 51, 51), rgb(193, 193, 193));"/></g><g style=""><g><foreignObject style="overflow: visible; text-align: left;" pointer-events="none" x="-9699" y="-9530" width="20186" height="20056"><div xmlns="http://www.w3.org/1999/xhtml" style="display: flex; align-items: unsafe center; justify-content: unsafe center; width: 188px; height: 1px; padding-top: 10000px; margin-left: 10000px;"><div style="box-sizing: border-box; font-size: 0; text-align: center; color: #000000; "><div style="display: inline-block; font-size: 12px; font-family: Helvetica; color: light-dark(#000000, #ffffff); line-height: 1.2; pointer-events: all; white-space: normal; word-wrap: normal; ">Emissive<br />自发光输出</div></div></div></foreignObject></g></g><g style="visibility: visible;"><rect x="40" y="340" width="180" height="60" rx="9" ry="9" fill="#ffffff" stroke="#000000" pointer-events="all" style="fill: light-dark(#ffffff, var(--ge-dark-color, #121212)); stroke: light-dark(rgb(0, 0, 0), rgb(255, 255, 255));"/></g><g style=""><g><foreignObject style="overflow: visible; text-align: left;" pointer-events="none" x="-9959" y="-9630" width="20176" height="20056"><div xmlns="http://www.w3.org/1999/xhtml" style="display: flex; align-items: unsafe center; justify-content: unsafe center; width: 178px; height: 1px; padding-top: 10000px; margin-left: 10000px;"><div style="box-sizing: border-box; font-size: 0; text-align: center; color: #000000; "><div style="display: inline-block; font-size: 12px; font-family: Helvetica; color: light-dark(#000000, #ffffff); line-height: 1.2; pointer-events: all; white-space: normal; word-wrap: normal; ">TextureSample.RGB<br />图案原色</div></div></div></foreignObject></g></g><g style="visibility: visible;"><rect x="40" y="530" width="570" height="40" fill="none" stroke="white" pointer-events="stroke" visibility="hidden" stroke-width="19" vector-effect="non-scaling-stroke"/><rect x="40" y="530" width="570" height="40" fill="none" stroke="none" pointer-events="all"/></g><g style=""><g><foreignObject style="overflow: visible; text-align: left;" pointer-events="none" x="-9958" y="-9450" width="20566" height="20036"><div xmlns="http://www.w3.org/1999/xhtml" style="display: flex; align-items: unsafe center; justify-content: unsafe flex-start; width: 1px; height: 1px; padding-top: 10000px; margin-left: 10000px;"><div style="box-sizing: border-box; font-size: 0; text-align: left; color: #555555; "><div style="display: inline-block; font-size: 11px; font-family: Helvetica; color: light-dark(#555555, #a4a4a4); line-height: 1.2; pointer-events: all; white-space: nowrap; ">标量参数由 CheckPuzzle 每次采样写入：对齐时取 SolveProgress，失焦时写 0。<br />K 决定动态范围；加 1 保证参数为 0 时自发光等于贴图原色，而不是全黑。</div></div></div></foreignObject></g></g><g style="visibility: visible;"><path d="M 395 100 L 395 131.88" fill="none" stroke="white" stroke-miterlimit="10" pointer-events="stroke" style="stroke: light-dark(rgb(51, 51, 51), rgb(193, 193, 193));" visibility="hidden" stroke-width="19" vector-effect="non-scaling-stroke"/><path d="M 395 100 L 395 131.88" fill="none" stroke="#333333" stroke-miterlimit="10" pointer-events="stroke" style="stroke: light-dark(rgb(51, 51, 51), rgb(193, 193, 193));"/><path d="M 395 138.88 L 391.5 131.88 L 398.5 131.88 Z" fill="#333333" stroke="#333333" stroke-miterlimit="10" pointer-events="all" style="fill: light-dark(rgb(51, 51, 51), rgb(193, 193, 193)); stroke: light-dark(rgb(51, 51, 51), rgb(193, 193, 193));"/></g><g style="visibility: visible;"><path d="M 395 200 L 395 231.88" fill="none" stroke="white" stroke-miterlimit="10" pointer-events="stroke" style="stroke: light-dark(rgb(51, 51, 51), rgb(193, 193, 193));" visibility="hidden" stroke-width="19" vector-effect="non-scaling-stroke"/><path d="M 395 200 L 395 231.88" fill="none" stroke="#333333" stroke-miterlimit="10" pointer-events="stroke" style="stroke: light-dark(rgb(51, 51, 51), rgb(193, 193, 193));"/><path d="M 395 238.88 L 391.5 231.88 L 398.5 231.88 Z" fill="#333333" stroke="#333333" stroke-miterlimit="10" pointer-events="all" style="fill: light-dark(rgb(51, 51, 51), rgb(193, 193, 193)); stroke: light-dark(rgb(51, 51, 51), rgb(193, 193, 193));"/></g><g style="visibility: visible;"><path d="M 395 300 L 395 331.88" fill="none" stroke="white" stroke-miterlimit="10" pointer-events="stroke" style="stroke: light-dark(rgb(51, 51, 51), rgb(193, 193, 193));" visibility="hidden" stroke-width="19" vector-effect="non-scaling-stroke"/><path d="M 395 300 L 395 331.88" fill="none" stroke="#333333" stroke-miterlimit="10" pointer-events="stroke" style="stroke: light-dark(rgb(51, 51, 51), rgb(193, 193, 193));"/><path d="M 395 338.88 L 391.5 331.88 L 398.5 331.88 Z" fill="#333333" stroke="#333333" stroke-miterlimit="10" pointer-events="all" style="fill: light-dark(rgb(51, 51, 51), rgb(193, 193, 193)); stroke: light-dark(rgb(51, 51, 51), rgb(193, 193, 193));"/></g><g style="visibility: visible;"><path d="M 395 400 L 395 431.88" fill="none" stroke="white" stroke-miterlimit="10" pointer-events="stroke" style="stroke: light-dark(rgb(51, 51, 51), rgb(193, 193, 193));" visibility="hidden" stroke-width="19" vector-effect="non-scaling-stroke"/><path d="M 395 400 L 395 431.88" fill="none" stroke="#333333" stroke-miterlimit="10" pointer-events="stroke" style="stroke: light-dark(rgb(51, 51, 51), rgb(193, 193, 193));"/><path d="M 395 438.88 L 391.5 431.88 L 398.5 431.88 Z" fill="#333333" stroke="#333333" stroke-miterlimit="10" pointer-events="all" style="fill: light-dark(rgb(51, 51, 51), rgb(193, 193, 193)); stroke: light-dark(rgb(51, 51, 51), rgb(193, 193, 193));"/></g><g style="visibility: visible;"><path d="M 220 370 L 291.88 370" fill="none" stroke="white" stroke-miterlimit="10" pointer-events="stroke" style="stroke: light-dark(rgb(51, 51, 51), rgb(193, 193, 193));" visibility="hidden" stroke-width="19" vector-effect="non-scaling-stroke"/><path d="M 220 370 L 291.88 370" fill="none" stroke="#333333" stroke-miterlimit="10" pointer-events="stroke" style="stroke: light-dark(rgb(51, 51, 51), rgb(193, 193, 193));"/><path d="M 298.88 370 L 291.88 373.5 L 291.88 366.5 Z" fill="#333333" stroke="#333333" stroke-miterlimit="10" pointer-events="all" style="fill: light-dark(rgb(51, 51, 51), rgb(193, 193, 193)); stroke: light-dark(rgb(51, 51, 51), rgb(193, 193, 193));"/></g></g><g/><g/></g></svg>
<figcaption>图 6-2 发光链路：标量参数经放大与偏置后调制贴图颜色，输出到自发光</figcaption>
</figure>

链条中两个常数各有明确职责。乘数 K 决定**动态范围**：参数从 0 变到 1 时，亮度在 <span class="eq">1</span> 与 <span class="eq">1 + K</span> 之间变化，取 K = 6 时对应 7 倍亮度；K 是纯调参量，效果不足时可增大到 15 或 30，链条结构不变。加数 1 则保证**零点语义**：参数为 0 时自发光等于贴图原色，图案保持正常外观，而不是完全熄灭。若省略该偏置，未对齐状态下图案会变成全黑。

**发光接自发光通道而不是基础色，是这条链路的关键选择。** 基础色参与光照着色计算，提高基础色只会让图案“更亮更白”，颜色被稀释，观感是漂洗而非发光；自发光则是直接叠加到最终亮度的独立项，提高它不会改变图案的色相，只是让同一颜色变得更耀眼，观感与光源一致。

自发光之外还需要一道后处理才能形成“光晕”：自发光本身只提供亮度，扩散感来自泛光（Bloom）。实现方式是在场景中放置一个后处理体积并勾选无限范围（Unbound），将 Bloom Intensity 调到约 <span class="eq">1.5 ~ 3</span>。缺少这一步时，图案会“变亮”但不会“发光”——这是发光反馈在观感上不达预期时首要检查的环节。

### 6.6 视觉方案的取舍

实现“碎片拼合后发光”至少有三条技术路线，它们在可控性、实现成本与最终效果上各有取舍。

<p class="caption">表 6-3 三种视觉路线的对照</p>

| 维度 | 材质实例 + 贴画/网格体（本方案） | 真实投影（聚光灯投影贴图） | 屏幕空间叠加 |
| --- | --- | --- | --- |
| 图案来源 | 单张贴图按 UV 子区域取样 | 光源的投影贴图 | 屏幕坐标下的图像合成 |
| 拆分方式 | 每个碎片一个材质实例，改 Tiling/Offset | 每个投影光源一张投影贴图 | 需要按视口尺寸重算位置 |
| 视差来源 | 碎片本身的纵深差（真实三维位置） | 投影距离差 | 需人为模拟，依赖视口参数 |
| 数量扩展成本 | 低：复制实例改两个向量参数 | 高：每个投影需独立资源与光源 | 中：需维护屏幕空间布局逻辑 |
| 参数可控性 | 高：任意标量/向量参数可在运行时写入 | 中：受光源属性限制 | 中：受渲染管线阶段限制 |
| 与判定系统的耦合 | 松：仅通过一个标量参数名关联 | 中：需同步光源参数 | 紧：依赖相机视口分辨率与宽高比 |
| 主要限制 | 贴画路线受 `Deferred Decal` 材质域与混合模式约束 | 效果接近投影仪，几何贴合不如贴画自然 | 分辨率相关，改变视口即需重算 |

本方案选择第一条路线，理由集中在三点。其一是**拆分成本与碎片数量解耦**：图案只保留一份源贴图，新增碎片只增加一个材质实例，不增加图像资源。其二是**反馈通道简单**：视觉层与判定层之间只有一个标量参数，双方可以独立修改——材质侧调整链条结构或常数不影响 C++，C++ 侧改变写入曲线也不影响材质。其三是**视差来源真实**：碎片处于真实的三维位置，视差由透视投影自然产生，不需要在屏幕空间模拟。

其代价也很明确：贴画路线的材质域被限定为 `Deferred Decal`，混合模式与可用的着色模型都受到约束，图案的最终观感受表面法线与投影方向影响；网格体路线虽无此约束，却失去了“自动贴合表面”的能力，需要人工把平面摆到与目标表面几乎重合的位置。

### 6.7 小结

- 图案拆分在纹理坐标层面完成：所有碎片共用一张源贴图，每个碎片用一组 `Tiling` 与 `Offset` 声明取样窗口，拆分块数变化时不需要重新制作图像资源。
- 材质侧的 UV 变换是“先缩放、后平移”的两步链条，顺序不可交换；参数以向量形式声明后再裁剪为双通道，否则会因通道数不一致触发 `float2` 与 `float3` 不可运算的编译错误。
- 参数值放在材质实例而非母材质中：母材质定义参数与拓扑，实例只覆盖数值，新增碎片因此只需复制实例。
- 碎片载体在贴画与网格体之间分支处理，`if / else if` 的顺序使贴画具有优先级；材质数组与碎片列表严格等长同序，空项由写入端容忍，因此单个碎片配置缺失不会破坏索引关系。
- 动态材质实例在初始化阶段一次性创建并持续复用，是运行时可写参数的前提；贴画路线需要“取材质、创建实例、回写组件”三步，缺一不可。
- 发光通过单个标量参数驱动自发光通道，参数值取“对齐时按进度、失焦时归零”，并配合泛光形成光晕；接到基础色只会造成颜色漂洗，不产生发光观感。

