import { UInt32, Cache } from 'o1js';
import { MessageProve, MessageProveProof, batchMessages } from './MessageProve';
import { Message } from './Message';

describe('message-prove', () => {
  beforeAll(async () => {
    console.log("compiling ...");
    console.time("compile-MessageProve");
    const cache: Cache = Cache.FileSystem('./cache');
    await MessageProve.compile({ cache });
    console.timeEnd("compile-MessageProve");
  });

  describe('message-prove for batch messages', () => {

    it('batch valid messages', async () => {
      let batchProof: MessageProveProof = await batchMessages([
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

      expect(batchProof.publicOutput).toEqual(new UInt32(10));
    });

    it('batch valid messages with an invalid message', async () => {
      let batchProof: MessageProveProof = await batchMessages([
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
        Message.from({ // highest number but invalid
          number: 1000,
          id: 100,
          x: 1500,
          y: 5500,
          checksum: 100,
        }),
      ]);

      // still max is 10, instead of 1000 from an invalid message
      expect(batchProof.publicOutput).toEqual(new UInt32(10));
    });
  });
});
