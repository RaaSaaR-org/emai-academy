#!/bin/sh
# Postgres init (runs once, on an empty data directory, as /docker-entrypoint-initdb.d/*):
# POSTGRES_DB (emai_academy, backend) is created by the image; this adds the skills database.
set -eu
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<SQL
CREATE DATABASE emai_skills OWNER "$POSTGRES_USER";
SQL
