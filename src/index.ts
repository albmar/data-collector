import { DBElement } from "tera-client-interface";
import {
  ClientModInterface,
  GlobalModInterface,
  HotReloadable,
  NetworkModInterface,
} from "tera-toolbox/bin/mod.js";
import { LibraryIndex } from "./libraryInterfaces";
import { EventEmitter } from "stream";
import {
  C_GACHA_CANCEL_1,
  C_START_PRODUCE_1,
  C_USE_ITEM_3,
  S_DESPAWN_NPC_3,
  S_END_PRODUCE_1,
  S_GACHA_END_5,
  S_GACHA_START_2,
  S_PRODUCE_CRITICAL_1,
  S_SPAWN_DROPITEM_9,
  S_SPAWN_NPC_12,
  S_SYSTEM_MESSAGE_LOOT_ITEM_1,
  S_SYSTEM_MESSAGE_LOOT_SPECIAL_ITEM_1,
} from "tera-toolbox/definitions";
import * as fs from "fs";
import * as path from "path";
import { Material, Recipe, Result, String as DBString } from "./dbInterfaces";
import { Histogram } from "./histogram";
import { CSV } from "./csv";
import {
  GachaResult,
  BossLoot,
  DungeonResult,
  parseGachaCSV,
  parseLootCSV,
} from "./results";

class Production {
  finished: boolean = false;
  critical: boolean = false;
  recipeId: number;

  constructor(recipeId: number) {
    this.recipeId = recipeId;
  }
}

class ProductionResult {
  count: number = 0;
  countCritical: number = 0;
}

class Contract {
  type: number;
  id: bigint;

  constructor(type: number, id: bigint) {
    this.type = type;
    this.id = id;
  }
}

class Gacha {
  id: bigint;
  count: number = 0;
  itemHistograms = new Map<ItemId, Histogram>();

  constructor(id: bigint) {
    this.id = id;
  }

  add(id: ItemId, amount: number) {
    let hist = this.itemHistograms.get(id);
    if (hist === undefined) {
      hist = new Histogram();
      this.itemHistograms.set(id, hist);
    }
    hist.add(amount);
  }
}

class ReloadState {
  results: Map<RecipeId, ProductionResult> = new Map();
  gachaResults: Map<ItemId, GachaResult> = new Map();
  lootResults: Map<DungeonId, DungeonResult> = new Map();
}

type RecipeId = number;
type ItemId = number;
type TemplateId = number;
type DungeonId = number;

class DataCollector implements HotReloadable<ReloadState> {
  mod: NetworkModInterface<DataCollector, DataCollector, DataCollector>;
  listener: EventEmitter;
  recipes: Map<RecipeId, DBElement> = new Map();

  usedItem: ItemId | null = null;
  production: Production | null = null;
  contract: Contract | null = null;
  gacha: Gacha | null = null;

  results: Map<RecipeId, ProductionResult> = new Map();
  gachaResults: Map<ItemId, GachaResult> = new Map();
  lootResults: Map<DungeonId, DungeonResult> = new Map();

  currentDungeonId: DungeonId | null = null;
  npcCache: Map<bigint, { templateId: TemplateId; name: string }> = new Map();

  loadState(state: ReloadState): ReloadState {
    if (state) {
      this.results = state.results;
      this.gachaResults = state.gachaResults;
      this.lootResults = state.lootResults ?? new Map();
    }
    return state;
  }

  saveState(): ReloadState {
    let state = new ReloadState();
    state.results = this.results;
    state.gachaResults = this.gachaResults;
    state.lootResults = this.lootResults;
    return state;
  }

  constructor(
    mod: NetworkModInterface<DataCollector, DataCollector, DataCollector>,
  ) {
    this.mod = mod;
    this.listener = new EventEmitter();

    const dataPath = path.resolve(__dirname, "data");
    if (fs.existsSync(dataPath)) {
      this.import(dataPath);
    } else {
      fs.mkdirSync(dataPath, { recursive: true });
    }
    mod.game.initialize("contract");

    mod.command.add("data", {
      export: this.export.bind(this),
      show: {
        $default: this.showAll.bind(this),
        production: this.showProductionResults.bind(this),
        gacha: this.showGachaResults.bind(this),
        loot: this.showLootResults.bind(this),
      },
      import: this.import.bind(this),
      reset: this.resetProductionResults.bind(this),
    });

    this.hookProduction();
    this.hookGacha();
    this.hookLoot();

    mod.game.me.on("change_zone", this.onChangeZone.bind(this));
  }

