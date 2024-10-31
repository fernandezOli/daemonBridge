# daemon Bridge developper documentation
Daemon for bridge developper documentation

## Config file
Configuration file: config/config.json

## Network
For adding a network, you need to define a new entry in "networks" entry in config file like that:

```json
{
	"networkName": "<name_of_network>", 
	"networkLongName": "<long_name_of_network>",
	"networkPrivateKey": "<private_key_name_of_account_for_sending_fund>",
	"symbol": "<token_or_coin_symbol>",
	"RPC_URL": "<RPC_URL_for_this_network>",
	"testnet": <true_or_false>
}
```

## Token
For adding a network, you need to define a new entry in "networks" entry in config file like that:


## Listening network

Listening on RPC_URL define in config file:
```json
"listeningNetwork": {
    "RPC_URL": "https://rpc2.sepolia.org"
```

## Listening tokens

Listening tokens on listening network are define in config file:
```json
"listeningNetwork": {
    "tokens": [
		"listeningAddress": "0x962aC815B...B5aeF39",
```
This account receive tokens.
This account MUST have native coin of listening network for fees on payback.

> **Warning**
>
> the listening address MUST BE unique

## Create account for listening token
Create a new account in your wallet (metamask, ...).
Send to this account some native coin of listening blockchain for fees on payback.
This account receive the tokens.
Add this address in config file:
```json
"listeningNetwork": {
    "tokens": [
		"listeningAddress": "<new_address>",
```
The creation of a new user is only necessary when adding a new token.

## Pay
Pay with private key define in config file:
```json
"networkPrivateKey": "<private_key_name_of_account_for_sending_fund>"
```
This private key MUST BE define in .env file:
```
<private_key_name>="<private_key>"
```

example:
```
[in config file]
"networkPrivateKey": "MyAccount"

[in .env file]
MyAccount="123456789....123456789"
```
This account MUST have token for payment and native coin for fees.

## Payback
Pay with private key of listeningAddress define in config file:

```json
"listeningNetwork": {
    "tokens": [
        "listeningAddress": "0x962aC815B...B5aeF39",
```
This account MUST have native coin of listening network for fees.


## License

MIT license


## Support

You can contact us via [discord](https://discord.com/channels/753223385948880961/1224720192488210584)
