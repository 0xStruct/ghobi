import {
  SmartContract,
  Poseidon,
  Field,
  Permissions,
  DeployArgs,
  State,
  state,
  Struct,
  PublicKey,
  UInt64,
  Bool,
  method,
  MerkleWitness,
  Signature,
  // MerkleMap,
  MerkleMapWitness,
  Provable,
  provablePure,
  Gadgets,
} from 'o1js';

let initialBalance = 10_000_000_000;
let maxTotalAddresses = 100;

export class Account extends Struct({
  publicKey: PublicKey,
}) {
  hash(): Field {
    return Poseidon.hash(this.publicKey.toFields());
  }
}

export class MerkleWitnessInstance extends MerkleWitness(8) {}

export class Challenge1 extends SmartContract {
  // eligibilityRoot is the root of the Merkle Tree
  @state(Field) eligibilityRoot = State<Field>();

  @state(Field) nullifierRoot = State<Field>();

  // total deposited messages
  @state(UInt64) totalMessages = State<UInt64>();

  // total eligible addresses
  @state(UInt64) totalAddresses = State<UInt64>();

  @state(Field) admin = State<Field>();

  // contract events
  events = {
    depositMessage: provablePure({
      depositer: String,
      message: Field,
    }),
  };

  deploy(args: DeployArgs) {
    super.deploy(args);

    const permissionToEdit = Permissions.signature();

    this.setPermissions({
      ...Permissions.default(),
      editState: Permissions.proofOrSignature(),
      setTokenSymbol: permissionToEdit,
      send: permissionToEdit,
      receive: permissionToEdit,
    });
    this.balance.addInPlace(UInt64.from(initialBalance));

    this.admin.set(Poseidon.hash(this.sender.toFields()));
    this.totalMessages.set(UInt64.zero);
    this.totalAddresses.set(UInt64.zero);
  }

  // set initial merkle tree value
  // @method
  // setEligibilityRoot(root: Field) {
  //   this.eligibilityRoot.set(root);
  // }

  // add eligible address, update eligibilityRoot
  @method addEligibleAddress(eligibilityWitness: MerkleMapWitness) {
    let totalAddresses = this.totalAddresses.getAndRequireEquals();

    // check if the TX sender is admin
    const sender = Poseidon.hash(this.sender.toFields());
    this.admin.getAndRequireEquals().assertEquals(sender, "only admin is allowed");

    // check if the address is already in the eligibility tree
    const eligibilityRoot = this.eligibilityRoot.getAndRequireEquals();
    let [derivedEligibilityRoot, key] = eligibilityWitness.computeRootAndKey(Field(1));

    this.eligibilityRoot.set(derivedEligibilityRoot);

    const totalAddressesAfter = totalAddresses.add(1);
    this.totalAddresses.set(totalAddressesAfter);
  }

  // @method
  // checkEligibility(account: Account, path: MerkleWitnessInstance) {
  //   // we fetch the on-chain eligibilityRoot
  //   let eligibilityRoot = this.eligibilityRoot.getAndRequireEquals();
  //   // we check that the account is within the committed Merkle Tree
  //   path.calculateRoot(account.hash()).assertEquals(eligibilityRoot);
  // }

  @method
  checkEligibility(eligibilityWitness: MerkleMapWitness) {
    // we fetch the on-chain eligibilityRoot
    let eligibilityRoot = this.eligibilityRoot.getAndRequireEquals();
    // we check that the account is within the committed Merkle Tree
    let [derivedEligibilityRoot, key] = eligibilityWitness.computeRootAndKey(Field(1));

    eligibilityRoot.assertEquals(derivedEligibilityRoot);
  }

  // checks if an account has deposited, throw error if not deposited yet
  @method
  checkDeposit(account: Account, nullifierWitness: MerkleMapWitness) {
    // ensure this account has not been deposited before
    let nullifierRoot = this.nullifierRoot.getAndRequireEquals();

    // get root when key is set to Field(1) - meaning deposited
    const [root, key] = nullifierWitness.computeRootAndKey(Field(1));
    Provable.log('nullifierRoot', nullifierRoot, 'root', root, 'key', key);

    key.assertEquals(account.hash());
    root.assertNotEquals(nullifierRoot);
  }

  @method
  depositMessage(
    account: Account,
    message: Field,
    eligibilityWitness: MerkleMapWitness,
    nullifierWitness: MerkleMapWitness,
    signature: Signature
  ) {
    // fetch the on-chain eligibilityRoot
    let eligibilityRoot = this.eligibilityRoot.getAndRequireEquals();

    // we check that the account is within the committed Merkle Tree
    let [derivedEligibilityRoot, _] = eligibilityWitness.computeRootAndKey(Field(1));
    eligibilityRoot.assertEquals(derivedEligibilityRoot);

    // fetch the on-chain nullifierRoot
    let nullifierRoot = this.nullifierRoot.getAndRequireEquals();

    // compute the root after setting nullifier f
    const [rootAfterDeposit, key] = nullifierWitness.computeRootAndKey(
      Field(1)
    );

    // ensure this account has not been deposited before
    nullifierRoot.assertNotEquals(rootAfterDeposit);

    Provable.log('rootAfterDeposit', rootAfterDeposit, 'key', key);
    Provable.log('setting nullifier root to', rootAfterDeposit);

    // set the new root
    this.nullifierRoot.set(rootAfterDeposit);

    // verify message
    const verified = this.verifyMessage(message);
    verified.assertTrue('message is not verified according to rule');

    // now emit event with the message
    this.emitEvent('depositMessage', {
      depositer: account.publicKey,
      message: message,
    });

    // update contract state
    let totalMessages = this.totalMessages.getAndRequireEquals();
    let newTotalMessages = totalMessages.add(1);
    Provable.log('message deposited', message);
    this.totalMessages.set(newTotalMessages);
  }

  verifyMessage(message: Field): Bool {
    // If flag 1 is true, then all other flags must be false
    // If flag 2 is true, then flag 3 must also be true
    // If flag 4 is true, then flags 5 and 6 must be false

    const f1Mask = Field(1); // 000001
    const f2Mask = Field(2); // 000010
    const f3Mask = Field(4); // 000100
    const f4Mask = Field(8); // 001000
    const f5Mask = Field(16); // 010000
    const f6Mask = Field(32); // 100000

    const f1Bit = Gadgets.and(message, f1Mask, 6);
    const f2Bit = Gadgets.and(message, f2Mask, 6);
    const f3Bit = Gadgets.and(message, f3Mask, 6);
    const f4Bit = Gadgets.and(message, f4Mask, 6);
    const f5Bit = Gadgets.and(message, f5Mask, 6);
    const f6Bit = Gadgets.and(message, f6Mask, 6);

    const f1: Bool = f1Bit.equals(f1Mask);
    const f2: Bool = f2Bit.equals(f2Mask);
    const f3: Bool = f3Bit.equals(f3Mask);
    const f4: Bool = f4Bit.equals(f4Mask);
    const f5: Bool = f5Bit.equals(f5Mask);
    const f6: Bool = f6Bit.equals(f6Mask);

    // rule 1: If flag 1 is true, then all other flags must be false
    const rule1 = f1.not().or(f1.and(f2.or(f3).or(f4).or(f5).or(f6).not()));

    // rule 2: If flag 2 is true, then flag 3 must also be true
    const rule2 = f2.not().or(f2.and(f3));

    // rule 3: If flag 4 is true, then flags 5 and 6 must be false
    const rule3 = f4.not().or(f4.and(f5.or(f6).not()));

    const verified = rule1.and(rule2).and(rule3);

    return verified;
  }
}
