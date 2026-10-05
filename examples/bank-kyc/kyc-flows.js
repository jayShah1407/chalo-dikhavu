// Raahi setup for the Bharat Demo Bank KYC demo.
//
// The whole 5-step KYC is described with one `form:` step per wizard page. Raahi reads
// each field and writes the questions itself. The bank only adds:
//   - `knowledge`: what the AI may use to answer "why?" questions,
//   - `why`: exact, pre-approved answers for the most-asked fields (free; no AI call),
//   - `confirm: "auto"` on the "Continue" buttons, so Raahi may press those for the
//     user. The final "Submit KYC" is still pressed by the user.
//
// The knowledge below is illustrative text for a fictional bank. A real bank should use
// text reviewed by its own compliance team.

globalThis.RAAHI_BANK_KNOWLEDGE = `
About: Bharat Demo Bank is a fictional bank used to demonstrate Raahi. Support: call 1800-000-0000 (demo number) or email support@bharatdemobank.example.

What KYC is and why it's needed:
KYC means Know Your Customer: the bank verifies who you are and where you live. Every bank in India must do this under the Prevention of Money Laundering Act, 2002 and the Reserve Bank of India's KYC Master Direction. It makes sure the account really belongs to you, protects you if someone tries to open or use an account in your name, and helps stop fraud, money laundering and terrorist financing. Bharat Demo Bank limits some services on accounts whose KYC is pending, and asks customers to update KYC from time to time (re-KYC).

Personal details: name as on PAN, date of birth, gender, and father's or spouse's name are the standard identity fields of a KYC record. The father's or spouse's name helps tell apart people with the same name and date of birth. Your mobile number and email are used for alerts and to reach you about your KYC.

PAN: Indian income-tax rules require a PAN to open a bank account. If you don't have a PAN, you can submit Form 60 at a branch instead. The bank verifies the PAN with the Income Tax Department.

Aadhaar: Giving Aadhaar is voluntary at Bharat Demo Bank. It can make verification faster, but you can complete KYC with other officially valid documents instead, such as a passport, driving licence or voter ID, at a branch. If you give it, the bank stores it masked and shows only the last four digits. Never share an Aadhaar OTP with anyone who calls you.

Occupation and annual income: banks must build a customer profile and assess risk under RBI's KYC rules. These answers help the bank understand what kind of account activity to expect. At Bharat Demo Bank they don't decide whether you get a basic savings account.

Politically exposed person (PEP): someone who holds or has held a prominent public position, such as a senior politician, senior government, judicial or military official, or a senior executive of a government-owned company, and their close family members and associates. Banks must apply extra checks for PEPs under anti-money-laundering rules. Answering Yes does not stop you from opening an account.

Tax residency (FATCA/CRS): Indian income-tax rules require banks to collect a self-declaration of tax residency, so that accounts of people who pay tax in other countries can be reported under FATCA and CRS. Most Indian residents answer No.

Address: the bank needs your current address to verify it and to send you communication. The PIN code helps confirm the address.

Documents: a copy of your PAN card lets the bank match the PAN you entered. Your signature is used to verify instructions you give the bank, such as cheques.

Consent: you allow the bank to verify your details with the authorities that issued your documents and to upload your KYC record to the Central KYC Records Registry (CKYCR), so you don't have to repeat full KYC at other regulated institutions.

Safety: Bharat Demo Bank will never ask for your OTP, PIN, password or CVV by phone, SMS, email or chat. If someone does, it's fraud: hang up and report it on the national cyber fraud helpline 1930 or at cybercrime.gov.in.

How long it takes: after you submit, verification usually completes within 2 working days at Bharat Demo Bank (demo policy), and you'll get an SMS.
`;

// Exact, pre-approved answers for the most-asked fields (no AI call, no tokens).
const WHY = {
  pan: {
    en: "Indian income-tax rules require a PAN to open a bank account. We verify it with the Income Tax Department. If you don't have one, you can submit Form 60 at a branch.",
    hi: "बैंक खाता खोलने के लिए आयकर नियमों के तहत PAN ज़रूरी है। हम इसे आयकर विभाग से वेरिफ़ाई करते हैं। अगर आपके पास PAN नहीं है, तो आप ब्रांच में फ़ॉर्म 60 दे सकते हैं।",
  },
  aadhaar: {
    en: "Aadhaar is optional here. It can make verification faster, but you can skip it and use another document like a passport or voter ID instead. We only ever show the last four digits.",
    hi: "यहाँ Aadhaar देना ज़रूरी नहीं है। इससे वेरिफ़िकेशन जल्दी हो सकता है, पर आप इसे छोड़कर पासपोर्ट या वोटर ID जैसा दूसरा दस्तावेज़ दे सकते हैं। हम सिर्फ़ आख़िरी चार अंक दिखाते हैं।",
  },
  pep: {
    en: "A politically exposed person is someone with a prominent public role, like a senior politician or official, or their close family. Banks apply extra checks for them by law. Saying yes doesn't stop you from opening an account.",
    hi: "राजनीतिक रूप से प्रमुख व्यक्ति वह है जो किसी बड़े सार्वजनिक पद पर है या रहा है, जैसे वरिष्ठ नेता या अधिकारी, या उनका करीबी परिवार। कानून के तहत बैंक ऐसे लोगों की अतिरिक्त जाँच करते हैं। हाँ कहने से आपका खाता खुलना नहीं रुकता।",
  },
  foreignTax: {
    en: "Banks must ask this under Indian tax rules for FATCA and CRS reporting. If you only pay tax in India, the answer is No.",
    hi: "FATCA और CRS रिपोर्टिंग के लिए भारतीय टैक्स नियमों के तहत बैंक को यह पूछना होता है। अगर आप सिर्फ़ भारत में टैक्स देते हैं, तो जवाब है 'नहीं'।",
  },
  parentName: {
    en: "It's a standard part of every KYC record in India and helps tell apart people who share the same name and date of birth.",
    hi: "यह भारत में हर KYC रिकॉर्ड का एक सामान्य हिस्सा है और एक जैसे नाम और जन्मतिथि वाले लोगों में फ़र्क करने में मदद करता है।",
  },
};

globalThis.RAAHI_FLOWS = [
  {
    id: "complete-kyc",
    title: { en: "Complete your KYC", hi: "अपना KYC पूरा करें", gu: "તમારું KYC પૂર્ણ કરો" },
    keywords: {
      en: ["complete kyc", "do kyc", "kyc pending", "update kyc", "verify account", "know your customer", "re kyc"],
      hi: ["kyc karna", "kyc pura karna", "kyc kaise kare", "केवाईसी", "KYC पूरा करना", "खाता वेरिफ़ाई"],
      gu: ["kyc karvu", "KYC પૂર્ણ કરવું"],
    },
    steps: [
      { path: "/", target: { selector: "a", text: "Complete your KYC" }, action: "click" },
      { path: "/kyc", form: "#kyc-personal", confirm: "auto", fields: { "#parentName": { why: WHY.parentName } } },
      { form: "#kyc-identity", confirm: "auto", fields: {
          "#pan": { why: WHY.pan },
          "#aadhaar": { why: WHY.aadhaar },
          'input[name="pep"]': { why: WHY.pep },
          'input[name="foreignTax"]': { why: WHY.foreignTax },
      } },
      { form: "#kyc-address", confirm: "auto" },
      { form: "#kyc-documents", confirm: "auto" },
      // Final page: the user ticks the declaration and presses "Submit KYC" themselves.
      { form: "#kyc-review" },
    ],
  },
];
