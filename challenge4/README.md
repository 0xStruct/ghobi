# Challenge 4

Built with Protokit as required.

The monorepo contains 1 package and 1 app:

- `packages/chain` contains everything related to your app-chain
- `apps/web` contains a demo UI that connects to your locally hosted app-chain sequencer

**Relevant files**

- `packages/chain/src/spy_manager/index.ts`
- `packages/chain/src/spy_manager/structs.ts`
- `packages/chain/test/spy_manager.test.ts`

__total of 5 tests are included__

**Prerequisites:**

- Node.js v18
- pnpm
- nvm

## To run tests

```zsh
# ensures you have the right node.js version
nvm use
pnpm install

# run and watch tests for the `chain` package
pnpm run test --filter=chain -- --watchAll
```

## Privacy concerns (addressed in Challenge4)

~~Currently, security codes and messages are open for everyone to see inside mempool.~~

~~Off-chain proofs could be used to keep security codes and messages private before submitting the proofs on-chain.~~

[x] `MessageProofProgram` is used to generate `MessageProof` to keep `securityCode` private.
