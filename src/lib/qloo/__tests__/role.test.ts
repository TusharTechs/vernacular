import { describe, expect, it } from "vitest";
import { genreTags, sharedTags, type ResolvedEntity } from "../tools";

const tag = (id: string, name: string) => ({ id, name });
const starbucks: ResolvedEntity = {
  id: "s",
  name: "Starbucks",
  type: "brand",
  tags: [
    tag("urn:tag:genre:brand:mobile_app:food_and_dining", "Food And Dining"),
    tag("urn:tag:genre:brand:dining", "Dining"),
    tag("urn:tag:genre:brand:mobile_app", "Mobile App"),
    tag("urn:tag:wikipedia_category:coffee_brands", "Coffee brands"),
    tag("urn:tag:wikipedia_category:american_companies_established_in_1971", "American companies established in 1971"),
    tag("urn:tag:business_model:qloo:b2c", "B2C"),
  ],
};

describe("genreTags", () => {
  it("leaves out the mobile-app genre when a more specific one exists", () => {
    expect(genreTags(starbucks).map((t) => t.id)).toEqual(["urn:tag:genre:brand:dining"]);
  });
  it("falls back to the mobile-app genre when it is all there is", () => {
    const app = { ...starbucks, tags: [tag("urn:tag:genre:brand:mobile_app", "Mobile App")] };
    expect(genreTags(app)).toHaveLength(1);
  });
});

describe("sharedTags", () => {
  it("keeps tags that say what both entities are and drops generic ones", () => {
    const dunkin: ResolvedEntity = {
      ...starbucks,
      id: "d",
      name: "Dunkin'",
      tags: [
        tag("urn:tag:genre:brand:dining", "Dining"),
        tag("urn:tag:wikipedia_category:coffee_brands", "Coffee brands"),
        tag("urn:tag:wikipedia_category:american_companies_established_in_1971", "American companies established in 1971"),
        tag("urn:tag:business_model:qloo:b2c", "B2C"),
        tag("urn:tag:genre:brand:mobile_app", "Mobile App"),
      ],
    };
    expect(sharedTags(starbucks, dunkin)).toEqual(["Dining", "Coffee brands"]);
  });
  it("finds nothing in common between a coffee chain and a sports league", () => {
    const nba: ResolvedEntity = { ...starbucks, id: "n", name: "NBA", tags: [tag("urn:tag:genre:brand:mobile_app", "Mobile App"), tag("urn:tag:business_model:qloo:b2c", "B2C")] };
    expect(sharedTags(starbucks, nba)).toEqual([]);
  });
  it("lists a name once even when two tag families share it", () => {
    const a: ResolvedEntity = { id: "a", name: "A", type: "tv_show", tags: [tag("urn:tag:keyword:media:friendship", "Friendship"), tag("urn:tag:theme:qloo:friendship", "Friendship")] };
    const b: ResolvedEntity = { ...a, id: "b" };
    expect(sharedTags(a, b)).toEqual(["Friendship"]);
  });
});
