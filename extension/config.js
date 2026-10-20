// Runs before vernacular-anywhere.js in the content-script world: points it at the
// hosted app and keeps the chosen audience in extension storage.
window.VernacularAnywhereConfig = {
  api: "https://vernacular-lime.vercel.app",
  app: "https://vernacular-lime.vercel.app",
  loadAudience: () => chrome.storage.sync.get("audience").then((v) => v.audience),
  saveAudience: (id) => chrome.storage.sync.set({ audience: id }),
};
