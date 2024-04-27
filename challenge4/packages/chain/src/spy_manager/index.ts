import {
  RuntimeModule,
  runtimeMethod,
  runtimeModule,
  state,
} from "@proto-kit/module";
import { StateMap, assert } from "@proto-kit/protocol";
import { Message, MessageProofPublicInput, MessageProofPublicOputput, Agent, AgentTx } from "./structs";
import { Bool, Character, Experimental, Field, Poseidon, Provable } from "o1js";

export const proveMessage = (
  publicInput: MessageProofPublicInput,
  message: Message
): MessageProofPublicOputput => {

  const messageSecurityCodeHash = Poseidon.hash(message.securityCode.map((char) => char.toField()));
  Provable.log("securityCode check", messageSecurityCodeHash, publicInput.securityCodeHash);
  assert(publicInput.securityCodeHash.equals(messageSecurityCodeHash));

  return new MessageProofPublicOputput({});
};

export const MessageProofProgram = Experimental.ZkProgram({
  publicInput: MessageProofPublicInput,
  publicOutput: MessageProofPublicOputput,
  methods: {
    prove: {
      privateInputs: [Message],
      method: proveMessage,
    }
  },
});

export class MessageProof extends Experimental.ZkProgram.Proof(MessageProofProgram) {}

@runtimeModule()
export class SpyManager extends RuntimeModule {
  @state() public agents = StateMap.from<Field, Agent>(Field, Agent);

  @runtimeMethod()
  public addAgent(agent: Agent) {
    // check if the agent with the id exists
    this.agents
      .get(agent.agentId)
      .isSome.assertFalse("Agent with this agentId already exists");

    // check security code is of 2 characters
    // optional to check as it is implicitly checked in receiveMessage
    assert(
      new Bool(agent.securityCode.length === 2),
      "Agent security code is not 2 characters"
    );

    // add agent
    this.agents.set(agent.agentId, agent);
  }

  @runtimeMethod()
  public receiveMessage(message: Message, messageProof: MessageProof) {
    // check if an agent with message.agentId exists
    const agent = this.agents.get(message.agentId);
    assert(agent.isSome, "agent not registered");

    messageProof.verify(); // verify proof
    assert(messageProof.publicInput.securityCodeHash.equals(agent.value.securityCodeHash));

    // check message.securityCode === agent.value.securityCode
    const msgSecurityCodeHash = Poseidon.hash(message.securityCode.map((char) => char.toField()));
    Provable.log("securityCode check", message.agentId, agent.value.agentId, msgSecurityCodeHash, agent.value.securityCodeHash);
    assert(msgSecurityCodeHash.equals(agent.value.securityCodeHash), "invalid securityCode");

    // check message.msgNumber > agent.value.lastMsgNumber
    assert(message.msgNumber.greaterThan(agent.value.lastMsgNumber), "invalid msgNumber");

    // check message.isValid()
    assert(message.isValid(), "message is not valid");

    // receive the message and set agent.value.lastMsgNumber with message.msgNumber
    agent.value.lastMsgNumber = message.msgNumber;
    this.agents.set(message.agentId, agent.value);
  }
}

@runtimeModule()
export class SpyManagerPrivate extends SpyManager {
  @state() public agentInfo = StateMap.from<Field, AgentTx>(
    Field,
    AgentTx
  );

  @runtimeMethod()
  public override receiveMessage(
    message: Message,
    messageProof: MessageProof
  ) {
    super.receiveMessage(message, messageProof);

    // save agentInfo
    let agentInfo = this.agentInfo.get(message.agentId).value;

    agentInfo.blockHeigh = this.network.block.height;
    agentInfo.nonce = agentInfo.nonce.add(1);
    agentInfo.sender = this.transaction.sender.value;

    this.agentInfo.set(message.agentId, agentInfo);
  }
}
