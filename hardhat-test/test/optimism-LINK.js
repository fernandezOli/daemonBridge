const ethers = require('ethers');
require('dotenv').config()
const { expect } = require("chai");
//const { time, loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

const config = require('../../config/config.json');

const serverAddress = "http://localhost:3000/";

const abi = [
	"function balanceOf(address) view returns(uint)",
	"function transfer(address to, uint amount) returns(bool)",
];

const toNetworkName = "Optimism Sepolia";
const fromTokenName = "LINK";
const toTokenName = "LINK";

let testNetwork = null; // network index to test
let testToken = null; // Token index to test

let providerSend = null; // source network
let providerReceive = null; // destination network
let contractSendTokenAddress = null; // source token
let contractReceiveTokenAddress = null; // destination token

let signerReceive = null; // listener
let signerSender = null; // address who send token

const waitingTime = 1000;
const maxTime = 20;

let signer_balance = null;
let signer_receive_balance = null;
//let gasPrice = null;

const title = "*** Test token from Sepolia to " + toNetworkName + " ***";
const stars = "*".repeat(title.length);

describe("\n" + stars + "\n" + title + "\n" + stars, function () {
	before(async function () {
		//console.log("before");

		// check if daemon is running
		try {
			await fetch(serverAddress);
		} catch(error) {
			expect(true, "localhost Error, daemon not started !").to.be.false;
		}

		// Init variables
		testNetwork = findNetworkByName(config.networks, toNetworkName);
		expect(testNetwork !== null, "Error network name not found !").to.be.true;

		const testTokenIndex = findTokenByName(config.listeningNetwork.tokens, toNetworkName, fromTokenName, toTokenName);
		expect(testTokenIndex !== null, "Error listener for token name not found !").to.be.true;
		testToken = config.listeningNetwork.tokens[testTokenIndex];
		expect(testToken.activated === true, "Error token not activated !").to.be.true;

		// use the first entry of RPC_URL
		providerSend = new ethers.providers.JsonRpcProvider(config.listeningNetwork.RPC_URLs[0].rpcurl); // sepolia
		providerReceive = new ethers.providers.JsonRpcProvider(config.networks[testNetwork].RPC_URLs[0].rpcurl); // optimism sepolia

		contractSendTokenAddress = testToken.tokenContractAddress; // sepolia/LINK
		contractReceiveTokenAddress = testToken.toTokenContractAddress; // optimism sepolia/LINK

		signerReceive = testToken.listeningAddress;

		expect(process.env.Sepolia_PRIVATE_KEY, "Invalid private key !").to.be.a.properPrivateKey;
		signerSender = new ethers.Wallet(process.env.Sepolia_PRIVATE_KEY, providerSend);


		//if(gasPrice === null) gasPrice = await providerSend.getGasPrice(); // The gas price (in wei) return BigNumber
		//gasPrice = "400000000000";
		//gasPrice = 400000000000;
	});

	beforeEach(async function () {
		//console.log("beforeEach");

		// get and check initial network balance
		signer_balance = await providerSend.getBalance(signerSender.address); // balance In Wei { BigNumber: "37426320346873870455" }
		signer_receive_balance = await providerReceive.getBalance(signerReceive);
		expect((signer_balance.gt(ethers.BigNumber.from(ethers.utils.parseEther("1.0")))), "Sender Not enough network coins [sepolia] for fees !").to.be.true;
		expect((signer_receive_balance.gt(ethers.BigNumber.from(ethers.utils.parseEther("1.0")))), "Receiver Not enough network coins [optimism sepolia] for fees !").to.be.true;
	});

	describe("-- Test token " + config.listeningNetwork.networkName + "/" + fromTokenName + " To " + toNetworkName + "/" + toTokenName + " --", function () {
		xit("** Test transfert token **", async function () {
			console.log("      - ** Test transfert token **");

			// get initial token balance
			const contractSend = new ethers.Contract(contractSendTokenAddress, abi, providerSend);
			const initial_balance_of_emit_token = await contractSend.balanceOf(signerSender.address);

			const contractReceive = new ethers.Contract(contractReceiveTokenAddress, abi, providerReceive);
			const initial_balance_of_receiver = await contractReceive.balanceOf(signerReceive);

			const amount = ethers.utils.parseEther("2.0");

			// check token balances
			expect(initial_balance_of_emit_token.gt(ethers.BigNumber.from(amount)), "Sender not enough tokens !").to.be.true;
			expect(initial_balance_of_receiver.gt(ethers.BigNumber.from(amount)), "Receiver not enough tokens !").to.be.true; //default convert = 1/1

			console.log("Sending token ...");
			// send tokens
			const initial_balance_of_receive_token = await contractReceive.balanceOf(signerSender.address);

			const transactionTx = await contractSend.connect(signerSender).transfer(signerReceive, amount);
			//const transactionTx = await contractSend.connect(signerSender).transfer(signerReceive, amount, { gasPrice: gasPrice, gasLimit: 40000 }); // 200000000000
			console.log("transactionTx: ", transactionTx.hash);
			console.log("Waiting transaction");
			await transactionTx.wait(1); // error on wait(1) => change rpc_url

			let new_balance_of_emit_token = await contractSend.balanceOf(signerSender.address);
			expect(new_balance_of_emit_token, "new_balance_of_emit_token unchanged").to.lt(initial_balance_of_emit_token);

			// wait for exchange or refund
			process.stdout.write("Waiting transfert ");
			let new_balance_of_receive_token = 0;
			let i = 0;
			while (true) {
				await sleep(waitingTime);
				new_balance_of_receive_token = await contractReceive.balanceOf(signerSender.address);
				if (!new_balance_of_receive_token.eq(initial_balance_of_receive_token)) break;
				new_balance_of_emit_token = await contractSend.balanceOf(signerSender.address);
				if(new_balance_of_emit_token.eq(initial_balance_of_emit_token)) break;
				i++;
				if (i > maxTime) break;
				process.stdout.write(".");
			}
			console.log("");

			// ok/error
			if (i > maxTime) {
				expect(true, "❌ Error max waiting time !").to.be.false;
			}
			else {
				expect(new_balance_of_emit_token, "❌ Refund !!").to.not.eq(initial_balance_of_emit_token);
				expect(new_balance_of_receive_token, "❌ No tokens received !!!").to.gt(initial_balance_of_receive_token);
			}
			console.log("✅ Tokens received");
		}).timeout(60000);

		xit("** Test max token **", async function () {
			console.log("      - ** Test max token **");

			// get initial token balance
			const contractSend = new ethers.Contract(contractSendTokenAddress, abi, providerSend);
			const initial_balance_of_emit_token = await contractSend.balanceOf(signerSender.address);

			const contractReceive = new ethers.Contract(contractReceiveTokenAddress, abi, providerReceive);
			const initial_balance_of_receiver = await contractReceive.balanceOf(signerReceive);

			const amount = ethers.utils.parseEther("12.0"); // testToken.max 10.0 !!
			console.log("amount: ", ethers.utils.formatEther(amount));

			// check token balances
			expect(initial_balance_of_emit_token.gt(ethers.BigNumber.from(amount)), "Sender not enough tokens !").to.be.true;
			expect(initial_balance_of_receiver.gt(ethers.BigNumber.from(amount)), "Receiver not enough tokens !").to.be.true; //default convert = 1/1

			console.log("Sending token ...");
			// send tokens
			const initial_balance_of_receive_token = await contractReceive.balanceOf(signerSender.address);

			const transactionTx = await contractSend.connect(signerSender).transfer(signerReceive, amount);
			//const transactionTx = await contractSend.connect(signerSender).transfer(signerReceive, amount, { gasPrice: gasPrice, gasLimit: 40000 }); // 200000000000
			console.log("transactionTx: ", transactionTx.hash);
			console.log("Waiting transaction");
			await transactionTx.wait(1); // error on wait(1) => change rpc_url

			let new_balance_of_emit_token = await contractSend.balanceOf(signerSender.address);
			expect(new_balance_of_emit_token, "new_balance_of_emit_token unchanged").to.lt(initial_balance_of_emit_token);

			// wait for exchange or refund
			process.stdout.write("Waiting transfert ");
			let new_balance_of_receive_token = 0;
			let i = 0;
			while (true) {
				await sleep(waitingTime);
				new_balance_of_receive_token = await contractReceive.balanceOf(signerSender.address);
				if (!new_balance_of_receive_token.eq(initial_balance_of_receive_token)) break;
				new_balance_of_emit_token = await contractSend.balanceOf(signerSender.address);
				if(new_balance_of_emit_token.eq(initial_balance_of_emit_token)) break;
				i++;
				if (i > maxTime) break;
				process.stdout.write(".");
			}
			console.log("");

			// ok/error
			if (i > maxTime) {
				expect(true, "❌ Error max waiting time !").to.be.false;
			}
			else {
				expect(new_balance_of_emit_token, "❌ No Refund !!").to.eq(initial_balance_of_emit_token);
				expect(new_balance_of_receive_token, "❌ Tokens received !!!").to.eq(initial_balance_of_receive_token);
			}
			console.log("✅ Tokens refunded");
		}).timeout(60000);

		xit("** Test min token **", async function () {
			console.log("      - ** Test min token **");

			// get initial token balance
			const contractSend = new ethers.Contract(contractSendTokenAddress, abi, providerSend);
			const initial_balance_of_emit_token = await contractSend.balanceOf(signerSender.address);

			const contractReceive = new ethers.Contract(contractReceiveTokenAddress, abi, providerReceive);
			const initial_balance_of_receiver = await contractReceive.balanceOf(signerReceive);

			const amount = ethers.utils.parseEther("0.2"); // testToken.min 0.5 !!
			console.log("amount: ", ethers.utils.formatEther(amount));

			// check token balances
			expect(initial_balance_of_emit_token.gt(ethers.BigNumber.from(amount)), "Sender not enough tokens !").to.be.true;
			expect(initial_balance_of_receiver.gt(ethers.BigNumber.from(amount)), "Receiver not enough tokens !").to.be.true; //default convert = 1/1

			console.log("Sending token ...");
			// send tokens
			const initial_balance_of_receive_token = await contractReceive.balanceOf(signerSender.address);

			const transactionTx = await contractSend.connect(signerSender).transfer(signerReceive, amount);
			//const transactionTx = await contractSend.connect(signerSender).transfer(signerReceive, amount, { gasPrice: gasPrice, gasLimit: 40000 }); // 200000000000
			console.log("transactionTx: ", transactionTx.hash);
			console.log("Waiting transaction");
			await transactionTx.wait(1); // error on wait(1) => change rpc_url

			let new_balance_of_emit_token = await contractSend.balanceOf(signerSender.address);
			expect(new_balance_of_emit_token, "new_balance_of_emit_token unchanged").to.lt(initial_balance_of_emit_token);

			// wait for exchange or refund
			process.stdout.write("Waiting transfert ");
			let new_balance_of_receive_token = 0;
			let i = 0;
			while (true) {
				await sleep(waitingTime);
				new_balance_of_receive_token = await contractReceive.balanceOf(signerSender.address);
				if (!new_balance_of_receive_token.eq(initial_balance_of_receive_token)) break;
				new_balance_of_emit_token = await contractSend.balanceOf(signerSender.address);
				if(new_balance_of_emit_token.eq(initial_balance_of_emit_token)) break;
				i++;
				if (i > maxTime) break;
				process.stdout.write(".");
			}
			console.log("");

			// ok/error
			if (i > maxTime) {
				expect(true, "❌ Error max waiting time !").to.be.false;
			}
			else {
				expect(new_balance_of_emit_token, "❌ No Refund !!").to.eq(initial_balance_of_emit_token);
				expect(new_balance_of_receive_token, "❌ Tokens received !!!").to.eq(initial_balance_of_receive_token);
			}
			console.log("✅ Tokens refunded");
		}).timeout(60000);

		xit("** Test minNoRefund token **", async function () {
			console.log("      - ** Test minNoRefund token **");

			// get initial token balance
			const contractSend = new ethers.Contract(contractSendTokenAddress, abi, providerSend);
			const initial_balance_of_emit_token = await contractSend.balanceOf(signerSender.address);

			const contractReceive = new ethers.Contract(contractReceiveTokenAddress, abi, providerReceive);
			const initial_balance_of_receiver = await contractReceive.balanceOf(signerReceive);

			const amount = ethers.utils.parseEther("0.001"); // testToken.minNoRefund 0.01 !!
			console.log("amount: ", ethers.utils.formatEther(amount));

			// check token balances
			expect(initial_balance_of_emit_token.gt(ethers.BigNumber.from(amount)), "Sender not enough tokens !").to.be.true;
			expect(initial_balance_of_receiver.gt(ethers.BigNumber.from(amount)), "Receiver not enough tokens !").to.be.true; //default convert = 1/1

			console.log("Sending token ...");
			// send tokens
			const initial_balance_of_receive_token = await contractReceive.balanceOf(signerSender.address);

			const transactionTx = await contractSend.connect(signerSender).transfer(signerReceive, amount);
			//const transactionTx = await contractSend.connect(signerSender).transfer(signerReceive, amount, { gasPrice: gasPrice, gasLimit: 40000 }); // 200000000000
			console.log("transactionTx: ", transactionTx.hash);
			console.log("Waiting transaction");
			await transactionTx.wait(1); // error on wait(1) => change rpc_url

			let new_balance_of_emit_token = await contractSend.balanceOf(signerSender.address);
			expect(new_balance_of_emit_token, "new_balance_of_emit_token unchanged").to.lt(initial_balance_of_emit_token);

			// wait for exchange or refund
			process.stdout.write("Waiting transfert ");
			let new_balance_of_receive_token = 0;
			let i = 0;
			while (true) {
				await sleep(waitingTime);
				new_balance_of_receive_token = await contractReceive.balanceOf(signerSender.address);
				if (!new_balance_of_receive_token.eq(initial_balance_of_receive_token)) break;
				new_balance_of_emit_token = await contractSend.balanceOf(signerSender.address);
				if(new_balance_of_emit_token.eq(initial_balance_of_emit_token)) break;
				i++;
				if (i > maxTime) break;
				process.stdout.write(".");
			}
			console.log("");

			// ok/error
			if (i > maxTime) {
				expect(true, "❌ Error max waiting time !").to.be.true;
			}
			else {
				expect(new_balance_of_emit_token, "❌ Refund !!").to.not.eq(initial_balance_of_emit_token);
				expect(new_balance_of_receive_token, "❌ Tokens received !!!").to.eq(initial_balance_of_receive_token);
			}
			console.log("✅ Tokens NOT refunded");
		}).timeout(60000);
	});
});

// find Network by name
// networkList: list of the networks
// networkName: name of the network to find
// return: network index in network list or null on error
function findNetworkByName(networkList, networkName) {
	for (let i = 0; i < networkList.length; i++) {
		if (networkList[i].networkName.toLowerCase() === networkName.toLowerCase()) {
			return i;
		}
	}
	return null;
}

// find token by name
// tokenList: list of the token
// networkName: name of the network to find
// fromToken: name of the from token to find
// toToken: name of the to token to find
// return: token index in token list or null on error
function findTokenByName(tokenList, networkName, fromToken, toToken) {
	for (let i = 0; i < tokenList.length; i++) {
		if (tokenList[i].toNetwork === networkName && tokenList[i].tokenName === fromToken && tokenList[i].toToken === toToken) {
			return i;
		}
	}
	return null;
}

// sleep time expects milliseconds
async function sleep (time) {
	return new Promise((resolve) => setTimeout(resolve, time));
}