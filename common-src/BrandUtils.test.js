import {resolveBrand, DEFAULT_BRAND} from "./BrandUtils";

describe("resolveBrand", () => {
  test("returns configured values when set (full settings object)", () => {
    const brand = resolveBrand({
      webGlobalSettings: {
        brandName: "Acme Media",
        brandDomain: "acme.example",
        brandLogo: "proj/prod/images/logo.png",
      },
    });
    expect(brand).toEqual({
      brandName: "Acme Media",
      brandDomain: "acme.example",
      brandLogo: "proj/prod/images/logo.png",
    });
  });

  test("accepts the webGlobalSettings sub-object directly", () => {
    const brand = resolveBrand({
      brandName: "Direct Brand",
      brandDomain: "direct.example",
    });
    expect(brand.brandName).toBe("Direct Brand");
    expect(brand.brandDomain).toBe("direct.example");
  });

  test("falls back to neutral defaults when unset", () => {
    const brand = resolveBrand({});
    expect(brand).toEqual(DEFAULT_BRAND);
  });

  test("falls back for partial / blank values", () => {
    const brand = resolveBrand({
      webGlobalSettings: {
        brandName: "   ",
        brandDomain: "partial.example",
      },
    });
    expect(brand.brandName).toBe(DEFAULT_BRAND.brandName);
    expect(brand.brandDomain).toBe("partial.example");
    expect(brand.brandLogo).toBe(DEFAULT_BRAND.brandLogo);
  });

  test("handles null / undefined input", () => {
    expect(resolveBrand(null)).toEqual(DEFAULT_BRAND);
    expect(resolveBrand(undefined)).toEqual(DEFAULT_BRAND);
  });

  test("never returns a value containing 'microfeed'", () => {
    const cases = [resolveBrand({}), resolveBrand(null), resolveBrand({webGlobalSettings: {}})];
    cases.forEach((brand) => {
      Object.values(brand).forEach((value) => {
        expect(String(value).toLowerCase()).not.toContain("microfeed");
      });
    });
  });
});
