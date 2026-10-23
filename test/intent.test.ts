import { describe, expect, it } from "vitest";
import { rankFlows, resolve, tokenize } from "../src/intent";
import type { Flow } from "../src/types";

const flows: Flow[] = [
  {
    id: "find-teacher",
    title: { en: "Find a teacher", hi: "टीचर कैसे ढूंढें" },
    keywords: { en: ["search tutor", "filter teachers"], hi: ["teacher dhundhna", "शिक्षक खोजें"] },
    steps: [],
  },
  {
    id: "book-class",
    title: { en: "Book a class", hi: "क्लास बुक करें" },
    keywords: { en: ["send request", "schedule class"], hi: ["class book karna"] },
    steps: [],
  },
  {
    id: "join-class",
    title: { en: "Join a live class", hi: "लाइव क्लास जॉइन करें" },
    keywords: ["join video class", "classroom"],
    steps: [],
  },
  { id: "wallet", title: "Check my wallet", keywords: ["refund", "balance", "wallet credit"], steps: [] },
];

const startsFlow = (q: string) => {
  const r = resolve(q, flows);
  return r.kind === "start" ? r.flow.id : r.kind;
};

describe("tokenize", () => {
  it("drops filler words in English, Hinglish and Hindi", () => {
    expect(tokenize("How do I find a teacher?")).toEqual(["find", "teacher"]);
    expect(tokenize("teacher kaise dhunde")).toEqual(["teacher", "dhunde"]);
    expect(tokenize("मुझे शिक्षक कैसे खोजें।")).toEqual(["शिक्षक", "खोजें"]);
  });
});

describe("resolve", () => {
  it("starts the right flow for plain English", () => {
    expect(startsFlow("how do I find a teacher")).toBe("find-teacher");
    expect(startsFlow("I want to book a class")).toBe("book-class");
    expect(startsFlow("where is my refund")).toBe("wallet");
  });

  it("understands Hindi and Hinglish", () => {
    expect(startsFlow("टीचर कैसे ढूंढें")).toBe("find-teacher");
    expect(startsFlow("mujhe class book karna hai")).toBe("book-class");
  });

  it("tolerates plurals and speech-to-text typos", () => {
    expect(startsFlow("find teachers")).toBe("find-teacher");
    expect(startsFlow("find techer")).toBe("find-teacher");
  });

  it("offers choices when the question is ambiguous", () => {
    const r = resolve("class", flows);
    expect(r.kind).toBe("choose");
    if (r.kind === "choose") {
      expect(r.options.map((f) => f.id)).toEqual(expect.arrayContaining(["book-class", "join-class"]));
    }
  });

  it("gives up on unrelated questions", () => {
    expect(startsFlow("what is the weather today")).toBe("none");
    expect(startsFlow("")).toBe("none");
  });

  it("ranks best match first", () => {
    expect(rankFlows("join video class", flows)[0].flow.id).toBe("join-class");
  });
});
