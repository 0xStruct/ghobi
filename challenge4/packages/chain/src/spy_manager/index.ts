import {
  RuntimeModule,
  runtimeMethod,
  runtimeModule,
  state,
} from "@proto-kit/module";
import { StateMap, assert } from "@proto-kit/protocol";
import { Message, Agent } from "./structs";
import { Bool, Character, Field, Poseidon, Provable } from "o1js";

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
  public receiveMessage(message: Message) {
    // check if an agent with message.agentId exists
    const agent = this.agents.get(message.agentId);
    assert(agent.isSome, "agent not registered");

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
