import { describe, expect, it } from "vitest";
import {
  ValidationError,
  parseBearerToken,
  parseCredentials,
  parseJsonBody,
} from "../src/http/validation";

describe("parseJsonBody", () => {
  it("parses a JSON object", () => {
    expect(parseJsonBody('{"email":"a@b.co"}')).toEqual({ email: "a@b.co" });
  });

  it("rejects malformed and empty bodies", () => {
    expect(() => parseJsonBody("{not json")).toThrow(ValidationError);
    expect(() => parseJsonBody("  ")).toThrow(/required/);
  });
});

describe("parseCredentials", () => {
  it("normalises the email and keeps the password intact", () => {
    expect(
      parseCredentials({ email: "  Agent@Example.COM ", password: "hunter2!" }),
    ).toEqual({ email: "agent@example.com", password: "hunter2!" });
  });

  it("rejects non-object bodies", () => {
    expect(() => parseCredentials(null)).toThrow(/JSON object/);
    expect(() => parseCredentials(["a@b.co", "password123"])).toThrow(
      /JSON object/,
    );
    expect(() => parseCredentials("a@b.co")).toThrow(/JSON object/);
  });

  it("rejects invalid emails and short passwords", () => {
    expect(() => parseCredentials({ email: "not-an-email", password: "password123" })).toThrow(
      /email/,
    );
    expect(() => parseCredentials({ email: "a@b.co", password: "short" })).toThrow(
      /at least 8/,
    );
  });
});

describe("parseBearerToken", () => {
  it("extracts the token from a Bearer header", () => {
    expect(parseBearerToken("Bearer abc123")).toBe("abc123");
  });

  it("accepts a case-insensitive scheme and extra surrounding whitespace", () => {
    expect(parseBearerToken("  bEaReR   abc123  ")).toBe("abc123");
  });

  it("rejects missing or malformed authorization headers with 401", () => {
    for (const header of [undefined, "", "abc123", "Basic abc123", "Bearer", "Bearer a b"]) {
      expect(() => parseBearerToken(header)).toThrow(ValidationError);
      try {
        parseBearerToken(header);
      } catch (error) {
        expect((error as ValidationError).statusCode).toBe(401);
      }
    }
  });
});
