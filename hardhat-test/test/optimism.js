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
const fromTokenName = "ETH (native)";
const toTokenName = "ETH (native)";

let loadedConfig = null;

let testNetwork = null; // network index to test
let testToken = null; // Token index to test

let providerSend = null; // provider source network
let providerReceive = null; // provider destination network

let signerReceive = null; // listener
let signerSender = null; // address who send token

const waitingTime = 1000;
const maxTime = 20;

let signer_balance = null;
let signer_receive_balance = null;
//let gasPrice = null;

const title = "*** Test native transfer from " + fromNetworkName + " to " + toNetworkName + " ***";
const stars = "*".repeat(title.length);

describe("\n" + stars + "\n" + title + "\n" + stars, function () {
	before(async function () {
		//console.log("before");

		// Check if daemon is running
		try {
			await fetch(serverAddress);
		} catch(error) {
			expect(true, "localhost Error, daemon not started !").to.be.false;
		}

		// Try to get json
		try {
            const response = await fetch(serverAddress + "json");
            if (!response.ok) {
                expect(true, "localhost Error loading configuration, Response status:",response.status).to.be.false;
            }
            loadedConfig = await response.json();
		} catch(error) {
			expect(true, "localhost Error, configuration not loaded !").to.be.false;
		}

		// Init variables
		testNetwork = findNetworkByName(loadedConfig.networks, toNetworkName);
		expect(testNetwork !== null, "Error network name not found !").to.be.true;

		const testTokenIndex = findTokenByName(loadedConfig.listeningNetwork.nativeTokens, toNetworkName);
		expect(testTokenIndex !== null, "Error listener for token name not found !").to.be.true;
		testToken = loadedConfig.listeningNetwork.nativeTokens[testTokenIndex];
		expect(testToken.activated === true, "Error token not activated !").to.be.true;

		// use the first entry of RPC_URL
		providerSend = new ethers.providers.JsonRpcProvider(loadedConfig.listeningNetwork.RPC_URLs[0].rpcurl); // sepolia
		providerReceive = new ethers.providers.JsonRpcProvider(loadedConfig.networks[testNetwork].RPC_URLs[0].rpcurl); // Arbitrum sepolia

		signerReceive = testToken.listeningAddress; // 0x962aC815B1249027Cfd80D6b0476C9090B5aeF39

		expect(process.env.Sepolia_PRIVATE_KEY, "Invalid private key !").to.be.a.properPrivateKey;
		signerSender = new ethers.Wallet(process.env.Sepolia_PRIVATE_KEY, providerSend);


		//if(gasPrice === null) gasPrice = await providerSend.getGasPrice(); // The gas price (in wei) return BigNumber
		//gasPrice = "400000000000";
		//gasPrice = 400000000000;
	});

	beforeEach(async function () {
		//console.log("beforeEach");

		// get and check initial network balance
		signer_balance = await providerSend.getBalance(signerSender.address); // balance sepolia  In Wei { BigNumber: "37426320346873870455" }
		signer_receive_balance = await providerReceive.getBalance(signerSender.address); // balance opsepolia
        // TODO getgascost
		expect((signer_balance.gt(ethers.BigNumber.from(ethers.utils.parseEther("0.1")))), "Sender Not enough network coins ["+fromNetworkName+"] !").to.be.true;
		expect((signer_receive_balance.gt(ethers.BigNumber.from(ethers.utils.parseEther("0.1")))), "Receiver Not enough network coins ["+toNetworkName+"] !").to.be.true;
	});

	describe("-- Test " + fromNetworkName + "/" + fromTokenName + " To " + toNetworkName + "/" + toTokenName + " --", function () {
		it("** Test transfert ETH **", async function () {
			console.log("      - ** Test transfert ETH **");

			let amount = ethers.utils.parseEther(testToken.min);
			amount = amount * 2;
			//console.log("Sending amount:", ethers.utils.formatEther(amount) + " " + toTokenName);

            // Convertion rate
			//console.log("Conversion rate:", testToken.conversionRateBC1toBC2);
            let convertAmount = amount * testToken.conversionRateBC1toBC2;
			//console.log("Receive amount:", ethers.utils.formatEther(BigInt(convertAmount)) + " " + toTokenName);

            // check balances
			expect(signer_balance.gt(ethers.BigNumber.from(amount)), "Sender not enough coins !").to.be.true;
			expect(signer_receive_balance.gt(ethers.BigNumber.from(convertAmount)), "Receiver not enough coins !").to.be.true; //default convert = 1/1

			console.log("Sending:", ethers.utils.formatEther(amount) + " " + fromTokenName + ", Receive:" + ethers.utils.formatEther(ethers.BigNumber.from(BigInt(convertAmount))) + " " + toTokenName + " ...");

			const transactionTx = await signerSender.sendTransaction({ to: signerReceive, value: amount });
			console.log("transactionTx: ", transactionTx.hash);
			console.log("Waiting transaction");
			await transactionTx.wait(1); // error on wait(1) => change rpc_url

			let new_signer_balance = await providerSend.getBalance(signerSender.address);
			expect(new_signer_balance, "Balance unchanged, transaction error (maybe rpc_url ?) !").to.lt(signer_balance);

			// wait for exchange or refund
			process.stdout.write("Waiting transfert ");
			let new_signer_receive_balance = 0;
			let i = 0;
			while (true) {
				await sleep(waitingTime);
				new_signer_receive_balance = await providerReceive.getBalance(signerSender.address);
				if (!new_signer_receive_balance.eq(signer_receive_balance)) break;
				new_signer_balance = await providerSend.getBalance(signerSender.address);
				if(new_signer_balance.eq(signer_balance)) break;
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
				expect(new_signer_balance, "❌ Refund !!").to.not.eq(signer_balance);
				expect(new_signer_receive_balance, "❌ No coins received !!!").to.gt(signer_receive_balance);
			}

            const totReceived = new_signer_receive_balance - signer_receive_balance;
            const totFees = amount - totReceived;
			console.log("✅ "+toTokenName+" received: " + ethers.utils.formatEther(totReceived) + ", fees: " + ethers.utils.formatEther(totFees));
		}).timeout(60000);

		xit("** Test max ETH **", async function () {
			console.log("      - ** Test max ETH **");

			let amount = ethers.BigNumber.from(ethers.utils.parseEther(testToken.max));
			amount = amount.add(ethers.BigNumber.from(ethers.utils.parseEther(testToken.min)));

			// check balances
			expect(signer_balance.gt(ethers.BigNumber.from(amount)), "Sender not enough coins !").to.be.true;
			expect(signer_receive_balance.gt(ethers.BigNumber.from(amount)), "Receiver not enough coins !").to.be.true; //default convert = 1/1

			console.log("Sending:", ethers.utils.formatEther(amount) + " " + toTokenName + " ...");

			const transactionTx = await contractSend.connect(signerSender).transfer(signerReceive, amount);
			console.log("transactionTx: ", transactionTx.hash);
			console.log("Waiting transaction");
			await transactionTx.wait(1); // error on wait(1) => change rpc_url

			let new_signer_balance_after_tx = await providerSend.getBalance(signerSender.address);
			expect(new_signer_balance_after_tx, "Balance unchanged, transaction error (maybe rpc_url ?) !").to.lt(signer_balance);

            // wait for exchange or refund
			process.stdout.write("Waiting transfert ");
			let new_signer_balance = 0;
			let new_signer_receive_balance = 0;
			let i = 0;
			while (true) {
				await sleep(waitingTime);
				new_signer_receive_balance = await providerReceive.getBalance(signerSender.address);
				if (!new_signer_receive_balance.eq(signer_receive_balance)) break;
				new_signer_balance = await providerSend.getBalance(signerSender.address);
				if(new_signer_balance.eq(signer_balance)) break;
				i++;
				if (i > maxTime) break;
				process.stdout.write(".");
			}
			console.log("");

			// ok/error
			if (i > maxTime) {
				expect(true, "Error max waiting time !").to.be.false;
			}
			else {
				expect(new_signer_balance.lte(signer_balance) && new_signer_balance.gt(new_signer_balance_after_tx), "❌ No Refund !!").to.be.true;
				expect(new_signer_receive_balance, "❌ Tokens received !!!").to.eq(signer_receive_balance);
			}
            const totFees = signer_balance - new_signer_balance;
			console.log("✅ "+toTokenName+" refunded, fees: " + ethers.utils.formatEther(totFees));
		}).timeout(60000);

		xit("** Test min ETH **", async function () {
			console.log("      - ** Test min ETH **");

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
				expect(true, "Error max waiting time !").to.be.false;
			}
			else {
				expect(new_balance_of_emit_token, "No Refund !!").to.eq(initial_balance_of_emit_token);
				expect(new_balance_of_receive_token, "Tokens received !!!").to.eq(initial_balance_of_receive_token);
			}
			console.log("✔ Tokens refunded");
		}).timeout(60000);

		xit("** Test minNoRefund ETH **", async function () {
			console.log("      - ** Test minNoRefund ETH **");

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
				expect(true, "Error max waiting time !").to.be.true;
			}
			else {
				expect(new_balance_of_emit_token, "Refund !!").to.not.eq(initial_balance_of_emit_token);
				expect(new_balance_of_receive_token, "Tokens received !!!").to.eq(initial_balance_of_receive_token);
			}
			console.log("✔ Tokens NOT refunded");
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
function findTokenByName(tokenList, networkName) {
	for (let i = 0; i < tokenList.length; i++) {
		if (tokenList[i].toNetwork === networkName) {
			return i;
		}
	}
	return null;
}

// sleep time expects milliseconds
async function sleep (time) {
	return new Promise((resolve) => setTimeout(resolve, time));
}