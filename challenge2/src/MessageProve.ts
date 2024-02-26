import {
  UInt32,
  Bool,
  Field,
  SelfProof,
  Provable,
  Struct,
  ZkProgram,
} from 'o1js';

import { Message } from './Message';

export class RpsProvePublicOutput extends Struct({
  hashedChoice: Field,
  revealed: Bool,
  revealedChoice: Field,
  gameId: Field,
}) {}

export const MessageProve = ZkProgram({
  name: 'message-prove',
  publicInput: UInt32,
  publicOutput: UInt32,
  methods: {
    start: {
      privateInputs: [],
      method(pubInput: UInt32) {
        return pubInput;
      },
    },
    step: {
      privateInputs: [SelfProof, Message],
      method(
        pubInput: UInt32,
        prevProof: SelfProof<UInt32, UInt32>,
        message: Message
      ) {
        const isValid = message.isValid();
        prevProof.verifyIf(isValid);

        // if isValid, return message.number, else return previous one
        return Provable.if(isValid, message.number, prevProof.publicOutput);
      },
    },
  },
});

export class MessageProveProof extends ZkProgram.Proof(MessageProve) {}

// step through batch of messages
export const batchMessages = async (
  messages: Message[],
  prevProof?: MessageProveProof
) => 
  await messages.reduce<Promise<MessageProveProof>>(
    async (proofPromise, message) => {
      const proof = await proofPromise;
      return MessageProve.step(UInt32.zero, proof, message);
    },
    Promise.resolve(prevProof || (await MessageProve.start(UInt32.zero)))
  );
