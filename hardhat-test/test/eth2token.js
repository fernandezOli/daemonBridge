const ethers = require('ethers');
require('dotenv').config()
const { expect } = require("chai");

const serverAddress = "http://localhost:3001/";

const fromNetworkName = "Sepolia";
const toNetworkName = "Optimism Sepolia";
const fromTokenName = "ETH";
const toTokenName = "USDC";
let userTest = 1; // 0 - all tests, 1 - transfert test only, 2 - max test only, 3 - min test only, 4 - minNoRefund test only, 5 - no tests

const abi = [
	"function decimals() view returns(uint)",
	"function balanceOf(address) view returns(uint)",
	"function transfer(address to, uint amount) returns(bool)"
];

let loadedConfig = null;

let networkId = null; // network index to test
let toNetworkId = null; // destination network index
let testToken = null; // Token to test

let providerSend = null; // provider source network
let providerReceive = null; // provider destination network
let contractReceiveTokenAddress = null; // destination token
let contractReceive =  null;
let contractReceiveDecimals = 18; // destination token decimals

let signerReceive = null; // listener
let signerSender = null; // address who send token

const waitingTime = 1000;
const maxTime = 20;

let signer_balance = null;
let signer_receive_balance = null;
//let receiver_balance = null;
let initial_balance_of_receiver = null;
//let gasPrice = null;

const title = "*** Test native to token transfer from " + fromNetworkName + " to " + toNetworkName + " ***";
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
        networkId = findNetworkByName(loadedConfig.networks, fromNetworkName);
		expect(networkId !== null, "❌ Error network name not found: " + fromNetworkName + " !").to.be.true;

		toNetworkId = findNetworkByName(loadedConfig.networks, toNetworkName);
		expect(toNetworkId !== null, "❌ Error network name not found !").to.be.true;

        const testTokenIndex = findTokenByName(loadedConfig.listeningNetwork.nativeTokens, toNetworkName, toTokenName);
		expect(testTokenIndex !== null, "❌ Error listener for token name not found !").to.be.true;
		testToken = loadedConfig.listeningNetwork.nativeTokens[testTokenIndex];
		expect(testToken.activated === true, "❌ Error token not activated !").to.be.true;
        //console.log('testToken:',testToken);

        providerSend = await getValidProvider(loadedConfig.networks[networkId], true);
        if (providerSend === null) throw '❌ No valid RPC_URL found for network: ' + fromNetworkName;

        providerReceive = await getValidProvider(loadedConfig.networks[toNetworkId], true);
        if (providerReceive === null) throw '❌ No valid RPC_URL found for network: ' + toNetworkName;

		contractReceiveTokenAddress = testToken.toTokenContractAddress;
        contractReceive = new ethers.Contract(contractReceiveTokenAddress, abi, providerReceive);
		contractReceiveDecimals = testToken.toTokenDecimals;

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
		signer_balance = await providerSend.getBalance(signerSender.address);
		signer_receive_balance = await providerReceive.getBalance(signerReceive);
        initial_balance_of_receiver = await contractReceive.balanceOf(signerReceive);

		// check initial network balance
		expect((signer_balance.gt(ethers.BigNumber.from(ethers.utils.parseEther("0.1")))), "❌ Sender Not enough network coins ["+fromNetworkName+"] to pay fees !").to.be.true;
		expect((signer_receive_balance.gt(ethers.BigNumber.from(ethers.utils.parseEther("0.1")))), "❌ Receiver Not enough network coins ["+toNetworkName+"] to pay fees !").to.be.true;
	});

	describe("-- Test " + fromNetworkName + "/" + fromTokenName + " To " + toNetworkName + "/" + toTokenName + " --", function () {
		if (userTest === 0 || userTest === 1) it("** Test transfert ETH **", async function () {
			console.log("      - ** Test transfert ETH **");

            const result = await sendToken(parseFloat("0.1"));

            if(result.error === 1 ) expect(true, "❌ Error max waiting time !").to.be.false;
            if(result.error === 2 ) expect(true, "❌ Refund !!").to.be.false;
            if(result.error === 3 ) expect(true, "❌ No tokens received !!!").to.be.false;

            console.log("✅ " + toTokenName + " received: " + ethers.utils.formatUnits(result.totReceived, contractReceiveDecimals) + ", fees: " + ethers.utils.formatUnits(result.totFees, contractReceiveDecimals));
		}).timeout(60000);

		if (userTest === 0 || userTest === 2) it("** Test max ETH **", async function () {
			console.log("      - ** Test max ETH **");

            const result = await sendToken(parseFloat(testToken.max) * 2);

            if(result.error === 1 ) expect(true, "❌ Error max waiting time !").to.be.false;
            if(result.error === 0 ) expect(true, "❌ Tokens received !!").to.be.false;
            if(result.error === 3 ) expect(true, "❌ No Refund !!!").to.be.false;

			console.log("✅ Tokens refunded");
		}).timeout(60000);

		if (userTest === 0 || userTest === 3) it("** Test min ETH **", async function () {
			console.log("      - ** Test min ETH **");

            const result = await sendToken(parseFloat(testToken.min));

            if(result.error === 1 ) expect(true, "❌ Error max waiting time !").to.be.false;
            if(result.error === 0 ) expect(true, "❌ Tokens received !!").to.be.false;
            if(result.error === 3 ) expect(true, "❌ No Refund !!!").to.be.false;

			console.log("✅ " + fromTokenName + " refunded");
		}).timeout(60000);

		if (userTest === 0 || userTest === 4) it("** Test minNoRefund ETH **", async function () {
			console.log("      - ** Test minNoRefund ETH **");

            const result = await sendToken(parseFloat(testToken.minNoRefund));

            if(result.error === 0 ) expect(true, "❌ Tokens received !!").to.be.false;
            if(result.error === 2 ) expect(true, "❌ Refund !!!").to.be.false;

			console.log("✅ Tokens NOT refunded");
		}).timeout(60000);
	});
});

