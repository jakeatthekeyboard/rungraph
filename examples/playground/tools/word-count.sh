#!/bin/bash
# Counts the words in a blurb. Used by the judge and length-critic.
# Pass the text on stdin (a heredoc keeps quotes and apostrophes safe):
#   tools/word-count.sh <<'TEXT'
#   Fresh lemons, $2 a cup...
#   TEXT
# A file path as the first argument also works.
if [ -n "$1" ]; then
  [ -f "$1" ] || { echo "ERROR: no such file: $1"; exit 1; }
  echo "$(wc -w < "$1" | tr -d ' ') words"
else
  echo "$(wc -w | tr -d ' ') words"
fi
