// @vitest-environment jsdom
// Accuracy corpus: how real people answer form questions out loud, in English, Hinglish,
// Hindi and Gujarati, and what should end up in the field. Add a row for every
// misunderstanding reported from the field.
import { describe, expect, it } from "vitest";
import { parseAnswer, parseYesNo, spokenCode } from "../src/answers";
import { describeField, type FieldInfo, type FieldKind } from "../src/fields";
import { spokenDigits, spokenNumber } from "../src/numbers";

const info = (kind: FieldKind, extra: Partial<FieldInfo> = {}) =>
  ({ kind, label: "x", sensitive: false, required: false, options: [], isoDate: false, ...extra }) as FieldInfo;

/** [said, expected value, or null when it must be refused and asked again] */
type Row = [string, string | null];

function check(kind: FieldKind, rows: Row[], extra: Partial<FieldInfo> = {}) {
  for (const [said, want] of rows) {
    const got = parseAnswer(info(kind, extra), said);
    if (want === null) expect(got.ok, `"${said}" should be refused, got ${JSON.stringify(got)}`).toBe(false);
    else expect(got.ok ? got.value : got, `"${said}"`).toBe(want);
  }
}

describe("phone numbers", () => {
  it("understands digits said singly, in pairs, doubled, and in four languages", () => {
    check("phone", [
      ["nine eight two five zero one two three four five", "9825012345"],
      ["ninety eight twenty five zero one two three four five", "9825012345"],
      ["double nine eight two five zero triple four five", "9982504445"],
      ["plus nine one nine eight two five zero one two three four five", "9825012345"],
      ["98250 12345", "9825012345"],
      ["+91 98250-12345", "9825012345"],
      ["0 98250 12345", "9825012345"],
      ["नौ आठ दो पाँच शून्य एक दो तीन चार पाँच", "9825012345"],
      ["अट्ठानवे पच्चीस शून्य एक दो तीन चार पाँच", "9825012345"],
      ["નવ આઠ બે પાંચ શૂન્ય એક બે ત્રણ ચાર પાંચ", "9825012345"],
      ["mera number hai 98250 12345", "9825012345"],
      ["+44 20 7946 0958", "+442079460958"],
    ]);
  });

  it("refuses a number with a digit lost or doubled, instead of filling it", () => {
    check("phone", [
      ["98250 1234", null],
      ["98250 123456", null],
      ["nine eight two", null],
    ]);
    expect(parseAnswer(info("phone"), "98250 1234")).toMatchObject({ ok: false, why: "hintPhone", vars: { count: 9 } });
  });

  it("trusts typed landlines", () => {
    expect(parseAnswer(info("phone"), "26561234", true)).toMatchObject({ value: "26561234" });
  });
});

describe("PIN codes", () => {
  it("reads six digits however they're said", () => {
    check("pincode", [
      ["three eight zero zero zero nine", "380009"],
      ["three eighty zero zero nine", "380009"],
      ["380 009", "380009"],
      ["तीन आठ शून्य शून्य शून्य नौ", "380009"],
      ["38000", null],
    ]);
  });
});

describe("amounts", () => {
  it("understands lakh, crore and Hindi fractions", () => {
    expect(spokenNumber("two lakh fifty thousand")).toBe(250000);
    expect(spokenNumber("5 lakh")).toBe(500000);
    expect(spokenNumber("1.5 lakh")).toBe(150000);
    expect(spokenNumber("saadhe teen lakh")).toBe(350000);
    expect(spokenNumber("dedh lakh")).toBe(150000);
    expect(spokenNumber("dhai lakh rupees")).toBe(250000);
    expect(spokenNumber("paune do lakh")).toBe(175000);
    expect(spokenNumber("one crore twenty lakh")).toBe(12000000);
    expect(spokenNumber("₹ 2,50,000")).toBe(250000);
    expect(spokenNumber("twenty five thousand five hundred")).toBe(25500);
    expect(spokenNumber("पांच लाख")).toBe(500000);
    expect(spokenNumber("साढ़े तीन लाख")).toBe(350000);
    expect(spokenNumber("ढाई हज़ार")).toBe(2500);
    expect(spokenNumber("સાડા ત્રણ લાખ")).toBe(350000);
    expect(spokenNumber("about nothing")).toBeNull();
  });

  it("fills number fields with the quantity", () => {
    check("number", [
      ["two lakh fifty thousand", "250000"],
      ["twenty five", "25"],
      ["my age is thirty two", "32"],
      ["2,50,000", "250000"],
      ["12.5", "12.5"],
    ]);
  });
});

