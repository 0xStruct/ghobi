import { TestingAppChain } from "@proto-kit/sdk";
import { PrivateKey, Field, Poseidon, Character, UInt64 } from "o1js";
import {
  SpyManager,
  SpyManagerPrivate,
  MessageProof,
  MessageProofProgram,
  proveMessage,
} from "../src/spy_manager";
import { log } from "@proto-kit/common";
import {
  Message,
  MessageProofPublicInput,
  MessageProofPublicOputput,
  Agent,
} from "../src/spy_manager/structs";
import { Pickles } from "o1js/dist/node/snarky";
import { dummyBase64Proof } from "o1js/dist/node/lib/proof_system";

log.setLevel("ERROR");

export async function dummyProof<I, O, P>(
  publicOutput: O,
  ProofType: new ({
    proof,
    publicInput,
    publicOutput,
    maxProofsVerified,
  }: {
    proof: unknown;
    publicInput: I;
    publicOutput: any;
    maxProofsVerified: 0 | 2 | 1;
  }) => P,
  publicInput: I
): Promise<P> {
  const [, proof] = Pickles.proofOfBase64(await dummyBase64Proof(), 2);
  return new ProofType({
    proof: proof,
    maxProofsVerified: 2,
    publicInput,
    publicOutput,
  });
}

