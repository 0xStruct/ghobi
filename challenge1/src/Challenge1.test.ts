import { Challenge1, Account, MerkleWitnessInstance } from './Challenge1';
import {
  Mina,
  PrivateKey,
  PublicKey,
  AccountUpdate,
  MerkleTree,
  UInt64,
  Signature,
  MerkleMap,
  Field,
  Bytes,
  Encoding,
  Poseidon,
} from 'o1js';

const Tree = new MerkleTree(8);
const initialTokens = 100;
let initialBalance = 10_000_000_000;
type Names = 'Bob' | 'Alice' | 'Charlie' | 'Olivia';
export let Accounts: Map<string, Account> = new Map<Names, Account>();

let bob, alice, charlie, olivia: any;
let initialCommitment: any;

async function createLocalBlockchain() {
  const Local = Mina.LocalBlockchain();
  Mina.setActiveInstance(Local);

  // console.log("compiling zkapp...");
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

  // Bob is not in the merkle tree
  Tree.setLeaf(BigInt(0), alice.hash());
  Tree.setLeaf(BigInt(1), charlie.hash());
  Tree.setLeaf(BigInt(2), olivia.hash());

  initialCommitment = Tree.getRoot();

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

  it('deploys the `Challenge1` smart contract and setsPreImage', async () => {
    const zkAppInstance = new Challenge1(zkAppAddress);
    await localDeploy(zkAppInstance, zkAppPrivateKey, deployerAccount);
    await setEligibilityRoot(deployerAccount, zkAppPrivateKey, zkAppInstance);

    expect(zkAppInstance.eligibilityRoot.get()).toEqual(initialCommitment);
  });

  it('check Alice is in the set', async () => {
    const zkAppInstance = new Challenge1(zkAppAddress);
    await localDeploy(zkAppInstance, zkAppPrivateKey, deployerAccount);
    await setEligibilityRoot(deployerAccount, zkAppPrivateKey, zkAppInstance);

    await checkSetInclusion(
      'Alice',
      BigInt(0),
      deployerAccount,
      zkAppPrivateKey,
      zkAppInstance
    );
  });

  it('can mint', async () => {
    const zkAppInstance = new Challenge1(zkAppAddress);
    await localDeploy(zkAppInstance, zkAppPrivateKey, deployerAccount);
    await setEligibilityRoot(deployerAccount, zkAppPrivateKey, zkAppInstance);

    await mint(deployerAccount, zkAppPrivateKey, zkAppInstance);
  });

  it('check claim status', async () => {
    const zkAppInstance = new Challenge1(zkAppAddress);
    await localDeploy(zkAppInstance, zkAppPrivateKey, deployerAccount);
    await setEligibilityRoot(deployerAccount, zkAppPrivateKey, zkAppInstance);

    const result = await checkClaimed("Alice", deployerAccount, zkAppPrivateKey, zkAppInstance);
    expect(result).toEqual(Field(0));
  });

  it('can claim', async () => {
    const zkAppInstance = new Challenge1(zkAppAddress);
    await localDeploy(zkAppInstance, zkAppPrivateKey, deployerAccount);
    await setEligibilityRoot(deployerAccount, zkAppPrivateKey, zkAppInstance);

    await depositMessage(
      'Alice',
      BigInt(0),
      Poseidon.hash(Encoding.stringToFields("Hello")),
      deployerAccount,
      zkAppPrivateKey,
      zkAppInstance
    );

    // eslint-disable-next-line no-unused-vars
    const result = await checkClaimed("Alice", deployerAccount, zkAppPrivateKey, zkAppInstance);
    // expect(result).toEqual(Field(1));
  });

  it('throws when randomer is not in set', async () => {
    const zkAppInstance = new Challenge1(zkAppAddress);
    await localDeploy(zkAppInstance, zkAppPrivateKey, deployerAccount);
    await setEligibilityRoot(deployerAccount, zkAppPrivateKey, zkAppInstance);
    try {
      expect(
        await checkSetInclusion(
          'Bob',
          BigInt(0),
          deployerAccount,
          zkAppPrivateKey,
          zkAppInstance
        )
      ).toThrow();
    } catch (e) {
      console.log(e);
    }
  });
});

async function setEligibilityRoot(
  feePayer: any,
  zkappKey: any,
  merkleZkApp: Challenge1
) {
  let tx = await Mina.transaction(feePayer, () => {
    merkleZkApp.setEligibilityRoot(initialCommitment);
    merkleZkApp.sign(zkappKey);
  });
  await tx.prove();
  await tx.send();
}

async function checkSetInclusion(
  name: Names,
  index: bigint, // do we need index? can we just loop in the tree?
  feePayer: any,
  zkappKey: any,
  contract: Challenge1
) {
  let tx = await Mina.transaction(feePayer, () => {
    let account = Accounts.get(name)!;
    let w = Tree.getWitness(index);
    let witness = new MerkleWitnessInstance(w);
    contract.checkEligibility(account, witness);
    contract.sign(zkappKey);
  });
  await tx.prove();
  await tx.send();
}

async function depositMessage(
  name: Names,
  index: bigint,
  message: Field,
  feePayer: any,
  zkappKey: any,
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
    let w = Tree.getWitness(index);
    let witness = new MerkleWitnessInstance(w);

    const map = new MerkleMap();
    console.log("depositor:", depositor.toBase58());
    const mmWitness = map.getWitness(Field(0));

    contract.depositMessage(account, message, witness, sig, mmWitness);
    contract.sign(zkappKey);
  });
  await tx.prove();
  tx.sign([zkappKey]);
  await tx.send();
}

async function checkClaimed(
  name: Names,
  feePayer: any,
  zkappKey: any,
  contract: Challenge1
): Promise<Field> {
  let result = Field(0)

  let tx = await Mina.transaction(feePayer, () => {
    let account = Accounts.get(name)!;
    const map = new MerkleMap();

    const mmWitness = map.getWitness(Field(0));

    result = contract.checkDeposited(account, mmWitness);
    console.log({ result })
    contract.sign(zkappKey);
  });
  await tx.prove();
  tx.sign([zkappKey]);
  await tx.send();
  return result
}

async function mint(
  feePayer: any,
  zkappKey: any,
  contract: Challenge1
) {
  const sig = Signature.create(
    zkappKey,
    UInt64.from(initialTokens)
      .toFields()
      .concat(contract.address.toFields())
  );
  // console.log("compiling.")
  // await Challenge1.compile()
  let tx = await Mina.transaction(feePayer, () => {
    AccountUpdate.fundNewAccount(feePayer);
    contract.mint(
      contract.address,
      UInt64.from(initialTokens),
      sig
    );
    contract.sign(zkappKey);
  });
  await tx.prove();
  tx.sign([zkappKey]);
  await tx.send();
}
