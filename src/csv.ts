import * as fs from "fs";
import * as path from "path";

export class CSV {
  header: string[] = [];
  data: any[] = [];

  addColumn(name: string) {
    this.header.push(name);
    return this;
  }

  addCell(cell: any) {
    this.data.push(cell);
    return this;
  }

  escape(value: string): string {
    const safe = value.replace(/"/g, '""');
    return `"${safe}"`;
  }

  unescape(value: string): string {
    let match = value.match(/^"(.*)"$/);
    if (!match || match[1] == null)
      throw new Error(`The value has to be in quotes, but was: ${value}`);
    return match[1].replace(/""/g, '"');
  }

  import(outputPath: string, seperator: string = ",") {
    const targetPath = outputPath
      ? path.resolve(__dirname, outputPath)
      : path.resolve(__dirname, "data.csv");

    const csv = fs.readFileSync(targetPath, { encoding: "utf8" });
    const lines = csv
      .split("\n")
      .map((line) => line.split(seperator))
      .values();
    this.header = lines.next().value!;
    this.data = [...lines]
      .filter((line) => !(line.length === 1 && line[0] === ""))
      .flatMap((line) =>
        line.map((v) => (v[0] == '"' ? this.unescape(v) : Number.parseFloat(v))),
      );
  }

  export(outputPath: string, seperator: string = ",") {
    const targetPath = outputPath
      ? path.resolve(__dirname, outputPath)
      : path.resolve(__dirname, "data.csv");

    const numCol = this.header.length;
    let lines = [this.header.join(seperator)];
    let i = 0;
    while (i * numCol < this.data.length) {
      lines.push(
        this.data
          .slice(i * numCol, (i + 1) * numCol)
          .map((v) => (typeof v == "string" ? this.escape(v) : v))
          .join(seperator),
      );
      i++;
    }

    const csv = lines.join("\n");
    fs.writeFileSync(targetPath, csv, { encoding: "utf8" });
  }
}