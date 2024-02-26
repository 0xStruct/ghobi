import { UInt32 } from 'o1js';
import { Message } from './Message';

describe('message validity check', () => {
  it('should be valid', () => {
    const message = Message.from({
      number: 1,
      id: 100,
      x: 1500,
      y: 5500,
      checksum: 7100,
    });
    expect(message.isValid().toBoolean()).toBe(true);
  });

  it('invalid checksum', () => {
    const message = Message.from({
      number: 1,
      id: 100,
      x: 1500,
      y: 5500,
      checksum: 7101,
    });
    expect(message.isValid().toBoolean()).toBe(false);
  });

  it('Agent ID >= 0 && <= 3000', () => {
    let message = Message.from({
      number: 1,
      id: 3500,
      x: 1000,
      y: 5000,
      checksum: 9500,
    });
    expect(message.isValid().toBoolean()).toBe(false);
    message.id = new UInt32(3000);
    message.checksum = new UInt32(9000);
    expect(message.isValid().toBoolean()).toBe(true);
  });

  it('Agent XLocation >= 0 && <= 15000', () => {
    let message = Message.from({
      number: 1,
      id: 100,
      x: 20000,
      y: 25000,
      checksum: 45100,
    });
    expect(message.isValid().toBoolean()).toBe(false);
    message.x = new UInt32(15000);
    message.checksum = new UInt32(40100);
    expect(message.isValid().toBoolean()).toBe(false);
  });

  it('Agent YLocation >= 5000 && <= 20000', () => {
    let message = Message.from({
      number: 1,
      id: 100,
      x: 1000,
      y: 4000,
      checksum: 5100,
    });
    expect(message.isValid().toBoolean()).toBe(false);
    message.y = new UInt32(5000);
    message.checksum = new UInt32(6100);
    expect(message.isValid().toBoolean()).toBe(true);
  });

  it('YLocation !> XLocation', () => {
    const message = Message.from({
      number: 1,
      id: 100,
      x: 6000,
      y: 5500,
      checksum: 11600,
    });
    expect(message.isValid().toBoolean()).toBe(false);
  });

  it('Agent with id 0, skip valid check', () => {
    const message = Message.from({
      number: 1,
      id: 0,
      x: 40000,
      y: 1000,
      checksum: 11600,
    });
    expect(message.isValid().toBoolean()).toBe(true);
  });
});
