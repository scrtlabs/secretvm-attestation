#!/bin/bash
# Sync artifact registry data into both packages
cp artifacts_registry/tdx.csv node/data/tdx.csv
cp artifacts_registry/sev.json node/data/sev.json
cp artifacts_registry/tdx.csv python/src/secretvm/verify/data/tdx.csv
cp artifacts_registry/sev.json python/src/secretvm/verify/data/sev.json
