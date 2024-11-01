const { ethers, JsonRpcProvider } = require('ethers');
//const { utils } = require('ethers');
require("dotenv").config();
const nodemailer = require('nodemailer');

const networkList = require('./config/config.json');

let listeningNetworkProvider = null;
let networkProvider = [];
let tokensList = null;
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
let mailTransporter = null;

module.exports = function daemon() {
	//console.log("-- loading daemon--");
	/*
	console.log("address: ", addr);
	*/

	try {
		initMailer();
		initProviders();
		startListening();
		return makeJson();
	} catch (error) {
		throw error;
	}
}

function initMailer() {
	//console.log("-- Init Mail --");
	try {
		mailTransporter = nodemailer.createTransport({
			host: process.env.SMTP_ADDRESS,
			port: process.env.SMTP_PORT,
			secure: process.env.SECURE
		});
	} catch (error) {
		console.error('ERROR initMailer [' + error.code + ']: ', error);
	}
}

// init providers for all destination networks
function initProviders() {
	//console.log("-- init Providers --");
	try {
		listeningNetworkProvider = new JsonRpcProvider(networkList.listeningNetwork.RPC_URL);
		if(listeningNetworkProvider === undefined || listeningNetworkProvider === null)
			throw new Error('Invalid RPC_URL for listening network');

		networkProvider = [];
		for (let i = 0; i < networkList.networks.length; i++) {
			networkProvider[i] = new JsonRpcProvider(networkList.networks[i].RPC_URL);
			if(networkProvider[i] === undefined || networkProvider[i] === null)
				throw new Error('Invalid RPC_URL for network: ' + networkList.networks[i].networkName);
		}
	} catch (error) {
		console.error('ERROR initProviders [' + error.code + ']: ', error);
		throw error;
	}
}

