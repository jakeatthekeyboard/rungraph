#!/bin/bash
# Prints how many words a file has. Used by the judge and length-critic.
# Usage: tools/word-count.sh out/blurb.md
[ -f "$1" ] || { echo "ERROR: no such file: $1"; exit 1; }
echo "$(wc -w < "$1" | tr -d ' ') words in $1"
