import { Histogram } from "../src/histogram";

describe("Histogram constructor", () => {
  test("empty histogram has zero totals", () => {
    const h = new Histogram();
    expect(h.totalCount).toBe(0);
    expect(h.totalAmount).toBe(0);
    expect(h.values.size).toBe(0);
  });

  test("initializes totalCount and totalAmount from entries", () => {
    const h = new Histogram([[1, 2], [3, 4]]);
    expect(h.totalCount).toBe(6);
    expect(h.totalAmount).toBe(14); // 1*2 + 3*4
  });
});

describe("Histogram.add", () => {
  test("increments totalCount and totalAmount", () => {
    const h = new Histogram();
    h.add(5);
    expect(h.totalCount).toBe(1);
    expect(h.totalAmount).toBe(5);
    expect(h.values.get(5)).toBe(1);
  });

  test("accumulates duplicate amounts", () => {
    const h = new Histogram();
    h.add(3);
    h.add(3);
    expect(h.values.get(3)).toBe(2);
    expect(h.totalCount).toBe(2);
    expect(h.totalAmount).toBe(6);
  });

  test("tracks multiple distinct amounts", () => {
    const h = new Histogram();
    h.add(1);
    h.add(2);
    expect(h.values.get(1)).toBe(1);
    expect(h.values.get(2)).toBe(1);
    expect(h.totalCount).toBe(2);
    expect(h.totalAmount).toBe(3);
  });
});

describe("Histogram.merge", () => {
  test("merges counts for overlapping amounts", () => {
    const a = new Histogram([[1, 2]]);
    const b = new Histogram([[1, 3], [2, 1]]);
    a.merge(b);
    expect(a.values.get(1)).toBe(5);
    expect(a.values.get(2)).toBe(1);
    expect(a.totalCount).toBe(6);
    expect(a.totalAmount).toBe(7); // 1*5 + 2*1
  });

  test("adds new amounts from merged histogram", () => {
    const a = new Histogram([[1, 1]]);
    const b = new Histogram([[5, 2]]);
    a.merge(b);
    expect(a.values.get(5)).toBe(2);
    expect(a.totalCount).toBe(3);
  });

  test("merge with undefined is a no-op", () => {
    const a = new Histogram([[1, 2]]);
    a.merge(undefined);
    expect(a.totalCount).toBe(2);
    expect(a.totalAmount).toBe(2);
  });

  test("merge with empty histogram changes nothing", () => {
    const a = new Histogram([[1, 2]]);
    a.merge(new Histogram());
    expect(a.totalCount).toBe(2);
  });
});

describe("Histogram.min / max", () => {
  test("min returns smallest key", () => {
    expect(new Histogram([[3, 1], [1, 5], [7, 2]]).min()).toBe(1);
  });

  test("max returns largest key", () => {
    expect(new Histogram([[3, 1], [1, 5], [7, 2]]).max()).toBe(7);
  });

  test("min of empty histogram is Infinity", () => {
    expect(new Histogram().min()).toBe(Infinity);
  });

  test("max of empty histogram is -Infinity", () => {
    expect(new Histogram().max()).toBe(-Infinity);
  });

  test("single bucket: min equals max", () => {
    const h = new Histogram([[4, 10]]);
    expect(h.min()).toBe(4);
    expect(h.max()).toBe(4);
  });
});

describe("Histogram.mean", () => {
  test("calculates weighted average", () => {
    // totalAmount = 1*2 + 3*4 = 14, totalCount = 6
    expect(new Histogram([[1, 2], [3, 4]]).mean()).toBeCloseTo(14 / 6);
  });

  test("single bucket mean equals its key", () => {
    expect(new Histogram([[7, 100]]).mean()).toBe(7);
  });

  test("empty histogram mean is NaN", () => {
    expect(new Histogram().mean()).toBeNaN();
  });
});

describe("Histogram.median", () => {
  test("single bucket: median is that value", () => {
    expect(new Histogram([[5, 3]]).median()).toBe(5);
  });

  test("odd count: returns middle element", () => {
    // [1, 2, 3] → median = 2
    expect(new Histogram([[1, 1], [2, 1], [3, 1]]).median()).toBe(2);
  });

  test("odd count: middle is in a larger bucket", () => {
    // [1, 1, 1, 10, 10] → median = 1
    expect(new Histogram([[1, 3], [10, 2]]).median()).toBe(1);
  });

  test("odd count: middle is in second bucket", () => {
    // [1, 1, 10, 10, 10] → median = 10
    expect(new Histogram([[1, 2], [10, 3]]).median()).toBe(10);
  });

  test("even count: averages two middle elements across buckets", () => {
    // [1, 3] → median = 2
    expect(new Histogram([[1, 1], [3, 1]]).median()).toBe(2);
  });

  test("even count: both midpoints in same bucket", () => {
    // [1, 1, 1, 3] → median = (1+1)/2 = 1
    expect(new Histogram([[1, 3], [3, 1]]).median()).toBe(1);
  });

  test("even count: midpoints span two buckets", () => {
    // [1, 1, 3, 3] → median = (1+3)/2 = 2
    expect(new Histogram([[1, 2], [3, 2]]).median()).toBe(2);
  });
});