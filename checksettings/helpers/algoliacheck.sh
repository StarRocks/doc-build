#!/bin/bash
APP_ID="ER08SJMRY1"
API_KEY="92292046d551109a1f2c463f1338c39b"
SEARCH_STRING=$1
INDEX_NAME="starrocks"

# Make the request
RESPONSE=$(curl -s -X POST \
  -H "X-Algolia-Application-Id: $APP_ID" \
  -H "X-Algolia-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  --data "{
    \"query\": \"$SEARCH_STRING\",
    \"facetFilters\": [[\"docusaurus_tag:docs-default-4.0\"]]
  }" \
  "https://${APP_ID}-dsn.algolia.net/1/indexes/${INDEX_NAME}/query")

# Parse results using jq
URLS=$(echo "$RESPONSE" | jq -r '.hits[].url')

if [ -z "$URLS" ]; then
  exit 1
  #echo "No results found in Algolia '$SEARCH_STRING'"
else
  echo "Found results in Algolia for '$SEARCH_STRING' at:"
  echo "$URLS"
fi

