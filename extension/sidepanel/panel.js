async function refreshCount() {
  const tabs = await chrome.tabs.query({});
  document.getElementById("count").textContent = `${tabs.length} tabs`;
}
refreshCount();
chrome.tabs.onCreated.addListener(refreshCount);
chrome.tabs.onRemoved.addListener(refreshCount);
