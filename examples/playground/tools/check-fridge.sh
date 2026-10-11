#!/bin/bash
# Pretends to check the lemonade fridge. Used by /flaky.
# Fails until out/fridge.txt contains the word "cold".
if grep -qx cold out/fridge.txt 2>/dev/null; then
  echo "OK: fridge is cold. Lemonade is ready to serve."
  exit 0
fi
echo "ERROR: fridge is still warm. Read tools/fridge-help.md to fix it."
exit 1
