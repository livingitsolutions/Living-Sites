import { describe, expect, it } from "vitest";
import type { WebsiteId } from "@livingsites/domain";
import { ConfiguredFallbackDomainProvider } from "./index.js";

describe("ConfiguredFallbackDomainProvider", () => {
  it("uses the configured suffix and preserves the existing Website-id label contract", () => {
    const provider = new ConfiguredFallbackDomainProvider("Preview.Example.COM.");
    expect(provider.hostnameFor("web_99143c32-dbfa-44a6-a1f8-ca976583aa1a" as WebsiteId)).toBe("web-99143c32-dbfa-44a6-a1f8-ca976583aa1a.preview.example.com");
  });

  it("rejects a suffix containing protocol or path components", () => {
    expect(() => new ConfiguredFallbackDomainProvider("https://example.com/sites")).toThrow();
  });
});
