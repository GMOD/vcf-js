#!/bin/bash

set -e

echo "Building both versions for benchmark"
echo "====================================="
echo

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
echo "Current branch: $CURRENT_BRANCH"
echo

# Build optimized version
echo "📦 Building optimized version (current branch)..."
yarn build:esm
cp -r esm esm-optimized
echo "✅ Optimized build saved to esm-optimized/"
echo

# Checkout master and build
echo "📦 Switching to master branch..."
git checkout master

echo "📦 Building master version..."
yarn build:esm
cp -r esm esm-master
echo "✅ Master build saved to esm-master/"
echo

# Return to original branch
echo "📦 Returning to $CURRENT_BRANCH..."
git checkout "$CURRENT_BRANCH"

# Rebuild optimized
echo "📦 Rebuilding optimized version..."
yarn build:esm
echo

echo "✅ Setup complete!"
echo
echo "Run benchmark with:"
echo "  node benchmark.js /home/cdiesh/data/1kg.chr1.subset.vcf.gz"
