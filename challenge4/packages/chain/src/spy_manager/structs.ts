import { Bool, Character, Field, Provable, Struct } from "o1js";

// message
export class Message extends Struct({
  msgNumber: Field,
  agentId: Field,
  twelveChars: Provable.Array(Character, 12),
  securityCode: Provable.Array(Character, 2),
}) {
  isValid(): Bool {
    // check twelve_chars
    new Bool(this.twelveChars.length === 12).assertTrue(
      "twelveChars must be of 12 characters"
    );

    // check security code
    new Bool(this.securityCode.length === 2).assertTrue(
      "securityCode must be of 2 characters"
    );

    return new Bool(true);
  }
}

// agent
export class Agent extends Struct({
  agentId: Field,
  lastMsgNumber: Field,
  securityCode: Provable.Array(Character, 2),
  securityCodeHash: Field,
}) {
  isValid(): Bool {
    // check security code
    new Bool(this.securityCode.length === 2).assertTrue(
      "securityCode must be of 2 characters"
    );

    return new Bool(true);
  }
}
