import {
  Cache,
  Mina,
  PrivateKey,
  PublicKey,
  AccountUpdate,
  UInt32,
} from 'o1js';
import { MessageProveValidator } from './MessageProveValidator';
import { MessageProve, batchMessages } from './MessageProve';
import { Message } from './Message';

let proofsEnabled = true;

describe('MessageProveValidator', () => {
  let deployerAccount: PublicKey,
    deployerKey: PrivateKey,
    accounts: { publicKey: PublicKey; privateKey: PrivateKey }[],
    zkAppAddress: PublicKey,
    zkAppPrivateKey: PrivateKey,
    zkApp: MessageProveValidator;

  async function localDeploy() {
    const txn = await Mina.transaction(deployerAccount, () => {
      AccountUpdate.fundNewAccount(deployerAccount);
      zkApp.deploy();
    });
    await txn.prove();
    await txn.sign([deployerKey, zkAppPrivateKey]).send();
  }

  beforeAll(async () => {
    const cache: Cache = Cache.FileSystem('./cache');
    console.log('compiling ...');
    console.time('compile-MessageProve');
    await MessageProve.compile({ cache });
    console.timeEnd('compile-MessageProve');

    console.time('compile-MessageProveValidator');
    if (proofsEnabled) await MessageProveValidator.compile();
    console.timeEnd('compile-MessageProveValidator');

    const Local = Mina.LocalBlockchain({ proofsEnabled });
    Mina.setActiveInstance(Local);
    ({ privateKey: deployerKey, publicKey: deployerAccount } =
      Local.testAccounts[0]);
    accounts = Local.testAccounts.slice(1);
    zkAppPrivateKey = PrivateKey.random();
    zkAppAddress = zkAppPrivateKey.toPublicKey();
    zkApp = new MessageProveValidator(zkAppAddress);

    await localDeploy();
  });

  it('check initial value of max', async () => {
    expect(zkApp.max.get()).toEqual(UInt32.zero);
  });

  it('process 3 batches, verify @state max after each', async () => {

    // 1st batch max = 10
    console.log("processing batch 1/3 ...")
    let batchProof = await batchMessages([
      Message.from({
        number: 1,
        id: 100,
        x: 1500,
        y: 5500,
        checksum: 7100,
      }),
      Message.from({
        number: 10,
        id: 100,
        x: 1500,
        y: 5500,
        checksum: 7100,
      }),
    ]);

    const account = accounts[0];
    let txn = await Mina.transaction(account.publicKey, () => {
      zkApp.step(batchProof);
    });
    await txn.prove();
    await txn.sign([account.privateKey]).send();

    expect(zkApp.max.get()).toEqual(new UInt32(10));

    // 2nd batch max = 100
    console.log("processing batch 2/3 ...")
    batchProof = await batchMessages([
      Message.from({
        number: 1,
        id: 100,
        x: 1500,
        y: 5500,
        checksum: 7100,
      }),
      Message.from({
        number: 100,
        id: 100,
        x: 1500,
        y: 5500,
        checksum: 7100,
      }),
    ]);

    txn = await Mina.transaction(account.publicKey, () => {
      zkApp.step(batchProof);
    });
    await txn.prove();
    await txn.sign([account.privateKey]).send();

    expect(zkApp.max.get()).toEqual(new UInt32(100));

    // 3rd batch max = 900 from an invalid one
    console.log("processing batch 3/3 ...")
    batchProof = await batchMessages([
      Message.from({
        number: 1,
        id: 100,
        x: 1500,
        y: 5500,
        checksum: 7100,
      }),
      Message.from({ // invalid one with high number of 900
        number: 900,
        id: 100,
        x: 1500,
        y: 5500,
        checksum: 100,
      }),
    ]);

    txn = await Mina.transaction(account.publicKey, () => {
      zkApp.step(batchProof);
    });
    await txn.prove();
    await txn.sign([account.privateKey]).send();

    expect(zkApp.max.get()).toEqual(new UInt32(100));
  });
});
