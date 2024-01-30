import { Challenge1, Account } from './Challenge1';
import {
  Mina,
  PrivateKey,
  PublicKey,
  AccountUpdate,
  MerkleTree,
  UInt64,
  Signature,
  MerkleMap,
  MerkleMapWitness,
  Field,
  Bool,
} from 'o1js';

const EligibilityTree = new MerkleTree(8);
const EligibilityMap = new MerkleMap();
const NullifierMap = new MerkleMap();

let initialBalance = 10_000_000_000;
type Names = 'Bob' | 'Alice' | 'Charlie' | 'Olivia';
export let Accounts: Map<string, Account> = new Map<Names, Account>();

let bob, alice, charlie, olivia: Account;
let initialEligibilityRoot: Field;
let initialNullifierRoot: Field;

async function createLocalBlockchain() {
  const Local = Mina.LocalBlockchain();
  Mina.setActiveInstance(Local);

  console.log("compiling zkapp...");
  let { verificationKey } = await Challenge1.compile();
  console.log("compiled zkapp...");
  console.log({ verificationKey })

  alice = new Account({publicKey: Local.testAccounts[1].publicKey});
  charlie = new Account({publicKey: Local.testAccounts[2].publicKey});
  olivia = new Account({publicKey: Local.testAccounts[3].publicKey});
  bob = new Account({publicKey: Local.testAccounts[4].publicKey});

  Accounts.set('Alice', alice);
  Accounts.set('Charlie', charlie);
  Accounts.set('Olivia', olivia);
  Accounts.set('Bob', bob);

  // Bob is not in the Eligibility merkle tree
  EligibilityTree.setLeaf(BigInt(0), alice.hash());
  EligibilityTree.setLeaf(BigInt(1), charlie.hash());
  EligibilityTree.setLeaf(BigInt(2), olivia.hash());

  initialEligibilityRoot = EligibilityTree.getRoot();
  initialNullifierRoot = NullifierMap.getRoot();

  return Local.testAccounts[0].privateKey;
}

async function localDeploy(
  zkAppInstance: Challenge1,
  zkAppPrivatekey: PrivateKey,
  deployerAccount: PrivateKey
) {
  const txn = await Mina.transaction(deployerAccount, () => {
    AccountUpdate.fundNewAccount(deployerAccount, { initialBalance });
    zkAppInstance.deploy({ zkappKey: zkAppPrivatekey });
  });
  await txn.send();
}

