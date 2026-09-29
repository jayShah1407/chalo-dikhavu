// Demo guides for the Tution Techer student portal (http://localhost:3001/student).
// Loaded by the dev extension; with the npm package you'd import this array instead.
// Targets use real links, visible text and ids, so the app needs no changes.

const NAV = (href) => `aside a[href="${href}"]`;

globalThis.RAAHI_FLOWS = [
  {
    id: "find-teacher",
    title: { en: "Find a teacher", hi: "टीचर कैसे ढूंढें" },
    keywords: {
      en: ["find teacher", "search tutor", "filter teachers", "choose teacher", "browse teachers"],
      hi: ["teacher dhundhna", "teacher kaise dhunde", "tutor chahiye", "टीचर ढूंढना", "शिक्षक खोजें"],
    },
    steps: [
      {
        path: "/student/*",
        target: NAV("/student/teachers"),
        say: {
          en: "Click “Find Teachers” in the left menu.",
          hi: "बाएँ मेनू में “Find Teachers” पर क्लिक करें।",
        },
      },
      {
        path: "/student/teachers",
        target: { selector: "main button", text: "Subject" },
        advance: "next",
        say: {
          en: "Use these filters to narrow down teachers. Start with the subject you want to learn.",
          hi: "इन फ़िल्टर से टीचर चुनें। सबसे पहले वह विषय चुनें जो आप सीखना चाहते हैं।",
        },
      },
      {
        target: { selector: "main button", text: "Language" },
        advance: "next",
        say: {
          en: "Pick the language you want to be taught in.",
          hi: "वह भाषा चुनें जिसमें आप पढ़ना चाहते हैं।",
        },
      },
      {
        target: "#sort",
        advance: "next",
        say: {
          en: "Sort teachers by rating or by price.",
          hi: "टीचर को रेटिंग या कीमत के हिसाब से क्रम में लगाएँ।",
        },
      },
      {
        target: 'main a[href^="/student/teachers/"]',
        say: {
          en: "Click a teacher's card to open their profile.",
          hi: "किसी टीचर के कार्ड पर क्लिक करके उनकी प्रोफ़ाइल खोलें।",
        },
      },
      {
        path: "/student/teachers/:id",
        target: { selector: "h2", text: "Send request" },
        advance: "next",
        say: {
          en: "Here you see their experience, rate and reviews. When you're ready, send them a request from this box.",
          hi: "यहाँ उनका अनुभव, फीस और रिव्यू दिखते हैं। तैयार हों तो इसी बॉक्स से रिक्वेस्ट भेजें।",
        },
      },
    ],
  },

  {
    id: "book-class",
    title: { en: "Book a class", hi: "क्लास बुक करें" },
    keywords: {
      en: ["book class", "send request", "schedule class", "request teacher", "book lesson", "enroll course"],
      hi: ["class book karna", "class kaise book kare", "request bhejna", "क्लास बुक करना", "रिक्वेस्ट भेजें"],
    },
    steps: [
      {
        path: "/student/*",
        target: NAV("/student/teachers"),
        say: {
          en: "First, open “Find Teachers”.",
          hi: "पहले “Find Teachers” खोलें।",
        },
      },
      {
        path: "/student/teachers",
        target: 'main a[href^="/student/teachers/"]',
        say: {
          en: "Choose a teacher you like.",
          hi: "अपनी पसंद का टीचर चुनें।",
        },
      },
      {
        path: "/student/teachers/:id",
        target: { selector: "label", text: "Custom one-off class" },
        say: {
          en: "You can pick one of the teacher's packages, or choose “Custom one-off class” to set your own time. Let's pick custom.",
          hi: "आप टीचर का कोई पैकेज चुन सकते हैं, या “Custom one-off class” चुनकर अपना समय तय कर सकते हैं। चलिए custom चुनते हैं।",
        },
      },
      {
        target: "#scheduledAt",
        advance: "input",
        say: {
          en: "Pick the date and time for your class.",
          hi: "अपनी क्लास की तारीख और समय चुनें।",
        },
      },
      {
        target: "#studentNote",
        advance: "next",
        say: {
          en: "Optionally, add a note for the teacher.",
          hi: "चाहें तो टीचर के लिए एक नोट लिखें।",
        },
      },
      {
        target: { selector: 'button[type="submit"]', text: "Send request" },
        say: {
          en: "Click “Send request”. The teacher will accept or decline, and you can track it under My Enrollments.",
          hi: "“Send request” पर क्लिक करें। टीचर स्वीकार या मना करेंगे, और आप इसे My Enrollments में देख सकते हैं।",
        },
      },
    ],
  },

  {
    id: "join-class",
    title: { en: "Join a live class", hi: "लाइव क्लास जॉइन करें" },
    keywords: {
      en: ["join class", "video class", "classroom", "start class", "live class", "join call"],
      hi: ["class join karna", "class kaise join kare", "video call", "क्लास जॉइन", "लाइव क्लास"],
    },
    steps: [
      {
        path: "/student/*",
        target: NAV("/student/classroom"),
        say: {
          en: "Open “Classroom” from the menu.",
          hi: "मेनू से “Classroom” खोलें।",
        },
      },
      {
        path: "/student/classroom",
        target: [{ selector: "button, a", text: "Join class" }, { selector: "button, a", text: "Join" }, "main h1"],
        advance: "next",
        say: {
          en: "Your active courses and upcoming classes are listed here. Click “Join” when it's time — your teacher may already be online.",
          hi: "आपके कोर्स और आने वाली क्लास यहाँ दिखती हैं। समय होने पर “Join” पर क्लिक करें — टीचर शायद पहले से ऑनलाइन हों।",
        },
      },
    ],
  },

  {
    id: "wallet",
    title: { en: "Check wallet & refunds", hi: "वॉलेट और रिफ़ंड देखें" },
    keywords: {
      en: ["wallet", "refund", "balance", "credit", "money back", "payment history"],
      hi: ["paisa wapas", "refund kab milega", "wallet kaise dekhe", "पैसे वापस", "रिफ़ंड", "वॉलेट"],
    },
    steps: [
      {
        path: "/student/*",
        target: NAV("/student/wallet"),
        say: {
          en: "Open “Wallet” from the menu.",
          hi: "मेनू से “Wallet” खोलें।",
        },
      },
      {
        path: "/student/wallet",
        target: '[data-testid="student-wallet-balance"]',
        advance: "next",
        say: {
          en: "This is your wallet credit from refunds. It's used first when you pay for a course.",
          hi: "यह रिफ़ंड से मिला आपका वॉलेट बैलेंस है। कोर्स की पेमेंट में पहले यही इस्तेमाल होता है।",
        },
      },
      {
        target: { selector: "main button", text: "Wallet history" },
        advance: "next",
        say: {
          en: "See every refund and wallet entry here.",
          hi: "सभी रिफ़ंड और वॉलेट की एंट्री यहाँ देखें।",
        },
      },
    ],
  },

  {
    id: "my-enrollments",
    title: { en: "Track my requests & courses", hi: "मेरी रिक्वेस्ट और कोर्स देखें" },
    keywords: {
      en: ["my enrollments", "my requests", "request status", "my courses", "pay for course"],
      hi: ["request ka status", "mere course", "मेरे कोर्स", "रिक्वेस्ट का स्टेटस"],
    },
    steps: [
      {
        path: "/student/*",
        target: NAV("/student/enrollments"),
        say: {
          en: "Open “My Enrollments”.",
          hi: "“My Enrollments” खोलें।",
        },
      },
      {
        path: "/student/enrollments",
        target: "main h1",
        advance: "next",
        say: {
          en: "All your requests and courses live here. Once a teacher accepts, you can pay and join the video class from this page.",
          hi: "आपकी सारी रिक्वेस्ट और कोर्स यहाँ हैं। टीचर के स्वीकार करने पर आप यहीं से पेमेंट करके वीडियो क्लास जॉइन कर सकते हैं।",
        },
      },
    ],
  },
];