describe("spyManager", () => {
  let appChain = TestingAppChain.fromRuntime({
    SpyManagerPrivate,
  });
  let spyManager: SpyManager;
  let get_chars = (str: string) => {
    return str.split("").map((v: string) => Character.fromString(v));
  };
  let agent1 = new Agent({
    agentId: Field(1),
    lastMsgNumber: Field(9),
    securityCode: get_chars("aa"),
    securityCodeHash: Poseidon.hash(
      get_chars("aa").map((char) => char.toField())
    ),
  });
  let agent2 = new Agent({
    agentId: Field(2),
    lastMsgNumber: Field(9),
    securityCode: get_chars("bb"),
    securityCodeHash: Poseidon.hash(
      get_chars("bb").map((char) => char.toField())
    ),
  });
  let agent3 = new Agent({
    agentId: Field(3),
    lastMsgNumber: Field(99),
    securityCode: get_chars("cc"),
    securityCodeHash: Poseidon.hash(
      get_chars("cc").map((char) => char.toField())
    ),
  });
  const signerPrivateKey = PrivateKey.random();
  const signer = signerPrivateKey.toPublicKey();

  beforeEach(async () => {
    appChain.configurePartial({
      Runtime: {
        Balances: {
          totalSupply: UInt64.from(10000),
        },
        SpyManagerPrivate: {},
      },
    });
    await appChain.start();
    appChain.setSigner(signerPrivateKey);

    spyManager = appChain.runtime.resolve("SpyManagerPrivate");

    // add agent
    const tx = await appChain.transaction(signer, () => {
      spyManager.addAgent(agent1);
    });
    await tx.sign();
    await tx.send();

    const block = await appChain.produceBlock();
    const agent_ = await appChain.query.runtime.SpyManagerPrivate.agents.get(
      agent1.agentId
    );

    expect(block?.transactions[0].status.toBoolean()).toBe(true);
    expect(agent_?.agentId.toBigInt()).toBe(agent1.agentId.toBigInt());
  });

  it("receiveMessage from agent1 (added) and query agentTx as well... should succeed", async () => {
    const agent = await appChain.query.runtime.SpyManagerPrivate.agents.get(
      agent1.agentId
    );

    let msg = new Message({
      msgNumber: Field(10),
      agentId: Field(1),
      twelveChars: get_chars("abcdefghijkl"), // 12 chars
      securityCode: get_chars("aa"),
    });

    const publicInput = new MessageProofPublicInput({
      securityCodeHash: Poseidon.hash(
        msg.securityCode.map((char) => char.toField())
      ),
    });
    const publicOutput = proveMessage(publicInput, msg);
    const proof = await dummyProof(publicOutput, MessageProof, publicInput);

    const tx = await appChain.transaction(signer, () => {
      spyManager.receiveMessage(msg, proof);
    });
    await tx.sign();
    await tx.send();

    const block = await appChain.produceBlock();
    const agent_ = await appChain.query.runtime.SpyManagerPrivate.agents.get(
      agent1.agentId
    );

    expect(block?.transactions[0].status.toBoolean()).toBe(true);
    expect(agent_?.lastMsgNumber.toBigInt()).toBe(msg.msgNumber.toBigInt());

    const agentTx = await appChain.query.runtime.SpyManagerPrivate.agentTx.get(
      msg.agentId
    );

    expect(agentTx?.blockHeight.toBigInt()).toBe(block?.height.toBigInt());
    expect(agentTx?.sender.toBase58()).toBe(signer.toBase58());
    expect(agentTx?.sender.toBase58()).toBe(
      tx.transaction?.sender.toBase58()
    );
    expect(agentTx?.nonce.toBigInt()).toBe(tx.transaction?.nonce.toBigInt());
  });

  it("receiveMessage from agent1 (added) with wrong securityCode... should fail", async () => {
    let msg = new Message({
      msgNumber: Field(10),
      agentId: agent1.agentId,
      twelveChars: get_chars("abcdefghijkl"), // 12 chars
      securityCode: get_chars("zz"),
    });

    const publicInput = new MessageProofPublicInput({
      securityCodeHash: Poseidon.hash(
        msg.securityCode.map((char) => char.toField())
      ),
    });
    const publicOutput = proveMessage(publicInput, msg);
    const proof = await dummyProof(publicOutput, MessageProof, publicInput);

    const tx = await appChain.transaction(signer, () => {
      spyManager.receiveMessage(msg, proof);
    });
    await tx.sign();
    await tx.send();

    const block = await appChain.produceBlock();
    expect(block?.transactions[0].status.toBoolean()).toBe(false);

    const agent_ = await appChain.query.runtime.SpyManagerPrivate.agents.get(
      agent1.agentId
    );
    expect(agent_?.lastMsgNumber.toBigInt()).not.toBe(msg.msgNumber.toBigInt());
  });

  it("receiveMessage from agent2 (not yet added)... should fail", async () => {
    let msg = new Message({
      msgNumber: Field(10),
      agentId: agent2.agentId,
      twelveChars: get_chars("abcdefghijkl"), // 12 chars
      securityCode: get_chars("bb"),
    });

    const publicInput = new MessageProofPublicInput({
      securityCodeHash: Poseidon.hash(
        msg.securityCode.map((char) => char.toField())
      ),
    });
    const publicOutput = proveMessage(publicInput, msg);
    const proof = await dummyProof(publicOutput, MessageProof, publicInput);

    const tx = await appChain.transaction(signer, () => {
      spyManager.receiveMessage(msg, proof);
    });
    await tx.sign();
    await tx.send();

    const block = await appChain.produceBlock();
    expect(block?.transactions[0].status.toBoolean()).toBe(false);

    const agent_ = await appChain.query.runtime.SpyManagerPrivate.agents.get(
      agent2.agentId
    );
    expect(agent_).toBeUndefined();
  });

  it("receiveMessage from agent1 (added) with low msgNumber... should fail", async () => {
    let msg = new Message({
      msgNumber: Field(1), // should be above 9
      agentId: agent1.agentId,
      twelveChars: get_chars("abcdefghijkl"), // 12 chars
      securityCode: get_chars("aa"),
    });

    const publicInput = new MessageProofPublicInput({
      securityCodeHash: Poseidon.hash(
        msg.securityCode.map((char) => char.toField())
      ),
    });
    const publicOutput = proveMessage(publicInput, msg);
    const proof = await dummyProof(publicOutput, MessageProof, publicInput);

    const tx = await appChain.transaction(signer, () => {
      spyManager.receiveMessage(msg, proof);
    });
    await tx.sign();
    await tx.send();

    const block = await appChain.produceBlock();
    expect(block?.transactions[0].status.toBoolean()).toBe(false);

    const agent_ = await appChain.query.runtime.SpyManagerPrivate.agents.get(
      agent1.agentId
    );
    expect(agent_?.lastMsgNumber.toBigInt()).not.toBe(msg.msgNumber.toBigInt());
  });

  it("receiveMessage from agent1 (added) with incorrect message length... should fail", async () => {
    let msg = new Message({
      msgNumber: Field(10), // should be above 9
      agentId: agent1.agentId,
      twelveChars: get_chars("abcde"), // 5 chars only
      securityCode: get_chars("aa"),
    });

    const publicInput = new MessageProofPublicInput({
      securityCodeHash: Poseidon.hash(
        msg.securityCode.map((char) => char.toField())
      ),
    });
    const publicOutput = proveMessage(publicInput, msg);
    const proof = await dummyProof(publicOutput, MessageProof, publicInput);

    await expect(async () => {
      const tx = await appChain.transaction(signer, () => {
        spyManager.receiveMessage(msg, proof);
      });
      await tx.sign();
      await tx.send();

      const block = await appChain.produceBlock();
      expect(block?.transactions[0].status.toBoolean()).toBe(false);

      const agent_ = await appChain.query.runtime.SpyManagerPrivate.agents.get(
        agent1.agentId
      );
      expect(agent_?.lastMsgNumber.toBigInt()).not.toBe(
        msg.msgNumber.toBigInt()
      );
    }).rejects.toThrow(/twelveChars must be of 12 characters/);
  });
});