  hookGacha() {
    // boxes
    // C_USE_ITEM id bdid /ItemData/combatItemType == "GACHA" /Gacha/GachaItem/itemTemplateId == id
    this.mod.hook("C_USE_ITEM", "*", (event: C_USE_ITEM_3) => {
      let itemData = this.mod.game.data.items.get(event.id);
      this.mod.log(
        `Used ${itemData?.name} of type ${itemData?.combatItemType}`,
      );
      this.usedItem = event.id;
    });
    // S_REQUEST_CONTRACT
    // S_GACHA_START
    this.mod.hook("S_GACHA_START", "*", (event: S_GACHA_START_2) => {
      if (this.usedItem && this.contract) {
        let itemData = this.mod.game.data.items.get(this.usedItem);
        if (itemData?.combatItemType.toString() == "GACHA") {
          this.gacha = new Gacha(this.contract.id);
          this.mod.log(`New Gacha ${this.gacha.id}`);
        }
      }
    });
    // C_GACHA_TRY id amount Contract.id == Gacha.id
    // S_SYSTEM_MESSAGE_LOOT_ITEM item amount
    // S_GACHA_END boxes
    this.mod.hook("S_GACHA_END", "*", (event: S_GACHA_END_5) => {
      if (this.gacha) {
        for (let boxes of event.boxes.values()) {
          this.gacha.add(boxes.randomReward.id, boxes.randomReward.amount);
          this.mod.log(
            `Added ${boxes.randomReward.amount}x ${this.mod.game.data.items.get(boxes.randomReward.id)?.name} to ${this.gacha.id}`,
          );
          for (let fixed of boxes.fixedRewards.values()) {
            this.gacha.add(fixed.id, fixed.amount);
            this.mod.log(
              `Added ${fixed.amount}x ${this.mod.game.data.items.get(fixed.id)?.name} to ${this.gacha.id}`,
            );
          }
        }
        this.gacha.count++;
      }
    });
    // C_GACHA_CANCEL id
    this.mod.hook("C_GACHA_CANCEL", "*", (event: C_GACHA_CANCEL_1) => {
      if (this.gacha && this.usedItem) {
        let result = this.gachaResults.get(this.usedItem);
        if (result === undefined) {
          result = new GachaResult();
          this.gachaResults.set(this.usedItem, result);
        }
        result.count += this.gacha.count;
        let sumItems = 0;
        for (let [itemId, newHist] of this.gacha.itemHistograms) {
          sumItems += newHist.totalAmount;
          let hist = result.itemHistograms.get(itemId);
          newHist.merge(hist);
          result.itemHistograms.set(itemId, newHist);
        }
        this.mod.log(
          `Gacha Result = ${result.count}x boxes with ${sumItems}x items`,
        );
      }
      this.gacha = null;
    });
    // S_CANCEL_CONTRACT id
  }

  private hookLoot() {
    this.mod.hook("S_SPAWN_NPC", "*", (event: S_SPAWN_NPC_12) => {
      const name =
        (this.mod.game.data as any).npcs?.get(event.templateId)?.name ?? "";
      this.npcCache.set(event.gameId, { templateId: event.templateId, name });
    });

    this.mod.hook("S_DESPAWN_NPC", "*", (event: S_DESPAWN_NPC_3) => {
      if (this.currentDungeonId === null) return;
      const npc = this.npcCache.get(event.gameId);
      if (!npc) return;
      const dungeonResult = this.lootResults.get(this.currentDungeonId);
      if (!dungeonResult) return;
      const boss = dungeonResult.bosses.get(npc.templateId);
      if (!boss) return;
      boss.killCount++;
    });

    this.mod.hook("S_SPAWN_DROPITEM", "*", (event: S_SPAWN_DROPITEM_9) => {
      if (this.currentDungeonId === null || !event.source) return;
      const npc = this.npcCache.get(event.source);
      if (!npc) return;

      const dungeonResult = this.lootResults.get(this.currentDungeonId)!;

      let boss = dungeonResult.bosses.get(npc.templateId);
      if (!boss) {
        boss = new BossLoot();
        boss.name = npc.name;
        dungeonResult.bosses.set(npc.templateId, boss);
      }

      let hist = boss.itemHistograms.get(event.item);
      if (!hist) {
        hist = new Histogram();
        boss.itemHistograms.set(event.item, hist);
      }
      hist.add(event.amount);

      this.mod.log(
        `Loot: ${event.amount}x ${this.mod.game.data.items.get(event.item)?.name} from ${boss.name || npc.templateId}`,
      );
    });
  }

