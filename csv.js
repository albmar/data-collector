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
Object.defineProperty(exports, "__esModule", { value: true });
exports.CSV = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class CSV {
    header = [];
    data = [];
    addColumn(name) {
        this.header.push(name);
        return this;
    }
    addCell(cell) {
        this.data.push(cell);
        return this;
    }
    escape(value) {
        const safe = value.replace(/"/g, '""');
        return `"${safe}"`;
    }
    unescape(value) {
        let match = value.match(/^"(.*)"$/);
        if (!match || match[1] == null)
            throw new Error(`The value has to be in quotes, but was: ${value}`);
        return match[1].replace(/""/g, '"');
    }
    import(outputPath, seperator = ",") {
        const targetPath = outputPath
            ? path.resolve(__dirname, outputPath)
            : path.resolve(__dirname, "data.csv");
        const csv = fs.readFileSync(targetPath, { encoding: "utf8" });
        const lines = csv
            .split("\n")
            .map((line) => line.split(seperator))
            .values();
        this.header = lines.next().value;
        this.data = [...lines]
            .filter((line) => !(line.length === 1 && line[0] === ""))
            .flatMap((line) => line.map((v) => (v[0] == '"' ? this.unescape(v) : Number.parseFloat(v))));
    }
    export(outputPath, seperator = ",") {
        const targetPath = outputPath
            ? path.resolve(__dirname, outputPath)
            : path.resolve(__dirname, "data.csv");
        const numCol = this.header.length;
        let lines = [this.header.join(seperator)];
        let i = 0;
        while (i * numCol < this.data.length) {
            lines.push(this.data
                .slice(i * numCol, (i + 1) * numCol)
                .map((v) => (typeof v == "string" ? this.escape(v) : v))
                .join(seperator));
            i++;
        }
        const csv = lines.join("\n");
        fs.writeFileSync(targetPath, csv, { encoding: "utf8" });
    }
}
exports.CSV = CSV;
