export function splitByAction(results) {
  const out = { autoClose: [], suggest: [], keep: [] };
  for (const r of results) {
    let action = r.action;
    if (action === "auto-close" && r.bucket !== "finished") action = "suggest";
    if (action === "auto-close") out.autoClose.push(r);
    else if (action === "suggest") out.suggest.push(r);
    else out.keep.push(r);
  }
  return out;
}
