const ethers = require('ethers');
require('dotenv').config()
const { expect } = require("chai");

const serverAddress = "http://localhost:3001/";

const abi = [
	"function decimals() view returns(uint)",
	"function balanceOf(address) view returns(uint)",
	"function transfer(address to, uint amount) returns(bool)"
];

const fromNetworkName = "Sepolia";
const toNetworkName = "Optimism Sepolia";
const fromTokenName = "USDC";
const toTokenName = "USDC";

let loadedConfig = null;

let testNetwork = null; // network index to test
let testToken = null; // Token index to test

let providerSend = null; // source network
let providerReceive = null; // destination network
let contractSendTokenAddress = null; // source token
let contractReceiveTokenAddress = null; // destination token
let contractSend =  null;
let contractReceive =  null;
let contract_decimals = 6; // default value for decimals, USDC: 6

let signerReceive = null; // listener
let signerSender = null; // address who send token

const waitingTime = 1000;
const maxTime = 20;

let signer_balance = null;
let signer_receive_balance = null;
let initial_balance_of_emit_token = null;
let initial_balance_of_receiver = null;
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

		contractSendTokenAddress = testToken.tokenContractAddress; // sepolia/USDC
		contractReceiveTokenAddress = testToken.toTokenContractAddress; // optimism sepolia/USDC
        contractSend = new ethers.Contract(contractSendTokenAddress, abi, providerSend);
        contractReceive = new ethers.Contract(contractReceiveTokenAddress, abi, providerReceive);

        try {
            contract_decimals = await contractSend.decimals();
            contract_decimals = contract_decimals.toNumber();
        } catch(error) {
            console.error('⚠️  Warning can not get decimals for token, set to default (6 for USDC)');
            console.error("⚠️  Error:", error);
        }

		signerReceive = testToken.listeningAddress;

		expect(process.env.Sepolia_PRIVATE_KEY, "❌ Invalid private key !").to.be.a.properPrivateKey;
		signerSender = new ethers.Wallet(process.env.Sepolia_PRIVATE_KEY, providerSend);


		//if(gasPrice === null) gasPrice = await providerSend.getGasPrice(); // The gas price (in wei) return BigNumber
		//gasPrice = "400000000000";
		//gasPrice = 400000000000;
	});

	beforeEach(async function () {
		//console.log("beforeEach");

		// get initial network balance
        signer_balance = await providerSend.getBalance(signerSender.address); // balance In Wei { BigNumber: "37426320346873870455" }
        signer_receive_balance = await providerReceive.getBalance(signerReceive);
        // get initial token balance
        initial_balance_of_emit_token = await contractSend.balanceOf(signerSender.address);
        initial_balance_of_receiver = await contractReceive.balanceOf(signerReceive);

		// check initial network balance
        expect((signer_balance.gt(ethers.BigNumber.from(ethers.utils.parseEther("0.1")))), "❌ Sender Not enough network coins [" + fromNetworkName + "] !").to.be.true;
        expect((signer_receive_balance.gt(ethers.BigNumber.from(ethers.utils.parseEther("0.1")))), "❌ Receiver Not enough network coins [" + toNetworkName + "] !").to.be.true;
	});

	describe("-- Test token " + fromNetworkName + "/" + fromTokenName + " To " + toNetworkName + "/" + toTokenName + " --", function () {
		xit("** Test transfert token **", async function () {
			console.log("      - ** Test transfert token **");

            const result = await sendToken(parseFloat("1.0"));

            if(result.error === 1 ) expect(true, "❌ Error max waiting time !").to.be.false;
            if(result.error === 2 ) expect(true, "❌ Refund !!").to.be.false;
            if(result.error === 3 ) expect(true, "❌ No tokens received !!!").to.be.false;

            console.log("✅ " + toTokenName + " received: " + ethers.utils.formatUnits(result.totReceived, contract_decimals) + ", fees: " + ethers.utils.formatUnits(result.totFees, contract_decimals));

        }).timeout(60000);

        xit("** Test max token **", async function () {
			console.log("      - ** Test max token **");

            const result = await sendToken(parseFloat(testToken.max) * 2);

            if(result.error === 1 ) expect(true, "❌ Error max waiting time !").to.be.false;
            if(result.error === 0 ) expect(true, "❌ Tokens received !!").to.be.false;
            if(result.error === 3 ) expect(true, "❌ No Refund !!!").to.be.false;

			console.log("✅ Tokens refunded");

        }).timeout(60000);

        xit("** Test min token **", async function () {
			console.log("      - ** Test min token **");

            const result = await sendToken(parseFloat(testToken.min));

            if(result.error === 1 ) expect(true, "❌ Error max waiting time !").to.be.false;
            if(result.error === 0 ) expect(true, "❌ Tokens received !!").to.be.false;
            if(result.error === 3 ) expect(true, "❌ No Refund !!!").to.be.false;

			console.log("✅ Tokens refunded");

        }).timeout(60000);

		xit("** Test minNoRefund token **", async function () {
			console.log("      - ** Test minNoRefund token **");

            const result = await sendToken(parseFloat(testToken.minNoRefund));

            if(result.error === 0 ) expect(true, "❌ Tokens received !!").to.be.false;
            if(result.error === 2 ) expect(true, "❌ Refund !!").to.be.false;

			console.log("✅ Tokens NOT refunded");

		}).timeout(60000);
	});
});

// send transaction
// amount: amount to be send by the sender
// return: object {error, totReceived, totFees}
async function sendToken(amount) {
    //console.log("-- sendToken --");
    let convertAmount = amount * testToken.conversionRateTokenBC1toTokenBC2; // Convertion rate

    const initial_balance_of_emit_token_wei = ethers.utils.parseEther(ethers.utils.formatUnits(initial_balance_of_emit_token, contract_decimals));
    const initial_balance_of_receiver_wei = ethers.utils.parseEther(ethers.utils.formatUnits(initial_balance_of_receiver, contract_decimals));

    // check token balances
    expect(initial_balance_of_emit_token_wei.gt(ethers.utils.parseEther(amount.toString())), "❌ Sender not enough tokens !").to.be.true;
    expect(initial_balance_of_receiver_wei.gt(ethers.utils.parseEther(convertAmount.toString())), "❌ Receiver not enough tokens !").to.be.true;
    const initial_balance_of_receive_token = await contractReceive.balanceOf(signerSender.address);

    console.log("Sending: "+ amount.toString() + " " + fromTokenName + ", Receive: " + convertAmount.toString() + " " + toTokenName + " ...");

    const transactionTx = await contractSend.connect(signerSender).transfer(signerReceive, ethers.utils.parseUnits(amount.toString(),contract_decimals));
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

    let totReceived = new_balance_of_receive_token - initial_balance_of_receive_token;
    totReceived = ethers.utils.parseUnits(ethers.utils.formatUnits(totReceived, contract_decimals), contract_decimals);
    convertAmount = ethers.utils.parseUnits(convertAmount.toString(), contract_decimals);
    const totFees = convertAmount.sub(totReceived);

    result = {};
    result.totReceived = totReceived;
    result.totFees = totFees;

    if (i > maxTime) {
        result.error = 1; // max waiting time
        return result;
    }
    if(new_balance_of_emit_token.eq(initial_balance_of_emit_token)) {
        result.error = 2; // Refund
        return result;
    }
    if(new_balance_of_receive_token.lte(initial_balance_of_receive_token)) {
        result.error = 3; // No tokens received
        return result;
    }
    result.error = 0; // Tokens received
    return result;
}

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