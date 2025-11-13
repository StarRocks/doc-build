#!/bin/bash
echo "Creating temp dir and getting visible parameters from StarRocks DB..."
mkdir -p temp
mysql -P9030 -h 127.0.0.1 -u root < ./helpers/visible-script > ./temp/visible-variables.txt
echo "Getting invisible parameters from StarRocks DB..."
mysql -P9030 -h 127.0.0.1 -u root < ./helpers/all-script > ./temp/all-variables.txt
/opt/homebrew/opt/grep/libexec/gnubin/grep -vf ./temp/visible-variables.txt ./temp/all-variables.txt > ./temp/invisible
echo "Checking the docs for invisible parameters..."
{
    echo "-----------------------------------------"
    while IFS=$'\t' read -r first_field rest_of_line; do
        if grep -q "\#\#\# $first_field" /Users/droscign/GitHub/starrocks/docs/en/sql-reference/System_variable.md; then
            echo $first_field is in System_variable.md
        fi
        ./helpers/algoliacheck.sh $first_field
        echo "-----------------------------------------"
    done
} < ./temp/invisible > ./results

echo "Examine the file ./results"
