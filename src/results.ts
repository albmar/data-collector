import { Histogram } from "./histogram";

export class GachaResult {
  count: number = 0;
  itemHistograms = new Map<number, Histogram>();
}

export class BossLoot {
  name: string = "";
  killCount: number = 0;
  itemHistograms = new Map<number, Histogram>();
}

export class DungeonResult {
  bosses = new Map<number, BossLoot>();
}

export function parseGachaCSV(
  data: any[],
  headerLength: number,
): Map<number, GachaResult> {
  const gachaResults = new Map<number, GachaResult>();
  let prevItemId: number | undefined;
  let prevBoxId: number | undefined;
  let prevBoxCount: number | undefined;
  let values: [number, number][] = [];
  let result = new GachaResult();

  let start = 0;
  let end = headerLength;
  while (start < data.length) {
    const [
      _boxName,
      boxId,
      boxCount,
      itemId,
      _itemName,
      _min,
      _mean,
      _median,
      _max,
      amount,
      count,
    ] = data.slice(start, end);

    if (prevItemId !== undefined && prevItemId !== itemId) {
      result.itemHistograms.set(prevItemId, new Histogram(values));
      values = [];
    }

    if (prevBoxId !== undefined && prevBoxId !== boxId) {
      result.count = prevBoxCount!;
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
    result.itemHistograms.set(prevItemId, new Histogram(values));
  }
  if (prevBoxId !== undefined) {
    result.count = prevBoxCount!;
    gachaResults.set(prevBoxId, result);
  }

  return gachaResults;
}

export function parseLootCSV(
  data: any[],
  headerLength: number,
): Map<number, DungeonResult> {
  const lootResults = new Map<number, DungeonResult>();
  let prevItemId: number | undefined;
  let prevBossId: number | undefined;
  let prevDungeonId: number | undefined;
  let prevBossName: string = "";
  let prevBossKills: number = 0;
  let prevDungeonName: string = "";
  let values: [number, number][] = [];
  let boss = new BossLoot();
  let dungeonResult = new DungeonResult();

  let start = 0;
  let end = headerLength;
  while (start < data.length) {
    const [
      dungeonId,
      _dungeonName,
      bossId,
      bossName,
      bossKills,
      itemId,
      _itemName,
      _min,
      _mean,
      _median,
      _max,
      amount,
      count,
    ] = data.slice(start, end);

    if (prevItemId !== undefined && prevItemId !== itemId) {
      boss.itemHistograms.set(prevItemId, new Histogram(values));
      values = [];
    }

    if (prevBossId !== undefined && prevBossId !== bossId) {
      boss.name = prevBossName;
      boss.killCount = prevBossKills;
      dungeonResult.bosses.set(prevBossId, boss);
      boss = new BossLoot();
    }

    if (prevDungeonId !== undefined && prevDungeonId !== dungeonId) {
      lootResults.set(prevDungeonId, dungeonResult);
      dungeonResult = new DungeonResult();
    }

    values.push([amount, count]);

    prevDungeonId = dungeonId;
    prevBossId = bossId;
    prevBossName = bossName;
    prevBossKills = bossKills;
    prevItemId = itemId;

    start += headerLength;
    end += headerLength;
  }

  if (prevItemId !== undefined) {
    boss.itemHistograms.set(prevItemId, new Histogram(values));
  }
  if (prevBossId !== undefined) {
    boss.name = prevBossName;
    boss.killCount = prevBossKills;
    dungeonResult.bosses.set(prevBossId, boss);
  }
  if (prevDungeonId !== undefined) {
    lootResults.set(prevDungeonId, dungeonResult);
  }

  return lootResults;
}
