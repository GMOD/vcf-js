#!/bin/bash

set -e

echo "Setting up benchmark..."
echo "======================"
echo

# Check if VCF file exists
VCF_FILE="/home/cdiesh/data/1kg.chr1.subset.vcf.gz"
if [ ! -f "$VCF_FILE" ]; then
    echo "❌ VCF file not found: $VCF_FILE"
    exit 1
fi

# Get current branch name
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
echo "Current branch: $CURRENT_BRANCH"
echo

# Save current changes
echo "📦 Stashing any uncommitted changes..."
git stash push -m "benchmark-temp-stash" || true
echo

# Build optimized version (current branch)
echo "🔨 Building OPTIMIZED version from current branch..."
yarn build
echo

# Copy optimized build
echo "📋 Copying optimized build..."
rm -rf esm-optimized
cp -r esm esm-optimized
echo

# Checkout master and build
echo "🔄 Checking out master branch..."
git checkout master
echo

echo "🔨 Building MASTER version..."
yarn build
echo

# Copy master build
echo "📋 Copying master build..."
rm -rf esm-master
cp -r esm esm-master
echo

# Go back to original branch
echo "🔄 Returning to $CURRENT_BRANCH..."
git checkout "$CURRENT_BRANCH"
echo

# Restore stashed changes
echo "📦 Restoring stashed changes..."
if git stash list | grep -q "benchmark-temp-stash"; then
    git stash pop || true
fi
echo

# Rebuild current branch
echo "🔨 Rebuilding current branch..."
yarn build
echo

echo "✅ Setup complete!"
echo
echo "You can now run the benchmark with:"
echo "  node benchmark.js $VCF_FILE"
