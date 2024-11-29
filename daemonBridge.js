const http = require('http');
const { exit } = require('process');

const daemonBridge = require('./daemon.js');
let daemon = null;

// launch the daemon
try {
	daemon = new daemonBridge();
} catch(error) {
	console.error('❌ ERROR lauching daemon');
	if(error !== undefined) console.error(error);
	exit();
}

if(daemon === null) {
	console.error("❌ ERROR lauching daemon (unknown error)");
	exit();
}

console.log('');
console.log("Launching daemon at:", new Date().toString());
console.log('');

let httpServerPort = 3000; // default port for npm start
const params = process.argv.slice(2);
if(params[0] !== undefined) {
	const paramPort = params[0].trim();
	if(paramPort !== undefined && paramPort !== null && paramPort !== "") httpServerPort = paramPort;
}

http.createServer(async function (req, res) {
	httpServer(req, res);
}).listen(httpServerPort);

console.log("┌───────────────────────────────────┐");
console.log("│                                   │".replaceAll(' ','\u2002'));
console.log("│   Daemon Bridge - v 1.0           │".replaceAll(' ','\u2002'));
console.log("│                                   │".replaceAll(' ','\u2002'));
console.log("│   Started on port: "+httpServerPort+"           │".replaceAll(' ','\u2002'));
console.log("│                                   │".replaceAll(' ','\u2002'));
console.log("└───────────────────────────────────┘");

async function httpServer(req, res) {

	res.setHeader("Access-Control-Allow-Origin", "*"); //"*"
	res.setHeader("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
	res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

	try {
		if (req.Method === "OPTIONS") {
			res.writeHead(200, { 'Content-Type': 'text/plain' });
			res.end('');
		}
		else {
			if (req.method === 'GET') {
				let _body = "ok";
				if(req.url.match("/json")) _body = daemon.makeJson(httpServerPort);
				if(req.url.match("/status")) _body = daemon.getStatus();
				res.writeHead(200, { 'Content-Length': Buffer.byteLength(_body), 'Content-Type': 'text/plain' });
				res.end(_body);
			} else {
				res.writeHead(405, { 'Content-Length': Buffer.byteLength('Method Not Allowed'), 'Content-Type': 'text/plain' });
				res.end('Method Not Allowed');
			}
		}
	} catch (error) {
		console.error('ERROR server [' + error.code + ']: ', error);
	}
}
