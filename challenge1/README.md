# Mina zkApp: Challenge1


## Install, build and test

```sh
npm install
npm run build
npm run test
```

## Test coverage

Total of 6 tests are written
- ✓ deploys the `Challenge1` smart contract and addEligibleAddress (69778 ms)
- ✓ check Alice and Charlie is in the eligibility tree (132133 ms)
- ✓ check Alice depositMessage status, Alice has not deposited yet (50402 ms)
- ✓ Alice can depositMessage 1st time, BUT cannot depositMessage again (104815 ms)
- ✓ check Bob eligibility - Bob is not in the list yet, THEN add Bob to the list and check again (78029 ms)
- ✓ verify various messages (17788 ms)

## Code explanation

@state `eligibilityRoot` is the root of Merkle Tree with addresses
@state `nullifierRoot` is the root of Merkle Map tracking deposits
@state `totalMessages` is total of messages deposited
@state `totalAddresses` is total of addresses in the eligibility list

@method `checkEligibilty` throws Error if an address is not part of `eligibilityRoot` via Merkle Map
@method `checkDeposit` throws Error if an address has already deposited as tracked in `nullifierRoot` via Merkle Map

@method `addEligibilityAddress` is used to add a new address and update `eligibilityRoot` contract state accordingly after adding new a address in the Merkle Map

```
// in challenge1.test.ts
await addEligibleAddress("Alice", deployerAccount, zkAppPrivateKey, zkAppInstance);
await addEligibleAddress("Charlie", deployerAccount, zkAppPrivateKey, zkAppInstance);
await addEligibleAddress("Olivia", deployerAccount, zkAppPrivateKey, zkAppInstance);

// in challenge1.ts
@method addEligibleAddress(eligibilityWitness: MerkleMapWitness) {
    ...
}
```

`verifyMessage` leverages bitwise `AND` gadget and `Bool` methods