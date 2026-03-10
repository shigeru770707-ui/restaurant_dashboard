#!/bin/sh
# BACKEND_API_KEY のみを envsubst で置換（nginx変数 $host 等は保持）
envsubst '${BACKEND_API_KEY}' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf
exec nginx -g 'daemon off;'
