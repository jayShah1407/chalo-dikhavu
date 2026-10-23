import { describe, expect, it } from "vitest";
import { romaniseName } from "../src/translit";

describe("romaniseName", () => {
  it("romanises common Indian names the way people write them", () => {
    const cases: Record<string, string> = {
      "जय शाह": "Jay Shah", "राकेश पटेल": "Rakesh Patel", "प्रिया शर्मा": "Priya Sharma", "कमला": "Kamla",
      "दीपक कुमार": "Deepak Kumar", "लक्ष्मी": "Lakshmi", "पूजा": "Pooja", "अर्जुन सिंह": "Arjun Singh",
      "सचिन": "Sachin", "शंभु": "Shambhu", "राहुल गांधी": "Rahul Gandhi", "ज़ैनब": "Zainab",
      "अमित": "Amit", "विकास": "Vikas", "गीता": "Geeta", "मोहम्मद": "Mohammad", "અનિલ": "Anil", "જય શાહ": "Jay Shah",
    };
    for (const [input, want] of Object.entries(cases)) expect(romaniseName(input)).toBe(want);
  });

  it("leaves Latin text alone", () => {
    expect(romaniseName("Jay Shah")).toBe("Jay Shah");
  });
});
