const { ethers, JsonRpcProvider } = require('ethers');
//const { utils } = require('ethers');
require("dotenv").config();
const nodemailer = require('nodemailer');

const networkList = require('./config/config.json');

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

module.exports = class daemon {
	_listeningNetworkProvider = null;
	_networkProvider = [];
	_tokensList = null;
	_mailTransporter = null;

	constructor() {
		//console.log("-- loading daemon--");
		/*
		console.log("address: ", addr);
		*/

		try {
			this.initMailer();
			this.initProviders();
			this.startListening();
		} catch (error) {
			throw error;
		}
	}

	initMailer() {
		//console.log("-- Init Mail --");
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

	// init providers for all destination networks
	initProviders() {
		//console.log("-- init Providers --");
		try {
			this._listeningNetworkProvider = new JsonRpcProvider(networkList.listeningNetwork.RPC_URL);
			if (this._listeningNetworkProvider === undefined || this._listeningNetworkProvider === null) {
				throw new Error('Invalid RPC_URL for listening network');
			}

			this._networkProvider = [];
			for (let i = 0; i < networkList.networks.length; i++) {
				this._networkProvider[i] = new JsonRpcProvider(networkList.networks[i].RPC_URL);
				if (this._networkProvider[i] === undefined || this._networkProvider[i] === null) {
					throw new Error('Invalid RPC_URL for network: ' + networkList.networks[i].networkName);
				}
			}
		} catch (error) {
			console.error('ERROR initProviders [' + error.code + ']: ', error);
			throw error;
		}
	}

	// Start listening on network for native coin or tokens
	startListening() {
		//console.log("-- start Listening --");
		let tokenIndex = null;
		if (this._listeningNetworkProvider === null) {
			throw new Error('ERROR start listening, no provider');
		}
		try {
			//this._listeningNetworkProvider.removeAllListeners();

			// Native token
			if (networkList.listeningNetwork.nativeToken) {
				this._listeningNetworkProvider.on("block", (blockNumber) => { parseBlock(blockNumber, 0) });
				console.log("Start listening for native token");
			}
			//this._listeningNetworkProvider.on("error", (tx) => { console.error('Error .on: ', tx)} );

			// tokens
			this._tokensList = networkList.listeningNetwork.tokens;
			for (tokenIndex = 0; tokenIndex < this._tokensList.length; tokenIndex++) {
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
					topics: [null, null, ethers.zeroPadValue(this._tokensList[tokenIndex].listeningAddress, 32)]
				};

				const _index = tokenIndex;
				this._listeningNetworkProvider.on(filter, (log) => { parseEvent(log, _index); });
				console.log("Start listening for token " + this._tokensList[tokenIndex].tokenName + " on " + this._tokensList[tokenIndex].listeningAddress + " to " + this._tokensList[tokenIndex].toNetwork + "/" + this._tokensList[tokenIndex].toToken);
			}
		} catch (error) {
			if (tokenIndex !== null && this._tokensList !== null) console.error("ERROR start listening for token " + this._tokensList[tokenIndex].tokenName);
			console.error('ERROR start listening [' + error.code + ']: ', error);
			throw error;
		}
	}

	//**********************
	//**** Native Coins ****
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

		try {
			const amount = BigInt(log.data);
			//console.log("amount (bigint): ", amount);
			// TODO save intial amount for payback
			// TODO save log.transactionHash for bridge log

			// check data (amount, fees, ...)

			// calc amount

			// get to and from and convert address length 32 to address length 20
			let _from = BigInt(log.topics[1]).toString(16);
			if (_from.length % 2 === 0) _from = ethers.zeroPadValue("0x" + _from, 20);
			else _from = ethers.zeroPadValue("0x0" + _from, 20);

			/*
			// Inutile car deja dans le filter
			let _to = BigInt(log.topics[2]).toString(16);
			if (_to.length % 2 === 0) _to = ethers.zeroPadValue("0x" + _to, 20);
			else _to = ethers.zeroPadValue("0x0" + _to, 20);
			*/

			this.sendToken(this._tokensList[indexToken].toNetworkIndex, indexToken, _from, amount);
		} catch (error) {
			console.error('Error parseEvent [' + error.code + ']: ', error);
			// TODO payback on '_from'
		}
	}

	// Send token in BC2 to the sender
	// networkNum: network index in network list
	// indexToken: token index
	// from: address sender
	// amount: amount to send
	async sendToken(networkNum, indexToken, from, amount) {
		//console.log("-- sendToken --");
		console.log("from: ", from);
		console.log("amount: ", amount);
		//console.log("sendToken[toTokenContractAddress]: ", this._tokensList[indexToken].toTokenContractAddress);
		console.log("signerPrivateKey: ", this._tokensList[indexToken].toPrivateKey);

		try {
			const signer = new ethers.Wallet(process.env["OPSepolia_PRIVATE_KEY"], this._networkProvider[networkNum]);
			const contract = new ethers.Contract(this._tokensList[indexToken].toTokenContractAddress, transferABI, signer);

			const tx = await contract.transfer(from, amount);
			await this._networkProvider[networkNum].waitForTransaction(tx.hash, 1);

			console.log("Transfert success tx: ", tx.hash);
		} catch (error) {
			//if (error.code === "INSUFFICIENT_FUNDS") => insufficient funds on native token on BC <networkNum>
			//error.shortMessage: 'insufficient funds for intrinsic transaction cost'
			this.sendTokenBack(indexToken, from, amount);
			this.sendMessageToAdmin('sendToken', error, networkNum, indexToken, from, amount);
			console.error('Error (function) sendToken [' + error.code + ']: ', error);
		}
	}

	// payback function
	// indexToken: token index
	// from: address sender
	// amount: amount to send
	async sendTokenBack(indexToken, from, amount) {
		console.log("-- sendTokenBack --");
		console.log("indexToken: ", indexToken);
		console.log("from: ", from);
		console.log("amount: ", amount);
		//this._listeningNetworkProvider
		//this._tokensList[indexToken].privateKey4payback
		//this._tokensList[indexToken].tokenContractAddress
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

	// send mail to admin
	async sendMessageToAdmin(functionName, error, networkNum, indexToken, from, amount) {
		//console.log("-- sendMessageToAdmin --");
		console.error('Error in ' + functionName + ' [' + error.code + ']: ', error);
		if (process.env.SEND_MAIL_TO_ADMIN !== true) return;
		if (this._mailTransporter === null) return;
		if (process.env.ADMIN_ADDRESS === undefined || process.env.ADMIN_ADDRESS === null || process.env.ADMIN_ADDRESS === "") return;
		if (process.env.FROM_ADDRESS === undefined || process.env.FROM_ADDRESS === null || process.env.FROM_ADDRESS === "") return;

		try {
			let message = 'Error in ' + functionName + ' [' + error.code +
				'], network: [' + networkNum + ']' + this._tokensList[indexToken].toNetwork +
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