describe("digit runs", () => {
  it("joins tens and units, but keeps zeros", () => {
    expect(spokenDigits("ninety eight")).toBe("98");
    expect(spokenDigits("ninety")).toBe("90");
    expect(spokenDigits("twenty zero five")).toBe("2005");
    expect(spokenDigits("nineteen ninety eight")).toBe("1998");
    expect(spokenDigits("nine hundred")).toBe("900");
  });
});

describe("dates", () => {
  it("understands spoken dates, ordinals and spoken years", () => {
    check("date", [
      ["14 July 1998", "1998-07-14"],
      ["fourteenth July nineteen ninety eight", "1998-07-14"],
      ["the fourteenth of July, 1998", "1998-07-14"],
      ["July twenty first two thousand five", "2005-07-21"],
      ["14/07/98", "1998-07-14"],
      ["14-7-05", "2005-07-14"],
      ["14 July 98", "1998-07-14"],
      ["चौदह जुलाई उन्नीस सौ अट्ठानवे", "1998-07-14"],
      ["14 जुलाई 1998", "1998-07-14"],
      ["મારી જન્મ તારીખ 14 જુલાઈ 1998 છે", "1998-07-14"],
      ["1 May 2001", "2001-05-01"],
      ["31 February 1998", null],
      ["sometime in July", null],
    ], { isoDate: true });
  });

  it("writes the date in the format the field asks for", () => {
    check("date", [["14 July 1998", "14-07-1998"]], { dateFormat: "DD-MM-YYYY" });
    check("date", [["14 July 1998", "1998/07/14"]], { dateFormat: "YYYY/MM/DD" });
    check("date", [["07/14/1998", "07/14/1998"]], { dateFormat: "MM/DD/YYYY" });
    check("date", [["14 July 1998", "14/07/1998"]]);
  });
});

describe("emails", () => {
  it("understands spoken emails in English, Hindi and Gujarati", () => {
    check("email", [
      ["jay dot shah at gmail dot com", "jay.shah@gmail.com"],
      ["jay shah one four at gmail dot com", "jayshah14@gmail.com"],
      ["jay underscore shah at the rate yahoo dot co dot in", "jay_shah@yahoo.co.in"],
      ["my email is jay at gmail dot com", "jay@gmail.com"],
      ["जय डॉट शाह एट जीमेल डॉट कॉम", "jay.shah@gmail.com"],
      ["jay एट द रेट जीमेल डॉट कॉम", "jay@gmail.com"],
      ["જય એટ જીમેલ ડોટ કોમ", "jay@gmail.com"],
      ["jay at gmail", null],
    ]);
  });
});

describe("PAN, IFSC and other codes", () => {
  it("reads PANs spelled out, with 'for' words and Hindi letter names", () => {
    check("pan", [
      ["a b c d e 1 2 3 4 f", "ABCDE1234F"],
      ["abcde1234f", "ABCDE1234F"],
      ["A for apple B C D E one two three four F", "ABCDE1234F"],
      ["my PAN number is abcde 1234 f", "ABCDE1234F"],
      ["a b c d e one two three O f", "ABCDE1230F"],
      ["ए बी सी डी ई एक दो तीन चार एफ", "ABCDE1234F"],
      ["a b c d 1 2 3 4 f", null],
    ]);
  });

  it("reads IFSC codes, fixing O for zero in the fifth place", () => {
    check("ifsc", [
      ["s b i n zero zero zero one two three four", "SBIN0001234"],
      ["SBIN 000 1234", "SBIN0001234"],
      ["s b i n o double zero one two three four", "SBIN0001234"],
      ["एसबीआईएन शून्य शून्य शून्य एक दो तीन चार", "SBIN0001234"],
      ["h d f c zero one two three four five six", "HDFC0123456"],
      ["s b i n one two three", null],
    ]);
  });

  it("spells other IDs", () => {
    expect(spokenCode("g j zero one a b one two three four")).toBe("GJ01AB1234");
    expect(spokenCode("two four a a a a a one two three four a one z five")).toBe("24AAAAA1234A1Z5");
    expect(spokenCode("one two three four five six seven eight nine")).toBe("123456789");
  });
});

describe("yes / no", () => {
  it("understands how people really agree and disagree", () => {
    const rows: Array<[string, boolean | null]> = [
      ["yes", true],
      ["haan sahi hai", true],
      ["sahi hai na", true],
      ["haan na", true],
      ["bilkul", true],
      ["ji haan", true],
      ["no problem", true],
      ["nothing wrong", true],
      ["galat nahi hai", true],
      ["of course", true],
      ["हाँ जी बिल्कुल", true],
      ["હા બરાબર", true],
      ["no", false],
      ["nahi galat hai", false],
      ["no that's wrong", false],
      ["ना", false],
      ["ના", false],
      ["not sure", null],
      ["pata nahi", null],
      ["पता नहीं", null],
    ];
    for (const [said, want] of rows) expect(parseYesNo(said), said).toBe(want);
  });
});

