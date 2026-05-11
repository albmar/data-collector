import { parseGachaCSV, parseLootCSV } from "../src/results";

// Column layout for gacha CSV:
// boxName, boxId, boxCount, itemId, itemName, min, mean, median, max, amount, count
const GACHA_COLS = 11;

function gachaRow(
  boxId: number,
  boxCount: number,
  itemId: number,
  amount: number,
  count: number,
): any[] {
  return ["", boxId, boxCount, itemId, "", 0, 0, 0, 0, amount, count];
}

// Column layout for loot CSV:
// dungeonId, dungeonName, bossId, bossName, bossKills, itemId, itemName, min, mean, median, max, amount, count
const LOOT_COLS = 13;

function lootRow(
  dungeonId: number,
  bossId: number,
  bossKills: number,
  itemId: number,
  amount: number,
  count: number,
): any[] {
  return [
    dungeonId,
    "",
    bossId,
    "",
    bossKills,
    itemId,
    "",
    0,
    0,
    0,
    0,
    amount,
    count,
  ];
}

describe("parseGachaCSV boundaries", () => {
  test("first row of a new item does not bleed into the previous item", () => {
    const data = [
      ...gachaRow(1, 100, 10, 5, 10), // box 1, item 10, amount 5 × 10
      ...gachaRow(1, 100, 10, 10, 3), // box 1, item 10, amount 10 × 3
      ...gachaRow(1, 100, 20, 1, 7), // box 1, item 20, amount 1 × 7  ← boundary
      ...gachaRow(2, 50, 30, 2, 5), // box 2, item 30, amount 2 × 5  ← boundary
    ];

    const result = parseGachaCSV(data, GACHA_COLS);

    const box1 = result.get(1)!;
    expect(box1).toBeDefined();

    const item10 = box1.itemHistograms.get(10)!;
    expect(item10).toBeDefined();
    expect(item10.values.get(5)).toBe(10);
    expect(item10.values.get(10)).toBe(3);
    expect(item10.values.size).toBe(2); // must not contain item 20's data

    const item20 = box1.itemHistograms.get(20)!;
    expect(item20).toBeDefined();
    expect(item20.values.get(1)).toBe(7);
    expect(item20.values.size).toBe(1); // must not contain item 30's data

    const box2 = result.get(2)!;
    expect(box2).toBeDefined();

    const item30 = box2.itemHistograms.get(30)!;
    expect(item30).toBeDefined();
    expect(item30.values.get(2)).toBe(5);
    expect(item30.values.size).toBe(1);
  });

  test("box count is stored on the correct box", () => {
    const data = [...gachaRow(1, 100, 10, 5, 3), ...gachaRow(2, 200, 20, 7, 1)];

    const result = parseGachaCSV(data, GACHA_COLS);

    expect(result.get(1)!.count).toBe(100);
    expect(result.get(2)!.count).toBe(200);
  });

  test("single row produces correct histogram", () => {
    const data = [...gachaRow(1, 10, 5, 3, 7)];
    const result = parseGachaCSV(data, GACHA_COLS);

    const hist = result.get(1)!.itemHistograms.get(5)!;
    expect(hist.values.get(3)).toBe(7);
    expect(hist.totalCount).toBe(7);
  });

  test("empty data produces empty map", () => {
    expect(parseGachaCSV([], GACHA_COLS).size).toBe(0);
  });
});

describe("parseLootCSV boundaries", () => {
  test("first row of a new item does not bleed into the previous item", () => {
    const data = [
      ...lootRow(1, 10, 50, 100, 5, 3), // dungeon 1, boss 10, item 100, amount 5 × 3
      ...lootRow(1, 10, 50, 100, 10, 1), // dungeon 1, boss 10, item 100, amount 10 × 1
      ...lootRow(1, 10, 50, 200, 3, 8), // dungeon 1, boss 10, item 200, amount 3 × 8  ← item boundary
      ...lootRow(2, 20, 30, 300, 2, 4), // dungeon 2, boss 20, item 300, amount 2 × 4  ← boss+dungeon boundary
    ];

    const result = parseLootCSV(data, LOOT_COLS);

    const dungeon1 = result.get(1)!;
    expect(dungeon1).toBeDefined();

    const boss10 = dungeon1.bosses.get(10)!;
    expect(boss10).toBeDefined();
    expect(boss10.killCount).toBe(50);

    const item100 = boss10.itemHistograms.get(100)!;
    expect(item100.values.get(5)).toBe(3);
    expect(item100.values.get(10)).toBe(1);
    expect(item100.values.size).toBe(2);

    const item200 = boss10.itemHistograms.get(200)!;
    expect(item200.values.get(3)).toBe(8);
    expect(item200.values.size).toBe(1);

    const dungeon2 = result.get(2)!;
    expect(dungeon2).toBeDefined();

    const boss20 = dungeon2.bosses.get(20)!;
    const item300 = boss20.itemHistograms.get(300)!;
    expect(item300.values.get(2)).toBe(4);
    expect(item300.values.size).toBe(1);
  });

  test("empty data produces empty map", () => {
    expect(parseLootCSV([], LOOT_COLS).size).toBe(0);
  });
});
