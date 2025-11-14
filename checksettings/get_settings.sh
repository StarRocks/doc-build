#!/bin/bash
mysql -P9030 -h 127.0.0.1 -u root <script >variables.txt
{
    read
    while IFS=$'\t' read -r first_field rest_of_line; do
        if grep -q "\#\#\# $first_field" /Users/droscign/GitHub/starrocks/docs/en/sql-reference/System_variable.md; then
            : # do nothing
        else
            echo "Setting: $first_field"
            echo "NOT in System_variable.md, checking Algolia"
            ./algoliacheck.sh $first_field
            echo "-----------------------------------------"
        fi
        #grep "\#\#\# $first_field" /Users/droscign/GitHub/starrocks/docs/en/sql-reference/System_variable.md| grep -v ":0"
        # Add your action here using $first_field
    done
} <variables.txt
