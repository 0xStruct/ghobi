import { TestingAppChain } from "@proto-kit/sdk";
import { PrivateKey, Field, Poseidon, Character } from "o1js";
import { SpyManager } from "../src/spy_manager";
import { log } from "@proto-kit/common";
import { UInt64 } from "@proto-kit/library";
import { Message, Agent } from "../src/spy_manager/structs";

log.setLevel("ERROR");

describe("spyManager", () => {
  let appChain = TestingAppChain.fromRuntime({
    SpyManager,
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
        SpyManager: {},
      },
    });
    await appChain.start();
    appChain.setSigner(signerPrivateKey);

    spyManager = appChain.runtime.resolve("SpyManager");

    // add agent
    const tx = await appChain.transaction(signer, () => {
      spyManager.addAgent(agent1);
    });
    await tx.sign();
    await tx.send();

    const block = await appChain.produceBlock();
    const agent_ = await appChain.query.runtime.SpyManager.agents.get(
      agent1.agentId
    );

    expect(block?.transactions[0].status.toBoolean()).toBe(true);
    expect(agent_?.agentId.toBigInt()).toBe(agent1.agentId.toBigInt());
  });

  it("receiveMessage from agent1 (added)... should succeed", async () => {
    const agent = await appChain.query.runtime.SpyManager.agents.get(
      agent1.agentId
    );

    let msg = new Message({
      msgNumber: Field(10),
      agentId: Field(1),
      twelveChars: get_chars("abcdefghijkl"), // 12 chars
      securityCode: get_chars("aa"),
    });

    const tx = await appChain.transaction(signer, () => {
      spyManager.receiveMessage(msg);
    });
    await tx.sign();
    await tx.send();

    const block = await appChain.produceBlock();
    const agent_ = await appChain.query.runtime.SpyManager.agents.get(
      agent1.agentId
    );

    expect(block?.transactions[0].status.toBoolean()).toBe(true);
    expect(agent_?.lastMsgNumber.toBigInt()).toBe(msg.msgNumber.toBigInt());
  });

  it("receiveMessage from agent1 (added) with wrong securityCode... should fail", async () => {
    let msg = new Message({
      msgNumber: Field(10),
      agentId: agent1.agentId,
      twelveChars: get_chars("abcdefghijkl"), // 12 chars
      securityCode: get_chars("zz"),
    });

    const tx = await appChain.transaction(signer, () => {
      spyManager.receiveMessage(msg);
    });
    await tx.sign();
    await tx.send();

    const block = await appChain.produceBlock();
    expect(block?.transactions[0].status.toBoolean()).toBe(false);

    const agent_ = await appChain.query.runtime.SpyManager.agents.get(
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

    const tx = await appChain.transaction(signer, () => {
      spyManager.receiveMessage(msg);
    });
    await tx.sign();
    await tx.send();

    const block = await appChain.produceBlock();
    expect(block?.transactions[0].status.toBoolean()).toBe(false);

    const agent_ = await appChain.query.runtime.SpyManager.agents.get(
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
    const tx = await appChain.transaction(signer, () => {
      spyManager.receiveMessage(msg);
    });
    await tx.sign();
    await tx.send();

    const block = await appChain.produceBlock();
    expect(block?.transactions[0].status.toBoolean()).toBe(false);

    const agent_ = await appChain.query.runtime.SpyManager.agents.get(
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

    await expect(async () => {
      const tx = await appChain.transaction(signer, () => {
        spyManager.receiveMessage(msg);
      });
      await tx.sign();
      await tx.send();

      const block = await appChain.produceBlock();
      expect(block?.transactions[0].status.toBoolean()).toBe(false);

      const agent_ = await appChain.query.runtime.SpyManager.agents.get(
        agent1.agentId
      );
      expect(agent_?.lastMsgNumber.toBigInt()).not.toBe(
        msg.msgNumber.toBigInt()
      );
    }).rejects.toThrow(/twelveChars must be of 12 characters/);
  });
});
