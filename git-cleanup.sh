#!/bin/bash

# 1. GATHER: Get list of all branches except master and main
branches=$(git ls-remote --heads origin | sed 's?.*refs/heads/??' | grep -vE '^(master|main)$')

# 2. CHECK: If the list is empty, stop here
if [ -z "$branches" ]; then
    echo "✅ Your repo is already clean! No extra branches found."
    exit 0
fi

# 3. DRY RUN: Show the user what will happen
echo "⚠️  The following branches will be DELETED from the server:"
echo "-------------------------------------------------------"
echo "$branches"
echo "-------------------------------------------------------"

# 4. CONFIRM: Ask for permission
read -p "Are you sure you want to delete these branches? (y/N) " -n 1 -r
echo    # (optional) move to a new line

# 5. EXECUTE: If 'y', delete them. Otherwise, cancel.
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "🚀 Starting deletion..."
    # Loop through the list and delete each one
    echo "$branches" | while read branch; do
        echo "Deleting: $branch"
        git push origin --delete "$branch"
    done
    echo "✨ All done!"
else
    echo ""
    echo "❌ Operation cancelled. No changes made."
fi