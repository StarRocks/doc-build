#!/bin/bash
if [ "$#" -ne 2 ]; then
    echo "Note: You need a running StarRocks instance on localhost:9030"
    echo ""
    echo "Usage: $0 <path to System_variable.md> <language>"
    echo ""
    echo "example: $0 ~/GitHub/starrocks/docs/en/sql-reference/System_variable.md en"
    exit 1
fi
echo "Creating temp dir and getting visible parameters from StarRocks DB..."
mkdir -p temp
mysql -P9030 -h 127.0.0.1 -u root < ./helpers/visible-script > ./temp/visible-variables.txt
echo "Getting invisible parameters from StarRocks DB..."
mysql -P9030 -h 127.0.0.1 -u root < ./helpers/all-script > ./temp/all-variables.txt
egrep -vf ./temp/visible-variables.txt ./temp/all-variables.txt > ./temp/invisible
echo "Checking the docs for invisible parameters..."
{
    echo "-----------------------------------------"
    while IFS=$'\t' read -r first_field rest_of_line; do
        grep_found=1
        algolia_found=1
        if grep -q "$first_field" $1; then
            echo $first_field is in System_variable.md
            grep_found=0
        fi
        ./helpers/algoliacheck.sh $first_field
        algolia_found=$?
        if [ $algolia_found -eq 0 ] || [ $grep_found -eq 0 ]
        then
          echo "-----------------------------------------"
        fi
    done
} < ./temp/invisible > ./results

echo "Examine the file ./results"
