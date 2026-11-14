// src/components/ui/FarmModalsOverlay.tsx
import React from 'react';
import type {
  FarmerGender,
  OvenMachineType,
  PlacedTree,
  TreeType,
} from '../../types/game';
import type { useFarmEconomy } from '../../hooks/useFarmEconomy';
import type { useFarmPlots } from '../../hooks/useFarmPlots';
import type { useHarvestMode, HarvestTarget } from '../../hooks/useHarvestMode';
import { useLanguage } from '../../i18n/LanguageContext';
import { HouseInteriorModal } from './HouseInteriorModal';
import { BreweryModal } from './BreweryModal';
import type { CaughtFishRecord } from '../../fishing/storage/SaveSchema';
import { BakeryModal } from './BakeryModal';
import { AnimalFeedModal } from './AnimalFeedModal';
import { FishShopModal } from './FishShopModal';
import { LevelUpModal } from './LevelUpModal';
import { InventoryModal } from './InventoryModal';
import { QuestGuideModal } from './QuestGuideModal';
import { LandExpansionModal } from './LandExpansionModal';
import { SettingsModal } from './SettingsModal';
import { PWAInstallModal } from './PWAInstallModal';
import { LoadingScreen } from './LoadingScreen';
import { HarvestHUD } from './HarvestHUD';
import { DevDocsDashboardModal } from './DevDocsDashboardModal';
import type { GraphicsQualityMode } from '../../utils/graphics4k';
import type { AspectRatioMode } from '../../types/aspectRatio';

export interface FarmModalsOverlayProps {
  economy: ReturnType<typeof useFarmEconomy>;
  unlockedZones: number[];
  handleUnlockZone: ReturnType<typeof useFarmPlots>['handleUnlockZone'];
  playerGender: FarmerGender;
  onToggleFarmerGender?: () => void;
  isPlayerHidden?: boolean;
  onTogglePlayerHidden?: () => void;
  fingerSwipeEnabled?: boolean;
  onToggleFingerSwipe?: () => void;

  /* ✅ Camera & Screen Rotation */
  autoRotateCamera?: boolean;
  onToggleAutoRotateCamera?: () => void;
  autoRotateSpeed?: number;
  onChangeAutoRotateSpeed?: (speed: number) => void;
  twoFingerRotateEnabled?: boolean;
  onToggleTwoFingerRotate?: () => void;
  onRotateCameraByAngle?: (deltaRad: number) => void;
  onResetCameraAngle?: () => void;

  addNotice: (text: string, color?: string) => void;
  showHouseInterior: boolean;
  onCloseHouseInterior: () => void;
  showBreweryModal: boolean;
  activeBreweryHouseId: string | null;
  onCloseBrewery: () => void;
  showOvenModal: boolean;
  activeOvenHouseId: string | null;
  activeOvenMachineType: OvenMachineType;
  onCloseOven: () => void;
  showFeedMillModal: boolean;
  activeFeedMillHouseId: string | null;
  onCloseFeedMill: () => void;
  showFishShopModal: boolean;
  activeFishShopHouseId: string | null;
  onCloseFishShop: () => void;
  fishBag: CaughtFishRecord[];
  onSellSingleFish: (recordId: string) => void;
  onSellAllCaughtFish: () => void;
  onOpenFishing: () => void;
  onSleep: () => void;
  isInventoryOpen: boolean;
  // ✅ NEW: แท็บเริ่มต้นของ InventoryModal (ตั้งจาก handler.handleOpenInventory(tab))
  inventoryInitialTab?: 'harvests' | 'processing' | 'shop';
  onCloseInventory: () => void;
  isGuideOpen: boolean;
  onOpenGuide: () => void;
  onCloseGuide: () => void;
  isExpansionOpen: boolean;
  onCloseExpansion: () => void;
  isSettingsOpen: boolean;
  onCloseSettings: () => void;
  soundEffectsEnabled: boolean;
  musicEnabled: boolean;
  onToggleSoundEffects: () => void;
  onToggleMusic: () => void;
  wasdEnabled: boolean;
  onToggleWasd: () => void;
  touchSlideEnabled: boolean;
  onToggleTouchSlide: () => void;
  structureEditEnabled: boolean;
  onToggleStructureEdit: () => void;
  structureEditClickMode: 'double' | 'single';
  onChangeStructureEditClickMode: (mode: 'double' | 'single') => void;
  graphicsQualityMode: GraphicsQualityMode;
  onSetGraphicsQualityMode: (mode: GraphicsQualityMode) => void;
  ultra4kEnabled: boolean;
  onToggleUltra4k: () => void;
  onSetUltra4k: (enabled: boolean) => void;
  onSaveNow: () => void;
  onResetProgress: () => void;
  isInstallOpen: boolean;
  onOpenInstall: () => void;
  onCloseInstall: () => void;
  isLoadingScreenOpen: boolean;
  onReplayLoadingScreen: () => void;
  onFinishLoadingScreen: () => void;
  harvest: ReturnType<typeof useHarvestMode>;
  readyTargets: HarvestTarget[];
  onHarvestAllReady: () => void;
  /* ✅ Aspect Ratio */
  aspectRatioMode?: AspectRatioMode;
  onChangeAspectRatioMode?: (mode: AspectRatioMode) => void;

