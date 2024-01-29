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
} from 'o1js';

let initialBalance = 10_000_000_000;

export class Account extends Struct({
  publicKey: PublicKey,
}) {

  hash(): Field {
    return Poseidon.hash(this.publicKey.toFields());
  }
}

export class MerkleWitnessInstance extends MerkleWitness(8) { }

export class Challenge1 extends SmartContract {
  // eligibilityRoot is the root of the Merkle Tree
  @state(Field) eligibilityRoot = State<Field>();

  @state(Field) nullifierRoot = State<Field>();

  // total deposited messages
  @state(UInt64) totalMessages = State<UInt64>();

  // contract events
  events = {
    depositMessage: provablePure({
      depositer: String,
      message: Field
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

    this.totalMessages.set(UInt64.zero);
  }

  // set initial merkle tree value
  @method
  setEligibilityRoot(root: Field) {
    this.eligibilityRoot.set(root);
  }

  @method
  checkEligibility(account: Account, path: MerkleWitnessInstance) {
    // we fetch the on-chain eligibilityRoot
    let eligibilityRoot = this.eligibilityRoot.getAndRequireEquals();
    // we check that the account is within the committed Merkle Tree
    path.calculateRoot(account.hash()).assertEquals(eligibilityRoot);
  }

  // checks if an account has deposited, throw error if not deposited yet
  @method
  checkDeposit(account: Account, nullifierWitness: MerkleMapWitness) {
    // ensure this account has not been deposited before
    let nullifierRoot = this.nullifierRoot.getAndRequireEquals();

    // get root when key is set to Field(1) - meaning deposited
    const [root, key] = nullifierWitness.computeRootAndKey(Field(1));
    Provable.log("nullifierRoot", nullifierRoot, "root", root, "key", key);
    
    key.assertEquals(account.hash());
    root.assertNotEquals(nullifierRoot);
  }

  @method
  depositMessage(
    account: Account,
    message: Field,
    path: MerkleWitnessInstance,
    signature: Signature,
    nullifierWitness: MerkleMapWitness
  ) {
    // fetch the on-chain eligibilityRoot
    let eligibilityRoot = this.eligibilityRoot.getAndRequireEquals();

    // check that the account is within the committed Merkle Tree
    path.calculateRoot(account.hash()).assertEquals(eligibilityRoot);

    // fetch the on-chain nullifierRoot
    let nullifierRoot = this.nullifierRoot.getAndRequireEquals();

    // compute the root after setting nullifier flag
    const [rootAfterDeposit, key] = nullifierWitness.computeRootAndKey(Field(1));

    // ensure this account has not been deposited before
    nullifierRoot.assertNotEquals(rootAfterDeposit);
    
    Provable.log("rootAfterDeposit", rootAfterDeposit, "key", key);
    Provable.log("setting nullifier root to", rootAfterDeposit);

    // set the new root
    this.nullifierRoot.set(rootAfterDeposit);
    
    // verify message
    Provable.log("message:", message.toBits()[-6]);

    //Provable.if(message.toBits()[-6] === Bool(true))

    // now emit event with the message
    this.emitEvent('depositMessage', {
      depositer: account.publicKey,
      message: message,
    });

    // update contract state
    let totalMessages = this.totalMessages.getAndRequireEquals();
    let newTotalMessages = totalMessages.add(1);
    console.log('mesage deposited');
    this.totalMessages.set(newTotalMessages);
    
  }
}