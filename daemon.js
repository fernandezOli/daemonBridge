// Daemon.js
const { ethers, BigNumber } = require('ethers');
require("dotenv").config();
const deasync = require('deasync');
const nodemailer = require('nodemailer');

const networkList = require('./config/config.json');
/*
const transferABI = [
	{
		"inputs": [
			{ "internalType": "address", "name": "to", "type": "address" },
			{ "internalType": "uint256", "name": "amount", "type": "uint256" }
		],
		"name": "transfer",
		"outputs": [
			{ "internalType": "bool", "name": "", "type": "bool" }
		],
		"stateMutability": "nonpayable",
		"type": "function"
	}
];
*/
const transferABI = [
	"function balanceOf(address) view returns(uint)",
	"function transfer(address to, uint amount) returns(bool)",
];


let validProviderIndex = []; // valid Provider Index by network, listening = 0, destination = network index + 1

module.exports = class daemon {
	_listeningNetworkProvider = null;
	_networkProvider = [];
	_tokensList = null;
	_mailTransporter = null;

	constructor() {
		//console.log("-- loading daemon--");
		//const providerTest = ethers.providers.getDefaultProvider('sepolia');
		//console.log("providerTest: ", providerTest);

		try {
			this.checkPrivateKeys();
			this.initProviders();
			this.startListening();
			this.initMailer();
			//sendMessageToAdmin(null, null, 0, 0, "0xE4aB69C077896252FAFBD49EFD26B5D171A32410", 10000000);
			//this.checkData(0, 0, ethers.utils.parseEther("10.0"), false).then(([err, result]) => {console.log("dataCheck err: ", err); console.log("dataCheck result: ", result);});

			this.calcFees(0, 0, ethers.utils.parseEther("1.0")).then(fees => {console.log("fees: ", fees);});
		} catch (error) {
			throw error;
		}
	}

	// check private keys
	checkPrivateKeys() {
		//console.log("-- check Private Keys --");
		let _privateKey = null;
		let _token = null;

		// native private keys
		for (let i = 0; i < networkList.listeningNetwork.nativeToken.length; i++) {
			_token = networkList.listeningNetwork.nativeToken[i];
			if (_token.toPrivateKey === undefined || _token.toPrivateKey === null || _token.toPrivateKey === "") {
				throw new Error('Invalid native private key for toPrivateKey');
			}
			_privateKey = _token.toPrivateKey;
			if (process.env[_privateKey] === undefined || process.env[_privateKey] === null || process.env[_privateKey] === "") {
				throw new Error('Undefined native private key for toPrivateKey');
			}
			if (_token.privateKey4refund === undefined || _token.privateKey4refund === null || _token.privateKey4refund === "") {
				throw new Error('Invalid native private key for privateKey4refund');
			}
			_privateKey = _token.privateKey4refund;
			if (process.env[_privateKey] === undefined || process.env[_privateKey] === null || process.env[_privateKey] === "") {
				throw new Error('Undefined native private key for privateKey4refund');
			}
		}
		// tokens private keys
		for (let i = 0; i < networkList.listeningNetwork.tokens.length; i++) {
			_token = networkList.listeningNetwork.tokens[i];
			if (_token.toPrivateKey === undefined || _token.toPrivateKey === null || _token.toPrivateKey === "") {
				throw new Error('Invalid native private key for toPrivateKey');
			}
			_privateKey = _token.toPrivateKey;
			if (process.env[_privateKey] === undefined || process.env[_privateKey] === null || process.env[_privateKey] === "") {
				throw new Error('Undefined native private key for toPrivateKey');
			}
			if (_token.privateKey4refund === undefined || _token.privateKey4refund === null || _token.privateKey4refund === "") {
				throw new Error('Invalid native private key for privateKey4refund');
			}
			_privateKey = _token.privateKey4refund;
			if (process.env[_privateKey] === undefined || process.env[_privateKey] === null || process.env[_privateKey] === "") {
				throw new Error('Undefined native private key for privateKey4refund');
			}
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
			if (validProvider === null) throw new Error('Invalid RPC_URL for listening network');
			//console.log("validProvider [initProviders]: ", validProvider);
			this._listeningNetworkProvider = validProvider;
		} catch (error) {
			console.error('ERROR initProviders for listening Network [' + error.code + ']: ', error);
			throw error;
		}

		// Init destination Networks
		try {
			this._networkProvider = [];
			for (let i = 0; i < networkList.networks.length; i++) {
				let validProvider;
				(async () => validProvider = await this.getFirstValidProvider(networkList.networks[i].RPC_URLs, i + 1).then().catch())();
				while (validProvider === undefined) { deasync.runLoopOnce(); } // Wait result from async_function
				if (validProvider === null) throw new Error('Invalid RPC_URL for network');
				this._networkProvider[i] = validProvider;
				//this._networkProvider[i] = new ethers.providers.JsonRpcProvider(networkList.networks[i].RPC_URL);
				//if (this._networkProvider[i] === undefined || this._networkProvider[i] === null) {
				//	throw new Error('Invalid RPC_URL for network: ' + networkList.networks[i].networkName);
				//}
			}
		} catch (error) {
			console.error('ERROR initProviders [' + error.code + ']: ', error);
			throw error;
		}
	}

	// get the first valid provider for a network
	// valid Provider Index by network, listening = 0, destination = network index + 1
	// return: valid provider or null on error
	async getFirstValidProvider(networkUrlList, networkIndex) {
		//console.log("-- getFirstValidProvider --");

		for (let i = 0; i < networkUrlList.length; i++) {
			try {
				let url = networkUrlList[i].rpcurl;
				let providerUrl = null;
				//console.log("Check provider: ", url);

				//InfuraProvider ethers.providers.JsonRpcProvider(url + process.env[networkUrlList[i].apikey], networkList.listeningNetwork.networkName)
				if(networkUrlList[i].type !== "") {
					if(networkUrlList[i].type === "ETHERSCAN")
						providerUrl = new ethers.providers.EtherscanProvider(networkList.listeningNetwork.networkName, process.env[networkUrlList[i].apikey]);
					else
						providerUrl = new ethers.providers.InfuraProvider(networkList.listeningNetwork.networkName, process.env[networkUrlList[i].apikey]);
				}
				else providerUrl = new ethers.providers.JsonRpcProvider(url);

				if (providerUrl === null) continue;

				//let providerError = await providerUrl.send("eth_chainId", []);
				//console.log("eth_chainId [getFirstValidProvider]: ", providerError);
				// TODO: check filter ?

				//console.log("Valid provider found: ", url);
				validProviderIndex[networkIndex] = i;
				return providerUrl;
			} catch (error) {
				console.error("Error provider: ", error);
				continue;
			}
		}
		console.error("Error, no valid provider found !");
		return null;
	}

	// Start listening on network for native token and tokens
	startListening() {
		//console.log("-- start Listening --");
		let tokenIndex = null;
		if (this._listeningNetworkProvider === null) {
			throw new Error('ERROR start listening, no provider');
		}

		//this._listeningNetworkProvider.removeAllListeners();
		// Native token
		try {
			if (networkList.listeningNetwork.activeNativeToken) {
				// Scan all blocks
				this._listeningNetworkProvider.on("block", (blockNumber) => { this.parseBlock(blockNumber, 0) });
				console.log("Start listening for native token");
			}
			this._listeningNetworkProvider.on("error", (error) => { console.error('Error _listeningNetworkProvider.on: ', error)} );
			// TODO: make address list of listeners
		} catch (error) {
			console.error('ERROR start listening for native token');
			throw error;
		}

		// tokens
		try {
			this._tokensList = networkList.listeningNetwork.tokens;
			for (let tokenIndex = 0; tokenIndex < this._tokensList.length; tokenIndex++) {
				if (this._tokensList[tokenIndex].listeningAddress === undefined ||
					this._tokensList[tokenIndex].listeningAddress === null ||
					this._tokensList[tokenIndex].listeningAddress === "0x") {
					this._tokensList[tokenIndex].activated = false;
					continue;
				}
				this._tokensList[tokenIndex].activated = true;
				this._tokensList[tokenIndex].toNetworkIndex = this.findNetworkByName(this._tokensList[tokenIndex].toNetwork);

				const filter = {
					address: this._tokensList[tokenIndex].tokenContractAddress,
					topics: [null, null, ethers.utils.hexZeroPad(this._tokensList[tokenIndex].listeningAddress, 32)]
				};

				const _index = tokenIndex;
				this._listeningNetworkProvider.on(filter, (log) => { this.parseEvent(log, _index); });
				console.log("Start listening for token " + this._tokensList[tokenIndex].tokenName + " on " + this._tokensList[tokenIndex].listeningAddress + " to " + this._tokensList[tokenIndex].toNetwork + "/" + this._tokensList[tokenIndex].toToken);
			}
		} catch (error) {
			if (tokenIndex !== null && this._tokensList !== null) console.error("ERROR start listening for token " + this._tokensList[tokenIndex].tokenName);
			console.error('ERROR start listening [' + error.code + ']: ', error);
			throw error;
		}
		// TODO add timeout to reload the filters
	}

	//**********************
	//**** Native Token ****
	//**********************

	// Parse Block for native token payment
	// blockNumber: block number in blockchain
	// networkNum: network index in network list
	async parseBlock(blockNumber, networkNum) {
		console.log("parseBlock[networkNum]: ", networkNum);
		console.log("parseBlock[blockNumber]: ", blockNumber);
		/*
			//const result = await this._networkProvider[networkNum].getBlockWithTransactions(blockNumber);
			const block = await this._listeningNetworkProvider.getBlock(blockNumber);
			console.log("Transactions:", block.transactions);
		
			for (let i = 0; i < block.transactions.length; i++) {
				console.log('transaction no: ', i);
				let result = await this._listeningNetworkProvider.getTransaction(block.transactions[i]);
				if (result.to === undefined || result.to === null) {
					console.log('transaction !to: ', result);
					continue;
				}
				console.log('transaction [to]: ', result.to);
				//if (result.transactions[i].to === undefined || result.transactions[i].to === null) continue;
				//if (result.transactions[i].to !== networkList.networks[i].listeningAddress) continue;
			}
		
			// check data (amount, fees, ...)
			// calc amount
			// send transaction to tr.from
			//sendNativeToken(networkNum, to, amount)
		*/
	}

	/*
	Transactions: [
	'0x8a64a71ef3f8b91644bfe247be709472acadfffdd25b1be31ba796f1ac838657',
	'0x6b55ddcae03ecf79ec670efc3e41b10da5cd0fc46f47a2d59fdc190a6cf3a520',
	'0xe9489b5b9290f684dc05f05a5687fc79f6d8e150bf412384fb3749da52bcd0cc',
	*/

	/*
	// Send token to the applicant
	async function sendNativeToken(networkNum, to, amount) {
		try {
			//const provider = new ethers.providers.JsonRpcProvider('QUICKNODE_HTTPS_URL');
			//this._networkProvider[networkNum]
			const signer = new ethers.Wallet(process.env["OPSepolia_PRIVATE_KEY"], this._networkProvider[networkNum]);
			const tx = await signer.sendTransaction({ to: to, value: amount });
			console.log(tx);
		} catch (error) {
			console.error('Error sendToken [' + error.code + ']: ', error);
		}
	}
	*/

	//****************
	//**** Tokens ****
	//****************

	// Parse log for tokens
	// struct log: transaction log
	// indexToken: token index
	async parseEvent(log, indexToken) {
		//console.log("-- parseEvent --");
		//console.log("parseEvent[indexToken]: ", indexToken);
		//console.log("parseEvent[log]:", log);
		const logTx = log.transactionHash;

		try {
			const initialAmount = BigInt(log.data);
			//console.log("amount (bigint): ", amount);

			const _token = this._tokensList[indexToken];
			const _networkNum = _token.toNetworkIndex;

			// get to and from and convert address length 32 to address length 20
			let _from = BigInt(log.topics[1]).toString(16);
			if (_from.length % 2 === 0) _from = ethers.utils.hexZeroPad("0x" + _from, 20);
			else _from = ethers.utils.hexZeroPad("0x0" + _from, 20);

			let amount = initialAmount - await calcFees(_networkNum, indexToken, initialAmount);
			
			// verify data integrity
			const [err, errMessage] = await this.checkData(_networkNum, indexToken, amount, false);
			//console.log("dataCheck err: ", err);
			if (err === false) {
				console.log("dataCheck errMessage: ", errMessage);
				//this.sendTokenBack(indexToken, _from, initialAmount);
				return;
			}

			this.sendToken(_networkNum, indexToken, _from, amount, logTx);
		} catch (error) {
			this.sendTokenBack(indexToken, from, amount, logTx);
			console.error('Error parseEvent [' + error.code + ']: ', error);
		}
	}

	// Send token in BC2 to the sender
	// networkNum: network index in network list
	// indexToken: token index
	// from: address sender
	// amount: amount to send
	// logTx: sender transaction Hash
	async sendToken(networkNum, indexToken, from, amount, logTx) {
		//console.log("-- sendToken --");
		//console.log("from: ", from);
		//console.log("amount: ", amount);
		//console.log("logTx: ", logTx);
		//console.log("signerPrivateKey: ", this._tokensList[indexToken].toPrivateKey);

		try {
			const signer = new ethers.Wallet(process.env[this._tokensList[indexToken].toPrivateKey], this._networkProvider[networkNum]);
			const contract = new ethers.Contract(this._tokensList[indexToken].toTokenContractAddress, transferABI, signer);

			const tx = await contract.transfer(from, amount);
			await this._networkProvider[networkNum].waitForTransaction(tx.hash, 1);

			console.log("Transfert success tx: ", tx.hash);
		} catch (error) {
			//if (error.code === "INSUFFICIENT_FUNDS") => insufficient funds on native token on BC <networkNum>
			//error.shortMessage: 'insufficient funds for intrinsic transaction cost'
			this.sendTokenBack(indexToken, from, amount, logTx);
			this.sendMessageToAdmin('sendToken', error, networkNum, indexToken, from, amount);
			console.error('Error (function) sendToken [' + error.code + ']: ', error);
		}
	}

	// refund function
	// indexToken: token index
	// from: address sender
	// amount: amount to send
	// logTx: sender transaction Hash
	async sendTokenBack(indexToken, from, amount, logTx) {
		console.log("-- sendTokenBack --");
		console.log("indexToken: ", indexToken);
		console.log("from: ", from);
		console.log("amount: ", amount);
		console.log("logTx: ", logTx);

		try {
			const signer = new ethers.Wallet(process.env[this._tokensList[indexToken].privateKey4refund], this._listeningNetworkProvider);
			const contract = new ethers.Contract(this._tokensList[indexToken].tokenContractAddress, transferABI, signer);

			const tx = await contract.transfer(from, amount);
			await this._listeningNetworkProvider.waitForTransaction(tx.hash, 1);

			console.log("Transfert success tx: ", tx.hash);
		} catch (error) {
			//if (error.code === "INSUFFICIENT_FUNDS") => insufficient funds on native token on BC <networkNum>
			//error.shortMessage: 'insufficient funds for intrinsic transaction cost'
			this.sendMessageToAdmin('sendTokenBack', error, networkNum, indexToken, from, amount);
			console.error('Error (function) sendTokenBack [' + error.code + ']: ', error);
		}
	}

	// Check balance, min, max, fees
	// networkNum: num of the network
	// indexToken: token index
	// amount: amount to be send in wei
	// nativeToken: true for native token false for token
	// return: true and empty message or false and error message on error
	async checkData(networkNum, indexToken, amount, nativeToken) {
		//console.log("-- checkData --");
		//console.log("amount: ", amount);

		const _provider = this._networkProvider[networkNum];
		const _token = this._tokensList[indexToken];
		const signer = new ethers.Wallet(process.env[_token.toPrivateKey], _provider);

		// Check balances
		const nativeBalance = await _provider.getBalance(signer.address); // native token balance
		const contract = new ethers.Contract(_token.toTokenContractAddress, transferABI, signer);
		const tokenBalance = await contract.balanceOf(signer.address); // token balance
		if (ethers.utils.parseEther("1.0").lt(nativeBalance)) {
			return [false, "Insufficient funds for intrinsic transaction cost"];
		}
		if (nativeToken) {
			if (amount.gt(nativeBalance)) {
				return [false, "Insufficient native token funds for transaction"];
			}
		} else {
			if (amount.gt(tokenBalance)) {
				return [false, "Insufficient token funds for transaction"];
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
	}

	// calc fees for amount to be sent
	// networkNum: num of the network
	// indexToken: token index
	// amount: amount (BigNumber)
	// return: fees for this amount (BigNumber)
	async calcFees(networkNum, indexToken, amount) {
		//console.log("-- calcFees --");
		//console.log("networkNum: ", networkNum);
		//console.log("indexToken: ", indexToken);
		//console.log("amount: ", amount);

		// calc amount - fees
		const _provider = this._networkProvider[networkNum];
		const _token = this._tokensList[indexToken];

		let relayerFee = ethers.utils.parseEther(_token.fixedFees);
		let relayerPcent = amount * _token.feesPcent;
		let pcent = BigNumber.from(relayerPcent.toString());
		relayerFee.add(pcent); 
		console.log("total relayerFee: ", relayerFee);

		const getGasPrice = await _provider.getFeeData(); //  in BC2 (dest) coin, in wei
		//let getGasPrice = await _provider.estimateGas({ from: "0xe5ee2053982073636a9E89Fdce0AC392869E9165", to: "0x962aC815B1249027Cfd80D6b0476C9090B5aeF39", value: 1});
		//console.log("gasPrice: ", getGasPrice);
		let destinationTxFee = getGasPrice.gasPrice * 21000;
		console.log("destinationTxFee: ", destinationTxFee);
		destinationTxFee = destinationTxFee * 1/_token.conversionRateBC1toBC2; // conversion BC2 (dest) to BC1 (src)
		destinationTxFee = destinationTxFee * _token.conversionRateBC1toTokenBC1; // convert to token
		destinationTxFee = BigNumber.from(destinationTxFee.toString());
		console.log("destinationTxFee: ", destinationTxFee);

		let totalFees = relayerFee.add(destinationTxFee);
		return totalFees;
	}

	//***********************
	//**** Html requests ****
	//***********************

	// make json for html request
	makeJson() {
		//console.log("--- makeJson ---");
		let daemonObject = {};
		let resultTokensList = [];

		if (this._tokensList === null) return "Error: tokensList error";

		try {
			daemonObject.listeningNetwork = {};
			daemonObject.listeningNetwork["networkName"] = networkList.listeningNetwork.networkName;
			daemonObject.networks = networkList.networks;
			for (let i = 0; i < this._tokensList.length; i++) {
				if (this._tokensList[i].activated !== true) continue;
				resultTokensList.push(this._tokensList[i]);
			}
			daemonObject.tokensList = resultTokensList;
			return JSON.stringify(daemonObject);
		} catch (error) {
			console.error('Error htmlJson: ', error);
			return "Error: create tokens list";
		}
	}

	//****************
	//**** Divers ****
	//****************

	// find Network by name
	// networkName: name of the network to find
	// return: network index in network list or null on error
	findNetworkByName(networkName) {
		//console.log("findNetwork: " + networkName);
		for (let i = 0; i < networkList.networks.length; i++) {
			if (networkList.networks[i].networkName.toLowerCase() === networkName.toLowerCase()) {
				return i;
			}
		}
		return null;
	}

	//TODO async
	initMailer() {
		//console.log("-- Init Mail --");
		if (process.env.SEND_MAIL_TO_ADMIN !== true) return;

		try {
			this._mailTransporter = nodemailer.createTransport({
				host: process.env.SMTP_ADDRESS,
				port: process.env.SMTP_PORT,
				secure: process.env.SECURE
			});
		} catch (error) {
			console.error('ERROR initMailer [' + error.code + ']: ', error);
		}
	}

	// send mail to admin
	async sendMessageToAdmin(functionName, error, networkNum, indexToken, from, amount) {
		//console.log("-- sendMessageToAdmin --");
		console.error('Error in ' + functionName + ' [' + error.code + ']: ', error);
		if (process.env.SEND_MAIL_TO_ADMIN !== true) return;
		if (this._mailTransporter === null) return;
		if (process.env.ADMIN_ADDRESS === undefined || process.env.ADMIN_ADDRESS === null || process.env.ADMIN_ADDRESS === "") return;
		if (process.env.FROM_ADDRESS === undefined || process.env.FROM_ADDRESS === null || process.env.FROM_ADDRESS === "") return;

		try {
			let message = '';
			if(error !== null) {
				if (functionName !== null && functionName !== "") {
					message += 'Error in ' + functionName;
				}
				message += ' [' + error.code + ']';
				if(error.message !== undefined && error.message !== null && error.message !== "") {
					message += ", " + error.message;
				}
				message += ', ';
			}

			message += 'network: [' + networkNum + ']' + this._tokensList[indexToken].toNetwork +
				', tokenIndex: ' + indexToken +
				', token: ' + this._tokensList[indexToken].toToken +
				', user: ' + this._tokensList[indexToken].toPrivateKey +
				', from: ' + from +
				', amount: ' + amount;

			console.log("Message: " + message);

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
