# Check the docs for missing settings

## Usage:

> Note: You need a running StarRocks instance on localhost:9030

Usage: `./find_invisible.sh <path to System_variable.md> <language>`

Example: `./find_invisible.sh ~/GitHub/starrocks/docs/en/sql-reference/System_variable.md en`

> To Do: filter the Algolia search on language

The script `find_invisible.sh`:

1. Connects to a running StarRocks DB and writes the list of settings to a file using `SHOW VARIABLES` with and without `enable_show_all_variables` set to true
1. Reads the list of variables meant to be invisible and:
   1. Checks the Markdown file `System_variable.md` for every variable that is to be invisible.
   1. Uses the Algolia search API to check the docs for any invisible variable.

