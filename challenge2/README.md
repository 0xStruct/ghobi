# Mina zkApp: Challenge2

`Message.ts` is a `Struct` with `isValid` method for checking validity of messages

`MessageProve.ts` is a `ZkProgram` for process messages in batch and generating proof which has public out of `UInt32` which denotes the max number among all valid messages in the batch

`MessageProveValidator.ts` is `SmartContract` which check the proof and update `@state(UInt32) max`

## How to build

```sh
npm run build
```

## How to run tests

```sh
npm run test
npm run testw # watch mode
```

## How to run coverage

```sh
npm run coverage
```

## License

[Apache-2.0](LICENSE)