// Listening event
function startListening() {
	//console.log("-- start Listening --");
	let tokenIndex = null;
	try {
		//listeningNetworkProvider.removeAllListeners();

		// Native token
		if (networkList.listeningNetwork.nativeToken) {
			listeningNetworkProvider.on("block", (blockNumber) => { parseBlock(blockNumber, 0) });
			console.log("Start listening for native token");
		}

		// tokens
		tokensList = networkList.listeningNetwork.tokens;
		for (tokenIndex = 0; tokenIndex < tokensList.length; tokenIndex++) {
			if (tokensList[tokenIndex].listeningAddress === undefined ||
				tokensList[tokenIndex].listeningAddress === null ||
				tokensList[tokenIndex].listeningAddress === "0x") {
					tokensList[tokenIndex].activated = false;
					continue;
			}
			tokensList[tokenIndex].activated = true;
			tokensList[tokenIndex].toNetworkIndex = findNetworkByName(tokensList[tokenIndex].toNetwork);

			const filter = {
				address: tokensList[tokenIndex].tokenContractAddress,
				topics: [null, null, ethers.zeroPadValue(tokensList[tokenIndex].listeningAddress,32)]
			};

			const _index = tokenIndex;
			listeningNetworkProvider.on(filter, (log) => { parseEvent(log, _index); });
			console.log("Start listening for token " + tokensList[tokenIndex].tokenName + " on " + tokensList[tokenIndex].listeningAddress + " to " + tokensList[tokenIndex].toNetwork + "/" + tokensList[tokenIndex].toToken);
		}
	} catch (error) {
		if (tokenIndex !== null && tokensList !== null) console.error("ERROR start listening for token " + tokensList[tokenIndex].tokenName);
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
async function parseBlock(blockNumber, networkNum) {
	console.log("parseBlock[networkNum]: ", networkNum);
	console.log("parseBlock[blockNumber]: ", blockNumber);
/*
	//const result = await networkProvider[networkNum].getBlockWithTransactions(blockNumber);
	const block = await listeningNetworkProvider.getBlock(blockNumber);
	console.log("Transactions:", block.transactions);

	for (let i = 0; i < block.transactions.length; i++) {
		console.log('transaction no: ', i);
		let result = await listeningNetworkProvider.getTransaction(block.transactions[i]);
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
		//networkProvider[networkNum]
		const signer = new ethers.Wallet(process.env["OPSepolia_PRIVATE_KEY"], networkProvider[networkNum]);
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
async function parseEvent(log, indexToken) {
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

		sendToken(tokensList[indexToken].toNetworkIndex, indexToken, _from, amount);
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
async function sendToken(networkNum, indexToken, from, amount) {
	//console.log("-- sendToken --");
	console.log("from: ", from);
	console.log("amount: ", amount);
	//console.log("sendToken[toTokenContractAddress]: ", tokensList[indexToken].toTokenContractAddress);
	console.log("signerPrivateKey: ", tokensList[indexToken].toPrivateKey);

	try {
		const signer = new ethers.Wallet(process.env["OPSepolia_PRIVATE_KEY"], networkProvider[networkNum]);
		const contract = new ethers.Contract(tokensList[indexToken].toTokenContractAddress, transferABI, signer);

		const tx = await contract.transfer(from, amount);
		await networkProvider[networkNum].waitForTransaction(tx.hash, 1);

		console.log("Transfert success tx: ", tx.hash);
	} catch (error) {
		//if (error.code === "INSUFFICIENT_FUNDS") => insufficient funds on native token on BC <networkNum>
		//error.shortMessage: 'insufficient funds for intrinsic transaction cost'
		sendTokenBack(indexToken, from, amount);
		sendMessageToAdmin('sendToken', error, networkNum, indexToken, from, amount);
		console.error('Error (function) sendToken [' + error.code + ']: ', error);
	}
}

// payback function
// indexToken: token index
// from: address sender
// amount: amount to send
async function sendTokenBack(indexToken, from, amount) {
	console.log("-- sendTokenBack --");
	console.log("indexToken: ", indexToken);
	console.log("from: ", from);
	console.log("amount: ", amount);
	//listeningNetworkProvider
	//tokensList[indexToken].privateKey4payback
	//tokensList[indexToken].tokenContractAddress
}

//****************
//**** Divers ****
//****************

// find Network by name
// networkName: name of the network to find
// return: network index in network list or null on error
function findNetworkByName(networkName) {
	//console.log("findNetwork: " + networkName);
	for (let i = 0; i < networkList.networks.length; i++) {
		if (networkList.networks[i].networkName.toLowerCase() === networkName.toLowerCase()) {
			return i;
		}
	}
	return null;
}

// send mail to admin
// networkName: name of the network to find
// return: network index in network list or null on error
async function sendMessageToAdmin(functionName, error, networkNum, indexToken, from, amount) {
	//console.log("-- sendMessageToAdmin --");
	console.error('Error in ' + functionName + ' [' + error.code + ']: ', error);
	if (process.env.SEND_MAIL_TO_ADMIN !== true) return;
	if (mailTransporter === undefined || mailTransporter === null) return;
	if (process.env.ADMIN_ADDRESS === undefined || process.env.ADMIN_ADDRESS === null || process.env.ADMIN_ADDRESS === "") return;
	if (process.env.FROM_ADDRESS === undefined || process.env.FROM_ADDRESS === null || process.env.FROM_ADDRESS === "") return;

	try {
		let message = 'Error in ' + functionName + ' [' + error.code +
			'], network: [' + networkNum + ']' + tokensList[indexToken].toNetwork +
			', tokenIndex: ' + indexToken +
			', token: ' + tokensList[indexToken].toToken +
			', user: ' + tokensList[indexToken].toPrivateKey +
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
		mailTransporter.sendMail(mailOptions, function (error, info) {
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

// make json for html request
function makeJson() {
	//console.log("--- makeJson ---");
	let _daemonObject = {};
	let _tokensList = [];

	if (tokensList === undefined || tokensList === null) return "tokensList error";

	try {
		_daemonObject.networks = networkList.networks;
		for (let i = 0; i < tokensList.length; i++) {
			_tokensList.push(tokensList[i]);
		}
		_daemonObject.tokensList = _tokensList;
		return JSON.stringify(_daemonObject);
	} catch (error) {
		console.error('Error htmlJson: ', error);
		return "Error create tokens list";
	}
}
