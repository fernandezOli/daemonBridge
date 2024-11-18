const ethers = require('ethers');
//const { time, loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { expect } = require("chai");
require('dotenv').config()

// import ../config/config.json

const providerSend = new ethers.providers.JsonRpcProvider("https://rpc2.sepolia.org");
const providerReceive = new ethers.providers.JsonRpcProvider("https://sepolia.optimism.io");

const signer = new ethers.Wallet(process.env.Sepolia_PRIVATE_KEY, providerSend);

const abi = [
	"function balanceOf(address) view returns(uint)",
	"function transfer(address to, uint amount) returns(bool)",
];

const waitingTime = 1000;
const maxTime = 20;

describe("test Sepolia optimism", function () {
    it("send token", async function () {
		// check if daemon is running
		try {
			await fetch(`http://localhost:3000/`);
		} catch(error) {
			expect(true, "localhost Error, daemon not started !").to.be.false;
		}

		// get initial balance of receive token
		const contractSend = new ethers.Contract("0x779877A7B0D9E8603169DdbD7836e478b4624789", abi, providerSend); // sepolia link
		const initial_balance_of_emit_token = await contractSend.balanceOf(signer.address);

		const contractReceive = new ethers.Contract("0xE4aB69C077896252FAFBD49EFD26B5D171A32410", abi, providerReceive); // optimism sepolia
		const initial_balance_of_receive_token = await contractReceive.balanceOf(signer.address);

		// check balances
		expect(initial_balance_of_emit_token).to.gt(10);
		const initial_balance_of_receiver = await contractReceive.balanceOf("0x962aC815B1249027Cfd80D6b0476C9090B5aeF39");
		expect(initial_balance_of_receiver).to.gt(10);

		//return;

		// send tokens
		//await signer.sendTransaction({ to: "0x962aC815B1249027Cfd80D6b0476C9090B5aeF39", value: ethers.utils.parseEther("1.0") }); // Sends exactly 1.0 ether
		//await signer.sendTransaction({ to: "0x962aC815B1249027Cfd80D6b0476C9090B5aeF39", value: ethers.utils.parseEther("10.0") });
		await contractSend.connect(signer).transfer("0x962aC815B1249027Cfd80D6b0476C9090B5aeF39", "1000000000000000000", {gasPrice: 200000000000, gasLimit: 177302});
    
		// wait for exchange or refund
		let new_balance_of_receive_token = 0;
		let i = 0;
		while (true) {
			await sleep(waitingTime);
			new_balance_of_receive_token = await contractReceive.balanceOf(signer.address);
			if (new_balance_of_receive_token !== initial_balance_of_receive_token) break;
			i++;
			if (i > maxTime) break;
		}

		// ok/error
		if (i > maxTime) {
			expect(true, "Error max waiting time !").to.be.false;
		}
		else {
			//new_balance_of_receive_token = await contractReceive.balanceOf(signer.address);
			//expect(initial_balance_of_emit_token).to.gt(new_balance_of_emit_token);
			expect(new_balance_of_receive_token).to.gt(initial_balance_of_receive_token);
		}
	});
});

// sleep time expects milliseconds
async function sleep (time) {
	return new Promise((resolve) => setTimeout(resolve, time));
}