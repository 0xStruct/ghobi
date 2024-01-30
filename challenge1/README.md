# Mina zkApp: Challenge1


## Install, build and test

```sh
npm install
npm run build
npm run test
```

## Test coverage

Total of 6 tests are written
- ✓ deploys the `Challenge1` smart contract and setEligibilityRoot (19362 ms)
- ✓ check Alice is in the eligibility tree (12636 ms)
- ✓ check Alice depositMessage status (16053 ms)
- ✓ Alice can depositMessage 1st time, BUT cannot depositMessage again (19774 ms)
- ✓ check Bob eligibility - Bob is not in the list (11852 ms)
- ✓ verify various messages (11697 ms)

## Code explanation

@state `eligibilityRoot` is the root of Merkle Tree with addresses
@state `nullifierRoot` is the root of Merkle Map tracking deposits
@state `totalMessages` is total of messages deposited

@method `checkEligibilty` throws Error if an address is not part of `eligibilityRoot` via Merkle Tree
@method `checkDeposit` throws Error if an address has already deposited as tracked in `nullifierRoot` via Merkle Map

`verifyMessage` leverages bitwise `AND` gadget and `Bool` methods