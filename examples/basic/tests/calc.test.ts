import { describe, expect, it } from "vitest";
import { add, sub } from "../src/calc";

describe("calc", () => {
  it("adds numbers", () => {
    expect(add(1, 2)).toBe(3);
  });

  it("subtracts numbers", () => {
    expect(sub(3, 1)).toBe(2);
  });
});