  /* ✅ Dev Docs / Realistic Fishing 3D Dashboard */
  trees?: PlacedTree[];
  isDevDocsOpen?: boolean;
  onOpenDevDocs?: () => void;
  onCloseDevDocs?: () => void;
  onFastForwardTime?: (seconds: number) => void;
  onGiveSaplings?: (type: TreeType, amount: number) => void;
  onReviveAllTrees?: () => void;
}

/**
 * รวม Modal และ HUD เก็บเกี่ยวทั้งหมดของฟาร์มแยกออกจาก FarmWorld.tsx
 */
export const FarmModalsOverlay: React.FC<FarmModalsOverlayProps> = ({
  economy,
  unlockedZones,
  handleUnlockZone,
  playerGender,
  onToggleFarmerGender,
  isPlayerHidden = false,
  onTogglePlayerHidden,
  fingerSwipeEnabled = false,
  onToggleFingerSwipe,

  autoRotateCamera = false,
  onToggleAutoRotateCamera,
  autoRotateSpeed = 0.08,
  onChangeAutoRotateSpeed,
  twoFingerRotateEnabled = true,
  onToggleTwoFingerRotate,
  onRotateCameraByAngle,
  onResetCameraAngle,

  addNotice,
  showHouseInterior,
  onCloseHouseInterior,
  showBreweryModal,
  activeBreweryHouseId,
  onCloseBrewery,
  showOvenModal,
  activeOvenHouseId,
  activeOvenMachineType,
  onCloseOven,
  showFeedMillModal,
  activeFeedMillHouseId,
  onCloseFeedMill,
  showFishShopModal,
  activeFishShopHouseId,
  onCloseFishShop,
  fishBag,
  onSellSingleFish,
  onSellAllCaughtFish,
  onOpenFishing,
  onSleep,
  isInventoryOpen,
  inventoryInitialTab,
  onCloseInventory,
  isGuideOpen,
  onOpenGuide,
  onCloseGuide,
  isExpansionOpen,
  onCloseExpansion,
  isSettingsOpen,
  onCloseSettings,
  soundEffectsEnabled,
  musicEnabled,
  onToggleSoundEffects,
  onToggleMusic,
  wasdEnabled,
  onToggleWasd,
  touchSlideEnabled,
  onToggleTouchSlide,
  structureEditEnabled,
  onToggleStructureEdit,
  structureEditClickMode,
  onChangeStructureEditClickMode,
  graphicsQualityMode,
  onSetGraphicsQualityMode,
  ultra4kEnabled,
  onToggleUltra4k,
  onSetUltra4k,
  onSaveNow,
  onResetProgress,
  isInstallOpen,
  onOpenInstall,
  onCloseInstall,
  isLoadingScreenOpen,
  onReplayLoadingScreen,
  onFinishLoadingScreen,
  harvest,
  readyTargets,
  onHarvestAllReady,
  aspectRatioMode,
  onChangeAspectRatioMode,

  /* ✅ Dev Docs */
  trees,
  isDevDocsOpen,
  onOpenDevDocs,
  onCloseDevDocs,
  onFastForwardTime,
  onGiveSaplings,
  onReviveAllTrees,
}) => {
  const { t } = useLanguage();
  const {
    stats,
    levelUpReward,
    clearLevelUpReward,
    inventoryCrops,
    inventorySeeds,
    inventorySaplings,
    inventoryTreeFruits,
    inventoryWood,
    inventoryDuckEggs,
    inventoryDuckFeathers,
    inventoryProcessedFeathers,
    inventoryDrinks,
    brewingJobs,
    inventoryBakedGoods,
    bakingJobs,
    ovenMasterySeconds,
    inventoryAnimalFeeds,
    feedMillJobs,
    spendCoins,
    handleBuySeed,
    handleBuySapling,
    handleSellCrop,
    handleSellTreeFruit,
    handleSellWood,
    handleSellDuckEgg,
    handleSellDuckFeather,
    handleCraftFeatherProduct,
    handleSellProcessedFeather,
    handleStartBrewing,
    handleCollectBrew,
    handleCollectAllReadyBrews,
    handleSellDrink,
    handleStartBaking,
    handleRushBakingJob,
    handleCollectBakedJob,
    handleCollectOvenBasket,
    handleBoostOvenMastery,
    handleSellBakedGood,
    handleStartFeedMill,
    handleRushFeedMillJob,
    handleSellAnimalFeed,
    handleUseAnimalFeed,
    handleSellAllCrops,
    handleCookDish,
  } = economy;

  return (
    <div data-ui>
      <HouseInteriorModal
        isOpen={showHouseInterior}
        onClose={onCloseHouseInterior}
        day={stats.day}
        stamina={stats.stamina}
        maxStamina={stats.maxStamina}
        onSleep={onSleep}
        inventoryCrops={inventoryCrops}
        inventoryTreeFruits={inventoryTreeFruits}
        inventoryDuckEggs={inventoryDuckEggs}
        onCookDish={handleCookDish}
        playerGender={playerGender}
        addNotice={addNotice}
      />

      <BreweryModal
        isOpen={showBreweryModal}
        breweryHouseId={activeBreweryHouseId}
        playerGender={playerGender}
        coins={stats.coins}
        inventoryCrops={inventoryCrops}
        inventoryTreeFruits={inventoryTreeFruits}
        inventoryDrinks={inventoryDrinks}
        brewingJobs={brewingJobs}
        onStartBrewing={handleStartBrewing}
        onCollectBrew={handleCollectBrew}
        onCollectAllReady={handleCollectAllReadyBrews}
        onSellDrink={handleSellDrink}
        onClose={onCloseBrewery}
      />

      <BakeryModal
        isOpen={showOvenModal}
        ovenHouseId={activeOvenHouseId}
        machineType={activeOvenMachineType}
        playerGender={playerGender}
        coins={stats.coins}
        inventoryCrops={inventoryCrops}
        inventoryBakedGoods={inventoryBakedGoods}
        bakingJobs={bakingJobs}
        ovenMasterySeconds={ovenMasterySeconds}
        onStartBaking={handleStartBaking}
        onRushBakingJob={handleRushBakingJob}
        onCollectBakedJob={handleCollectBakedJob}
        onCollectOvenBasket={handleCollectOvenBasket}
        onBoostOvenMastery={handleBoostOvenMastery}
        onSellBakedGood={handleSellBakedGood}
        onClose={onCloseOven}
      />

      <AnimalFeedModal
        isOpen={showFeedMillModal}
        feedMillHouseId={activeFeedMillHouseId}
        playerGender={playerGender}
        coins={stats.coins}
        inventoryCrops={inventoryCrops}
        inventoryAnimalFeeds={inventoryAnimalFeeds}
        feedMillJobs={feedMillJobs}
        onStartFeedMill={handleStartFeedMill}
        onRushFeedMillJob={handleRushFeedMillJob}
        onSellAnimalFeed={handleSellAnimalFeed}
        onUseAnimalFeed={handleUseAnimalFeed}
        onClose={onCloseFeedMill}
      />

      <FishShopModal
        isOpen={showFishShopModal}
        fishShopHouseId={activeFishShopHouseId}
        playerGender={playerGender}
        coins={stats.coins}
        fishBag={fishBag}
        onSellFish={onSellSingleFish}
        onSellAllFish={onSellAllCaughtFish}
        onGoFishing={onOpenFishing}
        onClose={onCloseFishShop}
      />

      <LevelUpModal reward={levelUpReward} onClose={clearLevelUpReward} />

      <InventoryModal
        isOpen={isInventoryOpen}
        onClose={onCloseInventory}
        initialTab={inventoryInitialTab}
        inventoryCrops={inventoryCrops}
        inventorySeeds={inventorySeeds}
        inventorySaplings={inventorySaplings}
        inventoryTreeFruits={inventoryTreeFruits}
        inventoryWood={inventoryWood}
        inventoryDuckEggs={inventoryDuckEggs}
        inventoryDuckFeathers={inventoryDuckFeathers}
        inventoryProcessedFeathers={inventoryProcessedFeathers}
        inventoryDrinks={inventoryDrinks}
        inventoryBakedGoods={inventoryBakedGoods}
        ovenMasterySeconds={ovenMasterySeconds}
        inventoryAnimalFeeds={inventoryAnimalFeeds}
        coins={stats.coins}
        onSellCrop={handleSellCrop}
        onSellTreeFruit={handleSellTreeFruit}
        onSellWood={handleSellWood}
        onSellDuckEgg={handleSellDuckEgg}
        onSellDuckFeather={handleSellDuckFeather}
        onCraftFeatherProduct={handleCraftFeatherProduct}
        onSellProcessedFeather={handleSellProcessedFeather}
        onSellDrink={handleSellDrink}
        onSellBakedGood={handleSellBakedGood}
        onSellAnimalFeed={handleSellAnimalFeed}
        onUseAnimalFeed={handleUseAnimalFeed}
        onSellAllCrops={handleSellAllCrops}
        onBuySeed={handleBuySeed}
        onBuySapling={handleBuySapling}
      />

      <QuestGuideModal
        isOpen={isGuideOpen}
        onClose={onCloseGuide}
        cropsHarvestedCount={stats.cropsHarvestedTotal}
        coinsEarnedCount={stats.coinsEarnedTotal}
        level={stats.level}
      />

      <LandExpansionModal
        isOpen={isExpansionOpen}
        onClose={onCloseExpansion}
        unlockedZones={unlockedZones}
        playerCoins={stats.coins}
        playerLevel={stats.level}
        onUnlockZone={(zone) => handleUnlockZone(zone, stats.coins, stats.level, spendCoins)}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={onCloseSettings}
        onOpenGuide={onOpenGuide}
        onOpenDevDocs={onOpenDevDocs}
        onReplayLoadingScreen={onReplayLoadingScreen}
        onResetProgress={onResetProgress}
        soundEffectsEnabled={soundEffectsEnabled}
        musicEnabled={musicEnabled}
        onToggleSoundEffects={onToggleSoundEffects}
        onToggleMusic={onToggleMusic}
        wasdEnabled={wasdEnabled}
        onToggleWasd={onToggleWasd}
        touchSlideEnabled={touchSlideEnabled}
        onToggleTouchSlide={onToggleTouchSlide}
        isPlayerHidden={isPlayerHidden}
        onTogglePlayerHidden={onTogglePlayerHidden}
        fingerSwipeEnabled={fingerSwipeEnabled}
        onToggleFingerSwipe={onToggleFingerSwipe}
        playerGender={playerGender}
        onToggleFarmerGender={onToggleFarmerGender}

        /* ✅ Camera & Screen Rotation */
        autoRotateCamera={autoRotateCamera}
        onToggleAutoRotateCamera={onToggleAutoRotateCamera}
        autoRotateSpeed={autoRotateSpeed}
        onChangeAutoRotateSpeed={onChangeAutoRotateSpeed}
        twoFingerRotateEnabled={twoFingerRotateEnabled}
        onToggleTwoFingerRotate={onToggleTwoFingerRotate}
        onRotateCameraByAngle={onRotateCameraByAngle}
        onResetCameraAngle={onResetCameraAngle}

        structureEditEnabled={structureEditEnabled}
        onToggleStructureEdit={onToggleStructureEdit}
        structureEditClickMode={structureEditClickMode}
        onChangeStructureEditClickMode={onChangeStructureEditClickMode}
        graphicsQualityMode={graphicsQualityMode}
        onSetGraphicsQualityMode={onSetGraphicsQualityMode}
        ultra4kEnabled={ultra4kEnabled}
        onToggleUltra4k={onToggleUltra4k}
        onSetUltra4k={onSetUltra4k}
        onSaveNow={onSaveNow}
        addNotice={addNotice}
        onOpenInstall={onOpenInstall}
        /* ✅ Aspect Ratio */
        aspectRatioMode={aspectRatioMode}
        onChangeAspectRatioMode={onChangeAspectRatioMode}
      />

      {/* ✅ Dev Docs Dashboard */}
      <DevDocsDashboardModal
        isOpen={isDevDocsOpen ?? false}
        onClose={onCloseDevDocs ?? (() => {})}
        trees={trees ?? []}
        onFastForwardTime={onFastForwardTime}
        onGiveSaplings={onGiveSaplings}
        onReviveAllTrees={onReviveAllTrees}
      />

      <PWAInstallModal
        isOpen={isInstallOpen}
        onClose={onCloseInstall}
        onInstalledNotice={() =>
          addNotice(
            t(
              '🎉 ติดตั้งแอป Beam Farm 3D ลงในมือถือเรียบร้อยแล้ว!',
              '🎉 Beam Farm 3D installed on your device!'
            ),
            '#4ade80'
          )
        }
      />

      <LoadingScreen isOpen={isLoadingScreenOpen} onFinish={onFinishLoadingScreen} />

      <HarvestHUD
        phase={harvest.phase}
        summary={harvest.summary}
        totalReadyCount={readyTargets.length}
        cooldownRemaining={harvest.cooldownRemaining}
        canExecute={harvest.canExecute}
        lastResult={harvest.lastResult}
        onHarvestAll={onHarvestAllReady}
        onConfirm={harvest.execute}
        onCancel={harvest.exit}
      />
    </div>
  );
};