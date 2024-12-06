# Daemon Bridge developper documentation
Daemon for bridge developper documentation

## Installation
In base folder do:
```bash
npm i
```
For testing, in base folder do:
```bash
cd hardhat-test
npm i
```

## Configuration

### Environment File
Create environment file: .env
```env
# if admin want mail on error
SEND_MAIL_TO_ADMIN=true
SMTP_ADDRESS="<your_smtp_server>" (ex: smtp.myserver.com)
SMTP_PORT=<your_smtp_server_port> (normally 25)
SECURE=false (false with port 25)
FROM_ADDRESS="<your_mail_from_address>" (ex: daemonbridge@daemon.com)
ADMIN_ADDRESS="<your_mail_address>"

# URL API KEYS
ETHERSCAN_API_KEY="<your_etherscan_api_key>"
INFURA_API_KEY="<your_infura_api_key>"

# Natif token payer account
Sepolia_PRIVATE_KEY="0x<your_sepolia_private_key>"

# Tokens payer account
OPSepolia_PRIVATE_KEY="<your_OPSepolia_private_key>"
ARSepolia_PRIVATE_KEY="<your_ARSepolia_private_key>"
BASepolia_PRIVATE_KEY="<your_BASepolia_private_key>"

# Refund payer for tokens (normally the auditor, because he takes the funds)
OPSepolia_LINK_REFUND="<your_OPSepolia_private_key>"
ARSepolia_LINK_REFUND="<your_ARSepolia_private_key>"
BASepolia_LINK_REFUND="<your_BASepolia_private_key>"
```

### Configuration File
Create configuration file: config/config.json
(view doc for configuration for more info)

## Run
Warning: the configuration file MUST exist.

### Single Server Mode
```bash
npm start
```
Launches server on port 3000 with default configuration (./config/config.js)

#### Change port
You can personalize the port with the option '-p' in package.json:
replace
```
"start": "node daemonBridge.js"
```
with
```
"start": "node daemonBridge.js -p:4000"
```
The daemon start the http server on port 4000.

#### Configuration file
You can personalize the configuration file with the option '-c' in package.json:
```
"start": "node daemonBridge.js -c:./config/sepolia.json"
```
The daemon start with the configuration file: ./config/sepolia.json.
Warning: if the configuration file ./config/sepolia.json not exist, the daemon load the default configuration file.

####  Port and configuration file
You can personalize both:
```
"start": "node daemonBridge.js -p:4000 -c:./config/sepolia.json"
```

### Demo Mode (4 daemons on one server)
```bash
npm run daemon1
npm run daemon2
npm run daemon3
npm run daemon4
```

### Multi daemon
define in 'scripts' in package.json (after start):

```
"sepolia": "node daemonBridge.js -p:3000 -c:./config/sepolia.json",
```
and run it with:
```bash
npm run sepolia
```

### Testing
Create environment file: .env in hardhat-test folder (view doc for configuration for more info)

```bash
cd hardhat-test
npx hardhat test
```
