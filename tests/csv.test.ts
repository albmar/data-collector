import { CSV } from "../src/csv";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

describe("CSV.escape / unescape", () => {
  let csv: CSV;
  beforeEach(() => {
    csv = new CSV();
  });

  test("escape wraps value in quotes", () => {
    expect(csv.escape("hello")).toBe('"hello"');
  });

  test("escape doubles internal quotes", () => {
    expect(csv.escape('say "hi"')).toBe('"say ""hi"""');
  });

  test("escape handles empty string", () => {
    expect(csv.escape("")).toBe('""');
  });

  test("unescape removes outer quotes", () => {
    expect(csv.unescape('"hello"')).toBe("hello");
  });

  test("unescape restores doubled quotes", () => {
    expect(csv.unescape('"say ""hi"""')).toBe('say "hi"');
  });

  test("unescape throws on unquoted input", () => {
    expect(() => csv.unescape("notquoted")).toThrow();
  });

  test("roundtrip: escape → unescape returns original", () => {
    const values = ["hello", 'with "quotes"', "", "special chars !@#$%"];
    for (const v of values) {
      expect(csv.unescape(csv.escape(v))).toBe(v);
    }
  });
});

describe("CSV import / export roundtrip", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "csv-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  test("numbers roundtrip correctly", () => {
    const file = path.join(tmpDir, "test.csv");
    const exporter = new CSV();
    exporter.addColumn("id").addColumn("count");
    exporter.addCell(42).addCell(7);
    exporter.addCell(100).addCell(0);
    exporter.export(file);

    const importer = new CSV();
    importer.import(file);

    expect(importer.header).toEqual(["id", "count"]);
    expect(importer.data).toEqual([42, 7, 100, 0]);
  });

  test("strings roundtrip correctly", () => {
    const file = path.join(tmpDir, "test.csv");
    const exporter = new CSV();
    exporter.addColumn("name").addColumn("label");
    exporter.addCell("Iron Sword").addCell("rare");
    exporter.addCell("Fire Staff").addCell("epic");
    exporter.export(file);

    const importer = new CSV();
    importer.import(file);

    expect(importer.header).toEqual(["name", "label"]);
    expect(importer.data).toEqual(["Iron Sword", "rare", "Fire Staff", "epic"]);
  });

  test("mixed numbers and strings roundtrip correctly", () => {
    const file = path.join(tmpDir, "test.csv");
    const exporter = new CSV();
    exporter.addColumn("recipeId").addColumn("name").addColumn("count").addColumn("countCritical");
    exporter.addCell(123).addCell("Iron Sword").addCell(10).addCell(2);
    exporter.addCell(456).addCell("Fire Staff").addCell(5).addCell(0);
    exporter.export(file);

    const importer = new CSV();
    importer.import(file);

    expect(importer.data).toEqual([123, "Iron Sword", 10, 2, 456, "Fire Staff", 5, 0]);
  });

  test("strings with quotes roundtrip correctly", () => {
    const file = path.join(tmpDir, "test.csv");
    const exporter = new CSV();
    exporter.addColumn("name");
    exporter.addCell('Sword "of Doom"');
    exporter.export(file);

    const importer = new CSV();
    importer.import(file);

    expect(importer.data[0]).toBe('Sword "of Doom"');
  });

  test("empty CSV produces empty data", () => {
    const file = path.join(tmpDir, "test.csv");
    const exporter = new CSV();
    exporter.addColumn("id").addColumn("count");
    exporter.export(file);

    const importer = new CSV();
    importer.import(file);

    expect(importer.header).toEqual(["id", "count"]);
    expect(importer.data).toEqual([]);
  });
});