  private hookProduction() {
    let mod = this.mod;
    mod.hook("C_START_PRODUCE", "*", (async (event: C_START_PRODUCE_1) => {
      const id = event.recipe;
      if (!this.recipes.has(id)) {
        let data = (await mod.queryData(
          "/ItemProduceRecipe/Recipe@id=?",
          [id] as any,
          false,
          true,
        )) as DBElement;
        if (data) {
          const recipe = data.attributes as Recipe;
          const itemId = recipe.recipeItemId;

          let recipeName = this.mod.game.data.items.get(itemId)?.name;

          this.recipes.set(id, data);

          this.mod.log(`Recipe added: ${recipeName} (${id})`);
          this.mod.log(`Production Points: ${recipe.subFatiguePoint}`);
          data.children.forEach((c) => {
            if (c.name == "Result") {
              let result = c.attributes as Result;
              this.mod.log("Result =");
              this.mod.log(result);
            } else if (c.name == "Materials") {
              let materials = c.children.map((c) => c.attributes as Material);
              this.mod.log("Materials =");
              materials.forEach((m) => this.mod.log(m));
            } else {
              this.mod.log("Unkown =");
              this.mod.log(c.attributes);
            }
          });
        }
      }
      this.production = new Production(id);
      mod.log(this.production);
    }) as any);
    mod.hook("S_PRODUCE_CRITICAL", "*", (event: S_PRODUCE_CRITICAL_1) => {
      if (this.production) {
        this.production.critical = true;
      }
    });
    mod.hook("S_END_PRODUCE", "*", (event: S_END_PRODUCE_1) => {
      if (this.production) {
        this.production.finished = true;
      }
    });
    mod.hook(
      "S_SYSTEM_MESSAGE_LOOT_ITEM",
      "*",
      (event: S_SYSTEM_MESSAGE_LOOT_ITEM_1) => {
        if (this.production) {
          let result = this.results.get(this.production.recipeId);
          if (result === undefined) {
            result = new ProductionResult();
            this.results.set(this.production.recipeId, result);
          }
          if (this.production.critical) {
            result.countCritical++;
          }
          result.count++;
        }
      },
    );
    mod.game.contract.on("begin", this.onContractBegin.bind(this));
    mod.game.contract.on("cancel", this.onContractCancel.bind(this));
  }

  destructor() {
    const dataPath = path.resolve(__dirname, "data");
    if (!fs.existsSync(dataPath)) {
      fs.mkdirSync(dataPath);
    }
    this.export(dataPath);
    this.mod.game.me.removeListener(
      "change_zone",
      this.onChangeZone.bind(this),
    );
    this.mod.game.contract.removeListener(
      "begin",
      this.onContractBegin.bind(this),
    );
    this.mod.game.me.removeListener("cancel", this.onContractCancel.bind(this));
  }

  onContractBegin(type: number, id: bigint) {
    this.contract = new Contract(type, id);
  }

  onContractCancel(type: number, id: bigint) {
    if (this.contract?.type == type && this.contract?.id == id) {
      this.production = null;
      this.contract = null;
    }
  }

  async onChangeZone(zone: number, quick: boolean) {
    this.npcCache.clear();

    this.mod.log(`in dungeon: ${this.mod.game.me.inDungeon}`);
    if (this.mod.game.me.inDungeon) {
      this.currentDungeonId = zone;

      if (!this.lootResults.has(zone)) {
        this.lootResults.set(zone, new DungeonResult());
      }

      var result = (await this.mod.queryData(
        "/StrSheet_Dungeon/String@id=?",
        [zone] as any,
        false,
        false,
      )) as DBElement;
      const dungeonName = (result?.attributes as DBString).string;
      if (dungeonName) {
        this.lootResults.get(zone)!.name = dungeonName;
      }
      this.mod.log(`dungeon: ${dungeonName} (${zone})`);
    } else {
      this.currentDungeonId = null;
    }

    var result = (await this.mod.queryData(
      "/Area@continentId=?",
      [zone] as any,
      false,
      false,
    )) as DBElement;
    let zoneId = result?.attributes.id;
    var result = (await this.mod.queryData(
      "/StrSheet_ZoneName/String@id=?",
      [zoneId] as any,
      false,
      false,
    )) as DBElement;
    this.mod.log(`zone: ${result?.attributes.string} (${zone}, ${zoneId})`);
  }

