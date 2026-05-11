"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DungeonResult = exports.BossLoot = exports.GachaResult = void 0;
exports.parseGachaCSV = parseGachaCSV;
exports.parseLootCSV = parseLootCSV;
const histogram_1 = require("./histogram");
class GachaResult {
    count = 0;
    itemHistograms = new Map();
}
exports.GachaResult = GachaResult;
class BossLoot {
    name = "";
    killCount = 0;
    itemHistograms = new Map();
}
exports.BossLoot = BossLoot;
class DungeonResult {
    name = "";
    bosses = new Map();
}
exports.DungeonResult = DungeonResult;
function parseGachaCSV(data, headerLength) {
    const gachaResults = new Map();
    let prevItemId;
    let prevBoxId;
    let prevBoxCount;
    let values = [];
    let result = new GachaResult();
    let start = 0;
    let end = headerLength;
    while (start < data.length) {
        const [_boxName, boxId, boxCount, itemId, _itemName, _min, _mean, _median, _max, amount, count,] = data.slice(start, end);
        if (prevItemId !== undefined && prevItemId !== itemId) {
            result.itemHistograms.set(prevItemId, new histogram_1.Histogram(values));
            values = [];
        }
        if (prevBoxId !== undefined && prevBoxId !== boxId) {
            result.count = prevBoxCount;
            gachaResults.set(prevBoxId, result);
            result = new GachaResult();
        }
        values.push([amount, count]);
        prevBoxId = boxId;
        prevBoxCount = boxCount;
        prevItemId = itemId;
        start += headerLength;
        end += headerLength;
    }
    if (prevItemId !== undefined) {
        result.itemHistograms.set(prevItemId, new histogram_1.Histogram(values));
    }
    if (prevBoxId !== undefined) {
        result.count = prevBoxCount;
        gachaResults.set(prevBoxId, result);
    }
    return gachaResults;
}
function parseLootCSV(data, headerLength) {
    const lootResults = new Map();
    let prevItemId;
    let prevBossId;
    let prevDungeonId;
    let prevBossName = "";
    let prevBossKills = 0;
    let prevDungeonName = "";
    let values = [];
    let boss = new BossLoot();
    let dungeonResult = new DungeonResult();
    let start = 0;
    let end = headerLength;
    while (start < data.length) {
        const [dungeonId, dungeonName, bossId, bossName, bossKills, itemId, _itemName, _min, _mean, _median, _max, amount, count,] = data.slice(start, end);
        if (prevItemId !== undefined && prevItemId !== itemId) {
            boss.itemHistograms.set(prevItemId, new histogram_1.Histogram(values));
            values = [];
        }
        if (prevBossId !== undefined && prevBossId !== bossId) {
            boss.name = prevBossName;
            boss.killCount = prevBossKills;
            dungeonResult.bosses.set(prevBossId, boss);
            boss = new BossLoot();
        }
        if (prevDungeonId !== undefined && prevDungeonId !== dungeonId) {
            dungeonResult.name = prevDungeonName;
            lootResults.set(prevDungeonId, dungeonResult);
            dungeonResult = new DungeonResult();
        }
        values.push([amount, count]);
        prevDungeonId = dungeonId;
        prevDungeonName = dungeonName;
        prevBossId = bossId;
        prevBossName = bossName;
        prevBossKills = bossKills;
        prevItemId = itemId;
        start += headerLength;
        end += headerLength;
    }
    if (prevItemId !== undefined) {
        boss.itemHistograms.set(prevItemId, new histogram_1.Histogram(values));
    }
    if (prevBossId !== undefined) {
        boss.name = prevBossName;
        boss.killCount = prevBossKills;
        dungeonResult.bosses.set(prevBossId, boss);
    }
    if (prevDungeonId !== undefined) {
        dungeonResult.name = prevDungeonName;
        lootResults.set(prevDungeonId, dungeonResult);
    }
    return lootResults;
}
