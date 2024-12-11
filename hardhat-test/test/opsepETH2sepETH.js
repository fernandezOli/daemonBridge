const ethers = require('ethers');
require('dotenv').config()
const { expect } = require("chai");

const serverAddress = "http://localhost:3001/";

const fromNetworkName = "Optimism Sepolia";
const toNetworkName = "Sepolia";
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

		const testTokenIndex = findTokenByName(loadedConfig.listeningNetwork.nativeTokens, toNetworkName);
		expect(testTokenIndex !== null, "❌ Error listener for token name not found !").to.be.true;
		testToken = loadedConfig.listeningNetwork.nativeTokens[testTokenIndex];
		expect(testToken.activated === true, "❌ Error token not activated !").to.be.true;

		// use the first entry of RPC_URL
		providerSend = new ethers.providers.JsonRpcProvider(loadedConfig.listeningNetwork.RPC_URLs[0].rpcurl); // sepolia
		providerReceive = new ethers.providers.JsonRpcProvider(loadedConfig.networks[testNetwork].RPC_URLs[0].rpcurl); // Optimism Sepolia

		signerReceive = testToken.listeningAddress; // 0x962aC815B1249027Cfd80D6b0476C9090B5aeF39

		expect(process.env.Sepolia_PRIVATE_KEY, "❌ Invalid private key !").to.be.a.properPrivateKey;
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
		receiver_balance = await providerReceive.getBalance(signerReceive); // balance opsepolia receiver
        // TODO getgascost
		expect((signer_balance.gt(ethers.BigNumber.from(ethers.utils.parseEther("0.1")))), "❌ Sender Not enough network coins ["+fromNetworkName+"] to pay fees !").to.be.true;
		expect((receiver_balance.gt(ethers.BigNumber.from(ethers.utils.parseEther("0.1")))), "❌ Receiver Not enough network coins ["+toNetworkName+"] to pay fees !").to.be.true;
	});

	describe("-- Test " + fromNetworkName + "/" + fromTokenName + " To " + toNetworkName + "/" + toTokenName + " --", function () {
		it("** Test transfert ETH **", async function () {
			console.log("      - ** Test transfert ETH **");

			let amount = parseFloat("1.0");
            let convertAmount = amount * testToken.conversionRateBC1toBC2; // Convertion rate

            // check balances
			expect(signer_balance.gt(ethers.utils.parseEther(amount.toString())), "❌ Sender not enough coins !").to.be.true;
			expect(receiver_balance.gt(ethers.utils.parseEther(convertAmount.toString())), "❌ Receiver not enough coins !").to.be.true;

            console.log("Sending: "+ amount.toString() + " " + fromTokenName + ", Receive: " + convertAmount.toString() + " " + toTokenName + " ...");

			const transactionTx = await signerSender.sendTransaction({ to: signerReceive, value: ethers.utils.parseEther(amount.toString()) });
			console.log("transactionTx: ", transactionTx.hash);
			console.log("Waiting transaction");
			await transactionTx.wait(1); // error on wait(1) => change rpc_url

			let new_signer_balance = await providerSend.getBalance(signerSender.address);
			expect(new_signer_balance, "❌ Balance unchanged, transaction error (maybe rpc_url ?)").to.lt(signer_balance);

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
            const totFees = ethers.utils.parseEther(convertAmount.toString()).toBigInt() - BigInt(totReceived);
            console.log("✅ " + toTokenName + " received: " + ethers.utils.formatEther(totReceived.toString()) + ", fees: " + ethers.utils.formatEther(totFees.toString()));
		}).timeout(60000);

		xit("** Test max ETH **", async function () {
			console.log("      - ** Test max ETH **");

			let amount = parseFloat(testToken.max);
			amount = amount * 2;
            let convertAmount = amount * testToken.conversionRateBC1toBC2; // Convertion rate

			// check balances
            expect(signer_balance.gt(ethers.utils.parseEther(amount.toString())), "❌ Sender not enough coins !").to.be.true;
			expect(receiver_balance.gt(ethers.utils.parseEther(convertAmount.toString())), "❌ Receiver not enough coins !").to.be.true;

			console.log("Sending:", amount.toString() + " " + fromTokenName + " ...");

			const transactionTx = await signerSender.sendTransaction({ to: signerReceive, value: ethers.utils.parseEther(amount.toString()) });
			console.log("transactionTx: ", transactionTx.hash);
			console.log("Waiting transaction");
			await transactionTx.wait(1); // error on wait(1) => change rpc_url

			let new_signer_balance_after_tx = await providerSend.getBalance(signerSender.address);
			expect(new_signer_balance_after_tx, "❌ Balance unchanged, transaction error (maybe rpc_url ?) !").to.lt(signer_balance);

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
				if(new_signer_balance.gt(new_signer_balance_after_tx)) break;
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
				expect(new_signer_balance.lte(signer_balance) && new_signer_balance.gt(new_signer_balance_after_tx), "❌ No Refund !!").to.be.true;
				expect(new_signer_receive_balance, "❌ " + fromTokenName + " received !!!").to.eq(signer_receive_balance);
			}
			console.log("✅ " + fromTokenName + " refunded");
            //const totFees = signer_balance - new_signer_balance;
			//console.log("✅ " + fromTokenName + " refunded, fees: " + ethers.utils.formatEther(totFees));
		}).timeout(60000);

		xit("** Test min ETH **", async function () {
			console.log("      - ** Test min ETH **");

			const amount = ethers.utils.parseEther(testToken.min);
            let convertAmount = amount * testToken.conversionRateBC1toBC2; // Convertion rate

			// check token balances
            expect(signer_balance.gt(amount), "❌ Sender not enough coins !").to.be.true;
			expect(receiver_balance.gt(ethers.BigNumber.from(convertAmount)), "❌ Receiver not enough coins !").to.be.true;

			console.log("Sending:", ethers.utils.formatEther(amount) + " " + fromTokenName + " ...");

            const transactionTx = await signerSender.sendTransaction({ to: signerReceive, value: amount });
			console.log("transactionTx: ", transactionTx.hash);
			console.log("Waiting transaction");
			await transactionTx.wait(1); // error on wait(1) => change rpc_url

			let new_signer_balance_after_tx = await providerSend.getBalance(signerSender.address);
			expect(new_signer_balance_after_tx, "❌ Balance unchanged, transaction error (maybe rpc_url ?) !").to.lt(signer_balance);

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
				if(new_signer_balance.gt(new_signer_balance_after_tx)) break;
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
				expect(new_signer_balance.lte(signer_balance) && new_signer_balance.gt(new_signer_balance_after_tx), "❌ No Refund !!").to.be.true;
				expect(new_signer_receive_balance, "❌ " + fromTokenName + " received !!!").to.eq(signer_receive_balance);
			}
			console.log("✅ " + fromTokenName + " refunded");
		}).timeout(60000);

		xit("** Test minNoRefund ETH **", async function () {
			console.log("      - ** Test minNoRefund ETH **");

			const amount = ethers.utils.parseEther(testToken.minNoRefund);
            let convertAmount = amount * testToken.conversionRateBC1toBC2; // Convertion rate

			// check token balances
            expect(signer_balance.gt(amount), "❌ Sender not enough coins !").to.be.true;
			expect(receiver_balance.gt(ethers.BigNumber.from(convertAmount)), "❌ Receiver not enough coins !").to.be.true;

			console.log("Sending:", ethers.utils.formatEther(amount) + " " + fromTokenName + " ...");

            const transactionTx = await signerSender.sendTransaction({ to: signerReceive, value: amount });
			console.log("transactionTx: ", transactionTx.hash);
			console.log("Waiting transaction");
			await transactionTx.wait(1); // error on wait(1) => change rpc_url

			let new_signer_balance_after_tx = await providerSend.getBalance(signerSender.address);
			expect(new_signer_balance_after_tx, "❌ Balance unchanged, transaction error (maybe rpc_url ?) !").to.lt(signer_balance);

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
				if(new_signer_balance.gt(new_signer_balance_after_tx)) break;
				i++;
				if (i > maxTime) break;
				process.stdout.write(".");
			}
			console.log("");

			// ok/error
			expect(new_signer_receive_balance, "❌ " + fromTokenName + " received !!!").to.eq(signer_receive_balance);
			if (i > maxTime) console.log("✅ " + fromTokenName + " Tokens NOT refunded");
            else expect(true, "❌ Unknown Error !").to.be.false;
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