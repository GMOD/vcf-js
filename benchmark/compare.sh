#!/bin/bash

set -e

VCF_FILE="/home/cdiesh/data/1kg.chr1.subset.vcf.gz"

echo "VCF Parser Performance Benchmark"
echo "================================="
echo

# Check if VCF file exists
if [ ! -f "$VCF_FILE" ]; then
    echo "❌ VCF file not found: $VCF_FILE"
    exit 1
fi

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
echo "Current branch: $CURRENT_BRANCH"
echo

# Build optimized version
echo "📦 Building optimized version (current branch)..."
yarn build:esm > /dev/null 2>&1
cp -r esm esm-optimized
echo "✅ Optimized build saved to esm-optimized/"
echo

# Checkout master and build
echo "📦 Switching to master branch..."
git checkout master > /dev/null 2>&1

echo "📦 Building master version..."
yarn build:esm > /dev/null 2>&1
cp -r esm esm-master
echo "✅ Master build saved to esm-master/"
echo

# Return to original branch
echo "📦 Returning to $CURRENT_BRANCH..."
git checkout "$CURRENT_BRANCH" > /dev/null 2>&1

# Rebuild optimized
echo "📦 Rebuilding optimized version..."
yarn build:esm > /dev/null 2>&1
echo

echo "✅ Build complete! Running benchmark..."
echo
echo "========================================"
echo

# Run the benchmark
node benchmark.mjs "$VCF_FILE"
