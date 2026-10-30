#!/bin/zsh
set -eu
cd "${0:A:h}"
# Finder has a minimal PATH. Prefer an installed Node 24+ without changing the user's shell.
node_candidates=(
  /opt/homebrew/opt/node@24/bin/node
  /opt/homebrew/bin/node
  "$HOME"/.nvm/versions/node/v*/bin/node(N)
  "$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"
)
if command -v node >/dev/null 2>&1; then node_candidates=("$(command -v node)" "${node_candidates[@]}"); fi
for node_binary in "${node_candidates[@]}"; do
  if [[ -x "$node_binary" ]] && "$node_binary" -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 24 ? 0 : 1)' 2>/dev/null; then
    exec "$node_binary" scripts/launch.mjs
  fi
done
print 'Netarium nécessite Node.js 24 ou supérieur. Installez cette version, puis relancez.'
read '?Appuyez sur Entrée pour fermer.'
