// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { buildRequest, isQuestion, wantsExplanation } from "../src/explain";
import { collectFields, describeField } from "../src/fields";
import type { Flow } from "../src/types";

describe("isQuestion", () => {
  it("spots questions in English, Hinglish, Hindi and Gujarati", () => {
    expect(isQuestion("why do you need my PAN")).toBe(true);
    expect(isQuestion("what is the purpose of KYC")).toBe(true);
    expect(isQuestion("is it safe to give Aadhaar")).toBe(true);
    expect(isQuestion("PAN kyu chahiye")).toBe(true);
    expect(isQuestion("यह क्यों ज़रूरी है")).toBe(true);
    expect(isQuestion("PEP का मतलब क्या है")).toBe(true);
    expect(isQuestion("આ કેમ જરૂરી છે")).toBe(true);
    expect(isQuestion("Aadhaar?")).toBe(true);
  });

  it("does not mistake answers for questions", () => {
    expect(isQuestion("Jay Shah")).toBe(false);
    expect(isQuestion("savings")).toBe(false);
    expect(isQuestion("for business purpose")).toBe(false);
    expect(isQuestion("14 July 1998")).toBe(false);
    expect(isQuestion("nine eight two five zero one two three four five")).toBe(false);
    expect(isQuestion("हाँ")).toBe(false);
  });

  it("tells 'how do I' (start a guide) apart from 'why/what' (explain)", () => {
    expect(wantsExplanation("what is KYC for")).toBe(true);
    expect(wantsExplanation("KYC kyu zaroori hai")).toBe(true);
    expect(wantsExplanation("how do I complete my KYC")).toBe(false);
    expect(wantsExplanation("KYC kaise kare")).toBe(false);
    expect(wantsExplanation("कैसे करें KYC")).toBe(false);
  });
});

describe("buildRequest", () => {
  it("sends labels and knowledge, never what the user typed", () => {
    document.title = "Complete your KYC";
    document.body.innerHTML = `
      <form id="f">
        <label for="name">Full name</label><input id="name" />
        <label for="pan">PAN</label><input id="pan" />
        <label for="aadhaar">Aadhaar number</label><input id="aadhaar" />
      </form>`;
    const secrets = { name: "Jay Shah", pan: "ABCDE1234F", aadhaar: "123412341234" };
    for (const [id, v] of Object.entries(secrets)) (document.getElementById(id) as HTMLInputElement).value = v;

    const flow: Flow = { id: "kyc", title: { en: "Complete KYC", hi: "KYC पूरा करें" }, knowledge: "KYC is required by RBI.", steps: [] };
    const fields = collectFields(document.getElementById("f")!, false).map((el) => describeField(el));
    const req = buildRequest("why do you need my PAN?", "hi", flow, fields[1], fields, "Support: 1800-000-0000");

    expect(req.field).toEqual({ label: "PAN", kind: "pan", required: false });
    expect(req.formFields).toEqual(["Full name", "PAN", "Aadhaar number"]);
    expect(req.flow).toEqual({ id: "kyc", title: "KYC पूरा करें" });
    expect(req.knowledge).toBe("Support: 1800-000-0000\n\nKYC is required by RBI.");
    const wire = JSON.stringify(req);
    for (const v of Object.values(secrets)) expect(wire).not.toContain(v);
  });
});