  importGachaResults(inputPath?: string) {
    const targetPath = inputPath
      ? path.resolve(__dirname, inputPath, "gacha_results.csv")
      : path.resolve(__dirname, "data", "gacha_results.csv");

    let importer = new CSV();
    importer.import(targetPath);
    this.gachaResults = parseGachaCSV(importer.data, importer.header.length);
  }

  exportGachaResults(outputPath?: string) {
    const targetPath = outputPath
      ? path.resolve(__dirname, outputPath, "gacha_results.csv")
      : path.resolve(__dirname, "data", "gacha_results.csv");

    let exporter = new CSV();

    exporter.addColumn("boxName");
    exporter.addColumn("boxId");
    exporter.addColumn("boxCount");
    exporter.addColumn("itemId");
    exporter.addColumn("itemName");
    exporter.addColumn("min");
    exporter.addColumn("mean");
    exporter.addColumn("median");
    exporter.addColumn("max");
    exporter.addColumn("amount");
    exporter.addColumn("count");

    for (const [boxId, result] of this.gachaResults.entries()) {
      let boxName = this.mod.game.data.items.get(boxId)?.name ?? "";
      for (const [itemId, hist] of result.itemHistograms.entries()) {
        let itemName = this.mod.game.data.items.get(itemId)?.name ?? "";
        for (const [amount, count] of hist.values.entries()) {
          exporter.addCell(boxName);
          exporter.addCell(boxId);
          exporter.addCell(result.count);
          exporter.addCell(itemId);
          exporter.addCell(itemName);
          exporter.addCell(hist.min());
          exporter.addCell(hist.mean());
          exporter.addCell(hist.median());
          exporter.addCell(hist.max());
          exporter.addCell(amount);
          exporter.addCell(count);
        }
      }
    }

    exporter.export(targetPath);
  }

  importLootResults(inputPath?: string) {
    const targetPath = inputPath
      ? path.resolve(__dirname, inputPath, "loot_results.csv")
      : path.resolve(__dirname, "data", "loot_results.csv");

    let importer = new CSV();
    importer.import(targetPath);
    this.lootResults = parseLootCSV(importer.data, importer.header.length);
  }

  exportLootResults(outputPath?: string) {
    const targetPath = outputPath
      ? path.resolve(__dirname, outputPath, "loot_results.csv")
      : path.resolve(__dirname, "data", "loot_results.csv");

    let exporter = new CSV();
    exporter.addColumn("dungeonId");
    exporter.addColumn("dungeonName");
    exporter.addColumn("bossId");
    exporter.addColumn("bossName");
    exporter.addColumn("bossKills");
    exporter.addColumn("itemId");
    exporter.addColumn("itemName");
    exporter.addColumn("min");
    exporter.addColumn("mean");
    exporter.addColumn("median");
    exporter.addColumn("max");
    exporter.addColumn("amount");
    exporter.addColumn("count");

    for (const [dungeonId, dungeonResult] of this.lootResults.entries()) {
      for (const [bossId, boss] of dungeonResult.bosses.entries()) {
        for (const [itemId, hist] of boss.itemHistograms.entries()) {
          const itemName = this.mod.game.data.items.get(itemId)?.name ?? "";
          for (const [amount, count] of hist.values.entries()) {
            exporter.addCell(dungeonId);
            exporter.addCell(dungeonResult.name);
            exporter.addCell(bossId);
            exporter.addCell(boss.name);
            exporter.addCell(boss.killCount);
            exporter.addCell(itemId);
            exporter.addCell(itemName);
            exporter.addCell(hist.min());
            exporter.addCell(hist.mean());
            exporter.addCell(hist.median());
            exporter.addCell(hist.max());
            exporter.addCell(amount);
            exporter.addCell(count);
          }
        }
      }
    }

    exporter.export(targetPath);
  }

