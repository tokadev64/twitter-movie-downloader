import { assertEquals, assertThrows } from "jsr:@std/assert";
import fc from "npm:fast-check";
import { validateFormat } from "./validate-format.ts";

// --- Unit Tests ---

Deno.test("validateFormat: accepts 'mp4'", () => {
  assertEquals(validateFormat("mp4"), "mp4");
});

Deno.test("validateFormat: throws on 'mov' (removed format)", () => {
  assertThrows(
    () => validateFormat("mov"),
    Error,
    'Invalid format: "mov". Supported formats: mp4',
  );
});

Deno.test("validateFormat: throws on invalid format", () => {
  assertThrows(
    () => validateFormat("avi"),
    Error,
    'Invalid format: "avi". Supported formats: mp4',
  );
});

Deno.test("validateFormat: throws on empty string", () => {
  assertThrows(() => validateFormat(""), Error, 'Invalid format: "". Supported formats: mp4');
});

Deno.test("validateFormat: case-sensitive — rejects uppercase", () => {
  assertThrows(() => validateFormat("MP4"), Error);
});

// --- PBT ---

Deno.test("PBT: validateFormat round-trip — 'mp4' always returns itself", () => {
  fc.assert(
    fc.property(fc.constant("mp4"), (format) => {
      assertEquals(validateFormat(format), format);
    }),
  );
});

Deno.test("PBT: validateFormat throws on arbitrary non-valid strings", () => {
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
        assertEquals(threw, true);
      },
    ),
  );
});
