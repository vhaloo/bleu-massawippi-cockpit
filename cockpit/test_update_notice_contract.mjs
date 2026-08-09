import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const index = fs.readFileSync(new URL("./index.html", import.meta.url), "utf8");
const workerSource = fs.readFileSync(new URL("./sw.js", import.meta.url), "utf8");
const scripts = [...index.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map((match) => match[1]);
const bootstrap = scripts.find((script) => script.includes("cockpit-update-ready"));
assert.ok(bootstrap, "Le gestionnaire de mise à jour doit rester intégré à la coque publique.");

const currentRelease = bootstrap.match(/const release = "([^"]+)"/)?.[1];
assert.ok(currentRelease, "La coque doit exposer sa version courante au gestionnaire de mise à jour.");

function createHarness({ sessionOpen = true } = {}) {
  const serviceWorkerHandlers = new Map();
  const windowHandlers = new Map();
  const postedMessages = [];
  const storage = new Map();
  let notice = null;
  let reloadCount = 0;
  let buttonClick = null;

  const button = {
    style: {},
    addEventListener(type, handler) {
      if (type === "click") buttonClick = handler;
    }
  };

  const document = {
    querySelector(selector) {
      if (selector === "#cockpit-update-ready") return notice;
      if (selector === "#cockpit-session") return sessionOpen ? {} : null;
      return null;
    },
    createElement(tagName) {
      assert.equal(tagName, "aside");
      const element = {
        id: "",
        dataset: {},
        style: {},
        setAttribute() {},
        querySelector(selector) { return selector === "button" ? button : null; },
        remove() { if (notice === element) notice = null; }
      };
      Object.defineProperty(element, "innerHTML", { set() {} });
      return element;
    },
    body: {
      appendChild(element) { notice = element; }
    }
  };

  const controller = {
    postMessage(message) { postedMessages.push(message); }
  };
  const registration = {
    waiting: null,
    update: async () => {}
  };
  const serviceWorker = {
    controller,
    addEventListener(type, handler) { serviceWorkerHandlers.set(type, handler); },
    register: async () => registration
  };

  vm.runInNewContext(bootstrap, {
    document,
    navigator: { serviceWorker },
    sessionStorage: {
      getItem(key) { return storage.get(key) ?? null; },
      setItem(key, value) { storage.set(key, String(value)); }
    },
    location: { reload() { reloadCount += 1; } },
    window: { addEventListener(type, handler) { windowHandlers.set(type, handler); } },
    console,
    Object,
    Boolean
  });

  return {
    dispatchServiceWorker(type, event = {}) { serviceWorkerHandlers.get(type)?.(event); },
    notice: () => notice,
    postedMessages: () => postedMessages,
    clickUpdate: () => buttonClick?.(),
    stored: (key) => storage.get(key),
    reloadCount: () => reloadCount
  };
}

const harness = createHarness({ sessionOpen: true });
harness.dispatchServiceWorker("controllerchange");
assert.equal(harness.notice(), null,
  "Un changement de contrôleur ne doit jamais afficher l’avis avant de connaître sa version.");
assert.equal(JSON.stringify(harness.postedMessages()), JSON.stringify([{ type: "cockpit-release-request" }]),
  "La page doit demander au nouveau contrôleur sa version exacte.");

harness.dispatchServiceWorker("message", { data: { type: "cockpit-release-info", release: currentRelease } });
assert.equal(harness.notice(), null,
  "Un contrôleur qui annonce la même version que la page ne doit pas recréer l’avis.");

const nextRelease = `${currentRelease}-next`;
harness.dispatchServiceWorker("message", { data: { type: "cockpit-update-ready", release: nextRelease } });
assert.ok(harness.notice(), "Une version réellement différente doit proposer l’actualisation.");
assert.equal(harness.notice().dataset.release, nextRelease,
  "L’avis doit mémoriser la version réellement attendue.");

harness.clickUpdate();
assert.equal(harness.stored(`cockpit-shell-reload-${nextRelease}`), nextRelease,
  "Le clic doit mémoriser la version cible, et non la vieille version de la page.");
assert.equal(harness.reloadCount(), 1, "Le clic doit provoquer une seule recharge.");

const workerHandlers = new Map();
vm.runInNewContext(workerSource, {
  self: { addEventListener(type, handler) { workerHandlers.set(type, handler); } },
  caches: {},
  fetch() {},
  URL,
  Response
});
let workerReply = null;
workerHandlers.get("message")?.({
  data: { type: "cockpit-release-request" },
  source: { postMessage(message) { workerReply = message; } }
});
assert.equal(JSON.stringify(workerReply), JSON.stringify({ type: "cockpit-release-info", release: currentRelease }),
  "Le nouveau contrôleur doit répondre avec la version exacte de sa coque.");

console.log(`✓ avis de mise à jour borné par version (${currentRelease})`);
