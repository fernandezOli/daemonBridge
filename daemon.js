const { ethers, JsonRpcProvider } = require('ethers');
//const { utils } = require('ethers');
require("dotenv").config();

const networkList = require('./config/networksList.json');

let listeningNetworkProvider = null;
let networkProvider = [];

module.exports = async function () {
	//console.log("-- loading daemon--");
	/*
	let addr = BigInt("0x000000000000000000000000962ac815b1249027cfd80d6b0476c9090b5aef39").toString(16);
	console.log("address: ", addr);
	console.log("address BigIntHex: ", ethers.zeroPadValue("0x"+addr,20));
	let addr2 = BigInt("0x0000000000000000000000000962ac815b1249027cfd80d6b0476c9090b5aef3").toString(16);
	console.log("address2: ", addr2);
	console.log("address2 BigIntHex: ", ethers.zeroPadValue("0x0"+addr2,20));
	*/

	try {
		initProviders();
		startListening();
	} catch (error) {
		throw error;
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
	try {
		//listeningNetworkProvider.removeAllListeners();

		// Native token
		if (networkList.listeningNetwork.nativeToken) {
			listeningNetworkProvider.on("block", (blockNumber) => { parseBlock(blockNumber, 0) });
			console.log("Start listening for native token");
		}

		// tokens
		const tokensList = networkList.listeningNetwork.tokens;
		for (let i = 0; i < tokensList.length; i++) {
			if (tokensList[i].listeningAddress === undefined || tokensList[i].listeningAddress === null || tokensList[i].listeningAddress === "0x")
				continue;
			const filter = {
				address: tokensList[i].contractAddress,
				topics: [null, null, ethers.zeroPadValue(tokensList[i].listeningAddress,32)]
			};
			listeningNetworkProvider.on(filter, (log) => {
				parseEvent(log, findNetworkByName(tokensList[i].toNetwork), tokensList[i].toTokenContractAddress);
			});
			console.log("Start listening for token " + tokensList[i].tokenName + " on " + tokensList[i].listeningAddress + " to " + tokensList[i].toNetwork + "/" + tokensList[i].toToken);
		}
	} catch (error) {
		console.error('ERROR startListening [' + error.code + ']: ', error);
		throw error;
	}
}

// Parse Block for native token payment
// blockNumber: block number in blockchain
// networkNum: network index in network list
async function parseBlock(blockNumber, networkNum) {
	console.log("parseBlock[networkNum]: ", networkNum);
	console.log("parseBlock[blockNumber]: ", blockNumber);

	//const result = await networkProvider[networkNum].getBlockWithTransactions(blockNumber);
	const block = await listeningNetworkProvider.getBlock(blockNumber);
	console.log("Transactions:", block.transactions);
	/*
	Transactions: [
  '0x8a64a71ef3f8b91644bfe247be709472acadfffdd25b1be31ba796f1ac838657',
  '0x6b55ddcae03ecf79ec670efc3e41b10da5cd0fc46f47a2d59fdc190a6cf3a520',
  '0xe9489b5b9290f684dc05f05a5687fc79f6d8e150bf412384fb3749da52bcd0cc',
	*/
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
}

/*
// Send token to the applicant
async function sendNativeToken(networkNum, to, amount) {
	try {
		//const provider = new ethers.providers.JsonRpcProvider('QUICKNODE_HTTPS_URL');
		//networkProvider[networkNum]
		const signer = new ethers.Wallet(process.env.OPSepolia_PRIVATE_KEY, networkProvider[networkNum]);
		const tx = await signer.sendTransaction({ to: to, value: amount });
		console.log(tx);
	} catch (error) {
		console.error('Error sendToken [' + error.code + ']: ', error);
	}
}
*/

// Parse log for tokens
// struct log: transaction log
// networkNum: network index in network list
// TokenContractAddress: contract address of the token
async function parseEvent(log, networkNum, TokenContractAddress) {
	console.log("parseEvent[networkNum]: ", networkNum);
	console.log("parseEvent[TokenContractAddress]: ", TokenContractAddress);
	//console.log("parseEvent[log]:", log);

	//console.log("amount hex:", log.data);
	const amount = BigInt(log.data);
	console.log("amount int: ", amount);
	//ethers.utils.hexStripZeros(metadata); -> ethers.toQuantity
	// BigInt(log.data).toString();
	//ethers.zeroPadValue(tokensList[i].listeningAddress,20);

	//console.log("log.topics[1] (from):", log.topics[1]); // 32 !!!!
	//console.log("log.topics[2] (to):", log.topics[2]); // 32 !!!!

	// check data (amount, fees, ...)
	// calc amount
	// send transaction to tr.from
	
	// convert address length 32 to address length 20
	let addr = BigInt(log.topics[2]).toString(16);
	if (addr.length() % 2) addr = ethers.zeroPadValue("0x"+addr,20);
	else addr = ethers.zeroPadValue("0x0"+addr,20);

	sendToken(networkNum, TokenContractAddress, addr, amount);
}

// Send token to the applicant
async function sendToken(networkNum, TokenContractAddress, to, amount) {
	try {

		const signer = new ethers.Wallet(process.env.OPSepolia_PRIVATE_KEY, networkProvider[networkNum]);

		//{ "indexed": true, "internalType": "address", "name": "from", "type": "address" },
		const contractABI = [
			{
				"inputs": [
					{ "indexed": true, "internalType": "address", "name": "to", "type": "address" },
					{ "indexed": false, "internalType": "uint256", "name": "value", "type": "uint256" }
				],
				"name": "transfer",
				"type": "function"
			}
		];
		//const contract = new ethers.Contract(networkList[networkId].contractAddress, contractABI, networkProvider);
		const contract = new ethers.Contract(TokenContractAddress, contractABI, signer);

		const tx = await contract.transfer(to, amount); //, { gasPrice: fastGasPrice }

		console.log(tx);
	} catch (error) {
		console.error('Error sendToken [' + error.code + ']: ', error);
	}
}

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
