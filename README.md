# Daemon Bridge
Daemon for bridge

Convert any coins or tokens to any coins or tokens in another blockchain without any interface or smart-contract.

## Why

Usable directly from a wallet.
Can be use by UI and smart-contract.


## Security

- **No** interface.
- **No** smart-contract.
- **No** request on the daemon.
- **No** direct access to the daemon (except for the admin and proxy).

**Everything goes through the blockchain.**

high security with proxy.

little code (less than 1000 lines)

## Dev

Quick and easy add-on in an interface, any dev can add a bridge to its UI quickly and easily.

Works on all EVM channels.

Traceability of the requests by inserting the 'transaction hash' of the request in the return requests (payment or refund).

## Install

```shell
npm i
```

## Configuration

[See doc_dev]

## Run

```shell
npm start
```

## networks and tokens

Listening on **sepolia**

|   Token   |   Listener Address |   To Network |   To Token |
|---    |---    |:-:    |:-:    |
|   LINK        |   0x962aC815B1249027Cfd80D6b0476C9090B5aeF39   |   Optimism Sepolia (Testnet)   |   LINK   |
|   LINK        |   0x71f7aaB7f69a4Cc5509903C2585FC84ecaba5485  |   Arbitrum Sepolia (testnet)   |   LINK |
|   LINK        |   0xF3842962562138C466649B19dEfc3C305af6BA64  |   Base Sepolia (testnet)   |   LINK |


## Technologies use

	- etherjs (5.7.2)
    - http (0.0.1-security)


## Changelog

### v1.0

    Initial version


## License

MIT license


## Support

You can contact us via [discord](https://discord.com/channels/753223385948880961/1224720192488210584)
