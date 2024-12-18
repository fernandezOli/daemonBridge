// Daemon.js
const { ethers, BigNumber } = require('ethers');
require("dotenv").config();
const deasync = require('deasync');
const nodemailer = require('nodemailer');
const fs = require("fs");

const transferABI = [
	"function balanceOf(address) view returns(uint)",
	"function transfer(address to, uint amount) returns(bool)",
    "function decimals() view returns (uint256)"
];

const defaultConfigFile = './config/config.json';
let initialConfig = null;
let networkList = null;

//let validProviderIndex = []; // valid Provider Index by network, listening = 0, destination = network index + 1
const Status = { NONE: "NONE", STARTING: "STARTING", WAITING: "WAITING", SLEEPING: "SLEEPING", RUNNING: "RUNNING", FAIL: "FAIL" };
let status = Status.NONE;

module.exports = class daemon {
	_listeningNetworkProvider = null;
	_networkProvider = [];
	_nativeListeners = [];
	_tokensList = null;
	_mailTransporter = null;

	constructor(configFile) {
		//console.log("-- loading daemon--");

		try {
			status = Status.STARTING;
            this.loadConfigFile(configFile);
            if (initialConfig === null || networkList === null) { status = Status.FAIL; throw 'Invalid configuration file, abort !'; }
            this.checkPrivateKeys();
			this.initProviders();
			this.startListening();
			this.initMailer();
			this.updateBalances();
			status = Status.RUNNING;
        } catch (error) {
			status = Status.FAIL;
			throw error;
		}
	}

	// load configuration file
	loadConfigFile(configFile) {
		//console.log("-- loadConfigFile --");
        try {
            if (configFile === undefined || configFile === null || configFile === "") {
                console.log("⚠️ loading default configuration");
                const _config = JSON.parse(fs.readFileSync(defaultConfigFile, "utf8"));
                initialConfig = _config;
                networkList = _config;
                return;
            }
        } catch (error) {
            console.log("❌ Error loading default configuration file, file is not valid JSON or file not exist !");
            console.error('Error loading configuration file:', error);
            throw error;
        }

        try {
            const _configJson = fs.readFileSync(configFile, "utf8");
            const _config = JSON.parse(_configJson);
            initialConfig = _config;
            networkList = _config;
        } catch(error) {
            console.log("❌ Error loading configuration file: "+ configFile + ", file is not valid JSON or file not exist !");
            // try to load default configuration
            return this.loadConfigFile("");
        }
	}

	// check private keys
	checkPrivateKeys() {
		//console.log("-- check Private Keys --");
		let _privateKey = null;
		let _token = null;
		let signer = null;

		// native private keys
		for (let i = 0; i < networkList.listeningNetwork.nativeTokens.length; i++) {
			_token = networkList.listeningNetwork.nativeTokens[i];
			if (_token.toPrivateKey === undefined || _token.toPrivateKey === null || _token.toPrivateKey === "") {
				throw 'Invalid (null) native private key for toPrivateKey in config';
			}
			_privateKey = _token.toPrivateKey;
			if (process.env[_privateKey] === undefined || process.env[_privateKey] === null || process.env[_privateKey] === "") {
				throw 'Undefined native private key for toPrivateKey in .env';
			}
			signer = new ethers.Wallet(process.env[_privateKey], this._listeningNetworkProvider);
			_token.toPublicKey = signer.address;

			if (_token.privateKey4refund === undefined || _token.privateKey4refund === null || _token.privateKey4refund === "") {
				throw 'Invalid native private key for privateKey4refund in config';
			}
			_privateKey = _token.privateKey4refund;
			if (process.env[_privateKey] === undefined || process.env[_privateKey] === null || process.env[_privateKey] === "") {
				throw 'Undefined native private key for privateKey4refund in .env';
			}
			signer = new ethers.Wallet(process.env[_privateKey], this._listeningNetworkProvider);
			_token.publicKey4refund = signer.address;
		}
		// tokens private keys
		for (let i = 0; i < networkList.listeningNetwork.tokens.length; i++) {
			_token = networkList.listeningNetwork.tokens[i];
			if (_token.toPrivateKey === undefined || _token.toPrivateKey === null || _token.toPrivateKey === "") {
				throw 'Invalid token private key for toPrivateKey in config';
			}
			_privateKey = _token.toPrivateKey;
			if (process.env[_privateKey] === undefined || process.env[_privateKey] === null || process.env[_privateKey] === "") {
				throw 'Undefined token private key for toPrivateKey .env';
			}
			signer = new ethers.Wallet(process.env[_privateKey], this._listeningNetworkProvider);
			_token.toPublicKey = signer.address;

			if (_token.privateKey4refund === undefined || _token.privateKey4refund === null || _token.privateKey4refund === "") {
				throw 'Invalid token private key for privateKey4refund in config';
			}
			_privateKey = _token.privateKey4refund;
			if (process.env[_privateKey] === undefined || process.env[_privateKey] === null || process.env[_privateKey] === "") {
				throw 'Undefined token private key for privateKey4refund .env';
			}
			signer = new ethers.Wallet(process.env[_privateKey], this._listeningNetworkProvider);
			_token.publicKey4refund = signer.address;
		}
	}

	// init providers for all networks
	initProviders() {
		//console.log("-- init Providers --");

		// Init listening Network
		try {
			let validProvider;
			(async () => validProvider = await this.getFirstValidProvider(networkList.listeningNetwork.RPC_URLs, 0).then().catch())();
			while (validProvider === undefined) { deasync.runLoopOnce(); } // Wait result from async_function
            if (validProvider === null) throw '❌ Invalid RPC_URL for listening network';
            this._listeningNetworkProvider = validProvider;
		} catch (error) {
			console.error('❌ ERROR initProviders for listening Network [' + error.code + ']: ', error);
			throw error;
		}

		// Init destination Networks
		try {
			this._networkProvider = [];
			for (let i = 0; i < networkList.networks.length; i++) {
				let validProvider;
				(async () => validProvider = await this.getFirstValidProvider(networkList.networks[i].RPC_URLs, i + 1).then().catch())();
				while (validProvider === undefined) { deasync.runLoopOnce(); } // Wait result from async_function
				if (validProvider === null) throw '❌ Invalid RPC_URL for network: ' + networkList.networks[i].networkName;
				this._networkProvider[i] = validProvider;
			}
		} catch (error) {
			console.error('❌ ERROR initProviders [' + error.code + ']: ', error);
			throw error;
		}
	}

	// get the first valid provider for a network
    // networkUrlList: rpc_url list
	// networkIndex: listening = 0, destination = network index + 1 // valid Provider Index by network
	// return: valid provider or null on error
	async getFirstValidProvider(networkUrlList, networkIndex) {
		//console.log("-- getFirstValidProvider --");

		let providerUrl = null;
		for (let i = 0; i < networkUrlList.length; i++) {
			try {
                providerUrl = null;
				let url = networkUrlList[i].rpcurl;
				//console.log("Check provider: ", url);

				if(networkUrlList[i].type !== "") {
					if(networkUrlList[i].type === "ETHERSCAN") {
						if (networkIndex === 0) providerUrl = new ethers.providers.EtherscanProvider(networkList.listeningNetwork.networkName, process.env[networkUrlList[i].apikey]);
                        else providerUrl = new ethers.providers.EtherscanProvider(networkList.networks[networkIndex - 1].networkName, process.env[networkUrlList[i].apikey]);
                    }
                    if(networkUrlList[i].type === "INFURA") {
						if (networkIndex === 0) providerUrl = new ethers.providers.InfuraProvider(networkList.listeningNetwork.networkName, process.env[networkUrlList[i].apikey]);
						else providerUrl = new ethers.providers.InfuraProvider(networkList.networks[networkIndex - 1].networkName, process.env[networkUrlList[i].apikey]);
                    }
                    if(networkUrlList[i].type === "APIKEY") {
                        providerUrl = new ethers.providers.JsonRpcProvider({ url: url + process.env[networkUrlList[i].apikey], timeout: 10000 }); //StaticJsonRpcProvider ???
                    }
				}
				else providerUrl = new ethers.providers.JsonRpcProvider({ url: url, timeout: 10000 }); //StaticJsonRpcProvider ???

                if (providerUrl === null || providerUrl === undefined) continue;

                // Check chainId
                try {
                    const chainId = parseInt(await providerUrl.send("eth_chainId", []),16);
                    if (networkIndex === 0) {
                        if (chainId !== networkList.listeningNetwork.chainId) {
                            console.error("⚠️ Warning invalid provider chainId for listening network");
                            providerUrl = null;
                            continue;
                        }
                    }
                    else if (chainId !== networkList.networks[networkIndex - 1].chainId) {
                            console.error("⚠️ Warning invalid provider chainId for " + networkList.networks[networkIndex - 1].networkName + " chainId found:" + networkData.chainId + ", config:" + networkList.networks[networkIndex - 1].chainId);
                            providerUrl = null;
                            continue;
                        }
                } catch (error) {
                    providerUrl = null;
                    if (error.code === "NETWORK_ERROR" || error.code === "TIMEOUT") {
                        continue;
                    }
                    if (error.code === "SERVER_ERROR") {
                        if (error.body !== undefined && error.body !== null) {
                            let errBody = JSON.parse(error.body);
                            console.error("⚠️ Error getFirstValidProvider (" + url + "): ", errBody.error.message);
                        }
                        else console.error("⚠️ Error getFirstValidProvider (" + url + "): ", error);
                        continue;
                    }
                    //console.error("❌ Error getFirstValidProvider (code): ", error.code);
                    if (networkIndex === 0) console.error("❌ Error getFirstValidProvider on: listening Network");
                    else console.error("❌ Error getFirstValidProvider on: ", networkList.networks[networkIndex - 1].networkName);
                    console.error("❌ Error getFirstValidProvider (eth_chainId): ", error);
                    continue;
                }

                // TODO: check filter ?
				//console.log("Valid provider found: ", providerUrl);
				return providerUrl;
			} catch (error) {
				console.error("❌ Error getFirstValidProvider: ", error);
				continue;
			}
		}
		console.error("❌ Error getFirstValidProvider, no valid provider found !");
		return null;
	}

	// Start listening on network for native token and tokens
	startListening() {
		//console.log("-- start Listening --");
		let tokenIndex = null;
		let nativeCounter = 0;
		let tokenCounter = 0;

		if (this._listeningNetworkProvider === null) {
			throw 'Error start listening, no provider !';
		}
		this._listeningNetworkProvider.removeAllListeners();
		// Native tokens
		try {
			if (networkList.listeningNetwork.activeNativeToken) {
				// check if 1 or more listening
				const nativeTokensList = networkList.listeningNetwork.nativeTokens;
				for (let nativeTokenIndex = 0; nativeTokenIndex < nativeTokensList.length; nativeTokenIndex++) {
					if (nativeTokensList[nativeTokenIndex].activated !== true) continue;
					const nativeToken = nativeTokensList[nativeTokenIndex];
					nativeCounter++;
					//nativeToken.toNetworkIndex = this.findNetworkByName(nativeToken.toNetwork);
                    nativeToken.toNetworkIndex = this.findNetworkByChainId(nativeToken.toNetworkChainId);
					this._nativeListeners[nativeTokensList[nativeTokenIndex].listeningAddress] = nativeTokenIndex;
					console.log("Start listening for " + networkList.listeningNetwork.symbol + " on " + nativeToken.listeningAddress + " to " + nativeToken.toNetwork +"/" + networkList.networks[nativeToken.toNetworkIndex].symbol);
				}
				if (nativeCounter !== 0) {
					// Scan all blocks
					this._listeningNetworkProvider.on("block", (blockNumber) => { this.parseBlock(blockNumber) });
				}
				else console.log("- No listening for native token -");
			}
			else console.log("- No listening for native token -");
			this._listeningNetworkProvider.on("error", (error) => { this.listeningProviderError(error)} );
		} catch (error) {
			console.error('error start listening for native token');
			throw error;
		}

		// tokens
		try {
			this._tokensList = networkList.listeningNetwork.tokens;
			for (tokenIndex = 0; tokenIndex < this._tokensList.length; tokenIndex++) {
                const _token = this._tokensList[tokenIndex];
				if (initialConfig.listeningNetwork.tokens[tokenIndex].activated !== true) {
					_token.activated = false;
					continue;
				}
                // check validity
				if (_token.listeningAddress === undefined ||
					_token.listeningAddress === null ||
					_token.listeningAddress === "0x") {
					_token.activated = false;
					continue;
				}
				_token.activated = true;
				//_token.toNetworkIndex = this.findNetworkByName(_token.toNetwork);
                _token.toNetworkIndex = this.findNetworkByChainId(_token.toNetworkChainId);

				const filter = {
					address: _token.tokenContractAddress,
					topics: [null, null, ethers.utils.hexZeroPad(_token.listeningAddress, 32)]
				};

				const _index = tokenIndex;
				this._listeningNetworkProvider.on(filter, (log) => { this.parseEvent(log, _index); });
				tokenCounter++;
				console.log("Start listening for token " + _token.tokenName + " on " + _token.listeningAddress + " to " + _token.toNetwork + "/" + _token.toToken);
			}
			if(tokenCounter === 0) console.log("- No listening for tokens -");
		} catch (error) {
			if (tokenIndex !== null && this._tokensList !== null) console.error("ERROR start listening for token " + this._tokensList[tokenIndex].tokenName);
			console.error('error start listening for token [' + error.code + ']: ', error);
			throw error;
		}
		if((tokenCounter + nativeCounter) === 0) {
			console.log("- No listener (abort) -");
			throw "No listener (abort)";
		}
	}

	// update balances in json
	async updateBalances() {
		//console.log("--- updateBalances ---");
		let _provider = null;

		try {
			// TODO native tokens

            // Tokens
			for (let tokenIndex = 0; tokenIndex < this._tokensList.length; tokenIndex++) {
				const _token = this._tokensList[tokenIndex];
				if (_token.activated !== true) continue;
				if (_token.listeningAddress === undefined || _token === null || _token === "") {
					continue; // not a valid address
				}

				// Refund
				_provider = this._listeningNetworkProvider;
				let signer = new ethers.Wallet(process.env[_token.privateKey4refund], _provider);
				let nativeBalance = await _provider.getBalance(signer.address); // native balance for refund
				_token.listeningBalance = ethers.utils.formatEther(nativeBalance);

                // Get token decimals
                try {
                    if (_token.tokenDecimals === undefined) {
                        const contract = new ethers.Contract(_token.tokenContractAddress, transferABI, signer);
                        const decimals = await contract.decimals();
                        _token.tokenDecimals = decimals.toNumber();
                    }
                } catch(error) {
			        console.error('Error get decimals for token, set to default (18)');
                    _token.tokenDecimals = 18;
			        console.error('Error get decimals: ', error);
		        }

				// payment
				_provider = this._networkProvider[_token.toNetworkIndex];
				signer = new ethers.Wallet(process.env[_token.toPrivateKey], _provider);
				nativeBalance = await _provider.getBalance(signer.address); // native balance for payement
				_token.toNativeBalance = ethers.utils.formatEther(nativeBalance);

				const contract = new ethers.Contract(_token.toTokenContractAddress, transferABI, signer);
				const tokenBalance = await contract.balanceOf(signer.address); // token balance for payement
				_token.toTokenBalance = ethers.utils.formatEther(tokenBalance);
                // Get decimals and convert token balance to wei with decimals
                try {
                    if (_token.toTokenDecimals === undefined) {
                        const decimals = await contract.decimals();
                        _token.toTokenDecimals = decimals.toNumber();
                    }
                    if (_token.toTokenDecimals !== 18) // convert to wei
                        _token.toTokenBalance = ethers.utils.formatUnits(tokenBalance, _token.toTokenDecimals); // number
                } catch(error) {
			        console.error('Error get decimals for to token, set to default (18)');
                    _token.toTokenDecimals = 18;
			        console.error('Error get decimals: ', error);
		        }
            }
		} catch(error) {
			console.error('Error updateBalances: ', error);
		}
	}

	// get error from listening provider
	async listeningProviderError(error) {
		//console.log("--- listeningProviderError ---");
		status = Status.FAIL;
		if (error.code === "SERVER_ERROR") {
			console.error('Error listening Provider: SERVER_ERROR, restart listening !');
			// restart listening (TODO and rpcurl ?)
			if (this.restartListening()) status = Status.RUNNING;
			return;
		}
		console.error('Error listening Provider: ', error);
	}

	// restart listening provider
	async restartListening() {
		//console.log("--- restartListening ---");
		try {
			this.startListening();
			return true;
		} catch(error) {
			console.error('Error restarting listening: ', error);
			return false;
		}
	}

	//**********************
	//**** Native Token ****
	//**********************

	// Parse Block for native token exchange
	// blockNumber: block number in blockchain
	async parseBlock(blockNumber) {
		//console.log("-- parseBlock --");
		//console.log("parseBlock[blockNumber]: ", blockNumber);

		let nativeListenerIndex = null;
		let result = null;
        let resultTx = null;

		try {
			result = await this._listeningNetworkProvider.getBlockWithTransactions(blockNumber);

			for (let i = 0; i < result.transactions.length; i++) {
				resultTx = result.transactions[i];
				if (resultTx.from === undefined || resultTx.from === null) continue;
				if (resultTx.to === undefined || resultTx.to === null) continue;
				if (parseInt(resultTx.value._hex, 16) === 0) continue; // value = 0

				// check if listeningAddress [to] is known
				if (this._nativeListeners[resultTx.to] === undefined) continue;

				nativeListenerIndex = this._nativeListeners[resultTx.to];
				this.execTransaction(nativeListenerIndex, resultTx.from, resultTx.value, resultTx.hash);
                nativeListenerIndex = null;
			}
		} catch (error) {
			console.error('Error parseBlock [' + error.code + ']: ', error);
			if ((resultTx !== null && nativeListenerIndex !== null))
				this.refundNativeToken(nativeListenerIndex, resultTx.from, resultTx.value, resultTx.hash);
			return;
		}
	}

	// Execute native token transaction
	// nativeListenerIndex: native token index
	// from: address sender
	// amount: amount to send
	// initialAmount: amount to send on refund
	// txHash: sender transaction Hash
	async execTransaction(nativeListenerIndex, from, initialAmount, txHash) {
		console.log("-- execTransaction --");
		//console.log("nativeListenerIndex: ", nativeListenerIndex);
		//console.log("from: ", from);
		//console.log("initialAmount: ", initialAmount);
		//console.log("txHash: ", txHash);

        const _nativeToken = networkList.listeningNetwork.nativeTokens[nativeListenerIndex];
		//const networkNum = this.findNetworkByName(_nativeToken.toNetwork);
        const networkNum = this.findNetworkByChainId(_nativeToken.toNetworkChainId);

		try {
            // Check min
            if (ethers.utils.parseEther(_nativeToken.min).gt(initialAmount)) {
				if (ethers.utils.parseEther(_nativeToken.minNoRefund).gte(initialAmount)) {
					console.log("[execTransaction]Invalid amount, less than No Refund amount");
					return;
				}
                console.log("[execTransaction]Invalid amount, less than minimum amount");
				this.refundNativeToken(nativeListenerIndex, from, initialAmount, txHash);
				return;
            }

			// calc amount
            let amount = initialAmount;
			amount = amount.sub(await this.calcFees(_nativeToken, initialAmount));

            if (_nativeToken.calcGasCostOnBC2 && _nativeToken.conversionRateBC1toBC2 !== undefined && _nativeToken.conversionRateBC1toBC2 !== null && _nativeToken.conversionRateBC1toBC2 !== 0) {
                let destinationTxFee = await this.calcGasCost(_provider, false);
                // conversion BC2 (dest) to BC1 (src)
                destinationTxFee = BigNumber.from((parseFloat(destinationTxFee.toBigInt()) * (1 / _nativeToken.conversionRateBC1toBC2)).toString());
                amount = amount.sub(destinationTxFee);
            }

            // Convert to native in BC2
            let convertAmount = BigNumber.from((parseFloat(amount.toBigInt()) * _nativeToken.conversionRateBC1toBC2).toString());

			// verify data integrity
			const [check, checkMessage] = await this.checkNativeData(networkNum, nativeListenerIndex, amount);
			if (check === false) {
				console.log("Error DataCheck Message: ", checkMessage);
				if (ethers.utils.parseEther(_nativeToken.minNoRefund).gt(initialAmount)) {
					console.log("[NoRefund]Invalid amount, less than No Refund amount");
					return;
				}
				this.refundNativeToken(nativeListenerIndex, from, initialAmount, txHash);
				return;
			}

			this.sendNativeToken(networkNum, nativeListenerIndex, from, convertAmount, initialAmount, txHash)
		} catch (error) {
			console.error('Error execTransaction [' + error.code + ']: ', error);
			this.refundNativeToken(nativeListenerIndex, from, initialAmount, txHash);
		}
	}

	// Send token in BC2 to the sender
	// networkNum: index of the destination network in network list
	// nativeTokenIndex: native token index
	// from: address sender
	// amount: amount to send
	// initialAmount: amount to send on refund
	// txHash: sender transaction Hash
	async sendNativeToken(networkNum, nativeTokenIndex, from, amount, initialAmount, txHash) {
		//console.log("-- sendNativeToken --");
		//console.log("networkNum: ", networkNum);
		//console.log("nativeTokenIndex: ", nativeTokenIndex);
		//console.log("from: ", from);
		//console.log("amount: ", amount);
		//console.log("txHash: ", txHash);

		const nativeTokensList = networkList.listeningNetwork.nativeTokens;
		const _provider = this._networkProvider[networkNum];

		try {
			const signer = new ethers.Wallet(process.env[nativeTokensList[nativeTokenIndex].toPrivateKey], _provider);

			const tx = await signer.sendTransaction({ to: from, value: amount });
			await _provider.waitForTransaction(tx.hash, 1);

			console.log("[sendNativeToken]Transfert success tx: ", tx.hash);
			this.updateBalances();
		} catch (error) {
			console.error('Error sendNativeToken [' + error.code + ']: ', error);
			this.refundNativeToken(nativeTokenIndex, from, initialAmount, txHash);
			//this.sendMessageToAdmin('sendNativeToken', error, indexToken, from, amount);
		}
	}

	// refund function for native token
	// nativeTokenIndex: native token index
	// from: address sender
	// amount: amount to send
	// txHash: sender transaction Hash
	async refundNativeToken(nativeTokenIndex, from, amount, txHash) {
		console.log("-- refundNativeToken --");
		//console.log("nativeTokenIndex: ", nativeTokenIndex);
		//console.log("from: ", from);
		//console.log("amount: ", amount);
		//console.log("txHash: ", txHash);

		const _provider = this._listeningNetworkProvider;
        const nativeToken = networkList.listeningNetwork.nativeTokens[nativeTokenIndex];

        try {
			const signer = new ethers.Wallet(process.env[nativeToken.privateKey4refund], _provider);
            // TODO check to see if we deduct the gas or not
			// Check balance
			const nativeBalance = await _provider.getBalance(signer.address); // native token balance
			if (nativeBalance.lte(amount)) { // TODO get gas cost
				console.error('[refundNativeToken]Insufficient funds for intrinsic transaction cost');
				return;
			}

			const tx = await signer.sendTransaction({ to: from, value: amount });
			await _provider.waitForTransaction(tx.hash, 1);

			console.log("[refundNativeToken]Transfert success tx: ", tx.hash);
			this.updateBalances();
		} catch (error) {
			this.sendMessageToAdmin('refundNativeToken', error, nativeTokenIndex, from, amount);
			console.error('Error refundNativeToken [' + error.code + ']: ', error);
		}
	}

	// Check balance, min, max
	// networkNum: index of the destination network in network list
	// nativeTokenIndex: native token index
	// amount: amount to be send in wei (BigNumber)
	// return: true and empty message or false and error message on error
	async checkNativeData(networkNum, nativeTokenIndex, amount) {
		//console.log("-- checkNativeData --");
		//console.log("amount: ", amount);
		//console.log("amount typeof: ", typeof amount);

        try {
            const _provider = this._networkProvider[networkNum];
            const _token = networkList.listeningNetwork.nativeTokens[nativeTokenIndex];
            const signer = new ethers.Wallet(process.env[_token.toPrivateKey], _provider);
            const nativeBalance = await _provider.getBalance(signer.address); // native token balance

            // Check balance
            if (amount.gt(nativeBalance)) {
                return [false, "Insufficient funds for transaction"];
            }

            // Check min, max
            if (ethers.utils.parseEther(_token.min).gte(amount)) {
                return [false, "Invalid amount, less than minimum amount"];
            }
            if (ethers.utils.parseEther(_token.max).lt(amount)) {
                return [false, "Invalid amount, greater than maximum amount"];
            }
            return [true, ""];
        } catch (error) {
            console.error('Error checkNativeData [' + error.code + ']: ', error);
            return [false, "Unknown error"];
        }
    }

	// calc fees for amount to be sent, amount = amount - (service_fees + destination_fees)
	// token: token in tokens list
	// amount: amount (BigNumber)
	// return: fees for this amount (BigNumber)
	async calcFees(token, amount) {
		//console.log("-- calcFees --");
		//console.log("token: ", token);
		//console.log("[calcFees]amount: ", ethers.utils.formatEther(amount));

        try {
            let relayerFee = ethers.utils.parseEther(token.fixedFees);
            let relayerPcent = amount * token.feesPcent;
            let pcent = BigNumber.from(relayerPcent.toString());
            relayerFee = relayerFee.add(pcent);
            //console.log("[calcFees]total relayerFee: ", ethers.utils.formatEther(relayerFee));
            return relayerFee;
        } catch (error) {
            console.error('Error calcFees [' + error.code + ']: ', error);
            return BigNumber.from(0);
        }
    }


	//****************
	//**** Tokens ****
	//****************

	// Parse log for tokens
	// struct log: transaction log
	// indexToken: token index
	async parseEvent(log, indexToken) {
		console.log("-- parseEvent --");
		//console.log("[parseEvent]indexToken: ", indexToken);
		//console.log("[parseEvent]log:", log);

		let logTx = log.transactionHash;
        let _networkNum = this._tokensList[indexToken].toNetworkIndex;
		let _from = null;
		let initialAmount = BigNumber.from(0);

		try {
			initialAmount = BigNumber.from(log.data);
            if (initialAmount === undefined || initialAmount === null || initialAmount.isZero()) {
                console.error('Error parseEvent, invalid amount:', ethers.utils.formatEther(initialAmount));
                console.error('Error parseEvent, parse log tx:', logTx);
                return;
            }
            //console.log("[parseEvent]log.data: ", log.data);

            // get from and convert address length 32 to address length 20
			_from = BigInt(log.topics[1]).toString(16);
			if (_from === undefined || _from === null) {
                console.error('Error parseEvent, invalid _from:',log.topics[1]);
                console.error('Error parseEvent, invalid _from tx:',logTx);
                // TODO sendMessage()
                return;
            }
			if (_from.length % 2 === 0) _from = ethers.utils.hexZeroPad("0x" + _from, 20);
			else _from = ethers.utils.hexZeroPad("0x0" + _from, 20);
        } catch (error) {
			console.error('Error parseEvent, parse log tx:',logTx);
			console.error('Error parseEvent, parse log error on from [' + error.code + ']:', error);
            if (_from !== undefined && _from !== null && !initialAmount.isZero()) {
			    this.refundToken(indexToken, _from, initialAmount, logTx);
            }
            // error _from ????
			return;
		}

        this.execLogTransaction(_networkNum, indexToken, _from, initialAmount, logTx);
	}

	// Exec transaction for tokens
	// networkNum: network index in network list
	// indexToken: token index
	// from: address sender
	// initialAmount: amount send by the sender
	// logTx: sender transaction Hash
	async execLogTransaction(_networkNum, indexToken, _from, initialAmount, logTx) {
		//console.log("-- execLogTransaction --");
		//console.log("[execLogTransaction]indexToken: ", indexToken);
		//console.log("[execLogTransaction]log:", log);
        //console.log("[execLogTransaction]initialAmount: ", initialAmount);
        //console.log("[execLogTransaction]initialAmount (ethers): ", ethers.utils.formatEther(initialAmount));

        const _token = this._tokensList[indexToken];
        const _provider = this._networkProvider[_networkNum];

		try {
            // Convert initialAmount to wei with decimals
            if (_token.tokenDecimals !== 18)
                initialAmount = ethers.utils.parseEther(ethers.utils.formatUnits(initialAmount, _token.tokenDecimals));

            // Check min
            if (ethers.utils.parseEther(_token.min).gt(initialAmount)) {
				if (ethers.utils.parseEther(_token.minNoRefund).gte(initialAmount)) {
					console.log("[execLogTransaction]Invalid amount, less than No Refund amount");
					return;
				}
                console.log("[execLogTransaction]Invalid amount, less than minimum amount");
				this.refundToken(indexToken, _from, initialAmount, logTx);
				return;
            }

            // calc amount
			let amount = initialAmount; // in ethers
			amount = amount.sub(await this.calcFees(_token, initialAmount));

            if (_token.calcGasCostOnBC2 && _token.conversionRateBC1toBC2 !== undefined && _token.conversionRateBC1toBC2 !== null && _token.conversionRateBC1toBC2 !== 0) {
                let destinationTxFee = await this.calcGasCost(_provider, true);
                // conversion BC2 (dest) to BC1 (src)
                destinationTxFee = BigNumber.from((parseFloat(destinationTxFee.toBigInt()) * (1 / _token.conversionRateBC1toBC2)).toString());
                // convert to BC1 token
                destinationTxFee = BigNumber.from((parseFloat(destinationTxFee.toBigInt()) * _token.conversionRateBC1toTokenBC1).toString()); // convert to token
                amount = amount.sub(destinationTxFee);
            }

            // Convert to token in BC2
            let convertAmount = BigNumber.from((parseFloat(amount.toBigInt()) * _token.conversionRateTokenBC1toTokenBC2).toString());

			// verify data integrity
			const [check, checkMessage] = await this.checkData(_networkNum, indexToken, amount, convertAmount, false);
			if (check === false) {
				console.log("Error DataCheck: ", checkMessage);
				if (ethers.utils.parseEther(_token.minNoRefund).gte(initialAmount)) {
					console.log("[NoRefund]Invalid amount, less than No Refund amount");
					return;
				}
				this.refundToken(indexToken, _from, initialAmount, logTx);
				return;
			}

			this.sendToken(_networkNum, indexToken, _from, convertAmount, initialAmount, logTx);
		} catch (error) {
			console.error('Error parseEvent [' + error.code + ']: ', error);
			this.refundToken(indexToken, _from, initialAmount, logTx);
		}
	}

	// Send token in BC2 to the sender
	// networkNum: network index in network list
	// indexToken: token index
	// from: address sender
	// amount: amount to send
	// logTx: sender transaction Hash
	async sendToken(networkNum, indexToken, from, amount, initialAmount, logTx) {
		console.log("-- sendToken --");
		//console.log("[sendToken]from: ", from);
		//console.log("[sendToken]amount: ", amount);
		//console.log("[sendToken]amount: ", ethers.utils.formatEther(amount));
		//console.log("[sendToken]initialAmount: ", initialAmount);
		//console.log("[sendToken]initialAmount: ", ethers.utils.formatEther(initialAmount));
		//console.log("logTx: ", logTx);

		try {
            const _token = this._tokensList[indexToken];
			const signer = new ethers.Wallet(process.env[_token.toPrivateKey], this._networkProvider[networkNum]);
			const contract = new ethers.Contract(_token.toTokenContractAddress, transferABI, signer);

            // convert wei to toToken decimals
            if (_token.toTokenDecimals !== 18)
                amount = ethers.utils.parseUnits(ethers.utils.formatEther(amount), _token.toTokenDecimals); // to BigNumber

			const tx = await contract.transfer(from, amount);
			await this._networkProvider[networkNum].waitForTransaction(tx.hash, 1);

			console.log("[sendToken]Transfert success tx: ", tx.hash);
			this.updateBalances();
		} catch (error) {
			this.refundToken(indexToken, from, initialAmount, logTx);
			this.sendMessageToAdmin('sendToken', error, indexToken, from, amount);
			console.error('Error sendToken [' + error.code + ']: ', error);
		}
	}

	// refund function
	// indexToken: token index
	// from: address sender
	// amount: amount to send
	// logTx: sender transaction Hash
	async refundToken(indexToken, from, amount, logTx) {
		//console.log("-- refundToken --");
		//console.log("indexToken: ", indexToken);
		//console.log("from: ", from);
		//console.log("amount: ", amount);
		//console.log("logTx: ", logTx);

		try {
			const _provider = this._listeningNetworkProvider;
            const _token = this._tokensList[indexToken];
			const signer = new ethers.Wallet(process.env[_token.privateKey4refund], _provider);
			const contract = new ethers.Contract(_token.tokenContractAddress, transferABI, signer);

            // convert wei to token decimals
            if (_token.tokenDecimals !== 18)
                amount = ethers.utils.parseUnits(ethers.utils.formatEther(amount), _token.tokenDecimals); // to BigNumber

			// Check balances
			const nativeBalance = await _provider.getBalance(signer.address); // native token balance
			const tokenBalance = await contract.balanceOf(signer.address); // token balance
			if (ethers.utils.parseEther("0.1").gt(nativeBalance)) { // TODO getgascost
				console.error('[Refund]Insufficient funds for intrinsic transaction cost');
				return;
			}
			if (amount.gt(tokenBalance)) {
				console.error('[Refund]Insufficient tokens funds for transaction');
				return;
			}

			const tx = await contract.transfer(from, amount);
			await _provider.waitForTransaction(tx.hash, 1);

			console.log("[Refund]Transfert success tx: ", tx.hash);
			this.updateBalances();
		} catch (error) {
			this.sendMessageToAdmin('refundToken', error, indexToken, from, amount);
			console.error('Error (function) refundToken [' + error.code + ']: ', error);
		}
	}

	// Check balances, min, max, ...
	// networkNum: num of the network
	// indexToken: token index
	// amount: amount to be send by the sender in wei (BigNumber)
	// convertAmount: amount to be send to the sender in wei (BigNumber)
	// isNativeToken: true for native token false for token
	// return: true and empty message or false and error message on error
	async checkData(networkNum, indexToken, amount, convertAmount, isNativeToken) {
		//console.log("-- checkData --");
		//console.log("amount: ", amount);
		//console.log("indexToken: ", indexToken);

        try {
            const _provider = this._networkProvider[networkNum];
            const _token = this._tokensList[indexToken];
            const signer = new ethers.Wallet(process.env[_token.toPrivateKey], _provider);

            // Check balances
            const nativeBalance = await _provider.getBalance(signer.address); // native token balance
            const contract = new ethers.Contract(_token.toTokenContractAddress, transferABI, signer);
            let tokenBalance = await contract.balanceOf(signer.address); // token balance
            if (_token.toTokenDecimals !== 18) // to wei to BigNumber
                tokenBalance = ethers.utils.parseEther(ethers.utils.formatUnits(tokenBalance, _token.toTokenDecimals));

            if (ethers.utils.parseEther("0.01").gt(nativeBalance)) { // TODO getgascost
                return [false, "Insufficient native funds for intrinsic transaction cost"];
            }
            if (isNativeToken) {
                if (convertAmount.gt(nativeBalance)) {
                    return [false, "Insufficient native tokens funds for transaction"];
                }
            } else {
                if (convertAmount.gt(tokenBalance)) {
                    return [false, "Insufficient tokens funds for transaction"];
                }
            }

            // Check min, max
            if (ethers.utils.parseEther(_token.min).gt(amount)) {
                return [false, "Invalid amount, less than minimum amount"];
            }
            if (ethers.utils.parseEther(_token.max).lt(amount)) {
                return [false, "Invalid amount, greater than maximum amount"];
            }
            return [true, ""];
    } catch (error) {
        console.error('Error checkData [' + error.code + ']: ', error);
        return [false, "Unknown error"];
    }
}

	// calc gas cost for token
	// provider: blockchain provider
	// isContract: true for token transfert
	// return: gas price for transaction (BigNumber)
	async calcGasCost(provider, isContract) {
		//console.log("--- calcGasCost ---");
        const getGasPrice = await provider.getFeeData(); //  in wei
        // TODO estimateGas()
        let destinationTxFee = getGasPrice.maxFeePerGas * (isContract?35000:21000);  // token transfer = 34,392
        return BigNumber.from(destinationTxFee.toString());
	}

	//***********************
	//**** Html requests ****
	//***********************

	// get networkName for html
	getNetworkName() {
		//console.log("--- getNetworkName ---");
		return networkList.listeningNetwork.networkName;
	}

	// make json for html request
	// httpServerPort: http port
	// return: json string
	makeJson(httpServerPort) {
		//console.log("--- makeJson ---");
		let json4http = {};
		let resultTokensList = [];

		if (this._tokensList === null) return "Error: tokensList error";

		try {
			json4http.general = {};
			json4http.general = { ...networkList.general};
			json4http.general["http_port"] = httpServerPort;
            json4http["networks"] = { ...networkList.networks};

			json4http["listeningNetwork"] = { ...networkList.listeningNetwork};
            // Native
            delete json4http.listeningNetwork.nativeTokens;
            resultTokensList = [];
            const nativeToken = networkList.listeningNetwork.nativeTokens;
			for (let i = 0; i < nativeToken.length; i++) {
				if (nativeToken[i].activated !== true) continue;
				const count = resultTokensList.push({ ...nativeToken[i]});
				delete resultTokensList[count - 1].privateKey4refund;
				delete resultTokensList[count - 1].toPrivateKey;
				delete resultTokensList[count - 1].toNetworkIndex;
            }
			json4http.listeningNetwork.nativeTokens = resultTokensList;

            // Tokens
            delete json4http.listeningNetwork.tokens;
            resultTokensList = [];
			for (let i = 0; i < this._tokensList.length; i++) {
				if (this._tokensList[i].activated !== true) continue;
				const count = resultTokensList.push({ ...this._tokensList[i]});
				delete resultTokensList[count - 1].privateKey4refund;
				delete resultTokensList[count - 1].toPrivateKey;
				delete resultTokensList[count - 1].toNetworkIndex;
			}
			json4http.tokensList = resultTokensList;
			return JSON.stringify(json4http);
		} catch (error) {
			console.error('Error makeJson: ', error);
			return "Error create json file";
		}
	}

	// get status for html request
	getStatus() {
		//console.log("--- getStatus ---");
		return status;
	}

	//****************
	//**** Divers ****
	//****************

	// find Network by name
	// networkName: name of the network to find
	// return: network index in network list or null on error
	findNetworkByName(networkName) {
		//console.log("-- findNetworkByName --");
		for (let i = 0; i < networkList.networks.length; i++) {
			if (networkList.networks[i].networkName.toLowerCase() === networkName.toLowerCase()) {
				return i;
			}
		}
		return null;
	}

	// find Network by chainId
	// chainId: chainId of the network to find (int)
	// return: network index in network list or null on error
	findNetworkByChainId(chainId) {
		//console.log("-- findNetworkByChainId --");
		for (let i = 0; i < networkList.networks.length; i++) {
			if (networkList.networks[i].chainId === chainId) {
				return i;
			}
		}
		return null;
	}

    /*
	// find token index by Listener
	// addressListener: listener address of the token to find
	// addressContract: contract address of the token to find
	// return: token index in tokens list or null on error
    findTokenByListener(addressListener, addressContract) {
		//console.log("-- findTokenByListener --");
		//console.log("addressListener: ",addressListener);
		//console.log("addressContract: ",addressContract.length);

        let _listTokens = networkList.listeningNetwork.tokens;
		for (let i = 0; i < _listTokens.length; i++) {
		    console.log("findTokenByListener[listeningAddress[i]]: ",_listTokens[i].listeningAddress);
            if (_listTokens[i].listeningAddress.toLowerCase() === addressListener.toLowerCase() && _listTokens[i].tokenContractAddress.toLowerCase() === addressContract.toLowerCase()) {
				return i;
            }
		}
		return null;
	}
    */

	// init mail service
	initMailer() {
		//console.log("-- Init Mail --");
		if (process.env.SEND_MAIL_TO_ADMIN !== "true") return;
		if (process.env.ADMIN_ADDRESS === undefined || process.env.ADMIN_ADDRESS === null || process.env.ADMIN_ADDRESS === "") return;
		if (process.env.FROM_ADDRESS === undefined || process.env.FROM_ADDRESS === null || process.env.FROM_ADDRESS === "") return;

		try {
			this._mailTransporter = nodemailer.createTransport({
				host: process.env.SMTP_ADDRESS,
				port: process.env.SMTP_PORT * 1,
				secure: (process.env.SECURE.toLowerCase() === "true")
			});
		} catch (error) {
			console.error('ERROR initMailer [' + error.code + ']: ', error);
		}
	}

	// send mail to admin
	async sendMessageToAdmin(functionName, error, indexToken, from, amount) {
		//console.log("-- sendMessageToAdmin --");
		if (this._mailTransporter === null) return;
		console.error('Error function: ' + functionName);
		if(error !== undefined && error !== null) console.error((error.code !== undefined && error.code !== null? 'Error code: ' + error.code:""));
		if(error !== undefined && error !== null) console.error('Error Message: ', error);
		const networkNum = this._tokensList[indexToken].toNetworkIndex;

		try {
			let message = 'Deamon Bridge Error<br>\r\n';
			message += '\r\nNetwork: [' + networkNum + '] ' + this._tokensList[indexToken].toNetwork +
				'<br>\r\nToken: [' + indexToken + '] ' + this._tokensList[indexToken].toToken +
				'<br>\r\nUser: ' + this._tokensList[indexToken].toPrivateKey +
				'<br>\r\nFrom: ' + from +
				'<br>\r\nAmount: ' + amount;

			if(error !== undefined && error !== null) {
				message += '<br><br>\r\nError';
				if (functionName !== null && functionName !== "") {
					message += ' in ' + functionName;
				}
				message += (error.code !== undefined && error.code !== null?' [' + error.code + ']':'');
				if (error.message !== undefined && error.message !== null && error.message !== "") {
					message += "<br>\r\nError message: " + error.message;
				}
				message += '<br>\r\n';
			}

			console.log("Message:" + message);

			// send mail
			const mailOptions = {
				from: process.env.FROM_ADDRESS,
				to: process.env.ADMIN_ADDRESS,
				subject: "Error on daemon bridge",
				html: message
			};
			this._mailTransporter.sendMail(mailOptions, function (error, info) {
				if (error) {
					console.error('Error Email sent: ', error);
				} else {
					console.log('Email sent: ' + info.response);
				}
			});
		} catch (error) {
			console.error('Error Email sent: ', error);
		}
	}

}
