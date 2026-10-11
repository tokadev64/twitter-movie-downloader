import { expect, test } from "bun:test";

import fc from "fast-check";

import { validateFormat } from "./validate-format.ts";

// --- Unit Tests ---

test("validateFormat: accepts 'mp4'", () => {
  expect(validateFormat("mp4")).toEqual("mp4");
});

test("validateFormat: throws on 'mov' (removed format)", () => {
  expect(() => validateFormat("mov")).toThrow('Invalid format: "mov". Supported formats: mp4');
});

test("validateFormat: throws on invalid format", () => {
  expect(() => validateFormat("avi")).toThrow('Invalid format: "avi". Supported formats: mp4');
});

test("validateFormat: throws on empty string", () => {
  expect(() => validateFormat("")).toThrow('Invalid format: "". Supported formats: mp4');
});

test("validateFormat: case-sensitive — rejects uppercase", () => {
  expect(() => validateFormat("MP4")).toThrow(Error);
});

// --- PBT ---

test("PBT: validateFormat round-trip — 'mp4' always returns itself", () => {
  fc.assert(
    fc.property(fc.constant("mp4"), (format) => {
      expect(validateFormat(format)).toEqual(format);
    }),
  );
});

test("PBT: validateFormat throws on arbitrary non-valid strings", () => {
  fc.assert(
    fc.property(
      fc.string().filter((s) => s !== "mp4"),
      (input) => {
        let threw = false;
        try {
          validateFormat(input);
        } catch {
          threw = true;
        }
        expect(threw).toEqual(true);
      },
    ),
  );
});
