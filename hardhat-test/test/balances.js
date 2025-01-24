const ethers = require('ethers');
require('dotenv').config()
const { expect } = require("chai");

const daemonAddress = "http://localhost:3001/";
const fromNetworkName = "Sepolia";
let userTest = 0; // 0 - all tests, 1 - sender only, 2 - listeners only, 3 - no tests

const abi = [
	"function decimals() view returns(uint)",
	"function balanceOf(address) view returns(uint)",
	"function transfer(address to, uint amount) returns(bool)"
];

let loadedConfig = null;

let networkId = null;

let providerSend = null; // source network
let providerReceive = null; // destination network
let contractSend =  null;

let signerSender = null; // address who send token

const title = "*** Test sender and listeners balances ***";
const stars = "*".repeat(title.length);

describe("\n" + stars + "\n" + title + "\n" + stars, function () {
    before(async function () {
		//console.log("before");

        // check if daemon is running
		try {
			await fetch(daemonAddress);
		} catch(error) {
			expect(true, "❌ localhost Error, daemon not started !").to.be.false;
		}

		// Try to get json
		try {
            const response = await fetch(daemonAddress + "json");
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

        providerSend = await getValidProvider(loadedConfig.networks[networkId], true);
        if (providerSend === null) throw '❌ No valid RPC_URL found for network: ' + fromNetworkName;
	});

	describe("-- Balances --", function () {
        if (userTest === 0 || userTest === 1) it("** get/check sender balances **", async function () {

            expect(process.env.Sepolia_PRIVATE_KEY, "❌ Invalid private key !").to.be.a.properPrivateKey;
            signerSender = new ethers.Wallet(process.env.Sepolia_PRIVATE_KEY, providerSend);
            console.log("Sender: ", signerSender.address);

            let _balance = await providerSend.getBalance(signerSender.address);
            const minBalance = ethers.utils.parseEther("1.0");
            let tokenNameList = [];
            console.log((_balance > minBalance?"✅ ":"❌ ") + "Network: " + fromNetworkName + ", Token: ETH" + ", Balance: " + ethers.utils.formatEther(_balance));
            for (let i = 0; i < loadedConfig.tokensList.length; i++) {
                let _testToken = loadedConfig.tokensList[i];
                if (tokenNameList[_testToken.tokenName] !== undefined) continue;
                tokenNameList[_testToken.tokenName] = true;
                contractSend = new ethers.Contract(_testToken.tokenContractAddress, abi, providerSend);
                _balance = await contractSend.balanceOf(signerSender.address);
                if (_testToken.tokenDecimals !== 18) _balance = ethers.utils.formatUnits(_balance, _testToken.tokenDecimals)
                else _balance = ethers.utils.formatEther(_balance)
                console.log((_balance > minBalance?"✅ ":"❌ ") + "Network: " + fromNetworkName + ", Token: " + _testToken.tokenName + ", Balance: " + _balance);
            }
        }).timeout(60000);

        if (userTest === 0 || userTest === 2) it("** get/check listeners balances **", async function () {
            console.log("");

            // extract listeners
            let listeners = [];
            let _balance = 0;
            for (let i = 0; i < loadedConfig.listeningNetwork.nativeTokens.length; i++) {
                let _testToken = loadedConfig.listeningNetwork.nativeTokens[i];
                _balance = 0;
                if (listeners[_testToken.listeningAddress] === undefined) {
                    listeners[_testToken.listeningAddress] = [];
                    _balance = await providerSend.getBalance(_testToken.listeningAddress);
                    listeners[_testToken.listeningAddress].push({ network: fromNetworkName, token: "ETH", balance: ethers.utils.formatEther(_balance) });
                }

                let netId = findNetworkByChainId(loadedConfig.networks, _testToken.toNetworkChainId);
                providerReceive = await getValidProvider(loadedConfig.networks[netId], true);
                if (providerReceive === null) continue;

                if (_testToken.toToken !== undefined) {
                    contractSend = new ethers.Contract(_testToken.toTokenContractAddress, abi, providerReceive);
                    _balance = await contractSend.balanceOf(_testToken.listeningAddress);
                    if (_testToken.toTokenDecimals !== 18) _balance = ethers.utils.formatUnits(_balance, _testToken.toTokenDecimals)
                    else _balance = ethers.utils.formatEther(_balance)
                    listeners[_testToken.listeningAddress].push({ network: _testToken.toNetwork, token: _testToken.toToken, balance: _balance });
                }
                else {
                    _balance = await providerReceive.getBalance(_testToken.listeningAddress);
                    listeners[_testToken.listeningAddress].push({ network: _testToken.toNetwork, token: "ETH", balance: ethers.utils.formatEther(_balance) });
                }
            }

            for (let i = 0; i < loadedConfig.tokensList.length; i++) {
                let _testToken = loadedConfig.tokensList[i];
                _balance = 0;

                if (listeners[_testToken.listeningAddress] === undefined) {
                    listeners[_testToken.listeningAddress] = [];
                    _balance = await providerSend.getBalance(_testToken.listeningAddress);
                    listeners[_testToken.listeningAddress].push({ network: fromNetworkName, token: "ETH", balance: ethers.utils.formatEther(_balance) });
                }

                let netId = findNetworkByChainId(loadedConfig.networks, _testToken.toNetworkChainId);
                providerReceive = await getValidProvider(loadedConfig.networks[netId], true);
                if (providerReceive === null) continue;

                if (_testToken.toToken !== undefined) {
                    contractSend = new ethers.Contract(_testToken.toTokenContractAddress, abi, providerReceive);
                    _balance = await contractSend.balanceOf(_testToken.listeningAddress);
                    if (_testToken.toTokenDecimals !== 18) _balance = ethers.utils.formatUnits(_balance, _testToken.toTokenDecimals)
                    else _balance = ethers.utils.formatEther(_balance)
                    listeners[_testToken.listeningAddress].push({ network: _testToken.toNetwork, token: _testToken.toToken, balance: _balance });
                }
                else {
                    _balance = await providerReceive.getBalance(_testToken.listeningAddress);
                    listeners[_testToken.listeningAddress].push({ network: _testToken.toNetwork, token: "ETH", balance: ethers.utils.formatEther(_balance) });
                }
            }

            for (const property in listeners) {
                console.log("Listener: " + property);
                for (let i = 0; i < listeners[property].length; i++) {
                    console.log("-- Network: " + listeners[property][i].network + ", Token: " + listeners[property][i].token + ", Balance: " + listeners[property][i].balance);
                }
            }
            console.log("");
        }).timeout(60000);
	});
});


// find Network by chainId
// chainId: chainId of the network to find (int)
// return: network index in network list or null on error
function findNetworkByChainId(networkList, chainId) {
    //console.log("-- findNetworkByChainId --");
	for (let i = 0; i < Object.keys(networkList).length; i++) {
		if (networkList[i].chainId === chainId) {
			return i;
		}
    }
    return null;
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
