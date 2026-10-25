#!/usr/bin/env bash
# REQ-TWIG-005 — fail when Twig templates use raw <form> / <input> / <textarea> / <select>.
# Scope: bundle views and demo templates. Allowlist: the bundle form themes listed in ALLOWLIST below, whose
# `icon_selector_widget` blocks legitimately render the field markup (REQ-TWIG-005 "Form themes" exception).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ALLOWLIST=(
  src/Resources/views/Form/icon_selector_theme.html.twig
  src/Resources/views/Form/icon_selector_theme_bootstrap3.html.twig
  src/Resources/views/Form/icon_selector_theme_bootstrap3_horizontal.html.twig
  src/Resources/views/Form/icon_selector_theme_bootstrap4.html.twig
  src/Resources/views/Form/icon_selector_theme_bootstrap4_horizontal.html.twig
  src/Resources/views/Form/icon_selector_theme_bootstrap5.html.twig
  src/Resources/views/Form/icon_selector_theme_bootstrap5_horizontal.html.twig
  src/Resources/views/Form/icon_selector_theme_foundation5.html.twig
  src/Resources/views/Form/icon_selector_theme_foundation6.html.twig
  src/Resources/views/Form/icon_selector_theme_table.html.twig
  src/Resources/views/Form/icon_selector_theme_tailwind2.html.twig
)

dirs=()
[[ -d src/Resources/views ]] && dirs+=(src/Resources/views)
while IFS= read -r d; do dirs+=("$d"); done < <(find demo -type d -name templates -not -path '*/vendor/*' -not -path '*/node_modules/*' 2>/dev/null || true)

if [[ ${#dirs[@]} -eq 0 ]]; then
  echo "check-no-raw-html-form: no Twig templates — OK"
  exit 0
fi

matches="$(grep -RInE '<(form|input|textarea|select)([[:space:]>]|$)' "${dirs[@]}" --include='*.twig' || true)"
for allowed in "${ALLOWLIST[@]}"; do
  matches="$(printf '%s\n' "$matches" | grep -v -F "${allowed}:" || true)"
done
matches="$(printf '%s' "$matches" | sed '/^$/d')"
if [[ -n "$matches" ]]; then
  echo "ERROR: raw <form> / <input> / <textarea> / <select> in Twig (REQ-TWIG-005):" >&2
  echo "$matches" >&2
  exit 1
fi

echo "check-no-raw-html-form: OK"