describe("names", () => {
  it("strips the many ways people introduce their name", () => {
    check("name", [
      ["myself Jay Shah", "Jay Shah"],
      ["naam Jay Shah hai", "Jay Shah"],
      ["mera naam hai Jay Shah", "Jay Shah"],
      ["i am jay shah", "Jay Shah"],
      ["G", null],
    ], { label: "Full name" });
  });
});

describe("the field's own rules", () => {
  const field = (html: string) => {
    document.body.innerHTML = html;
    return describeField(document.querySelector("input")!);
  };

  it("refuses values longer than maxlength or not matching pattern", () => {
    expect(parseAnswer(field(`<label>Customer ID <input id="c" maxlength="6"></label>`), "1234567")).toMatchObject({ ok: false, why: "hintTooLong", vars: { max: 6, count: 7 } });
    expect(parseAnswer(field(`<label>Customer ID <input id="c" pattern="[0-9]{6}"></label>`), "12345a")).toMatchObject({ ok: false, why: "hintFormat" });
    expect(parseAnswer(field(`<label>Customer ID <input id="c" pattern="[0-9]{6}"></label>`), "123456")).toMatchObject({ ok: true });
  });

  it("refuses numbers and dates out of range", () => {
    expect(parseAnswer(field(`<label>Age <input type="number" min="18" max="100"></label>`), "sixteen")).toMatchObject({ ok: false, why: "hintMin", vars: { min: "18" } });
    expect(parseAnswer(field(`<label>Date of birth <input type="date" max="2008-01-01"></label>`), "14 July 2010")).toMatchObject({ ok: false, why: "hintMax", vars: { max: "1 January 2008" } });
  });
});

describe("field detection", () => {
  const kindOf = (html: string) => {
    document.body.innerHTML = html;
    return describeField(document.querySelector("input")!);
  };

  it("spots IFSC, ID numbers and date formats", () => {
    expect(kindOf(`<label>IFSC code <input></label>`).kind).toBe("ifsc");
    expect(kindOf(`<label>Account number <input></label>`).kind).toBe("code");
    expect(kindOf(`<label>GSTIN <input></label>`).kind).toBe("code");
    expect(kindOf(`<label>Name as per passport <input></label>`).kind).toBe("name");
    expect(kindOf(`<label>Account holder name <input></label>`).kind).toBe("name");
    const dob = kindOf(`<label>Date of birth <input placeholder="DD-MM-YYYY"></label>`);
    expect([dob.kind, dob.dateFormat]).toEqual(["date", "DD-MM-YYYY"]);
    const joined = kindOf(`<label>Joining <input placeholder="dd/mm/yyyy"></label>`);
    expect([joined.kind, joined.dateFormat]).toEqual(["date", "DD/MM/YYYY"]);
  });

  it("asks for a PAN card number out loud: it isn't a payment card", () => {
    const pan = kindOf(`<label>PAN card number <input></label>`);
    expect([pan.kind, pan.sensitive]).toEqual(["pan", false]);
    expect(kindOf(`<label>Card number <input></label>`).sensitive).toBe(true);
  });
});

describe("odd input never crashes", () => {
  it("handles words that are also built-in property names", () => {
    for (const kind of ["date", "email", "number", "phone", "pan", "ifsc", "code", "name", "pincode"] as FieldKind[]) {
      for (const said of ["constructor", "__proto__ toString", "hasOwnProperty valueOf"]) {
        expect(() => parseAnswer(info(kind), said)).not.toThrow();
      }
    }
  });
});

describe("after filling, the site's own validation", () => {
  it("is noticed, with the site's error message", async () => {
    const { rejectedBySite } = await import("../src/assist");
    document.body.innerHTML = `<label>Customer ID <input id="c" aria-describedby="c-err"></label><p id="c-err">Customer ID must start with CU</p>`;
    const field = describeField(document.querySelector("input")!);
    expect(rejectedBySite(field)).toBeNull();
    field.el.setAttribute("aria-invalid", "true");
    expect(rejectedBySite(field)).toBe("Customer ID must start with CU");

    document.body.innerHTML = `<label>Email <input type="email"></label>`;
    const email = describeField(document.querySelector("input")!);
    (email.el as HTMLInputElement).value = "not-an-email";
    expect(rejectedBySite(email)).toBeTruthy();
    (email.el as HTMLInputElement).value = "jay@gmail.com";
    expect(rejectedBySite(email)).toBeNull();
  });
});