describe('Challenge1', () => {
  let deployerAccount: PrivateKey,
    zkAppAddress: PublicKey,
    zkAppPrivateKey: PrivateKey;

  beforeEach(async () => {
    deployerAccount = await createLocalBlockchain();
    zkAppPrivateKey = PrivateKey.random();
    zkAppAddress = zkAppPrivateKey.toPublicKey();
  });

  // afterAll(async () => {});

  it('deploys the `Challenge1` smart contract and addEligibleAddress', async () => {
    const zkAppInstance = new Challenge1(zkAppAddress);
    await localDeploy(zkAppInstance, zkAppPrivateKey, deployerAccount);

    await addEligibleAddress("Alice", deployerAccount, zkAppPrivateKey, zkAppInstance);
    
    expect(zkAppInstance.eligibilityRoot.get()).toEqual(EligibilityMap.getRoot());
  });

  it('check Alice and Charlie is in the eligibility tree', async () => {
    const zkAppInstance = new Challenge1(zkAppAddress);
    await localDeploy(zkAppInstance, zkAppPrivateKey, deployerAccount);
    
    await addEligibleAddress("Alice", deployerAccount, zkAppPrivateKey, zkAppInstance);
    await addEligibleAddress("Charlie", deployerAccount, zkAppPrivateKey, zkAppInstance);
    // await addEligibleAddress("Olivia", deployerAccount, zkAppPrivateKey, zkAppInstance);

    expect(zkAppInstance.eligibilityRoot.get()).toEqual(EligibilityMap.getRoot());

    await checkEligibility(
      'Alice',
      deployerAccount,
      zkAppPrivateKey,
      zkAppInstance
    );

    await checkEligibility(
      'Alice',
      deployerAccount,
      zkAppPrivateKey,
      zkAppInstance
    );
  });

  it('check Alice depositMessage status, Alice has not deposited yet', async () => {
    const zkAppInstance = new Challenge1(zkAppAddress);
    await localDeploy(zkAppInstance, zkAppPrivateKey, deployerAccount);
    
    await addEligibleAddress("Alice", deployerAccount, zkAppPrivateKey, zkAppInstance);
    // await addEligibleAddress("Charlie", deployerAccount, zkAppPrivateKey, zkAppInstance);
    // await addEligibleAddress("Olivia", deployerAccount, zkAppPrivateKey, zkAppInstance);

    await checkDeposit("Alice", deployerAccount, zkAppPrivateKey, zkAppInstance);
  });

  it('Alice can depositMessage 1st time, BUT cannot depositMessage again', async () => {
    const zkAppInstance = new Challenge1(zkAppAddress);
    await localDeploy(zkAppInstance, zkAppPrivateKey, deployerAccount);
    
    await addEligibleAddress("Alice", deployerAccount, zkAppPrivateKey, zkAppInstance);
    // await addEligibleAddress("Charlie", deployerAccount, zkAppPrivateKey, zkAppInstance);
    // await addEligibleAddress("Olivia", deployerAccount, zkAppPrivateKey, zkAppInstance);

    await depositMessage(
      'Alice',
      Field(0),
      deployerAccount,
      zkAppPrivateKey,
      zkAppInstance
    );

    // after depositting, update the local NullifierMap
    NullifierMap.set(Accounts.get("Alice")!.hash(), Field(1));

    // checkDeposit - show throw error as Alice has deposited already
    try {
      expect(
        await checkDeposit("Alice", deployerAccount, zkAppPrivateKey, zkAppInstance)
      ).toThrowError();
    } catch (e) {
      console.log("checkDeposit for Charlie:", e);
    }

    // checkDeposit - should not throw error as Charlie has not deposited
    await checkDeposit("Charlie", deployerAccount, zkAppPrivateKey, zkAppInstance);

    // Alice deposit again - should not be allowed
    try {
      expect(
        await depositMessage(
          'Alice',
          Field(0),
          deployerAccount,
          zkAppPrivateKey,
          zkAppInstance
        )
      ).toThrowError();
    } catch (e) {
      console.log("Alice depositting again, should not be allowed", e);
    }
  });

  it('check Bob eligibility - Bob is not in the list yet, THEN add Bob to the list and check again', async () => {
    const zkAppInstance = new Challenge1(zkAppAddress);
    await localDeploy(zkAppInstance, zkAppPrivateKey, deployerAccount);

    try {
      expect(
        await checkEligibility(
          'Bob',
          deployerAccount,
          zkAppPrivateKey,
          zkAppInstance
        )
      ).toThrow();
    } catch (e) {
      console.log(e);
    }

    await addEligibleAddress("Bob", deployerAccount, zkAppPrivateKey, zkAppInstance);

    await checkEligibility(
      'Bob',
      deployerAccount,
      zkAppPrivateKey,
      zkAppInstance
    );

  });

  it('verify various messages', async () => {
    // If flag 1 is true, then all other flags must be false
    // If flag 2 is true, then flag 3 must also be true
    // If flag 4 is true, then flags 5 and 6 must be false

    const zkAppInstance = new Challenge1(zkAppAddress);
    await localDeploy(zkAppInstance, zkAppPrivateKey, deployerAccount);

    expect(zkAppInstance.verifyMessage(Field(0b000001))).toEqual(Bool(true)); // rule 1 is true
    expect(zkAppInstance.verifyMessage(Field(0b000110))).toEqual(Bool(true)); // rule 2 is true
    expect(zkAppInstance.verifyMessage(Field(0b001000))).toEqual(Bool(true)); // rule 3 is true

    // flag 1, 2, 4 are false
    expect(zkAppInstance.verifyMessage(Field(0b000000))).toEqual(Bool(true));
    expect(zkAppInstance.verifyMessage(Field(0b110100))).toEqual(Bool(true));
    expect(zkAppInstance.verifyMessage(Field(0b100100))).toEqual(Bool(true));

    expect(zkAppInstance.verifyMessage(Field(0b100001))).toEqual(Bool(false)); // rule 1 is false
    expect(zkAppInstance.verifyMessage(Field(0b100010))).toEqual(Bool(false)); // rule 2 is false
    expect(zkAppInstance.verifyMessage(Field(0b111000))).toEqual(Bool(false)); // rule 3 is false
  });
    
});

async function addEligibleAddress(
  name: Names,
  feePayer: any,
  zkappKey: any,
  contract: Challenge1,
) {

  let account = Accounts.get(name)!;
  let eligibilityWitness = EligibilityMap.getWitness(account.hash());

  EligibilityMap.set(account.hash(), Field(1));

  let tx = await Mina.transaction(feePayer, () => {
    contract.addEligibleAddress(eligibilityWitness);
  });
  await tx.prove();
  await tx.sign([feePayer]).send();
}

async function checkEligibility(
  name: Names,
  feePayer: any,
  zkappKey: any,
  contract: Challenge1
) {
  let account = Accounts.get(name)!;
  let eligibilityWitness = EligibilityMap.getWitness(account.hash());

  let tx = await Mina.transaction(feePayer, () => {
    contract.checkEligibility(eligibilityWitness);
  });
  await tx.prove();
  await tx.sign([zkappKey]).send();
}

async function depositMessage(
  name: Names,
  message: Field,
  feePayer: PrivateKey,
  zkappKey: PrivateKey,
  contract: Challenge1
) {
  let depositor = Accounts.get(name)!.publicKey;

  // create authorization signature
  const sig = Signature.create(
    zkappKey,
    UInt64.from(UInt64.one).toFields().concat(depositor.toFields())
  );

  let tx = await Mina.transaction(feePayer, () => {
    let account = Accounts.get(name)!;

    console.log("depositor:", depositor.toBase58());

    const eligibilityMapWitness = EligibilityMap.getWitness(account.hash());
    const nullifierMapWitness = NullifierMap.getWitness(account.hash());

    contract.depositMessage(account, message, eligibilityMapWitness, nullifierMapWitness, sig);
  });
  await tx.prove();
  await tx.sign([zkappKey]).send();
}

async function checkDeposit(
  name: Names,
  feePayer: any,
  zkappKey: any,
  contract: Challenge1
) {

  let tx = await Mina.transaction(feePayer, () => {
    let account = Accounts.get(name)!;

    const nullifierWitness = NullifierMap.getWitness(account.hash());

    contract.checkDeposit(account, nullifierWitness);
    contract.sign(zkappKey);
  });
  await tx.prove();
  tx.sign([zkappKey]);
  await tx.send();
}
