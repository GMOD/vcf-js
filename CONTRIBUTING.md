# Contributing

## Development

```sh
pnpm install
pnpm test
pnpm build
```

Use `pnpm version patch/minor/major` to release — it runs lint, format, types,
tests and build, regenerates CHANGELOG.md with git-cliff, then pushes the
version tag which triggers the publish workflow.

[docs/api.md](docs/api.md) is written by hand, and `test/apiDocs.test.ts` fails
when a public member of `VCFParser`, `Variant`, `Breakend`,
`LocalAlleleGenotypeMaps`, or an export, is missing from it. Document the new
member, or add it to the test's `undocumented` list with the reason it is
internal.

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
`esm_branch2/`, so your checkout stays on its branch. It builds each ref as
committed, so commit before benchmarking. The script leaves both directories in
place afterwards; `pnpm benchonly` on its own compares whatever the last run
left there, and the benchmark labels each side from the `branchname.txt` the
script writes.

## Publishing

Releases publish automatically via GitHub Actions using npm trusted publishing
(OIDC, no stored token). The workflow requires `--provenance` and
`id-token: write` permissions.

vcf-js is already configured. To set up a new package:
`npm trust github <pkg> --file publish.yml --repo GMOD/<repo>` (requires
npm >=11.10.0 and 2FA).

Once npm publish succeeds, the `release` job creates the GitHub release for the
tag, taking its notes from that version's CHANGELOG.md section.
`scripts/release-notes.sh` extracts the section, so run the script with a
version to preview a release's notes.
