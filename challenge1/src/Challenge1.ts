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
  method,
  MerkleWitness,
  Signature,
  // MerkleMap,
  MerkleMapWitness,
  Bytes,
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

  // nullifiers are used to prevent double spending
  @state(Field) nullifiers = State<Field>();

  // total supply of tokens
  @state(UInt64) totalMessages = State<UInt64>();

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

  // token method
  @method mint(
    receiverAddress: PublicKey,
    amount: UInt64,
    adminSignature: Signature
  ) {
    let totalMessages = this.totalMessages.getAndRequireEquals();
    let newTotalMessages = totalMessages.add(1);

    console.log('verifying signature');
    adminSignature
      .verify(
        this.address,
        amount.toFields().concat(receiverAddress.toFields())
      )
      .assertTrue();
    console.log('verified signature');

    this.token.mint({
      address: receiverAddress,
      amount,
    });
    console.log('minted!');
    this.totalMessages.set(newTotalMessages);
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

  /// checks if an account has deposited, returns 0 if not deposited, 1 if deposited
  @method
  checkDeposited(account: Account, mmWitness: MerkleMapWitness): Field {
    // ensure this account has not been deposited before
    let nullifiers = this.nullifiers.getAndRequireEquals();

    // eslint-disable-next-line no-unused-vars
    const [rootBefore, key] = mmWitness.computeRootAndKey(Field(0));
    return key;
  }

  @method
  depositMessage(
    account: Account,
    message: Field,
    path: MerkleWitnessInstance,
    signature: Signature,
    mmWitness: MerkleMapWitness
  ) {
    // fetch the on-chain eligibilityRoot
    let eligibilityRoot = this.eligibilityRoot.getAndRequireEquals();

    // check that the account is within the committed Merkle Tree
    path.calculateRoot(account.hash()).assertEquals(eligibilityRoot);

    // ensure this account has not been deposited before
    let _nullifiers = this.nullifiers.getAndRequireEquals();

    // eslint-disable-next-line no-unused-vars
    const [rootBefore, key] = mmWitness.computeRootAndKey(Field(0));
    // console.log(" nullifier root is", rootBefore.toString())
    key.assertEquals(Field(0));
    // rootBefore.assertEquals(_nullifiers.getRoot());

    // compute the root after setting nullifier flag
    // eslint-disable-next-line no-unused-vars
    const [rootAfter, _] = mmWitness.computeRootAndKey(Field(1));

    // console.log("setting nullifier root to", rootAfter.toString())

    // set the new root
    this.nullifiers.set(rootAfter);

    // now send tokens to the account
    // this.mint(account.publicKey, UInt64.one, signature);
  }
}