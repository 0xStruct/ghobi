import { SmartContract, state, UInt32, State, method, Provable } from 'o1js';
import { MessageProveProof } from './MessageProve';

export class MessageProveValidator extends SmartContract {
  @state(UInt32) max = State<UInt32>();

  init() {
    super.init();
    // set max to zero at init
    this.max.set(UInt32.zero);
  }

  @method step(batchProof: MessageProveProof) {
    const contractMax = this.max.getAndRequireEquals();
    batchProof.verify(); // verify, of course
    const batchProofMax = batchProof.publicOutput;

    // check which is greater (contractMax or proofMax), then set it
    this.max.set(
      Provable.if(batchProofMax.greaterThan(contractMax), batchProofMax, contractMax)
    );
  }
}
