import { Bool, Struct, UInt32 } from 'o1js';

export type MessageType = {
  number: number;
  id: number;
  x: number;
  y: number;
  checksum: number;
};

export class Message extends Struct({
  number: UInt32,
  id: UInt32,
  x: UInt32,
  y: UInt32,
  checksum: UInt32,
}) {
  static from(message: MessageType) {
    return new Message({
      number: new UInt32(message.number),
      id: new UInt32(message.id),
      x: new UInt32(message.x),
      y: new UInt32(message.y),
      checksum: new UInt32(message.checksum),
    });
  }

  isValid(): Bool {
    return this.id.equals(UInt32.zero).or(
      // Agent ID >= 0 && <= 3000
      this.id
        .lessThanOrEqual(new UInt32(3000))
        // Agent XLocation >= 0 && <= 15000
        .and(this.x.lessThanOrEqual(new UInt32(15000)))
        // Agent YLocation >= 5000 && <= 20000
        .and(this.y.greaterThanOrEqual(new UInt32(5000)))
        .and(this.y.lessThanOrEqual(new UInt32(20000)))
        // Agent YLocation > Agent XLocation
        .and(this.y.greaterThan(this.x))
        // Checksum id + x + y
        .and(this.checksum.equals(this.id.add(this.x).add(this.y)))
    );
  }
}