// send transaction
// amount: amount to be send by the sender
// return: object {error, totReceived, totFees}
async function sendToken(amount) {
    let convertAmount = amount * testToken.conversionRateTokenBC1toTokenBC2; // Convertion rate

    const initial_balance_of_receiver_wei = ethers.utils.parseEther(ethers.utils.formatUnits(initial_balance_of_receiver, contractReceiveDecimals));

    // check balances
    expect(signer_balance.gt(ethers.utils.parseEther(amount.toString())), "❌ Sender not enough coins !").to.be.true;
    expect(initial_balance_of_receiver_wei.gt(ethers.utils.parseEther(convertAmount.toString())), "❌ Receiver not enough tokens !").to.be.true;

    const initial_balance_of_receive_token = await contractReceive.balanceOf(signerSender.address);

    console.log("Sending: "+ amount.toString() + " " + fromTokenName + ", Receive: " + convertAmount.toString() + " " + toTokenName + " ...");

    const transactionTx = await signerSender.sendTransaction({ to: signerReceive, value: ethers.utils.parseEther(amount.toString()) });
    console.log("transactionTx: ", transactionTx.hash);
    console.log("Waiting transaction");
    await transactionTx.wait(1); // error on wait(1) => change rpc_url

    let new_signer_balance = await providerSend.getBalance(signerSender.address);
    expect(new_signer_balance, "❌ Balance unchanged, transaction error (maybe rpc_url ?)").to.lt(signer_balance);

    // wait for exchange or refund
    process.stdout.write("Waiting transfert ");
    let new_balance_of_receive_token = 0;
    let new_signer_balance_2 = ethers.BigNumber.from(0);
    let i = 0;
    while (true) {
        await sleep(waitingTime);
        new_balance_of_receive_token = await contractReceive.balanceOf(signerSender.address);
        if (!new_balance_of_receive_token.eq(initial_balance_of_receive_token)) break;
        new_signer_balance_2 = await providerSend.getBalance(signerSender.address);
        if(new_signer_balance_2.gt(new_signer_balance)) break;
        i++;
        if (i > maxTime) break;
        process.stdout.write(".");
    }
    console.log("");

    let totReceived = new_balance_of_receive_token - initial_balance_of_receive_token;
    totReceived = ethers.utils.parseUnits(ethers.utils.formatUnits(totReceived.toString(), contractReceiveDecimals), contractReceiveDecimals);
    convertAmount = ethers.utils.parseUnits(convertAmount.toString(), contractReceiveDecimals);
    const totFees = convertAmount.sub(totReceived);

    result = {};
    result.totReceived = totReceived;
    result.totFees = totFees;

    if (i > maxTime) {
        result.error = 1; // max waiting time
        return result;
    }
    if(new_signer_balance_2.gt(new_signer_balance)) {
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
// toToken: name of the to token to find
// return: token index in token list or null on error
function findTokenByName(tokenList, networkName, toToken) {
	for (let i = 0; i < tokenList.length; i++) {
		if (tokenList[i].toNetwork === networkName && tokenList[i].toToken === toToken) {
			return i;
		}
	}
	return null;
}

// get valid provider for network
// _network: network object from config
// noApi: try to use provider with api key if false
// return: provider object or null on error
async function getValidProvider(_network, noApi) {
    let providerUrl = null;
    let networkUrlList = _network.RPC_URLs;
    let _networkName = _network.networkName;
    let _chainId = _network.chainId;

    for (let i = 0; i < networkUrlList.length; i++) {
        try {
            providerUrl = null;
            let url = networkUrlList[i].rpcurl;
            if(noApi && networkUrlList[i].apikey !== "") continue;
            let _apiKey = networkUrlList[i].apikey !== ""?process.env[networkUrlList[i].apikey]:"";

            switch (networkUrlList[i].type) {
                case 'ETHERSCAN':
                    providerUrl = new ethers.providers.EtherscanProvider(_chainId, _apiKey);
                    break;
                case 'INFURA':
                    providerUrl = new ethers.providers.InfuraProvider(_chainId, _apiKey);
                    break;
                case 'STATIC':
                    providerUrl = new ethers.providers.StaticJsonRpcProvider({ url: url + _apiKey, timeout: 20000 });
                    break;
                case '':
                default:
                    providerUrl = new ethers.providers.JsonRpcProvider({ url: url + _apiKey, timeout: 20000 });
            }
            if (providerUrl === null || providerUrl === undefined) continue;

            // Check chainId
            try {
                const chainId = parseInt(await providerUrl.send("eth_chainId", []),16);
                if (chainId !== _chainId) {
                    console.error("⚠️ Warning invalid provider chainId for " + _networkName + " chainId found:" + chainId + ", config:" + _chainId);
                    providerUrl = null;
                    continue;
                }
            } catch (error) {
                providerUrl = null;
                if (error.code === "NETWORK_ERROR" || error.code === "TIMEOUT") {
                    continue;
                }
                if (error.code === "SERVER_ERROR") {
                    if (error.body !== undefined && error.body !== null) {
                        let errBody = JSON.parse(error.body);
                        console.error("⚠️ Error getValidProvider (" + url + "): ", errBody.error.message);
                    }
                    else console.error("⚠️ Error getValidProvider (" + url + "): ", error);
                    continue;
                }
                console.error("❌ Error getValidProvider on: ", _networkName);
                console.error("❌ Error getValidProvider (eth_chainId): ", error);
                continue;
            }

            return providerUrl;
        } catch (error) {
            console.error("❌ Error getValidProvider: ", error);
            continue;
        }
    }
    console.error("❌ Error getValidProvider, no valid provider found !");
    return null;
}

// sleep time expects milliseconds
async function sleep (time) {
	return new Promise((resolve) => setTimeout(resolve, time));
}