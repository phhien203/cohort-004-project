import { describe, expect, it } from "vitest";
import { canModifyComment } from "./canModifyComment";

describe("canModifyComment", () => {
  it("allows the comment author", () => {
    expect(canModifyComment(10, 10, 99)).toBe(true);
  });

  it("allows the course instructor", () => {
    expect(canModifyComment(10, 99, 99)).toBe(true);
  });

  it("rejects unrelated users", () => {
    expect(canModifyComment(10, 22, 99)).toBe(false);
  });

  it("rejects deleted comments", () => {
    expect(canModifyComment(10, 10, 99, "2026-01-01T00:00:00.000Z")).toBe(false);
  });
});
