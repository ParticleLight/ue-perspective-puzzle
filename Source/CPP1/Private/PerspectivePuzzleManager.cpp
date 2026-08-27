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

void APerspectivePuzzleManager::Tick(float DeltaTime)
{
	Super::Tick(DeltaTime);
}


// 标定：记录每个碎片到标定位置的方向和距离

void APerspectivePuzzleManager::Calibrate()
{
	CalibratedData.Empty();
	// 标定原点 = Manager 位置抬升到相机高度
	CalibratedOrigin = GetActorLocation() + FVector(0, 0, CameraHeightOffset);

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

	UE_LOG(LogTemp, Log, TEXT("Calibrate: %d points recorded, view target %s"), CalibratedData.Num(), *CalibratedViewTarget.ToString());
}


// 为每个碎片创建动态材质实例，供发光控制

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

	UE_LOG(LogTemp, Log, TEXT("CacheFragmentMaterials: %d materials cached"), FragmentMaterials.Num());
}


// 重置解密状态

void APerspectivePuzzleManager::ResetPuzzle()
{
	bIsSolved = false;
	bWasAligned = false;
	HoldTimer = 0.0f;
	SolveProgress = 0.0f;

	GetWorldTimerManager().ClearTimer(DetectionTimerHandle);
	GetWorldTimerManager().SetTimer(DetectionTimerHandle, this, &APerspectivePuzzleManager::CheckPuzzle, DetectionInterval, true);
}


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


// 核心：检测玩家是否在正确位置

void APerspectivePuzzleManager::CheckPuzzle()
{
	if (bIsSolved || CalibratedData.Num() == 0) return;

	APlayerController* PC = UGameplayStatics::GetPlayerController(GetWorld(), 0);
	if (!PC || !PC->PlayerCameraManager) return;

	FVector CamLoc;
	FRotator CamRot;
	PC->GetPlayerViewPoint(CamLoc, CamRot);
	FVector CamForward = CamRot.Vector();

	// 调试：玩家相机位置 vs 标定位置
	UE_LOG(LogTemp, Log, TEXT("Cam=%s Origin=%s Offset=%.1f"),
		*CamLoc.ToString(), *CalibratedOrigin.ToString(),
		FVector::Dist(CamLoc, CalibratedOrigin));

	// 朝向检测：玩家视线是否对准图案中心方向（独立于单个碎片）
	FVector ViewTargetDir = (CalibratedViewTarget - CalibratedOrigin).GetSafeNormal();
	float ViewDot = FVector::DotProduct(CamForward, ViewTargetDir);
	bool bViewMatch = (ViewDot >= ViewAngleThreshold);

	// 调试射线：红色 = 玩家当前视线，绿色 = 目标视线方向
	const float DebugRayLen = 200.0f;
	DrawDebugLine(GetWorld(), CamLoc, CamLoc + CamForward * DebugRayLen,
		FColor::Red, false, DetectionInterval * 2.0f, 0, 2.0f);
	DrawDebugLine(GetWorld(), CalibratedOrigin, CalibratedOrigin + ViewTargetDir * DebugRayLen,
		FColor::Green, false, DetectionInterval * 2.0f, 0, 2.0f);

	int32 PassCount = 0;

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

	// 位置对齐 + 视线对准图案中心 都满足才算对齐
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

	// 更新碎片发光：对齐时随 SolveProgress 逐渐增强，失焦时归零
	if (GlowParameterName != NAME_None)
	{
		float GlowValue = bAlignedNow ? SolveProgress : 0.0f;
		for (UMaterialInstanceDynamic* DynMat : FragmentMaterials)
		{
			if (DynMat) DynMat->SetScalarParameterValue(GlowParameterName, GlowValue);
		}
	}

	bWasAligned = bAlignedNow;
}
