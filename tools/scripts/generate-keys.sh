#!/usr/bin/env bash
# Genera las claves de desarrollo y las imprime como variables de entorno:
#   ./tools/scripts/generate-keys.sh >> .env
#
# - JWT_PRIVATE_KEY y JWT_PUBLIC_KEY: par RSA para firmar los access tokens (RS256).
# - ENCRYPTION_KEY: 32 bytes en base64 para AES-256-GCM (credenciales de Yallegó
#   y nombres de pagadores).
set -euo pipefail

command -v openssl >/dev/null || { echo "Falta openssl." >&2; exit 1; }

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out "$tmp/privada.pem" 2>/dev/null
openssl pkey -in "$tmp/privada.pem" -pubout -out "$tmp/publica.pem"

# Una sola línea con \n, como la esperan los archivos .env.
una_linea() { awk 'BEGIN { ORS = "\\n" } { print }' "$1"; }

echo "JWT_PRIVATE_KEY=\"$(una_linea "$tmp/privada.pem")\""
echo "JWT_PUBLIC_KEY=\"$(una_linea "$tmp/publica.pem")\""
echo "ENCRYPTION_KEY=$(openssl rand -base64 32)"
