# Daemon Bridge developper documentation
Daemon for bridge developper documentation for configuration

## Config file
Configuration file: config/config.json

## Listening network
entry: listeningNetwork
"activeNativeToken": <true_or_false>,
"networkName": "<network_name>",
"networkLongName": "<long_network_name>",
"symbol": "<coin_symbol>",
"testnet": <true_or_false>,
"chainId": <chainId>,


## Network
For adding a network, you need to define a new entry in "networks" entry in config file.

```json
{
    "activated": <true_or_false>, // normaly true
	"networkName": "<network_name>",
	"networkLongName": "<long_network_name>",
	"symbol": "<token_or_coin_symbol>",
	"chainId": <chainId>, // ex: 11155420 for Optimism Sepolia
	"testnet": <true_or_false>,
    "decimals": <token decimals>, // integer normaly 18
	"RPC_URLs": [ // list of RPC_URL (see below)
		{
			"rpcurl": "https://sepolia.optimism.io",
			"type": "",
			"apikey": ""
		}
	]
}
```

### Network datas
"activated": activate or desactivate network (true/false)
"networkName": the network name (ex: Sepolia)
"networkLongName": network long name (ex: Ethereum Sepolia Testnet)
"symbol": token symbol (ex: ETH)
"chainId": chain Id of the network (ex: 11155420 for Optimism Sepolia)
"testnet": true for testnet false for mainnet,
"decimals": token decimals (integer normaly 18)

### Network RPC_URL
default form:
```json
{
	"rpcurl": "<rpc_url>",
	"type": "<provider_type>",
	"apikey": "<api_key>"
}
```
rpcurl: the rpc_url for the network
type: can be: empty (default), STATIC, ETHERSCAN or INFURA
apikey: api key string define in .env

Select provider with 'type':
Using **JsonRpcProvider** (default)
```json
{
	"rpcurl": "https://sepolia.optimism.io",
	"type": "",
	"apikey": ""
}
```

Using **StaticJsonRpcProvider** with **STATIC**
```json
{
	"rpcurl": "https://sepolia.optimism.io",
	"type": "STATIC",
	"apikey": ""
}
```
In default and static, if you add a key api it will be added to the url.
```json
{
	"rpcurl": "https://sepolia.optimism.io/",
	"type": "",
	"apikey": "MY_API_KEY"
}
```
url: https://sepolia.optimism.io/{process.env["MY_API_KEY"]}

Using **EtherscanProvider** with **ETHERSCAN**
```json
{
	"rpcurl": "https://api-sepolia.etherscan.io/api/",
	"type": "ETHERSCAN",
	"apikey": "ETHERSCAN_API_KEY"
}
```

Using **InfuraProvider** with **INFURA**
```json
{
	"rpcurl": "https://sepolia.infura.io/v3/",
	"type": "INFURA",
	"apikey": "INFURA_API_KEY"
}
```

Specials types: ETHERSCAN and INFURA
You can define an ETHERSCAN or INFURA provider in 3 ways:
Using **EtherscanProvider**
```json
{
	"rpcurl": "https://api-sepolia.etherscan.io/api/",
	"type": "ETHERSCAN",
	"apikey": "ETHERSCAN_API_KEY"
}
```
Using **JsonRpcProvider**
```json
{
	"rpcurl": "https://api-sepolia.etherscan.io/api/",
	"type": "",
	"apikey": "ETHERSCAN_API_KEY"
}
```
Using **StaticJsonRpcProvider** with **STATIC**
```json
{
	"rpcurl": "https://api-sepolia.etherscan.io/api/",
	"type": "STATIC",
	"apikey": "ETHERSCAN_API_KEY"
}
```

The api key MUST BE define in .env
```
ETHERSCAN_API_KEY="your_etherscan_api_key"
```

## Token
For adding a swap or bridge, you need to define a new entry in "nativeTokens" or "tokens" entry in config file.
For define a native to native bridge:
```json
{
	"activated": true,
	"listeningAddress": "<listener_address>",
	"privateKey4refund": "<private_key_for_refund_define_in_dot_env>",
	"gasCostOnRefund": <true_or_false>,
	"minNoRefund": "<min_for_no_refund>", // 0.0001 (float/string)
	"min": "<min_amount>", // 0.0005 (float/string)
	"max": "<max_amount>", // 2.0 (float/string)
	"fixedFees": "<fixed_fees_amount>", // 0.0001 (float/string)
	"feesPcent": <fees_%>, //0.01 float
	"conversionRateBC1toBC2": <conversion_Rate>, //1.0
	"calcGasCostOnBC2": <true_or_false>,
	"toPrivateKey": "<private_key_for_payment_define_in_dot_env>",
	"toNetwork": "<destination_network_name>",
    "toNetworkChainId": <chainId>
}
```

For define a token to token bridge:
```json
{
	"activated": true,
	"listeningAddress": "<listener_address>",
	"privateKey4refund": "<private_key_for_refund_define_in_dot_env>",
	"tokenContractAddress": "<contract_token_address>",
	"tokenName": "<token_name>",
	"tokenDecimals": <token_decimals>,
	"gasCostOnRefund": <true_or_false>,
	"minNoRefund": "<min_for_no_refund>",
	"min": "<min_amount>",
	"max": "<max_amount>",
	"fixedFees": "<fixed_fees_amount>",
	"feesPcent": <fees_%>,
	"conversionRateBC1toBC2": <conversion_Rate>,
	"conversionRateBC1toTokenBC1": <conversion_Rate>,
	"toPrivateKey": "<private_key_for_payment_define_in_dot_env>",
	"toNetwork": "<destination_network_name>",
    "toNetworkChainId": <chainId>,
	"toTokenContractAddress": "<contract_token_address>",
	"toToken": "<token_name>",
	"toTokenDecimals": <token_decimals>,
	"calcGasCostOnBC2": <true_or_false>,
	"conversionRateTokenBC1toTokenBC2": <conversion_Rate>
}
```

## Unsupported tokens
The standard bridge does not support certain ERC-20 configurations:
Fee on Transfer
Upgradable Tokens
Tokens with Blocklists
Pausable Tokens

## unfully supported tokens
Low Decimals
High Decimals

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
"toPrivateKey": "<private_key_name_of_account_for_sending_fund>"
```
This private key MUST BE define in .env file:
```
<private_key_name_of_account_for_sending_fund>="<private_key>"
```

example:
```
[in config file]
"toPrivateKey": "MyAccount"

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
		"privateKey4payback": "MyAccount_LINK_PAYBACK",
```
This account MUST have native coin of listening network for fees.
The 'privateKey4payback' is the private key of the listening address.

## License

MIT license


## Support

You can contact us via [discord](https://discord.com/channels/753223385948880961/1224720192488210584)
