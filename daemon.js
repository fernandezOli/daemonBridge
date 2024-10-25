const { ethers, JsonRpcProvider } = require('ethers');
//const { utils } = require('ethers');

const networkList = require('./config/networksList.json');

let listeningNetworkProvider = null;
let networkProvider = [];

module.exports = async function () {
	//console.log("-- loading daemon--");
	initProviders();
	startListening();
}

// init providers for all networks
function initProviders() {
	//console.log("-- init Providers --");
	listeningNetworkProvider = new JsonRpcProvider(networkList.listeningNetwork.RPC_URL);

	networkProvider = [];
	for (let i = 0; i < networkList.networks.length; i++) {
		networkProvider[i] = new JsonRpcProvider(networkList.networks[i].RPC_URL);
	}
}

// Listening event
function startListening() {
	//console.log("-- start Listening --");
	//listeningNetworkProvider.removeAllListeners();
	/*
	for (let i = 0; i < networkList.networks.length; i++) {
		if (networkList.networks[i].listeningAddress === "0x") continue;

		const filter = {
			topics: [ethers.id("Transfer(address,address,uint256)"), null, ethers.zeroPadValue(networkList.networks[i].listeningAddress,32)]
		};

		const filter = {
			to: ethers.zeroPadValue(networkList.networks[i].listeningAddress,32)
		};

		const filter = {
			topics: [null, null, ethers.zeroPadValue(networkList.networks[i].listeningAddress,32)]
		};
		listeningNetworkProvider.on(filter, (log, event) => { parseBlock(log, event, 0) });
		networkProvider[0].on("block", (blockNumber) => { rinkebyParseBlock(blockNumber)});

		listeningNetworkProvider.on("block", (blockNumber) => { parseBlock(blockNumber, i) });
		console.log("start Listening for " + networkList.networks[i].networkName + " on " + networkList.networks[i].listeningAddress);
	}
	*/
	listeningNetworkProvider.on("block", (blockNumber) => { parseBlock(blockNumber, 0) });
	console.log("");
}

// Parse Event
// struct log : transaction log
// int event : transaction event
// int networkNum : network index in network list
async function parseBlock(blockNumber, networkNum) {
	console.log("parseBlock[networkNum]: ", networkNum);
	console.log("parseBlock[blockNumber]: ", blockNumber);

	/*
	const result = await networkProvider[networkNum].getBlockWithTransactions(blockNumber);
	*/
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
}

/*
// Parse Event
// struct log : transaction log
// int event : transaction event
// int networkNum : network index in network list
async function parseEvent(log, event, networkNum) {
	console.log("parseEvent[networkNum]: ", networkNum);
	console.log("parseEvent[event]: ", event);
	console.log("parseEvent[log]: ", log);

	// check data (amount, fees, ...)
	// calc amount
	// send transaction to tr.from
}

function findNetworkByName(networkName) {
	//console.log("findNetwork: " + networkName);
	for (let i = 0; i < networkList.networks.length; i++) {
		if (networkList.networks[i].networkName.toLowerCase() === networkName.toLowerCase()) {
			return i;
		}
	}
	return null;
}
*/
