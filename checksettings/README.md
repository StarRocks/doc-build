# Check the docs for missing settings

The script `get_settings.sh`:

1. connects to a running StarRocks DB and writes the list of settings to a file `variables.txt` using `SHOW VARIABLES`
1. Reads `variables.txt` line by line and:
   1. Throws away the first line of the `variables.txt` as it is the word "variables"
   1. Checks the Markdown file `System_variable.md` for every subsequent variable name 
   1. Uses the Algolia search API to check the docs for any variables not in `System_variable.md` and reports if the variable is found in the docs anywhere.

