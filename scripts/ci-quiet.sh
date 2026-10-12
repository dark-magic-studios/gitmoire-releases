#!/usr/bin/env bash
# Run a command with its output captured to a temp file, so the PUBLIC Actions
# log never carries private source paths or compiler snippets.
# Set VERBOSE_LOGS=true to stream the output instead.
set -uo pipefail

if [ "${VERBOSE_LOGS:-false}" = "true" ]; then
  exec "$@"
fi

log="$(mktemp)"
"$@" >"$log" 2>&1
code=$?
rm -f "$log"

if [ "$code" -ne 0 ]; then
  echo "::error::command failed with exit code $code (output suppressed: public repo; re-run with verbose_logs=true to see it)"
fi
exit "$code"
