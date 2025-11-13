#!/bin/bash
mysql -P9030 -h 127.0.0.1 -u root < ./helpers/visible-script > ./temp/visible-variables.txt
mysql -P9030 -h 127.0.0.1 -u root < ./helpers/all-script > ./temp/all-variables.txt
/opt/homebrew/opt/grep/libexec/gnubin/grep -vf ./temp/visible-variables.txt ./temp/all-variables.txt > ./temp/invisible
{
    read
    while IFS=$'\t' read -r first_field rest_of_line; do
        if grep -q "\#\#\# $first_field" /Users/droscign/GitHub/starrocks/docs/en/sql-reference/System_variable.md; then
            : # do nothing
            echo $first_field is decloaked
        else
            echo "Setting: $first_field"
            echo "NOT in System_variable.md, checking Algolia"
            ./helpers/algoliacheck.sh $first_field
            echo "-----------------------------------------"
        fi
        #grep "\#\#\# $first_field" /Users/droscign/GitHub/starrocks/docs/en/sql-reference/System_variable.md| grep -v ":0"
        # Add your action here using $first_field
    done
} < ./temp/invisible >./results

