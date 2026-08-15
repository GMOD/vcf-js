# Contributing

## Development

```sh
pnpm install
pnpm test
pnpm build
```

Use `pnpm version patch/minor/major` to release — it runs lint, tests, and
build, then pushes the version tag which triggers the publish workflow.

## Benchmarking

`pnpm benchonly` runs `benchmark/parse.bench.ts` against `src/`.

`benchmark/master-vs-current.bench.ts` compares two refs, and needs them built
first:

```sh
pnpm bench                                          # origin/main vs your HEAD
BRANCH1=origin/main BRANCH2=my-branch pnpm bench     # or name them
./scripts/build-both-branches.sh origin/main my-branch && pnpm benchonly
```

The script builds each ref in a throwaway git worktree into `esm_branch1/` and
`esm_branch2/`, so your checkout is never switched — but each ref is built as
committed, so commit before benchmarking. The two directories stick around
afterwards; `pnpm benchonly` on its own will happily compare whatever was left
there last time, and the benchmark labels each side from the `branchname.txt`
the script writes.

## Publishing

Releases publish automatically via GitHub Actions using npm trusted publishing
(OIDC, no stored token). The workflow requires `--provenance` and
`id-token: write` permissions.

This repo is already configured. To set up a new package:
`npm trust github <pkg> --file publish.yml --repo GMOD/<repo>` (requires
npm >=11.10.0 and 2FA).

Once npm publish succeeds, the `release` job creates the GitHub release for the
tag. Its notes are that version's CHANGELOG.md section, extracted by
`scripts/release-notes.sh` — run that with a version to preview what a release
will say.
