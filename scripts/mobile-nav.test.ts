/**
 * Keyboard behaviour of the site header's mobile drawer (MobileNav):
 *
 *   - while the drawer is open, everything behind its scrim — the header's
 *     logo and hamburger, <main>, <footer> — carries `inert`, and the scrim
 *     itself does not (it has to stay clickable to close);
 *   - focus lands on the drawer's close button on open;
 *   - Tab from the drawer's last focusable wraps to its first, Shift+Tab
 *     from the first wraps to the last, and a Tab in between is left to the
 *     browser (whose default action, over an inert-marked page, can only
 *     land inside the drawer — emulated below, since jsdom has no default
 *     Tab action of its own);
 *   - Escape, the close button and the scrim all close it, drop `inert`
 *     from the page, and put focus back on the hamburger;
 *   - the closed drawer is inert, so its off-screen links aren't tabbable.
 *
 * Runs the real component under React in jsdom. next/link and usePathname
 * work without a Next router (they render a plain <a> and return null).
 *
 *   npm test
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";

const dom = new JSDOM(
  `<!doctype html><html><body>
    <header><div id="shell"><a id="logo" href="/">EssentialRegs</a><div id="nav-root"></div></div></header>
    <main><a id="page-link" href="/regulations">Browse</a></main>
    <footer><a id="footer-link" href="/terms">Terms</a></footer>
  </body></html>`,
  { url: "http://localhost/", pretendToBeVisual: true },
);
const { window } = dom;
// React and the component both expect browser globals.
Object.assign(globalThis, { window, self: window, document: window.document, HTMLElement: window.HTMLElement, Element: window.Element, Node: window.Node, KeyboardEvent: window.KeyboardEvent, MouseEvent: window.MouseEvent, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, "navigator", { value: window.navigator, configurable: true });
// next/link prefetches on idle; run that synchronously so its state update
// stays inside act() instead of firing from a timer after the test step.
window.requestIdleCallback = (cb) => (cb({ didTimeout: false, timeRemaining: () => 50 }), 1);
window.cancelIdleCallback = () => {};

test("mobile drawer: focus trap, inert page, focus return", async (t) => {
  const React = await import("react");
  const { act } = React;
  const { createRoot } = await import("react-dom/client");
  const { MobileNav } = await import("../src/components/MobileNav");

  const document = window.document;
  const $ = (sel: string) => {
    const el = document.querySelector<HTMLElement>(sel);
    assert.ok(el, `missing ${sel}`);
    return el;
  };
  const active = () => document.activeElement;
  const isInert = (el: Element) => el.hasAttribute("inert") || el.closest("[inert]") !== null;

  /** Fire a keydown on the focused element the way a browser would, then, if it wasn't prevented, do what the browser would do for Tab: move focus to the next/previous focusable element in document order that isn't inside an inert subtree. */
  function pressKey(key: string, shiftKey = false): boolean {
    const target = active() ?? document.body;
    const ev = new window.KeyboardEvent("keydown", { key, shiftKey, bubbles: true, cancelable: true });
    target.dispatchEvent(ev);
    if (ev.defaultPrevented || key !== "Tab") return ev.defaultPrevented;
    const all = Array.from(
      document.querySelectorAll<HTMLElement>('a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])'),
    ).filter((el) => !isInert(el));
    const i = all.indexOf(target as HTMLElement);
    const next = shiftKey ? all[i - 1] : all[i + 1];
    if (next) next.focus();
    else (document.activeElement as HTMLElement | null)?.blur(); // browser chrome
    return false;
  }
  async function press(key: string, shiftKey = false) {
    let prevented = false;
    await act(async () => {
      prevented = pressKey(key, shiftKey);
    });
    return prevented;
  }
  async function click(el: Element) {
    await act(async () => {
      el.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    });
  }

  const root = createRoot($("#nav-root"));
  await act(async () => {
    root.render(
      React.createElement(MobileNav, {
        authSlot: React.createElement("a", { id: "auth-link", href: "/login" }, "Log in"),
      }),
    );
  });

  const toggle = $('#nav-root > button[aria-expanded]');
  const drawer = $('[role="dialog"]');
  const scrim = $('#nav-root > [aria-hidden="true"]');
  const closeButton = drawer.querySelector<HTMLElement>("button")!;
  const drawerFocusables = () => Array.from(drawer.querySelectorAll<HTMLElement>("a[href], button, input"));
  const behindScrim = () => [$("#logo"), toggle, $("main"), $("footer")];


  await t.test("closed drawer: page is live, drawer is inert", () => {
    assert.equal(toggle.getAttribute("aria-expanded"), "false");
    assert.ok(drawer.hasAttribute("inert"), "closed drawer is inert");
    for (const el of behindScrim()) assert.ok(!isInert(el), `${el.id || el.tagName} is not inert while closed`);
  });

  await t.test("open: page behind the scrim is inert, focus moves to the close button", async () => {
    toggle.focus();
    await click(toggle);
    assert.equal(toggle.getAttribute("aria-expanded"), "true");
    assert.ok(!drawer.hasAttribute("inert"));
    for (const el of behindScrim()) assert.ok(el.hasAttribute("inert"), `${el.id || el.tagName} is inert while open`);
    assert.ok(!scrim.hasAttribute("inert"), "scrim stays clickable");
    assert.equal(active(), closeButton);
  });

  await t.test("Tab and Shift+Tab cycle inside the drawer", async () => {
    const items = drawerFocusables();
    assert.ok(items.length >= 4, "drawer has several focusables");
    assert.equal(items[0], closeButton);
    const last = items[items.length - 1];
    assert.equal(last.id, "auth-link", "last focusable is the auth slot link");

    // A full lap forward from the close button visits exactly the drawer's
    // controls, in order, and comes back round.
    const visited: Element[] = [];
    for (let i = 0; i < items.length; i++) {
      await press("Tab");
      visited.push(active()!);
    }
    assert.deepEqual(visited, [...items.slice(1), closeButton]);
    for (const el of visited) assert.ok(drawer.contains(el), "focus never left the drawer");

    // The wrap itself is the component's doing (preventDefault + focus),
    // not the emulated browser default.
    last.focus();
    assert.equal(await press("Tab"), true, "Tab on the last item is intercepted");
    assert.equal(active(), closeButton);
    assert.equal(await press("Tab", true), true, "Shift+Tab on the first item is intercepted");
    assert.equal(active(), last);

    // In between, the browser's own Tab is left alone.
    closeButton.focus();
    assert.equal(await press("Tab"), false, "Tab off the close button is not intercepted");
    assert.equal(active(), items[1]);

    // Backwards lap.
    closeButton.focus();
    for (let i = 0; i < items.length; i++) {
      await press("Tab", true);
      assert.ok(drawer.contains(active()!), "Shift+Tab stays inside");
    }
    assert.equal(active(), closeButton);

    // Focus that somehow ended up outside (e.g. programmatically) is pulled
    // back in on the next Tab.
    (active() as HTMLElement).blur();
    assert.equal(active(), document.body);
    assert.equal(await press("Tab"), true);
    assert.equal(active(), closeButton);
  });

  await t.test("Escape closes, un-inerts the page, and returns focus to the hamburger", async () => {
    assert.equal(await press("Escape"), false);
    assert.equal(toggle.getAttribute("aria-expanded"), "false");
    assert.ok(drawer.hasAttribute("inert"));
    for (const el of behindScrim()) assert.ok(!isInert(el), `${el.id || el.tagName} live again`);
    assert.equal(active(), toggle);
  });

  await t.test("close button and scrim click also return focus to the hamburger", async () => {
    await click(toggle);
    assert.equal(active(), closeButton);
    await click(closeButton);
    assert.equal(active(), toggle);
    assert.ok(drawer.hasAttribute("inert"));

    await click(toggle);
    assert.equal(active(), closeButton);
    closeButton.blur(); // a real click on the (unfocusable) scrim drops focus on <body>
    await click(scrim);
    assert.equal(toggle.getAttribute("aria-expanded"), "false");
    assert.equal(active(), toggle);
    for (const el of behindScrim()) assert.ok(!isInert(el));
  });

  await t.test("closed drawer's links are out of the tab order", async () => {
    toggle.focus();
    await press("Tab");
    // jsdom applies no CSS, so the emulated Tab can land on the desktop nav
    // row (display:none at phone widths in a real browser); what matters
    // is that it never enters the inert, off-screen drawer.
    assert.ok(active() && !drawer.contains(active()!), "Tab from the hamburger skips the closed drawer");
    assert.ok(drawerFocusables().every((el) => isInert(el)));
  });
});
