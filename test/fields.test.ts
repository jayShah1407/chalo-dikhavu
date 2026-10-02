// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { collectFields, describeField, isSubmitButton, selectorFor, submitButtonOf } from "../src/fields";
import { guideTextFor, questionFor } from "../src/prompts";

beforeEach(() => {
  document.body.innerHTML = `
    <form id="acct">
      <label for="fullName">Full Name *</label><input id="fullName" required />
      <label>Mobile number <input name="mobile" type="tel" /></label>
      <input name="email_address" placeholder="Enter your email" />
      <label for="dob">Date of birth</label><input id="dob" type="date" />
      <label for="pan">PAN</label><input id="pan" name="pan" />
      <label for="pincode">PIN code</label><input id="pincode" />
      <label for="type">Account type</label>
      <select id="type"><option value="">Select…</option><option value="sav">Savings</option><option value="cur">Current</option></select>
      <fieldset><legend>Gender</legend>
        <label><input type="radio" name="gender" value="m" /> Male</label>
        <label><input type="radio" name="gender" value="f" /> Female</label>
      </fieldset>
      <label for="pw">Password</label><input id="pw" type="password" />
      <label for="otp">OTP</label><input id="otp" />
      <label for="aadhaar">Aadhaar number</label><input id="aadhaar" />
      <label><input type="checkbox" id="terms" required /> I agree to the terms</label>
      <input type="hidden" name="csrf" value="x" />
      <input id="ro" readonly value="fixed" />
      <button type="button">Cancel</button>
      <button type="submit">Open account</button>
    </form>`;
});

const field = (sel: string) => describeField(document.querySelector(sel)!);

describe("describeField", () => {
  it("reads labels from <label for>, wrapping labels, placeholders and names", () => {
    expect(field("#fullName").label).toBe("Full Name");
    expect(field('[name="mobile"]').label).toBe("Mobile number");
    expect(field('[name="email_address"]').label).toBe("email");
  });

  it("works out what kind of answer each field wants", () => {
    expect(field("#fullName").kind).toBe("name");
    expect(field('[name="mobile"]').kind).toBe("phone");
    expect(field('[name="email_address"]').kind).toBe("email");
    expect(field("#dob").kind).toBe("date");
    expect(field("#pan").kind).toBe("pan");
    expect(field("#pincode").kind).toBe("pincode");
    expect(field("#type").kind).toBe("choice");
    expect(field("#terms").kind).toBe("check");
  });

  it("lists options without the placeholder, and groups radios under their legend", () => {
    expect(field("#type").options.map((o) => o.label)).toEqual(["Savings", "Current"]);
    const gender = field('input[name="gender"]');
    expect(gender.label).toBe("Gender");
    expect(gender.options.map((o) => o.label)).toEqual(["Male", "Female"]);
    expect(gender.point.tagName).toBe("LABEL");
  });

  it("flags passwords, OTPs and Aadhaar as sensitive, but not a PIN code", () => {
    expect(field("#pw").sensitive).toBe(true);
    expect(field("#otp").sensitive).toBe(true);
    expect(field("#aadhaar").sensitive).toBe(true);
    expect(field("#pincode").sensitive).toBe(false);
    expect(field("#fullName").sensitive).toBe(false);
  });

  it("knows required fields", () => {
    expect(field("#fullName").required).toBe(true);
    expect(field("#pan").required).toBe(false);
  });
});

describe("questions", () => {
  it("asks natural questions in English and Hindi", () => {
    expect(questionFor(field("#fullName"), "en")).toBe("What's your full name?");
    expect(questionFor(field("#pan"), "en")).toBe("What's your PAN?");
    expect(questionFor(field("#fullName"), "hi")).toBe("आपका Full Name क्या है?");
    expect(questionFor(field("#type"), "en")).toBe("Which account type? You can say: Savings, Current.");
    expect(questionFor(field("#terms"), "en")).toBe("Should I tick “I agree to the terms”?");
  });

  it("writes pointer text for show mode", () => {
    expect(guideTextFor(field('[name="mobile"]'), "en")).toBe("Enter your mobile number here.");
    expect(guideTextFor(field("#type"), "en")).toBe("Choose Account type here.");
  });
});

describe("collectFields", () => {
  it("returns fillable fields in order, one per radio group, skipping hidden/readonly/buttons", () => {
    const ids = collectFields(document.getElementById("acct")!, false).map((el) => el.id || el.getAttribute("name"));
    expect(ids).toEqual(["fullName", "mobile", "email_address", "dob", "pan", "pincode", "type", "gender", "pw", "otp", "aadhaar", "terms"]);
  });

  it("finds the submit button and knows it is one", () => {
    const submit = submitButtonOf(document.getElementById("acct")!)!;
    expect(submit.textContent).toBe("Open account");
    expect(isSubmitButton(submit)).toBe(true);
    expect(isSubmitButton(document.querySelector('button[type="button"]')!)).toBe(false);
  });

  it("builds selectors that find the same element again", () => {
    for (const el of collectFields(document.getElementById("acct")!, false)) {
      expect(document.querySelector(selectorFor(el))).toBe(el);
    }
    const submit = submitButtonOf(document.getElementById("acct")!)!;
    expect(document.querySelector(selectorFor(submit))).toBe(submit);
  });
});
