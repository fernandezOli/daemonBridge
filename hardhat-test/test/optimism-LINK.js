const ethers = require('ethers');
require('dotenv').config()
const { expect } = require("chai");

const serverAddress = "http://localhost:3000/";

const abi = [
	"function balanceOf(address) view returns(uint)",
	"function transfer(address to, uint amount) returns(bool)",
];

const fromNetworkName = "Sepolia";
const toNetworkName = "Optimism Sepolia";
const fromTokenName = "LINK";
const toTokenName = "LINK";

let loadedConfig = null;

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

const title = "*** Test token transfer from " + fromNetworkName + " to " + toNetworkName + " ***";
const stars = "*".repeat(title.length);

describe("\n" + stars + "\n" + title + "\n" + stars, function () {
	before(async function () {
		//console.log("before");

		// check if daemon is running
		try {
			await fetch(serverAddress);
		} catch(error) {
			expect(true, "❌ localhost Error, daemon not started !").to.be.false;
		}

		// Try to get json
		try {
            const response = await fetch(serverAddress + "json");
            if (!response.ok) {
                expect(true, "❌ localhost Error loading configuration, Response status:",response.status).to.be.false;
            }
            loadedConfig = await response.json();
		} catch(error) {
			expect(true, "❌ localhost Error, configuration not loaded !").to.be.false;
		}

		// Init variables
		testNetwork = findNetworkByName(loadedConfig.networks, toNetworkName);
		expect(testNetwork !== null, "❌ Error network name not found !").to.be.true;

        const testTokenIndex = findTokenByName(loadedConfig.tokensList, toNetworkName, fromTokenName, toTokenName);
		expect(testTokenIndex !== null, "❌ Error listener for token name not found !").to.be.true;
		testToken = loadedConfig.tokensList[testTokenIndex];
		expect(testToken.activated === true, "❌ Error token not activated !").to.be.true;

		// use the first entry of RPC_URL
		providerSend = new ethers.providers.JsonRpcProvider(loadedConfig.listeningNetwork.RPC_URLs[0].rpcurl); // sepolia
		providerReceive = new ethers.providers.JsonRpcProvider(loadedConfig.networks[testNetwork].RPC_URLs[0].rpcurl); // optimism sepolia

		contractSendTokenAddress = testToken.tokenContractAddress; // sepolia/LINK
		contractReceiveTokenAddress = testToken.toTokenContractAddress; // optimism sepolia/LINK

		signerReceive = testToken.listeningAddress;

		expect(process.env.Sepolia_PRIVATE_KEY, "❌ Invalid private key !").to.be.a.properPrivateKey;
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
        // TODO getgascost
		expect((signer_balance.gt(ethers.BigNumber.from(ethers.utils.parseEther("0.1")))), "❌ Sender Not enough network coins ["+fromNetworkName+"] !").to.be.true;
		expect((signer_receive_balance.gt(ethers.BigNumber.from(ethers.utils.parseEther("0.1")))), "❌ Receiver Not enough network coins ["+toNetworkName+"] !").to.be.true;
	});

	describe("-- Test token " + fromNetworkName + "/" + fromTokenName + " To " + toNetworkName + "/" + toTokenName + " --", function () {
		xit("** Test transfert token **", async function () {
			console.log("      - ** Test transfert token **");

			// get initial token balance
			const contractSend = new ethers.Contract(contractSendTokenAddress, abi, providerSend);
			const initial_balance_of_emit_token = await contractSend.balanceOf(signerSender.address);
			const contractReceive = new ethers.Contract(contractReceiveTokenAddress, abi, providerReceive);
			const initial_balance_of_receiver = await contractReceive.balanceOf(signerReceive);

			let amount = parseFloat("1.0");
            let convertAmount = amount * testToken.conversionRateTokenBC1toTokenBC2; // Convertion rate

            // check token balances
			expect(initial_balance_of_emit_token.gt(ethers.utils.parseEther(amount.toString())), "❌ Sender not enough tokens !").to.be.true;
			expect(initial_balance_of_receiver.gt(ethers.utils.parseEther(convertAmount.toString())), "❌ Receiver not enough tokens !").to.be.true;
			const initial_balance_of_receive_token = await contractReceive.balanceOf(signerSender.address);

            console.log("Sending: "+ amount.toString() + " " + fromTokenName + ", Receive: " + convertAmount.toString() + " " + toTokenName + " ...");

			const transactionTx = await contractSend.connect(signerSender).transfer(signerReceive, ethers.utils.parseEther(amount.toString()));
			console.log("transactionTx: ", transactionTx.hash);
			console.log("Waiting transaction");
			await transactionTx.wait(1); // error on wait(1) => change rpc_url

			let new_balance_of_emit_token = await contractSend.balanceOf(signerSender.address);
			expect(new_balance_of_emit_token, "❌ Token balance unchanged !").to.lt(initial_balance_of_emit_token);

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

            const totReceived = new_balance_of_receive_token - initial_balance_of_receive_token;
            const totFees = ethers.utils.parseEther(convertAmount.toString()).toBigInt() - BigInt(totReceived);
            console.log("✅ " + toTokenName + " received: " + ethers.utils.formatEther(totReceived.toString()) + ", fees: " + ethers.utils.formatEther(totFees.toString()));
		}).timeout(60000);

        xit("** Test max token **", async function () {
			console.log("      - ** Test max token **");

			// get initial token balance
			const contractSend = new ethers.Contract(contractSendTokenAddress, abi, providerSend);
			const initial_balance_of_emit_token = await contractSend.balanceOf(signerSender.address);
			const contractReceive = new ethers.Contract(contractReceiveTokenAddress, abi, providerReceive);
			const initial_balance_of_receiver = await contractReceive.balanceOf(signerReceive);

			let amount = parseFloat(testToken.max);
			amount = amount * 2;
            let convertAmount = amount * testToken.conversionRateTokenBC1toTokenBC2; // Convertion rate

            // check token balances
			expect(initial_balance_of_emit_token.gt(ethers.utils.parseEther(amount.toString())), "❌ Sender not enough tokens !").to.be.true;
			expect(initial_balance_of_receiver.gt(ethers.utils.parseEther(convertAmount.toString())), "❌ Receiver not enough tokens !").to.be.true; // default convert = 1/1
			const initial_balance_of_receive_token = await contractReceive.balanceOf(signerSender.address);

			console.log("Sending:", amount.toString() + " " + fromTokenName + " ...");

			const transactionTx = await contractSend.connect(signerSender).transfer(signerReceive, ethers.utils.parseEther(amount.toString()));
			console.log("transactionTx: ", transactionTx.hash);
			console.log("Waiting transaction");
			await transactionTx.wait(1); // error on wait(1) => change rpc_url

			let new_balance_of_emit_token = await contractSend.balanceOf(signerSender.address);
			expect(new_balance_of_emit_token, "❌ Token balance unchanged !").to.lt(initial_balance_of_emit_token);

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

			const amount = ethers.utils.parseEther(testToken.min);
            let convertAmount = amount * testToken.conversionRateTokenBC1toTokenBC2; // Convertion rate

			// check token balances
			expect(initial_balance_of_emit_token.gt(ethers.BigNumber.from(amount)), "❌ Sender not enough tokens !").to.be.true;
			expect(initial_balance_of_receiver.gt(ethers.BigNumber.from(convertAmount)), "❌ Receiver not enough tokens !").to.be.true; //default convert = 1/1
			const initial_balance_of_receive_token = await contractReceive.balanceOf(signerSender.address);

			console.log("Sending:", amount.toString() + " " + fromTokenName + " ...");

			const transactionTx = await contractSend.connect(signerSender).transfer(signerReceive, amount);
			console.log("transactionTx: ", transactionTx.hash);
			console.log("Waiting transaction");
			await transactionTx.wait(1); // error on wait(1) => change rpc_url

			let new_balance_of_emit_token = await contractSend.balanceOf(signerSender.address);
			expect(new_balance_of_emit_token, "❌ Token balance unchanged !").to.lt(initial_balance_of_emit_token);

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

			const amount = ethers.utils.parseEther(testToken.minNoRefund);
            let convertAmount = amount * testToken.conversionRateTokenBC1toTokenBC2; // Convertion rate

			// check token balances
			expect(initial_balance_of_emit_token.gt(ethers.BigNumber.from(amount)), "❌ Sender not enough tokens !").to.be.true;
			expect(initial_balance_of_receiver.gt(ethers.BigNumber.from(convertAmount)), "❌ Receiver not enough tokens !").to.be.true; //default convert = 1/1
			const initial_balance_of_receive_token = await contractReceive.balanceOf(signerSender.address);

			console.log("Sending:", ethers.utils.formatEther(amount) + " " + fromTokenName + " ...");

			const transactionTx = await contractSend.connect(signerSender).transfer(signerReceive, amount);
			console.log("transactionTx: ", transactionTx.hash);
			console.log("Waiting transaction");
			await transactionTx.wait(1); // error on wait(1) => change rpc_url

			let new_balance_of_emit_token = await contractSend.balanceOf(signerSender.address);
			expect(new_balance_of_emit_token, "❌ Token balance unchanged !").to.lt(initial_balance_of_emit_token);

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
			expect(new_balance_of_emit_token, "❌ Refund !!").to.not.eq(initial_balance_of_emit_token);
			expect(new_balance_of_receive_token, "❌ Tokens received !!!").to.eq(initial_balance_of_receive_token);
			console.log("✅ Tokens NOT refunded");
		}).timeout(60000);
	});
});

// find Network by name
// networkList: list of the networks
// networkName: name of the network to find
// return: network index in network list or null on error
function findNetworkByName(networkList, networkName) {
	for (let i = 0; i < Object.keys(networkList).length; i++) {
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