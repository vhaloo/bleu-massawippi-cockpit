export function positionStrategyContextAtBottom(root = document) {
  const privateRoot = root.querySelector("#cockpit-content [data-cockpit-private-root]");
  const strategy = root.querySelector("#context-collapsible");
  if (!privateRoot || !strategy || strategy.parentElement !== privateRoot || privateRoot.lastElementChild === strategy) return;
  privateRoot.append(strategy);
}
