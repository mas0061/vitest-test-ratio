import { describe, expect, it } from "vitest";
import { countLoc } from "../src/loc.js";

describe("countLoc", () => {
  it("uses sloc for supported extensions", () => {
    const content = `
const a = 1; // inline comment
// full line comment
/*
  block comment
*/
const b = 2;
const url = "http://example.com";
`;
    expect(countLoc(content, "sample.ts")).toBe(3);
  });

  it("falls back to lightweight parser for unknown extensions", () => {
    const content = `
const a = 1;
// comment only
const b = 2;
`;
    expect(countLoc(content, "sample.unknown")).toBe(2);
  });

  it("falls back when file path is not provided", () => {
    const content = `
const x = "// not a comment";
// comment only
const y = 1;
`;
    expect(countLoc(content)).toBe(2);
  });
});
