// src/components/FarmWorld.tsx
import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { FarmScene } from './3d/FarmScene';
import { HarvestSelection } from './3d/HarvestSelection';
import {
  DroneAutoHarvest,
  type DroneMode,
  type DroneAltitude,
} from './3d/DroneAutoHarvest';
import { BuildUI } from './ui/BuildUI';
import { TopHUD } from './ui/TopHUD';
import { BottomDock } from './ui/BottomDock';
import { NearHousePromptOverlay } from './ui/NearHousePromptOverlay';
import { PondFishingPrompt } from './ui/PondFishingPrompt';
import { FishingOverlay } from './ui/FishingOverlay';
import { FarmStatusOverlays } from './ui/FarmStatusOverlays';
import { FarmModalsOverlay } from './ui/FarmModalsOverlay';
import { useFloatingNotices } from '../hooks/useFloatingNotices';
import { useFarmEconomy } from '../hooks/useFarmEconomy';
import { useFarmPlots } from '../hooks/useFarmPlots';
import { useFarmTrees } from '../hooks/useFarmTrees';
import { useFarmPlacement } from '../hooks/useFarmPlacement';
import { useFarmWorldHandlers } from '../hooks/useFarmWorldHandlers';

// ✅ World Travel (สะพานปลาหัวหิน) — M01
import { useWorldTravel } from './world-travel/WorldTravelGateway';
import { FishBridgeWorldOverlay, TravelToFishBridgeButton } from './world-travel/WorldTravelUI';
import { SeafoodFarmSellPanel } from './world-travel/VendorTradeUI';
import { WORLD_IDS } from '../core/world/WorldRegistry';

// ✅ Aspect Ratio System
import {
  ASPECT_RATIO_OPTIONS,
  getSavedAspectRatioMode,
  saveAspectRatioMode,
  getNextAspectRatioMode,
  getAspectRatioLabel,
  type AspectRatioMode,
} from '../types/aspectRatio';

import { getCurrentLang } from '../i18n/translations';

interface FarmWorldProps {
  onResetGameSession?: () => void;
  isFreshReset?: boolean;
}