  showLootResults() {
    for (const [dungeonId, dungeonResult] of this.lootResults.entries()) {
      this.mod.command.message(`${dungeonResult.name || dungeonId}:`);
      for (const [bossId, boss] of dungeonResult.bosses.entries()) {
        this.mod.command.message(
          `  ${boss.name || bossId} (${boss.killCount} kills):`,
        );
        for (const [itemId, hist] of boss.itemHistograms.entries()) {
          const itemName =
            this.mod.game.data.items.get(itemId)?.name ?? String(itemId);
          this.mod.command.message(
            `    - ${itemName}: min=${hist.min()} mean=${hist.mean().toFixed(2)} median=${hist.median().toFixed(2)} max=${hist.max()}`,
          );
        }
      }
    }
  }

  importProductionResults(inputPath?: string) {
    const targetPath = inputPath
      ? path.resolve(__dirname, inputPath, "production_results.csv")
      : path.resolve(__dirname, "data", "production_results.csv");

    let importer = new CSV();

    importer.import(targetPath);

    let start = 0;
    let end = importer.header.length;
    while (start < importer.data.length) {
      const [recipeId, _, count, countCritical] = importer.data.slice(
        start,
        end,
      );
      const result = new ProductionResult();
      result.count = count;
      result.countCritical = countCritical;

      this.results.set(recipeId, result);

      start += importer.header.length;
      end += importer.header.length;
    }
  }

  exportProductionResults(outputPath?: string) {
    const targetPath = outputPath
      ? path.resolve(__dirname, outputPath, "production_results.csv")
      : path.resolve(__dirname, "data", "production_results.csv");

    let exporter = new CSV();

    exporter.addColumn("recipeId");
    exporter.addColumn("recipeName");
    exporter.addColumn("count");
    exporter.addColumn("countCritical");

    for (const [recipeId, result] of this.results.entries()) {
      let recipeName = "";
      const recipeEntry = this.recipes.get(recipeId);
      if (recipeEntry && recipeEntry.attributes) {
        const recipe = recipeEntry.attributes as Recipe;
        const namedItemId = recipe.recipeItemId;
        recipeName = this.mod.game.data.items.get(namedItemId)?.name ?? "";
      }

      exporter.addCell(recipeId);
      exporter.addCell(recipeName);
      exporter.addCell(result.count);
      exporter.addCell(result.countCritical);
    }

    exporter.export(targetPath);
  }

  import(path?: string) {
    this.importGachaResults(path);
    this.importProductionResults(path);
    this.importLootResults(path);
  }

  export(outputPath?: string) {
    this.exportGachaResults(outputPath);
    this.exportProductionResults(outputPath);
    this.exportLootResults(outputPath);
  }

  showGachaResults() {
    for (const [itemId, result] of this.gachaResults.entries()) {
      const name = this.mod.game.data.items.get(itemId)?.name;

      this.mod.command.message(`${name} (${itemId}):`);

      for (const [itemId, hist] of result.itemHistograms.entries()) {
        const name = this.mod.game.data.items.get(itemId)?.name;

        const min = hist.min();
        const mean = hist.mean().toFixed(2);
        const median = hist.median().toFixed(2);
        const max = hist.max();
        this.mod.command.message(
          `- ${name} (${itemId}): min=${min} mean=${mean} median=${median} max=${max}`,
        );
      }
    }
  }

  showProductionResults() {
    for (const [recipeId, result] of this.results.entries()) {
      let recipeName = "";
      const recipeEntry = this.recipes.get(recipeId);
      if (recipeEntry && recipeEntry.attributes) {
        const recipe = recipeEntry.attributes as Recipe;
        const namedItemId = recipe.recipeItemId;
        recipeName = this.mod.game.data.items.get(namedItemId)?.name ?? "";
      }
      const percentage = (result.countCritical * 100) / result.count;
      const fractionDigits = Math.min(2.5 - Math.log10(percentage), 3);
      this.mod.command.message(
        `${recipeName} (${recipeId}): ${result.countCritical} / ${result.count} = ${percentage.toFixed(fractionDigits)}%`,
      );
    }
  }

  showAll() {
    this.mod.command.message(`=== Production ===`);
    this.showProductionResults();
    this.mod.command.message(`=== Gacha ===`);
    this.showGachaResults();
    this.mod.command.message(`=== Loot ===`);
    this.showLootResults();
    this.mod.command.message(`=== End ===`);
  }

  resetProductionResults() {
    this.results.clear();
    this.mod.command.message("production results reseted.");
  }
}

export = {
  NetworkMod: DataCollector,
  RequireInterface: (
    globalMod: GlobalModInterface,
    clientMod: ClientModInterface,
    networkMod: NetworkModInterface,
    requiredBy: any,
  ) => networkMod,
};
