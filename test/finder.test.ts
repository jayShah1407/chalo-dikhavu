// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { findNow, waitFor } from "../src/finder";
import { isStaticPath, matchPath } from "../src/paths";

// jsdom has no layout, so skip the visibility check here.
const find = (t: Parameters<typeof findNow>[0]) => findNow(t, document, false);

beforeEach(() => {
  document.body.innerHTML = `
    <aside>
      <a href="/student">Dashboard</a>
      <a href="/student/teachers">Find Teachers</a>
    </aside>
    <main>
      <div class="card">Subject filter panel <button type="button">Subject</button></div>
      <button aria-label="Close dialog">x</button>
      <input id="note" placeholder="Anything the teacher should know" />
      <button type="submit">Send request</button>
    </main>`;
});

describe("findNow", () => {
  it("finds by CSS selector", () => {
    expect(find('aside a[href="/student/teachers"]')?.textContent).toBe("Find Teachers");
  });

  it("finds by visible text, preferring the tight element over its wrapper", () => {
    expect(find({ text: "Subject" })?.tagName).toBe("BUTTON");
  });

  it("finds by aria-label and placeholder", () => {
    expect(find({ text: "close dialog" })?.textContent).toBe("x");
    expect(find({ text: "teacher should know" })?.id).toBe("note");
  });

  it("combines selector and text", () => {
    expect(find({ selector: "main button", text: "send" })?.getAttribute("type")).toBe("submit");
  });

  it("uses the first fallback that matches", () => {
    expect(find(["#does-not-exist", { text: "Dashboard" }])?.getAttribute("href")).toBe("/student");
  });

  it("returns null for missing or invalid selectors instead of throwing", () => {
    expect(find("#nope")).toBeNull();
    expect(find("a[[broken")).toBeNull();
  });
});

describe("waitFor", () => {
  it("resolves when the element is rendered later", async () => {
    setTimeout(() => {
      const b = document.createElement("button");
      b.id = "late";
      b.getBoundingClientRect = () => ({ width: 10, height: 10 }) as DOMRect;
      document.body.append(b);
    }, 50);
    expect((await waitFor("#late", 1000))?.id).toBe("late");
  });

  it("resolves null on timeout", async () => {
    expect(await waitFor("#never", 100)).toBeNull();
  });
});

describe("matchPath", () => {
  it("matches static paths and params", () => {
    expect(matchPath("/student/teachers", "/student/teachers/")).toBe(true);
    expect(matchPath("/student/teachers/:id", "/student/teachers/abc123")).toBe(true);
    expect(matchPath("/student/teachers/:id", "/student/teachers")).toBe(false);
    expect(matchPath("/student", "/student/wallet")).toBe(false);
    expect(matchPath("/docs/*", "/docs/a/b")).toBe(true);
  });

  it("knows which paths can be navigated to", () => {
    expect(isStaticPath("/student/wallet")).toBe(true);
    expect(isStaticPath("/student/teachers/:id")).toBe(false);
  });
});
