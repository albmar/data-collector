export interface Recipe {
  id: number;
  categoryId: number;
  maxSkillProf: number;
  subFatiguePoint: number;
  obtainable: boolean;
  needSkillId: number;
  recipeItemId: number;
  addOnSuccessProf: number;
  needGrade: number;
  needSkillProf: number;
}

export interface Result {
  id: number;
  count: number;
  criticalItemCount: number;
  criticalItemId: number;
}

export interface Material {
  id: number;
  count: number;
}

export interface String {
  id: number;
  string: string;
  tooltip: string;
}

export interface ItemData {
  id: number;
  level: number;
  name: string;
  coolTime: number;
  rank: number;
  icon: string;
  maxStack: number;
  category: string; //enum
  combatItemType: string; //enum
  rareGrade: number;
  requiredLevel: number;
  equipSound: string;
  usedSound: string;
  gambleItemType: unknown;
  accessoryColorId: unknown;
  artisanable: boolean;
  autoPickUp: unknown;
  awakenable: boolean;
  boundType: string; //enum
  buyPrice: string;
  changeColorEnable: boolean;
  changeEnchantFxId: unknown;
  changeLook: boolean;
  combatItemArg1: unknown;
  combatItemArg2: unknown;
  combatItemArg3: unknown;
  combatItemArg4: unknown;
  combatItemArg5: unknown;
  combatItemSubType: string; //enum
  combineOptionValue: unknown;
  conversionSmallGroup: unknown;
  coolTimeGroup: number;
  customizingString: unknown;
  decompositionId: number;
  defaultValue: number;
  destroyable: boolean;
  dismantlable: boolean;
  dropEffect: string;
  dropEffectOnlyWhenMine: string;
  dropIdentify: unknown;
  dropSilhouette: string;
  dropSound: string;
  dropType: number;
  dualOptionAble: boolean;
  enchantEnable: boolean;
  enchantEquipPart: unknown;
  equipmentSetId: number;
  extractLook: boolean;
  gambleItemGrade: unknown;
  guildWarehouseStorable: boolean;
  isMaterialEquip: boolean;
  isPvpEquipment: boolean;
  isReputation: boolean;
  itemMixId: unknown;
  linkCardId: unknown;
  linkChangeColorListId: unknown;
  linkCrestId: number;
  linkCustomizingId: number;
  linkEnchantId: unknown;
  linkEquipmentExpId: unknown;
  linkEquipmentId: number;
  linkLookInfoId: unknown;
  linkMasterpieceEnchantId: unknown;
  linkMasterpiecePassivityCategoryId: unknown;
  linkMasterpiecePassivityId: unknown;
  linkMaterialEnchantId: unknown;
  linkMaterialRepairId: unknown;
  linkPassivityCategoryId: unknown;
  linkPassivityId: unknown;
  linkPetAdultId: number;
  linkPetOrbId: unknown;
  linkRawStoneId: unknown;
  linkSkillId: number;
  linkSkillPeriodDay: unknown;
  linkSocialId: unknown;
  lootEffect: number;
  masterpieceBasicStatRevise: unknown;
  masterpieceRate: number;
  nonOwnershipItemDropEffect: unknown;
  obtainable: boolean;
  optionResetDisable: boolean;
  periodByWebAdmin: unknown;
  periodInMinute: unknown;
  periodItemCategoryId: unknown;
  preSetEnchant: unknown;
  requiredClass: unknown;
  requiredEquipmentType: string; //enum
  requiredGender: unknown;
  requiredGuildLevel: unknown;
  requiredMaxLevel: unknown;
  requiredRace: unknown;
  requiredUserStatus: unknown;
  ridingUseable: boolean;
  searchable: boolean;
  sellPrice: string; //number
  slotLimit: number;
  sortingNumber: unknown;
  storeSellable: boolean;
  styleCostumeId: unknown;
  tradable: boolean;
  tradeBrokerTradable: boolean;
  unbindCount: unknown;
  unbindEnchant: unknown;
  unidentifiedItemGrade: number;
  unionVenderTradeable: unknown;
  uniqueEquippedItem: unknown;
  useOnlyTerritory: boolean;
  userWarehouseStorable: boolean;
  warehouseStorable: boolean;
}
