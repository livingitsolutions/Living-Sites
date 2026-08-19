import { describe, expect, it } from "vitest";
import { resolveTrustedOrigins } from "./index";

describe("resolveTrustedOrigins", () => {
  it("trusts only the exact configured and current Netlify deploy origins", () => {
    expect(resolveTrustedOrigins({
      TRUSTED_ORIGINS: "https://admin.example.com",
      URL: "https://living-cms.netlify.app",
      DEPLOY_PRIME_URL: "https://deploy-preview-42--living-cms.netlify.app",
      DEPLOY_URL: "https://deploy-preview-42--living-cms.netlify.app/path",
    }, "https://living-cms.netlify.app")).toEqual([
      "https://living-cms.netlify.app",
      "https://admin.example.com",
      "https://deploy-preview-42--living-cms.netlify.app",
    ]);
  });

  it("rejects invalid explicit origins", () => {
    expect(() => resolveTrustedOrigins({ TRUSTED_ORIGINS: "not-a-url" }, "https://living-cms.netlify.app"))
      .toThrow("Trusted origin is not a valid URL");
  });
});
