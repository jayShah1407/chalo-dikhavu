import { describe, expect, it } from "vitest";
import { parseAnswer, parseChoice, parseDate, parseEmail, parsePhone, parseYesNo, spokenDigits } from "../src/answers";
import type { FieldInfo, FieldKind } from "../src/fields";

const info = (kind: FieldKind, extra: Partial<FieldInfo> = {}) =>
  ({ kind, label: "x", sensitive: false, required: false, options: [], isoDate: false, ...extra }) as FieldInfo;

describe("spoken numbers", () => {
  it("handles English, Hinglish, Hindi words and digits", () => {
    expect(spokenDigits("nine eight double two five")).toBe("98225");
    expect(spokenDigits("ek do teen")).toBe("123");
    expect(spokenDigits("नौ आठ सात")).toBe("987");
    expect(spokenDigits("९८२५")).toBe("9825");
    expect(spokenDigits("98250 12345")).toBe("9825012345");
  });

  it("does not turn filler words into digits", () => {
    expect(parsePhone("my mobile no is 98250 12345")).toEqual({ ok: true, value: "9825012345", display: "98250 12345" });
  });

  it("strips the country code and trunk zero from phone numbers", () => {
    expect(parsePhone("+91 98250 12345").ok && parsePhone("+91 98250 12345")).toMatchObject({ value: "9825012345" });
    expect(parsePhone("098250 12345")).toMatchObject({ value: "9825012345" });
    expect(parsePhone("twelve").ok).toBe(false);
  });
});

describe("email", () => {
  it("understands spoken emails", () => {
    expect(parseEmail("jay dot shah at gmail dot com")).toMatchObject({ value: "jay.shah@gmail.com" });
    expect(parseEmail("jay underscore 14 at the rate yahoo dot in")).toMatchObject({ value: "jay_14@yahoo.in" });
    expect(parseEmail("जय एट जीमेल डॉट कॉम")).toMatchObject({ value: "jay@gmail.com" }); // Hindi speech-to-text
    expect(parseEmail("not an email").ok).toBe(false);
  });
});

describe("dates", () => {
  it("parses spoken and written dates, day-first", () => {
    expect(parseDate("14 July 1998", true)).toEqual({ ok: true, value: "1998-07-14", display: "14 July 1998" });
    expect(parseDate("July 14th, 1998", true)).toMatchObject({ value: "1998-07-14" });
    expect(parseDate("14/07/1998", true)).toMatchObject({ value: "1998-07-14" });
    expect(parseDate("1998-07-14", false)).toMatchObject({ value: "14/07/1998" });
    expect(parseDate("14 जुलाई 1998", true)).toMatchObject({ value: "1998-07-14" });
  });

  it("rejects impossible dates", () => {
    expect(parseDate("31 February 1998", true).ok).toBe(false);
    expect(parseDate("sometime last year", true).ok).toBe(false);
  });
});

describe("yes / no", () => {
  it("understands English, Hinglish and Hindi, with 'no' winning", () => {
    expect(parseYesNo("yes that's right")).toBe(true);
    expect(parseYesNo("haan ji")).toBe(true);
    expect(parseYesNo("हाँ सही है")).toBe(true);
    expect(parseYesNo("no, that's wrong")).toBe(false);
    expect(parseYesNo("नहीं")).toBe(false);
    expect(parseYesNo("mera naam")).toBe(null);
    expect(parseYesNo("नाम")).toBe(null); // "ना" inside a word is not "no"
  });
});

describe("choices", () => {
  const options = [
    { label: "Savings account", value: "sav" },
    { label: "Current account", value: "cur" },
  ];
  it("matches by name, typo, position or number", () => {
    expect(parseChoice("savings", options)).toMatchObject({ value: "sav" });
    expect(parseChoice("current", options)).toMatchObject({ value: "cur" });
    expect(parseChoice("savngs", options)).toMatchObject({ value: "sav" });
    expect(parseChoice("the second one", options)).toMatchObject({ value: "cur" });
    expect(parseChoice("पहला", options)).toMatchObject({ value: "sav" });
    expect(parseChoice("2", options)).toMatchObject({ value: "cur" });
    expect(parseChoice("fixed deposit", options).ok).toBe(false);
  });
});

describe("parseAnswer", () => {
  it("title-cases spoken names but keeps typed ones as typed", () => {
    expect(parseAnswer(info("name"), "jay shah.")).toMatchObject({ value: "Jay Shah" });
    expect(parseAnswer(info("name"), "jay shah", true)).toMatchObject({ value: "jay shah" });
  });

  it("parses PAN and PIN code", () => {
    expect(parseAnswer(info("pan"), "a b c d e 1 2 3 4 f")).toMatchObject({ value: "ABCDE1234F" });
    expect(parseAnswer(info("pan"), "hello").ok).toBe(false);
    expect(parseAnswer(info("pincode"), "three eight zero zero zero one")).toMatchObject({ value: "380001" });
  });

  it("maps checkbox answers to yes/no", () => {
    expect(parseAnswer(info("check"), "haan")).toMatchObject({ value: "yes" });
    expect(parseAnswer(info("check"), "no")).toMatchObject({ value: "no" });
    expect(parseAnswer(info("check"), "maybe").ok).toBe(false);
  });

  it("rejects empty answers", () => {
    expect(parseAnswer(info("text"), "  ").ok).toBe(false);
  });
});

describe("names (speech-to-text is weakest here)", () => {
  const name = (label = "Full name (as on PAN card)") => info("name", { label });

  it("rejects what the recognizer makes of short names, instead of filling it", () => {
    expect(parseAnswer(name(), "G").ok).toBe(false); // "Jay" heard as "G" (real report)
    expect(parseAnswer(name(), "J K").ok).toBe(false);
    expect(parseAnswer(name(), "yes").ok).toBe(false);
    expect(parseAnswer(name(), "98250").ok).toBe(false);
    expect(parseAnswer(name(), "R. K. Sharma")).toMatchObject({ value: "R. K. Sharma" }); // initials + surname are fine
  });

  it("strips lead-ins in English, Hinglish, Hindi and Gujarati", () => {
    expect(parseAnswer(name(), "my name is jay shah")).toMatchObject({ value: "Jay Shah" });
    expect(parseAnswer(name(), "mera naam Jay Shah hai")).toMatchObject({ value: "Jay Shah" });
    expect(parseAnswer(name("Father's or spouse's name"), "mere papa ka naam Rakesh Shah hai")).toMatchObject({ value: "Rakesh Shah" });
    expect(parseAnswer(info("email"), "my email is jay at gmail dot com")).toMatchObject({ value: "jay@gmail.com" });
    expect(parseAnswer(info("phone"), "my mobile number is 98250 12345")).toMatchObject({ value: "9825012345" });
    // Typed answers are taken as typed.
    expect(parseAnswer(name(), "My Name Is Unusual", true)).toMatchObject({ value: "My Name Is Unusual" });
  });

  it("writes a Hindi- or Gujarati-script name in English letters on an English form", () => {
    expect(parseAnswer(name(), "मेरा नाम जय शाह है")).toMatchObject({ value: "Jay Shah" });
    expect(parseAnswer(name(), "प्रिया शर्मा")).toMatchObject({ value: "Priya Sharma" });
    expect(parseAnswer(name(), "રાકેશ પટેલ")).toMatchObject({ value: "Rakesh Patel" });
    // A form whose label is itself in Hindi keeps the script.
    expect(parseAnswer(name("पूरा नाम"), "जय शाह")).toMatchObject({ value: "जय शाह" });
  });
});
