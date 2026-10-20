const select = document.getElementById("audience");
chrome.storage.sync.get("audience").then((v) => v.audience && (select.value = v.audience));
select.addEventListener("change", () => chrome.storage.sync.set({ audience: select.value }));