export const FarmWorld: React.FC<FarmWorldProps> = ({
  onResetGameSession,
  isFreshReset = false,
}) => {
  const { floatingTexts, addNotice } = useFloatingNotices();
  const travel = useWorldTravel(() =>
    addNotice(
      getCurrentLang() === 'th' ? '⚠️ โหลดสะพานปลาไม่สำเร็จ กลับฟาร์มแล้ว' : '⚠️ Fish Bridge failed to load — back to farm',
      '#f59e0b'
    )
  );
  const [nearHuaHinSign, setNearHuaHinSign] = React.useState(false);
  const economy = useFarmEconomy(addNotice);
  const farmPlots = useFarmPlots(addNotice);
  const farmTrees = useFarmTrees(addNotice);
  const placement = useFarmPlacement(
    addNotice,
    undefined,
    farmPlots.unlockedZones.includes(5)
  );

  /* ═══════════════════════════════════════════════
     ✅ DRONE STATE (mode + altitude)
     ═══════════════════════════════════════════════ */
  const [droneMode, setDroneMode] = useState<DroneMode>('AUTO');
  const [droneAltitude, setDroneAltitude] = useState<DroneAltitude>('GROUND');

  /* ═══════════════════════════════════════════════
     ✅ ASPECT RATIO STATE
     ═══════════════════════════════════════════════ */
  const [aspectRatioMode, setAspectRatioMode] = useState<AspectRatioMode>(() =>
    getSavedAspectRatioMode()
  );
  const [isCompactDevice, setIsCompactDevice] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return (
      window.innerWidth <= 840 ||
      window.matchMedia('(pointer: coarse)').matches
    );
  });

  useEffect(() => {
    const onResize = () => {
      setIsCompactDevice(
        window.innerWidth <= 840 ||
          window.matchMedia('(pointer: coarse)').matches
      );
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const handleChangeAspectRatioMode = useCallback(
    (mode: AspectRatioMode) => {
      setAspectRatioMode(mode);
      saveAspectRatioMode(mode);
    },
    []
  );

  const handleCycleAspectRatioMode = useCallback(() => {
    setAspectRatioMode((cur) => {
      const next = getNextAspectRatioMode(cur);
      saveAspectRatioMode(next);
      const label = getAspectRatioLabel(next);
      addNotice(
        getCurrentLang() === 'th'
          ? `${label.icon} สัดส่วนหน้าจอ: ${label.th}`
          : `${label.icon} Aspect ratio: ${label.en}`,
        '#38bdf8'
      );
      return next;
    });
  }, [addNotice]);

  const { isFramed, frameContainerStyle } = useMemo(() => {
    const opt = ASPECT_RATIO_OPTIONS.find((o) => o.mode === aspectRatioMode);
    const ratio = opt?.ratio ?? null;

    const shouldFrame =
      aspectRatioMode === 'auto' ? !isCompactDevice : aspectRatioMode !== 'full';

    if (!shouldFrame) {
      return { isFramed: false, frameContainerStyle: {} as React.CSSProperties };
    }

    const effectiveRatio = aspectRatioMode === 'auto' ? 18 / 9 : ratio ?? 18 / 9;

    const style: React.CSSProperties = {
      width: `min(100%, calc(100dvh * ${effectiveRatio}))`,
      aspectRatio: String(effectiveRatio),
      maxHeight: '100dvh',
      transform: 'translateZ(0)',
    };

    return { isFramed: true, frameContainerStyle: style };
  }, [aspectRatioMode, isCompactDevice]);

  const handlers = useFarmWorldHandlers({
    addNotice,
    economy,
    farmPlots,
    farmTrees,
    placement,
    onResetGameSession,
    isFreshReset,
  });

  const aiPlayerRef = useRef({
    x: handlers.initialPlayerPos?.x ?? 0,
    z: handlers.initialPlayerPos?.z ?? 0,
    heading: handlers.initialPlayerPos?.heading ?? 0,
  });

  const wrappedPlayerMove = useCallback(
    (pos: { x: number; z: number; heading?: number }) => {
      aiPlayerRef.current = { x: pos.x, z: pos.z, heading: pos.heading ?? 0 };
      handlers.handlePlayerMove(pos);
    },
    [handlers.handlePlayerMove]
  );

  const {
    plots,
    unlockedZones,
    interactPlot,
    handleUnlockZone,
    waterPlot,
    replantPlot,
  } = farmPlots;
  const { trees, harvestTree } = farmTrees;

  const handleEnterHouseInterior = useCallback(
    () => handlers.setShowHouseInterior(true),
    [handlers.setShowHouseInterior]
  );
  const handleCloseHouseInterior = useCallback(
    () => handlers.setShowHouseInterior(false),
    [handlers.setShowHouseInterior]
  );

  const {
    stats,
    inventorySeeds,
    inventorySaplings,
    addXP,
    earnCoins,
    spendSeed,
    addCrop,
    addSeed, // ✅ ดึง addSeed
    addTreeHarvest,
    addSapling, // ✅ ดึง addSapling
    spendSapling,
  } = economy;

  const {
    houses,
    animals,
    rocks,
    placing,
    ghost,
    setGhost,
    selectedHouse,
    selectedHouseId,
    selectedAnimal,
    selectedAnimalId,
    selectedRock,
    selectedRockId,
    handleStartPlaceHouse,
    handleStartPlaceAnimal,
    handleStartPlaceRock,
    handleRotatePlacing,
    handleNudgePlacing,
    handleCancelPlacing,
    handleMoveHouseById,
    handleMoveSelectedHouse,
    handleRotateSelectedHouse,
    handleColorSelectedHouse,
    handleTextureSelectedHouse,
    handleStyleHousePart,
    handleResetHouseStyle,
    handleMoveSelectedAnimal,
    handleRotateSelectedAnimal,
    handleMoveRockById,
    handleMoveSelectedRock,
    handleRotateSelectedRock,
  } = placement;

  const shouldRenderNearHouseOverlay = !handlers.isModalBlockingInput;

  const droneObstacles = useMemo(() => {
    const obs: Array<{ x: number; z: number; radius: number }> = [];
    for (const h of houses) obs.push({ x: h.x, z: h.z, radius: 2.5 });
    for (const t of trees) obs.push({ x: t.worldX, z: t.worldZ, radius: 1.2 });
    return obs;
  }, [houses, trees]);

  return (
    <div
      onClick={handlers.ensureAudioStarted}
      className="fixed inset-0 w-screen h-[100dvh] bg-[#090605] flex items-center justify-center overflow-hidden font-sans select-none"
    >
      {isFramed && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse at center, rgba(251,191,36,0.10) 0%, rgba(9,6,5,0) 70%)',
          }}
        />
      )}

      <div
        id="farm-world-viewport"
        className={`relative w-full h-full overflow-hidden bg-stone-950 select-none safe-top safe-bottom safe-left safe-right ${
          isFramed
            ? 'rounded-2xl shadow-2xl shadow-black/60 ring-1 ring-white/10'
            : ''
        }`}
        style={{
          ...frameContainerStyle,
          transform: 'translateZ(0)',
        }}
      >
        <FarmScene
          plots={plots}
          activeTool={handlers.activeTool}
          timeOfDay={handlers.timeOfDay}
          onPlotClick={handlers.handlePlotClick}
          onPlayerMove={wrappedPlayerMove}
          initialPlayerPos={handlers.initialPlayerPos}
          resetCameraTrigger={handlers.resetCameraTrigger}
          houses={houses}
          placing={placing}
          selectedHouseId={selectedHouseId}
          onHouseSelect={handlers.handleHouseSelect}
          onHouseMove={handleMoveHouseById}
          onHouseInteract={handlers.handleHouseInteract}
          onPondInteract={handlers.handlePondInteract}
          onClearFingerHouse={handlers.handleClearFingerHouse}
          onGhostChange={setGhost}
          onConfirmPlace={handlers.handleConfirmPlaceWithGhost}
          animals={animals}
          selectedAnimalId={selectedAnimalId}
          onAnimalSelect={handlers.handleAnimalSelect}
          onAnimalPet={handlers.handleAnimalPetFromScene}
          rocks={rocks}
          selectedRockId={selectedRockId}
          onRockSelect={handlers.handleRockSelect}
          onRockMove={handleMoveRockById}
          trees={trees}
          gridVisible={handlers.gridVisible}
          onTreeClick={handlers.handleTreeClick}
          onGridCellClick={handlers.handleGridCellClick}
          isCellFree={handlers.handleCheckCellFree}
          canPlacePlotAt={handlers.canPlacePlotAt}
          cameraMode={handlers.cameraMode}
          skyVistaEnabled={handlers.skyVistaEnabled}
          isPlayerLocked={handlers.isPlayerLocked}
          isPlayerHidden={handlers.isPlayerHidden}
          fingerSwipeEnabled={handlers.fingerSwipeEnabled}
          playerGender={handlers.playerGender}
          playerOutfit={handlers.playerOutfit}
          cameraFocusRequest={handlers.cameraFocusRequest}
          autoRotateCamera={handlers.autoRotateCamera}
          autoRotateSpeed={handlers.autoRotateSpeed}
          twoFingerRotateEnabled={handlers.twoFingerRotateEnabled}
          cameraRotateTrigger={handlers.cameraRotateTrigger}
          onNearHouseChange={handlers.setNearHouse}
          onNearPondChange={handlers.setNearPond}
          onNearHuaHinSignChange={setNearHuaHinSign}
          renderPaused={handlers.isFishingOpen || travel.isAwayFromFarm}
          isMovingPlotMode={handlers.isMovingPlotMode}
          selectedPlotToMove={handlers.selectedPlotToMove}
          unlockedZones={unlockedZones}
          onOpenExpansionModal={handlers.handleOpenExpansionModal}
          onSceneReady={handlers.handleSceneReady}
          harvestPhase={handlers.harvest.phase}
          onHarvestHover={handlers.harvest.setHover}
          onHarvestToggle={handlers.harvest.toggleTarget}
          wasdEnabled={handlers.wasdEnabled}
          touchSlideEnabled={handlers.touchSlideEnabled}
          isInputBlocked={handlers.isModalBlockingInput || travel.isAwayFromFarm}
          structureEditEnabled={handlers.structureEditEnabled}
          structureEditClickMode={handlers.structureEditClickMode}
          graphicsQualityMode={handlers.graphicsQualityMode}
          ultra4kEnabled={handlers.ultra4kEnabled}
          activeBrewHouseIds={handlers.activeBrewHouseIds}
          bakingJobs={economy.bakingJobs}
          feedMillJobs={economy.feedMillJobs}
          feedAutoCollectEvents={economy.feedAutoCollectEvents}
          fishBagCount={handlers.fishBag.length}
          fishSaleTrigger={handlers.fishSaleTrigger}
        />

        {shouldRenderNearHouseOverlay && (
          <NearHousePromptOverlay
            nearHouse={handlers.nearHouse}
            showHouseInterior={handlers.showHouseInterior}
            showBreweryModal={handlers.showBreweryModal}
            showOvenModal={handlers.showOvenModal}
            showFeedMillModal={handlers.showFeedMillModal}
            showFishShopModal={handlers.showFishShopModal}
            onEnterInterior={handleEnterHouseInterior}
            onEnterBrewery={handlers.handleEnterBrewery}
            onEnterOven={handlers.handleEnterOven}
            onEnterFeedMill={handlers.handleEnterFeedMill}
            onEnterFishShop={handlers.handleEnterFishShop}
            fishBagCount={handlers.fishBag.length}
            fishBagTotalCoins={handlers.fishBagTotalCoins}
            onSellAllCaughtFish={handlers.handleSellAllCaughtFish}
            brewingJobs={economy.brewingJobs}
            onCollectAllReadyBrews={economy.handleCollectAllReadyBrews}
            bakingJobs={economy.bakingJobs}
            onCollectOvenBasket={economy.handleCollectOvenBasket}
            feedMillJobs={economy.feedMillJobs}
            checkPoiCooldown={handlers.checkPoiCooldown}
            earnCoins={earnCoins}
            addXP={addXP}
            setStats={economy.setStats}
            addNotice={addNotice}
            onCollectDuckCoop={handlers.handleCollectDuckCoop}
            plots={plots}
            seedCounts={inventorySeeds}
            playerCoins={stats.coins}
            onPlantCoveredCrop={handlers.handlePlantCoveredCrop}
            onWaterCoveredHouse={handlers.handleWaterCoveredHouse}
            onHarvestCoveredHouse={handlers.handleHarvestCoveredHouse}
            onOpenInventory={handlers.handleOpenInventory}
            onDismiss={() => handlers.handleDismissNearHouse()}
          />
        )}

        <PondFishingPrompt
          visible={
            handlers.nearPond &&
            !handlers.nearHouse &&
            !handlers.isFishingOpen &&
            !handlers.isModalBlockingInput
          }
          onOpen={handlers.handleOpenFishing}
        />

        <FarmStatusOverlays
          hasWorkerQuarters={handlers.hasWorkerQuarters}
          workerQuartersCount={handlers.workerQuartersCount}
          isMovingPlotMode={handlers.isMovingPlotMode}
          selectedPlotToMove={handlers.selectedPlotToMove}
          onToggleMovingPlotMode={handlers.handleToggleMovingPlotMode}
          floatingTexts={floatingTexts}
        />

        <TopHUD
          stats={stats}
          timeOfDay={handlers.timeOfDay}
          onCycleTimeOfDay={handlers.handleCycleTime}
          skyVistaEnabled={handlers.skyVistaEnabled}
          onToggleSkyVista={handlers.handleToggleSkyVista}
          soundEnabled={handlers.soundEffectsEnabled}
          onToggleSound={handlers.handleToggleSoundEffects}
          aspectRatioMode={aspectRatioMode}
          onCycleAspectRatioMode={handleCycleAspectRatioMode}
        />

        <BuildUI
          houses={houses}
          animals={animals}
          rocks={rocks}
          placing={placing}
          ghostValid={ghost?.valid ?? false}
          ghostReason={ghost?.reason}
          ghostPos={handlers.ghostPosMemo}
          selectedHouse={selectedHouse}
          selectedAnimal={selectedAnimal}
          selectedRock={selectedRock}
          playerCoins={stats.coins}
          playerGems={stats.gems}
          playerDay={stats.day}
          timeOfDay={handlers.timeOfDay}
          onCycleTimeOfDay={handlers.handleCycleTime}
          isMovementLocked={handlers.isPlayerLocked}
          onToggleMovementLock={handlers.handleToggleMovementLock}
          isPlayerHidden={handlers.isPlayerHidden}
          onTogglePlayerHidden={handlers.handleTogglePlayerHidden}
          fingerSwipeEnabled={handlers.fingerSwipeEnabled}
          onToggleFingerSwipe={handlers.handleToggleFingerSwipe}
          farmerGender={handlers.playerGender}
          onToggleFarmerGender={handlers.handleToggleFarmerGender}
          cameraMode={handlers.cameraMode}
          onCycleCameraMode={handlers.handleCycleCameraMode}
          isMovingPlotMode={handlers.isMovingPlotMode}
          onToggleMovingPlotMode={handlers.handleToggleMovingPlotMode}
          soundEnabled={handlers.soundEffectsEnabled}
          onToggleSound={handlers.handleToggleSoundEffects}
          onOpenExpansion={handlers.handleOpenExpansionModal}
          onOpenInventory={handlers.handleOpenInventory}
          onOpenGuide={handlers.handleOpenGuide}
          onResetCamera={handlers.handleResetCamera}
          onOpenDevDocs={handlers.handleOpenDevDocs}
          onOpenSettings={handlers.handleOpenSettings}
          onOpenInstall={handlers.handleOpenInstall}
          onStartPlaceHouse={handleStartPlaceHouse}
          onStartPlaceAnimal={handleStartPlaceAnimal}
          onStartPlaceRock={handleStartPlaceRock}
          onRotatePlacing={handleRotatePlacing}
          onNudgePlacing={handleNudgePlacing}
          onConfirmPlace={handlers.handleConfirmPlaceWithGhost}
          onCancelPlace={handleCancelPlacing}
          onMoveSelectedHouse={handleMoveSelectedHouse}
          onRotateSelectedHouse={handleRotateSelectedHouse}
          onColorSelectedHouse={handleColorSelectedHouse}
          onTextureSelectedHouse={handleTextureSelectedHouse}
          onStyleHousePart={handleStyleHousePart}
          onResetHouseStyle={handleResetHouseStyle}
          onFocusHouseCamera={handlers.handleFocusHouseCamera}
          playerOutfit={handlers.playerOutfit}
          onUpdatePlayerOutfit={handlers.handleUpdatePlayerOutfit}
          onResetPlayerOutfit={handlers.handleResetPlayerOutfit}
          onFocusPlayerCamera={handlers.handleFocusPlayerCamera}
          onNotice={addNotice}
          onOpenFishShop={handlers.handleEnterFishShop}
          onInteractSelectedHouse={handlers.handleHouseInteract}
          onDeleteSelectedHouse={handlers.handleDeleteSelectedHouseWithRefund}
          onCloseSelectedHouse={handlers.handleCloseSelectedHouse}
          onMoveSelectedAnimal={handleMoveSelectedAnimal}
          onRotateSelectedAnimal={handleRotateSelectedAnimal}
          onDeleteSelectedAnimal={handlers.handleDeleteSelectedAnimalWithRefund}
          onPetSelectedAnimal={handlers.handlePetSelectedAnimal}
          onCloseSelectedAnimal={handlers.handleCloseSelectedAnimal}
          onMoveSelectedRock={handleMoveSelectedRock}
          onRotateSelectedRock={handleRotateSelectedRock}
          onDeleteSelectedRock={handlers.handleDeleteSelectedRockWithRefund}
          onCloseSelectedRock={handlers.handleCloseSelectedRock}
          isOpen={handlers.openLeftMenu === 'build'}
          isAnyDrawerOpen={handlers.openLeftMenu !== null}
          onOpenChange={handlers.handleBuildMenuOpenChange}
          adjacentMenu={
            <BottomDock
              activeTool={handlers.activeTool}
              selectedSeed={handlers.selectedSeed}
              seedCounts={inventorySeeds}
              selectedSapling={handlers.selectedSapling}
              saplingCounts={inventorySaplings}
              gridVisible={handlers.gridVisible}
              onSelectTool={handlers.handleSelectTool}
              onSelectSeed={handlers.setSelectedSeed}
              onSelectSapling={handlers.handleSelectSaplingAndTool}
              onToggleGrid={handlers.handleToggleGrid}
              harvestModeActive={handlers.harvest.isActive}
              onToggleHarvestMode={handlers.handleToggleHarvestMode}
              isOpen={handlers.openLeftMenu === 'tools'}
              onOpenInventory={handlers.handleOpenInventory}
              onOpenChange={handlers.handleToolsMenuOpenChange}
            />
          }
        />

        {handlers.sceneReady &&
          handlers.sceneRef.current &&
          handlers.harvest.phase !== 'IDLE' && (
            <HarvestSelection
              scene={handlers.sceneRef.current}
              hover={handlers.harvest.hover}
              selection={handlers.harvest.selection}
              getTargetPosition={handlers.resolveWorldPos}
            />
          )}

        {handlers.sceneReady && handlers.sceneRef.current && (
          <DroneAutoHarvest
            isActive={handlers.activeTool === 'drone' && droneMode !== 'OFF'}
            mode={droneMode}
            onModeChange={setDroneMode}
            altitude={droneAltitude}
            onAltitudeChange={setDroneAltitude}
            playerPosition={aiPlayerRef.current}
            scene={handlers.sceneRef.current}
            plots={plots}
            trees={trees}
            interactPlot={interactPlot}
            harvestTree={harvestTree}
            addXP={addXP}
            earnCoins={earnCoins}
            addNotice={addNotice}
            selectedSeed={handlers.selectedSeed}
            spendSeed={spendSeed}
            addCrop={addCrop}
            addSeed={addSeed} // ✅ ส่ง addSeed ให้โดรน
            addTreeHarvest={addTreeHarvest}
            addSapling={addSapling} // ✅ ส่ง addSapling ให้โดรน
            waterPlot={waterPlot}
            replantPlot={replantPlot}
            spendCoins={economy.spendCoins}
            obstacles={droneObstacles}
            seedCounts={inventorySeeds}
            saplingCounts={inventorySaplings}
            spendSapling={spendSapling}
            plantTree={farmTrees.plantTree}
            isCellFree={farmTrees.isCellFree}
            houses={houses}
            rocks={rocks}
            timeOfDay={handlers.timeOfDay}
            map2Unlocked={unlockedZones.includes(5)}
            voiceEnabled={handlers.soundEffectsEnabled}
          />
        )}

        {handlers.isFishingOpen && (
          <FishingOverlay
            onExit={handlers.handleCloseFishing}
            playerCoins={stats.coins}
            spendCoins={economy.spendCoins}
            earnCoins={earnCoins}
            addXP={addXP}
            addNotice={addNotice}
          />
        )}

        <SeafoodFarmSellPanel
          visible={handlers.showFishShopModal && travel.activeWorld === WORLD_IDS.FARM}
          earnCoins={earnCoins}
          addXP={addXP}
          addNotice={addNotice}
        />

        <TravelToFishBridgeButton
          visible={nearHuaHinSign && !travel.isAwayFromFarm && !handlers.nearHouse && !handlers.isFishingOpen && !handlers.isModalBlockingInput}
          disabled={travel.phase === 'loading'}
          onTravel={() => travel.travelTo(WORLD_IDS.HUA_HIN_FISH_BRIDGE)}
        />

        {travel.activeWorld === WORLD_IDS.HUA_HIN_FISH_BRIDGE && (
          <FishBridgeWorldOverlay
            gender={handlers.playerGender}
            outfit={handlers.playerOutfit}
            isCompact={isCompactDevice}
            onReady={travel.markReady}
            onFail={travel.markFailed}
            onReturn={() => travel.travelTo(WORLD_IDS.FARM)}
            coins={stats.coins}
            earnCoins={earnCoins}
            spendCoins={economy.spendCoins}
            addXP={addXP}
            addNotice={addNotice}
          />
        )}

        <FarmModalsOverlay
          economy={economy}
          unlockedZones={unlockedZones}
          handleUnlockZone={handleUnlockZone}
          playerGender={handlers.playerGender}
          onToggleFarmerGender={handlers.handleToggleFarmerGender}
          isPlayerHidden={handlers.isPlayerHidden}
          onTogglePlayerHidden={handlers.handleTogglePlayerHidden}
          fingerSwipeEnabled={handlers.fingerSwipeEnabled}
          onToggleFingerSwipe={handlers.handleToggleFingerSwipe}
          autoRotateCamera={handlers.autoRotateCamera}
          onToggleAutoRotateCamera={handlers.handleToggleAutoRotateCamera}
          autoRotateSpeed={handlers.autoRotateSpeed}
          onChangeAutoRotateSpeed={handlers.handleChangeAutoRotateSpeed}
          twoFingerRotateEnabled={handlers.twoFingerRotateEnabled}
          onToggleTwoFingerRotate={handlers.handleToggleTwoFingerRotate}
          onRotateCameraByAngle={handlers.handleRotateCameraByAngle}
          onResetCameraAngle={handlers.handleResetCameraAngle}
          addNotice={addNotice}
          showHouseInterior={handlers.showHouseInterior}
          onCloseHouseInterior={handleCloseHouseInterior}
          showBreweryModal={handlers.showBreweryModal}
          activeBreweryHouseId={handlers.activeBreweryHouseId}
          onCloseBrewery={handlers.handleCloseBrewery}
          showOvenModal={handlers.showOvenModal}
          activeOvenHouseId={handlers.activeOvenHouseId}
          activeOvenMachineType={handlers.activeOvenMachineType}
          onCloseOven={handlers.handleCloseOven}
          showFeedMillModal={handlers.showFeedMillModal}
          activeFeedMillHouseId={handlers.activeFeedMillHouseId}
          onCloseFeedMill={handlers.handleCloseFeedMill}
          showFishShopModal={handlers.showFishShopModal}
          activeFishShopHouseId={handlers.activeFishShopHouseId}
          onCloseFishShop={handlers.handleCloseFishShop}
          fishBag={handlers.fishBag}
          onSellSingleFish={handlers.handleSellSingleFish}
          onSellAllCaughtFish={() => handlers.handleSellAllCaughtFish()}
          onOpenFishing={handlers.handleOpenFishing}
          onSleep={handlers.handleSleep}
          isInventoryOpen={handlers.isInventoryOpen}
          inventoryInitialTab={handlers.inventoryInitialTab}
          onCloseInventory={handlers.handleCloseInventory}
          isGuideOpen={handlers.isGuideOpen}
          onOpenGuide={handlers.handleOpenGuide}
          onCloseGuide={handlers.handleCloseGuide}
          isExpansionOpen={handlers.isExpansionOpen}
          onCloseExpansion={handlers.handleCloseExpansionModal}
          isSettingsOpen={handlers.isSettingsOpen}
          onCloseSettings={handlers.handleCloseSettings}
          trees={trees}
          isDevDocsOpen={handlers.isDevDocsOpen}
          onOpenDevDocs={handlers.handleOpenDevDocs}
          onCloseDevDocs={handlers.handleCloseDevDocs}
          onFastForwardTime={handlers.handleFastForwardTime}
          onGiveSaplings={handlers.handleGiveSaplings}
          onReviveAllTrees={handlers.handleReviveAllTrees}
          soundEffectsEnabled={handlers.soundEffectsEnabled}
          musicEnabled={handlers.musicEnabled}
          onToggleSoundEffects={handlers.handleToggleSoundEffects}
          onToggleMusic={handlers.handleToggleMusic}
          wasdEnabled={handlers.wasdEnabled}
          onToggleWasd={handlers.handleToggleWasd}
          touchSlideEnabled={handlers.touchSlideEnabled}
          onToggleTouchSlide={handlers.handleToggleTouchSlide}
          structureEditEnabled={handlers.structureEditEnabled}
          onToggleStructureEdit={handlers.handleToggleStructureEdit}
          structureEditClickMode={handlers.structureEditClickMode}
          onChangeStructureEditClickMode={handlers.handleChangeStructureEditClickMode}
          graphicsQualityMode={handlers.graphicsQualityMode}
          onSetGraphicsQualityMode={handlers.handleSetGraphicsQualityMode}
          ultra4kEnabled={handlers.ultra4kEnabled}
          onToggleUltra4k={handlers.handleToggleUltra4k}
          onSetUltra4k={handlers.handleSetUltra4k}
          onSaveNow={handlers.handleSaveGameNow}
          onResetProgress={handlers.handleResetProgress}
          isInstallOpen={handlers.isInstallOpen}
          onOpenInstall={handlers.handleOpenInstall}
          onCloseInstall={handlers.handleCloseInstall}
          isLoadingScreenOpen={handlers.isLoadingScreenOpen}
          onReplayLoadingScreen={handlers.handleReplayLoadingScreen}
          onFinishLoadingScreen={handlers.handleFinishLoadingScreen}
          harvest={handlers.harvest}
          readyTargets={handlers.readyTargets}
          onHarvestAllReady={handlers.handleHarvestAllReady}
          aspectRatioMode={aspectRatioMode}
          onChangeAspectRatioMode={handleChangeAspectRatioMode}
        />
      </div>
    </div>
  );
};