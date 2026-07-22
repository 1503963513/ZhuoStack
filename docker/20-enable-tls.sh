#!/bin/sh
set -eu

cert=/etc/nginx/tls/tls.crt
key=/etc/nginx/tls/tls.key

if [ -f "$cert" ] && [ -f "$key" ]; then
  cp /etc/nginx/nginx.tls.conf /etc/nginx/conf.d/default.conf
  echo "TLS certificate detected; HTTPS listener enabled."
elif [ -f "$cert" ] || [ -f "$key" ]; then
  echo "Both tls.crt and tls.key are required." >&2
  exit 1
else
  cp /etc/nginx/nginx.http.conf /etc/nginx/conf.d/default.conf
  echo "No local TLS certificate found; expecting HTTPS termination at an upstream proxy."
fi
