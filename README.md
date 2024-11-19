# Daemon Bridge

Convert coins or tokens from one EVM blockchain to coins or tokens from another EVM blockchain without any interface or smart-contract.
Usable directly from a wallet.
Can be use by UI and smart-contract.

## Security

- **No** interface.
- **No** smart-contract.
- **No** oracle.
- **No** request on the daemon.
- **No** direct access to the daemon (except for admin and proxy).

**Everything goes through the blockchain.**

high security with proxy.

low code (less than 1000 lines)

## Install

```shell
npm i
```

## Configuration

[See doc_dev]

## Run

Run only one server (port: 3000)
```shell
npm start
```

Launch 4 servers (ports: 3000 to 3003) demo only
```shell
npm run daemon1
npm run daemon2
npm run daemon3
npm run daemon4
```

## networks and tokens

Listening on **sepolia**

|   Token   |   Listener Address |   To Network |   To Token |
|---    |---    |:-:    |:-:    |
|   LINK        |   0x962aC815B1249027Cfd80D6b0476C9090B5aeF39   |   Optimism Sepolia (Testnet)   |   LINK   |
|   LINK        |   0x71f7aaB7f69a4Cc5509903C2585FC84ecaba5485  |   Arbitrum Sepolia (testnet)   |   LINK |
|   LINK        |   0xF3842962562138C466649B19dEfc3C305af6BA64  |   Base Sepolia (testnet)   |   LINK |


## Diagrams

working principle
![principle](./images/principe.png)

Demonstration mode
![demo](./images/demo_config.png)

Production mode
![production](./images/prod_config.png)

## Technologies use

	- etherjs (5.7.2)
    - http (0.0.1-security)

## Dev

Quick and easy add-on in an interface, any dev can add a bridge to its UI quickly and easily.

Works on all EVM channels.

Traceability of the requests by inserting the 'transaction hash' of the request in the return requests (payment or refund).

## Changelog

### v1.0

    Initial version

## License

MIT license

## Support

You can contact us via [discord](https://discord.com/channels/753223385948880961/1224720192488210584)
