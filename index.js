"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
const stream_1 = require("stream");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const histogram_1 = require("./histogram");
const csv_1 = require("./csv");
class Production {
    finished = false;
    critical = false;
    recipeId;
    constructor(recipeId) {
        this.recipeId = recipeId;
    }
}
class ProductionResult {
    count = 0;
    countCritical = 0;
}
class Contract {
    type;
    id;
    constructor(type, id) {
        this.type = type;
        this.id = id;
    }
}
class Gacha {
    id;
    count = 0;
    itemHistograms = new Map();
    constructor(id) {
        this.id = id;
    }
    add(id, amount) {
        let hist = this.itemHistograms.get(id);
        if (hist === undefined) {
            hist = new histogram_1.Histogram();
            this.itemHistograms.set(id, hist);
        }
        hist.add(amount);
    }
}
class GachaResult {
    count = 0;
    itemHistograms = new Map();
}
class ReloadState {
    results = new Map();
    gachaResults = new Map();
}
class DataCollector {
    mod;
    listener;
    recipes = new Map();
    usedItem = null;
    production = null;
    contract = null;
    gacha = null;
    results = new Map();
    gachaResults = new Map();
    loadState(state) {
        if (state) {
            this.results = state.results;
            this.gachaResults = state.gachaResults;
        }
        return state;
    }
    saveState() {
        let state = new ReloadState();
        state.results = this.results;
        state.gachaResults = this.gachaResults;
        return state;
    }
    constructor(mod) {
        this.mod = mod;
        this.listener = new stream_1.EventEmitter();
        const library = mod.require.library;
        const entity = library.entity;
        const dataPath = path.resolve(__dirname, "data");
        if (fs.existsSync(dataPath)) {
            this.import(dataPath);
        }
        mod.game.initialize("contract");
        mod.command.add("data", {
            export: this.export.bind(this),
            show: {
                $default: this.showAll.bind(this),
                production: this.showProductionResults.bind(this),
                gacha: this.showGachaResults.bind(this),
            },
            import: this.import.bind(this),
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
        mod.hook("S_SPAWN_DROPITEM", "*", (event) => {
            let num = event.amount;
            let itemId = event.item;
            mod.log(`Dropped ${num} ${mod.game.data.items.get(itemId)?.name}`);
        });
        mod.hook("S_LOOT_DROPITEM", "raw", (code, rawData, incoming, fake) => {
            mod.log(rawData.toString("hex"));
        });
        mod.hook("S_SYSTEM_MESSAGE_LOOT_ITEM", "*", (event) => {
            let num = event.amount;
            let itemId = event.item;
            mod.log(`Looted ${num} ${mod.game.data.items.get(itemId)?.name} (${itemId})`);
        });
        mod.hook("S_SYSTEM_MESSAGE_LOOT_SPECIAL_ITEM", "*", (event) => {
            let num = event.amount;
            let itemId = event.id;
            mod.log(`Looted special ${num} ${mod.game.data.items.get(itemId)?.name}`);
        });
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
        this.mod.hook("C_USE_ITEM", "*", (event) => {
            let itemData = this.mod.game.data.items.get(event.id);
            this.mod.log(`Used ${itemData?.name} of type ${itemData?.combatItemType}`);
            this.usedItem = event.id;
        });
        // S_REQUEST_CONTRACT
        // S_GACHA_START
        this.mod.hook("S_GACHA_START", "*", (event) => {
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
        this.mod.hook("S_GACHA_END", "*", (event) => {
            if (this.gacha) {
                for (let boxes of event.boxes.values()) {
                    this.gacha.add(boxes.randomReward.id, boxes.randomReward.amount);
                    this.mod.log(`Added ${boxes.randomReward.amount}x ${this.mod.game.data.items.get(boxes.randomReward.id)?.name} to ${this.gacha.id}`);
                    for (let fixed of boxes.fixedRewards.values()) {
                        this.gacha.add(fixed.id, fixed.amount);
                        this.mod.log(`Added ${fixed.amount}x ${this.mod.game.data.items.get(fixed.id)?.name} to ${this.gacha.id}`);
                    }
                }
                this.gacha.count++;
            }
        });
        // C_GACHA_CANCEL id
        this.mod.hook("C_GACHA_CANCEL", "*", (event) => {
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
                this.mod.log(`Gacha Result = ${result.count}x boxes with ${sumItems}x items`);
            }
            this.gacha = null;
        });
        // S_CANCEL_CONTRACT id
    }
    hookProduction() {
        let mod = this.mod;
        mod.hook("C_START_PRODUCE", "*", (async (event) => {
            const id = event.recipe;
            if (!this.recipes.has(id)) {
                let data = (await mod.queryData("/ItemProduceRecipe/Recipe@id=?", [id], false, true));
                if (data) {
                    const recipe = data.attributes;
                    const itemId = recipe.recipeItemId;
                    let recipeName = this.mod.game.data.items.get(itemId)?.name;
                    this.recipes.set(id, data);
                    this.mod.log(`Recipe added: ${recipeName} (${id})`);
                    this.mod.log(`Production Points: ${recipe.subFatiguePoint}`);
                    data.children.forEach((c) => {
                        if (c.name == "Result") {
                            let result = c.attributes;
                            this.mod.log("Result =");
                            this.mod.log(result);
                        }
                        else if (c.name == "Materials") {
                            let materials = c.children.map((c) => c.attributes);
                            this.mod.log("Materials =");
                            materials.forEach((m) => this.mod.log(m));
                        }
                        else {
                            this.mod.log("Unkown =");
                            this.mod.log(c.attributes);
                        }
                    });
                }
            }
            this.production = new Production(id);
            mod.log(this.production);
        }));
        mod.hook("S_PRODUCE_CRITICAL", "*", (event) => {
            if (this.production) {
                this.production.critical = true;
            }
        });
        mod.hook("S_END_PRODUCE", "*", (event) => {
            if (this.production) {
                this.production.finished = true;
            }
        });
        mod.hook("S_SYSTEM_MESSAGE_LOOT_ITEM", "*", (event) => {
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
        });
        mod.game.contract.on("begin", this.onContractBegin.bind(this));
        mod.game.contract.on("cancel", this.onContractCancel.bind(this));
    }
    destructor() {
        const dataPath = path.resolve(__dirname, "data");
        if (!fs.existsSync(dataPath)) {
            fs.mkdirSync(dataPath);
        }
        this.export(dataPath);
        this.mod.game.me.removeListener("change_zone", this.onChangeZone.bind(this));
        this.mod.game.contract.removeListener("begin", this.onContractBegin.bind(this));
        this.mod.game.me.removeListener("cancel", this.onContractCancel.bind(this));
    }
    onContractBegin(type, id) {
        this.contract = new Contract(type, id);
    }
    onContractCancel(type, id) {
        if (this.contract?.type == type && this.contract?.id == id) {
            this.production = null;
            this.contract = null;
        }
    }
    async onChangeZone(zone, quick) {
        this.mod.log(`in dungeon: ${this.mod.game.me.inDungeon}`);
        if (this.mod.game.me.inDungeon) {
            var result = (await this.mod.queryData("/StrSheet_Dungeon/String@id=?", [zone], false, false));
            let dungeon = result?.attributes.string;
            this.mod.log(`dungeon: ${dungeon} (${zone})`);
        }
        var result = (await this.mod.queryData("/Area@continentId=?", [zone], false, false));
        let zoneId = result?.attributes.id;
        var result = (await this.mod.queryData("/StrSheet_ZoneName/String@id=?", [zoneId], false, false));
        this.mod.log(`zone: ${result?.attributes.string} (${zone}, ${zoneId})`);
    }
    importGachaResults(inputPath) {
        const targetPath = inputPath
            ? path.resolve(__dirname, inputPath, "gacha_results.csv")
            : path.resolve(__dirname, "data", "gacha_results.csv");
        let importer = new csv_1.CSV();
        importer.import(targetPath);
        let prevItemId;
        let prevBoxId;
        let prevBoxCount;
        let values = [];
        let result = new GachaResult();
        let start = 0;
        let end = importer.header.length;
        while (start < importer.data.length) {
            const [_boxName, boxId, boxCount, itemId, _itemName, _min, _mean, _median, _max, amount, count,] = importer.data.slice(start, end);
            values.push([amount, count]);
            if (prevItemId && prevItemId != itemId) {
                const hist = new histogram_1.Histogram(values);
                result.itemHistograms.set(prevItemId, hist);
                values = [];
            }
            if (prevBoxId && prevBoxId != boxId) {
                result.count = prevBoxCount;
                this.gachaResults.set(prevBoxId, result);
                result = new GachaResult();
            }
            prevBoxId = boxId;
            prevBoxCount = boxCount;
            prevItemId = itemId;
            start += importer.header.length;
            end += importer.header.length;
        }
        if (prevItemId) {
            let hist = new histogram_1.Histogram(values);
            result.itemHistograms.set(prevItemId, hist);
            values = [];
        }
        if (prevBoxId) {
            result.count = prevBoxCount;
            this.gachaResults.set(prevBoxId, result);
            result = new GachaResult();
        }
    }
    exportGachaResults(outputPath) {
        const targetPath = outputPath
            ? path.resolve(__dirname, outputPath, "gacha_results.csv")
            : path.resolve(__dirname, "data", "gacha_results.csv");
        let exporter = new csv_1.CSV();
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
    importProductionResults(inputPath) {
        const targetPath = inputPath
            ? path.resolve(__dirname, inputPath, "production_results.csv")
            : path.resolve(__dirname, "data", "production_results.csv");
        let importer = new csv_1.CSV();
        importer.import(targetPath);
        let start = 0;
        let end = importer.header.length;
        while (start < importer.data.length) {
            const [recipeId, _, count, countCritical] = importer.data.slice(start, end);
            const result = new ProductionResult();
            result.count = count;
            result.countCritical = countCritical;
            this.results.set(recipeId, result);
            start += importer.header.length;
            end += importer.header.length;
        }
    }
    exportProductionResults(outputPath) {
        const targetPath = outputPath
            ? path.resolve(__dirname, outputPath, "production_results.csv")
            : path.resolve(__dirname, "data", "production_results.csv");
        let exporter = new csv_1.CSV();
        exporter.addColumn("recipeId");
        exporter.addColumn("recipeName");
        exporter.addColumn("count");
        exporter.addColumn("countCritical");
        for (const [recipeId, result] of this.results.entries()) {
            let recipeName = "";
            const recipeEntry = this.recipes.get(recipeId);
            if (recipeEntry && recipeEntry.attributes) {
                const recipe = recipeEntry.attributes;
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
    import(path) {
        this.importGachaResults(path);
        this.importProductionResults(path);
    }
    export(outputPath) {
        this.exportGachaResults(outputPath);
        this.exportProductionResults(outputPath);
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
                this.mod.command.message(`- ${name} (${itemId}): min=${min} mean=${mean} median=${median} max=${max}`);
            }
        }
    }
    showProductionResults() {
        for (const [recipeId, result] of this.results.entries()) {
            let recipeName = "";
            const recipeEntry = this.recipes.get(recipeId);
            if (recipeEntry && recipeEntry.attributes) {
                const recipe = recipeEntry.attributes;
                const namedItemId = recipe.recipeItemId;
                recipeName = this.mod.game.data.items.get(namedItemId)?.name ?? "";
            }
            const percentage = (result.countCritical * 100) / result.count;
            const fractionDigits = Math.min(2.5 - Math.log10(percentage), 3);
            this.mod.command.message(`${recipeName} (${recipeId}): ${result.countCritical} / ${result.count} = ${percentage.toFixed(fractionDigits)}%`);
        }
    }
    showAll() {
        this.mod.command.message(`=== Production ===`);
        this.showProductionResults();
        this.mod.command.message(`=== Gacha ===`);
        this.showGachaResults();
        this.mod.command.message(`=== End ===`);
    }
    resetProductionResults() {
        this.results.clear();
        this.mod.command.message("production results reseted.");
    }
}
module.exports = {
    NetworkMod: DataCollector,
    RequireInterface: (globalMod, clientMod, networkMod, requiredBy) => networkMod,
};
