"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Histogram = void 0;
class Histogram {
    values = new Map();
    totalCount = 0;
    totalAmount = 0;
    constructor(values) {
        this.values = new Map(values);
        this.totalCount = [...this.values.values()].reduce((sum, x) => sum + x, 0);
        this.totalAmount = [...this.values.entries()]
            .map(([k, v]) => k * v)
            .reduce((sum, x) => sum + x, 0);
    }
    add(amount) {
        let count = this.values.get(amount);
        count = count === undefined ? 1 : count + 1;
        this.values.set(amount, count);
        this.totalCount += 1;
        this.totalAmount += amount;
    }
    merge(hist) {
        if (!hist)
            return;
        for (const [amount, newCount] of hist.values.entries()) {
            let count = this.values.get(amount);
            count = count === undefined ? newCount : count + newCount;
            this.values.set(amount, count);
        }
        this.totalCount += hist.totalCount;
        this.totalAmount += hist.totalAmount;
    }
    min() {
        let min = Infinity;
        for (const x of this.values.keys()) {
            min = Math.min(min, x);
        }
        return min;
    }
    max() {
        let max = -Infinity;
        for (const x of this.values.keys()) {
            max = Math.max(max, x);
        }
        return max;
    }
    mean() {
        return this.totalAmount / this.totalCount;
    }
    median() {
        let entries = [...this.values.entries()]
            .sort((a, b) => a[0] - b[0])
            .values();
        let mid = (this.totalCount - 1) / 2;
        let lowerMid = Math.trunc(mid);
        let [amount, count] = [0, 0];
        for ([amount, count] of entries) {
            if (lowerMid < count) {
                break;
            }
            lowerMid -= count;
        }
        // even totalCount: mid has a fractional part and we're at the last element of the bucket
        if (mid !== Math.trunc(mid) && lowerMid + 1 === count) {
            const [nextAmount] = entries.next().value;
            return (amount + nextAmount) / 2;
        }
        return amount;
    }
}
exports.Histogram = Histogram;
