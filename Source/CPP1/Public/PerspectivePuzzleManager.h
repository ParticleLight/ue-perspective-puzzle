// Fill out your copyright notice in the Description page of Project Settings.

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "PerspectivePuzzleManager.generated.h"

class UMaterialInstanceDynamic;


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

UCLASS()
class CPP1_API APerspectivePuzzleManager : public AActor
{
    GENERATED_BODY()

public:
    APerspectivePuzzleManager();

    //碎片列表——拖入场景中所有的碎片 Actor（Decal / 任意 Actor） 
    UPROPERTY(EditAnywhere, Category = "Puzzle")
    TArray<AActor*> FragmentActors;

    //相机高度偏移——Manager 放地面，标定时自动抬升到玩家眼睛高度 
    UPROPERTY(EditAnywhere, Category = "Puzzle", meta = (ClampMin = 0.0f))
    float CameraHeightOffset = 160.0f;

    //对齐时控制的材质发光参数名,碎片材质需暴露该标量参数，空则跳过 
    UPROPERTY(EditAnywhere, Category = "Puzzle")
    FName GlowParameterName = TEXT("GlowIntensity");

    // ===== 检测参数 =====

    //方向容差 cos(角度)，默认 cos(5°) ≈ 0.996 
    UPROPERTY(EditAnywhere, Category = "Detection", meta = (ClampMin = 0.9, ClampMax = 1.0))
    float DotProductThreshold = 0.996f;

    //视线方向容差——玩家必须看向碎片方向才算对齐，防止低头/转头仍触发 
    UPROPERTY(EditAnywhere, Category = "Detection", meta = (ClampMin = 0.9, ClampMax = 1.0))
    float ViewAngleThreshold = 0.996f;

    // 距离容差（世界单位） 
    UPROPERTY(EditAnywhere, Category = "Detection", meta = (ClampMin = 0.0f))
    float DistanceTolerance = 50.0f;

    //通过比例——多少碎片对齐算成功 
    UPROPERTY(EditAnywhere, Category = "Detection", meta = (ClampMin = 0.0, ClampMax = 1.0))
    float RequiredPassRate = 0.8f;

    //保持对齐时间（秒） 
    UPROPERTY(EditAnywhere, Category = "Detection", meta = (ClampMin = 0.0f))
    float HoldDuration = 1.5f;

    //检测间隔（秒） 
    UPROPERTY(EditAnywhere, Category = "Detection", meta = (ClampMin = 0.05f))
    float DetectionInterval = 0.1f;

protected:
    virtual void BeginPlay() override;

public:
    virtual void Tick(float DeltaTime) override;

    UPROPERTY(BlueprintReadOnly, Category = "State")
    bool bIsSolved = false;

    UPROPERTY(BlueprintReadOnly, Category = "State")
    float SolveProgress = 0.0f;

    UFUNCTION(BlueprintCallable, Category = "Puzzle", meta = (CallInEditor = "true"))
    void Calibrate();

    UFUNCTION(BlueprintCallable, Category = "Puzzle")
    void ResetPuzzle();

    UFUNCTION(BlueprintCallable, Category = "Debug", meta = (CallInEditor = "true"))
    void DrawDebugCalibration(float Duration = 5.0f) const;

    // （在蓝图中实现） 

    UFUNCTION(BlueprintImplementableEvent, Category = "Events")
    void OnPuzzleSolved();

    UFUNCTION(BlueprintImplementableEvent, Category = "Events")
    void OnViewAligned();

    UFUNCTION(BlueprintImplementableEvent, Category = "Events")
    void OnViewLost();

    UFUNCTION(BlueprintImplementableEvent, Category = "Events")
    void OnProgressUpdated(float Progress);

protected:
    TArray<FCalibratedMarkPoint> CalibratedData;
    float HoldTimer = 0.0f;
    bool bWasAligned = false;
    mutable TObjectPtr<class APlayerController> CachedPC;
    FVector CalibratedOrigin;

    //标定时算出的图案中心（所有碎片的几何中心）——视线检测的参考点 
    FVector CalibratedViewTarget;
    FTimerHandle DetectionTimerHandle;
    void CheckPuzzle();

    //每个碎片对应的动态材质实例（用于控制发光） 
    UPROPERTY(Transient)
    TArray<UMaterialInstanceDynamic*> FragmentMaterials;

    //为每个碎片创建动态材质实例，供发光控制 
    void CacheFragmentMaterials();
};
