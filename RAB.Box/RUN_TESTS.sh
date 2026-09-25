#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")"
node --test tests/*.test.mjs engine/tests/*.test.mjs
