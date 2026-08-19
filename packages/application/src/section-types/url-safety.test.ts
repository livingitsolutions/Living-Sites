import { describe, expect, it } from "vitest";
import { getSectionType, validateSectionProps, validateSafeUrl } from "./index.js";

describe("Section URL safety", () => {
  it.each(["javascript:alert(1)", " JAVASCRIPT:alert(1)", "data:text/html,boom", "vbscript:msgbox(1)"])("rejects dangerous URL %s", (url) => {
    expect(validateSafeUrl(url, "link").ok).toBe(false);
    expect(validateSafeUrl(url, "image").ok).toBe(false);
  });
  it.each(["https://example.com/path", "mailto:hello@example.com", "tel:+15551234567", "/contact", "#details"])("allows safe link URL %s", (url) => expect(validateSafeUrl(url, "link").ok).toBe(true));
  it.each(["https://images.example.com/a.jpg", "/images/a.jpg"])("allows safe image URL %s", (url) => expect(validateSafeUrl(url, "image").ok).toBe(true));
  it.each(["http://example.com", "//example.com", "#image", "mailto:image@example.com"])("rejects unapproved image URL %s", (url) => expect(validateSafeUrl(url, "image").ok).toBe(false));
  it("enforces and normalizes URLs through Section validation", () => {
    const hero = getSectionType("hero")!;
    const valid = validateSectionProps(hero, { ...hero.defaultProps, ctaUrl: "  https://EXAMPLE.com/contact  " });
    expect(valid.ok && valid.value.ctaUrl).toBe("https://example.com/contact");
    expect(validateSectionProps(hero, { ...hero.defaultProps, ctaUrl: "javascript:alert(1)" }).ok).toBe(false);
  });
});
