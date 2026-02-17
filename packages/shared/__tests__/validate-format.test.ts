import { assertEquals, assertThrows } from "jsr:@std/assert";
import fc from "npm:fast-check";
import type { VideoFormat } from "../types.ts";
import { validateFormat } from "../validate-format.ts";

// --- Unit Tests ---

Deno.test("validateFormat: accepts 'mp4'", () => {
  assertEquals(validateFormat("mp4"), "mp4");
});

Deno.test("validateFormat: accepts 'mov'", () => {
  assertEquals(validateFormat("mov"), "mov");
});

Deno.test("validateFormat: throws on invalid format", () => {
  assertThrows(
    () => validateFormat("avi"),
    Error,
    'Invalid format: "avi". Supported formats: mp4, mov',
  );
});

Deno.test("validateFormat: throws on empty string", () => {
  assertThrows(
    () => validateFormat(""),
    Error,
    'Invalid format: "". Supported formats: mp4, mov',
  );
});

Deno.test("validateFormat: case-sensitive — rejects uppercase", () => {
  assertThrows(() => validateFormat("MP4"), Error);
  assertThrows(() => validateFormat("MOV"), Error);
});

// --- PBT ---

const validFormats: VideoFormat[] = ["mp4", "mov"];

Deno.test("PBT: validateFormat round-trip — valid formats always return themselves", () => {
  fc.assert(
    fc.property(fc.constantFrom(...validFormats), (format) => {
      assertEquals(validateFormat(format), format);
    }),
  );
});

Deno.test("PBT: validateFormat throws on arbitrary non-valid strings", () => {
  fc.assert(
    fc.property(
      fc.string().filter((s) => s !== "mp4" && s !== "mov"),
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
