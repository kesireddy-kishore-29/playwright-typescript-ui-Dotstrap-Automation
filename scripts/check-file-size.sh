#!/usr/bin/env sh
# Pre-commit guard: no staged file may exceed 2 MB (evidence samples, media, downloaded tools).
limit=2097152
status=0
for f in "$@"; do
  [ -f "$f" ] || continue
  size=$(wc -c < "$f" | tr -d ' ')
  if [ "$size" -gt "$limit" ]; then
    echo "file-size: $f is $size bytes (limit 2 MB). Keep large artifacts out of git."
    status=1
  fi
done
exit $status
