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
  S_END_PRODUCE_1,
  S_GACHA_END_5,
  S_GACHA_START_2,
  S_PRODUCE_CRITICAL_1,
  S_SPAWN_DROPITEM_9,
  S_SYSTEM_MESSAGE_LOOT_ITEM_1,
  S_SYSTEM_MESSAGE_LOOT_SPECIAL_ITEM_1,
} from "tera-toolbox/definitions";
import * as fs from "fs";
import * as path from "path";
import { Material, Recipe, Result } from "./dbInterfaces";

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

class Histogram {
  values = new Map<number, number>();
  totalCount = 0;
  totalAmount = 0;

  add(amount: number) {
    let count = this.values.get(amount);
    count = count === undefined ? 1 : count + 1;
    this.values.set(amount, count);
    this.totalCount += 1;
    this.totalAmount += amount;
  }

  merge(hist?: Histogram) {
    if (!hist) return;
    for (const [amount, newCount] of hist.values.entries()) {
      let count = this.values.get(amount);
      count = count === undefined ? newCount : count + newCount;
      this.values.set(amount, count);
    }
    this.totalCount += hist.totalCount;
    this.totalAmount += hist.totalAmount;
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
    }
    hist.add(amount);
  }
}

class GachaResult {
  count: number = 0;
  itemHistograms = new Map<ItemId, Histogram>();
}

class ReloadState {
  results: Map<RecipeId, ProductionResult> = new Map();
  gachaResults: Map<ItemId, GachaResult> = new Map();
}

type RecipeId = number;

type ItemId = number;

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

  loadState(state: ReloadState): ReloadState {
    if (state) {
      this.results = state.results;
      this.gachaResults = state.gachaResults;
    }
    return state;
  }

  saveState(): ReloadState {
    let state = new ReloadState();
    state.results = this.results;
    state.gachaResults = this.gachaResults;
    return state;
  }

  constructor(
    mod: NetworkModInterface<DataCollector, DataCollector, DataCollector>,
  ) {
    this.mod = mod;
    this.listener = new EventEmitter();
    const library = mod.require.library as LibraryIndex;
    const entity = library.entity;
    mod.game.initialize("contract");

    mod.command.add("data", {
      export: this.exportProductionResults.bind(this),
      results: this.showProductionResults.bind(this),
      import: this.importProductionResults.bind(this),
      reset: this.resetProductionResults.bind(this),
    });

    this.hookProduction();

    this.hookGacha();

    // loot
    // S_SPAWN_DROPITEM
    // S_SYSTEM_MESSAGE_LOOT_ITEM
    // S_SYSTEM_MESSAGE_LOOT_SPECIAL_ITEM
    // S_LOOT_DROPITEM
    // S_DESPAWN_DROPITEM
    //

    mod.hook("S_SPAWN_DROPITEM", "*", (event: S_SPAWN_DROPITEM_9) => {
      let num = event.amount;
      let itemId = event.item;
      mod.log(`Dropped ${num} ${mod.game.data.items.get(itemId)?.name}`);
    });
    mod.hook("S_LOOT_DROPITEM", "raw", (code, rawData, incoming, fake) => {
      mod.log(rawData.toString("hex"));
    });
    mod.hook(
      "S_SYSTEM_MESSAGE_LOOT_ITEM",
      "*",
      (event: S_SYSTEM_MESSAGE_LOOT_ITEM_1) => {
        let num = event.amount;
        let itemId = event.item;
        mod.log(`Looted ${num} ${mod.game.data.items.get(itemId)?.name}`);
      },
    );
    mod.hook(
      "S_SYSTEM_MESSAGE_LOOT_SPECIAL_ITEM",
      "*",
      (event: S_SYSTEM_MESSAGE_LOOT_SPECIAL_ITEM_1) => {
        let num = event.amount;
        let itemId = event.id;
        mod.log(
          `Looted special ${num} ${mod.game.data.items.get(itemId)?.name}`,
        );
      },
    );

    // mod.hook("S_SPAWN_NPC", "*", (event: S_SPAWN_NPC_12) => {});
    // mod.hook("S_DESPAWN_NPC", "*", (event: S_DESPAWN_NPC_3) => {});
    // mod.hook("S_TARGET_INFO", "*", (event: S_TARGET_INFO_3) => {
    //   let percentage = event.hpPercentage * 100;
    //   mod.log(`Target ${event.target} at ${percentage.toFixed(2)}%`);
    // });
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
          for (let fixed of boxes.fixedRewards.values()) {
            this.gacha.add(fixed.id, fixed.amount);
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
        for (let [itemId, newHist] of this.gacha.itemHistograms) {
          let hist = result.itemHistograms.get(itemId);
          newHist.merge(hist);
          result.itemHistograms.set(itemId, newHist);
        }
      }
      this.gacha = null;
    });
    // S_CANCEL_CONTRACT id
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
    this.mod.log(`in dungeon: ${this.mod.game.me.inDungeon}`);
    if (this.mod.game.me.inDungeon) {
      var result = (await this.mod.queryData(
        "/StrSheet_Dungeon/String@id=?",
        [zone] as any,
        false,
        false,
      )) as DBElement;
      let dungeon = result?.attributes.string;
      this.mod.log(`dungeon: ${dungeon} (${zone})`);
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

  importProductionResults() {
    this.mod.command.message("not yet implemented");
  }

  exportProductionResults(outputPath?: string) {
    const targetPath = outputPath
      ? path.resolve(outputPath)
      : path.resolve("production_results.csv");

    const escape = (value: string): string => {
      const safe = value.replace(/"/g, '""');
      return `"${safe}"`;
    };

    const lines = ["recipeId,recipeName,count,countCritical"];
    for (const [recipeId, result] of this.results.entries()) {
      let recipeName = "";
      const recipeEntry = this.recipes.get(recipeId);
      if (recipeEntry && recipeEntry.attributes) {
        const recipe = recipeEntry.attributes as Recipe;
        const namedItemId = recipe.recipeItemId;
        recipeName = this.mod.game.data.items.get(namedItemId)?.name ?? "";
      }

      const nameEscaped = recipeName ? escape(recipeName) : "";
      lines.push(
        `${recipeId},${nameEscaped},${result.count},${result.countCritical}`,
      );
    }

    const csv = lines.join("\n");
    try {
      fs.writeFileSync(targetPath, csv, { encoding: "utf8" });
      this.mod.log(`Production results exported to ${targetPath}`);
    } catch (err: any) {
      this.mod.log(`Failed to export production results: ${err.message}`);
    }

    return targetPath;
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
