document.getElementById("classifyBtn").onclick = async () => {
  const btn = document.getElementById("classifyBtn");
  const titles = document.getElementById("titles").value.split("\n").map(s => s.trim()).filter(Boolean);
  if (!titles.length) return;
  btn.disabled = true; btn.textContent = "Thinking…";
  const tabs = titles.map((title, i) => ({ id: i, title, url: "", idleMinutes: 120, text: "" }));
  try {
    const res = await fetch("/classify", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tabs }),
    });
    const { results = [] } = await res.json();
    const byId = Object.fromEntries(tabs.map(t => [t.id, t.title]));
    document.getElementById("results").replaceChildren(...results.map(r => {
      const li = document.createElement("li");
      li.textContent = `${byId[r.id]} → ${r.bucket} (${r.action}) — ${r.reason}`;
      return li;
    }));
  } catch {
    document.getElementById("results").replaceChildren(
      Object.assign(document.createElement("li"), { textContent: "Something went wrong — try again." }));
  } finally {
    btn.disabled = false; btn.textContent = "Classify";
  }
};
