const http = require('http');
const { exit } = require('process');

const daemonBridge = require('./daemon.js');
let daemon = null;

let httpServerPort = 3000; // default port
let configFile = "./config/config.json"; // default config file

// load options
if(process.argv.length > 2) {
    for(i = 2; i < process.argv.length; i++) {
        const param = process.argv[i].trim();
        const params = param.split(':');
        if (params.length < 2 || params[1] === "") continue;
        switch (params[0]) {
            case '-p':
              httpServerPort = params[1].trim();
              break;
            case '-c':
                configFile = params[1].trim();
              break;
            default:
              console.log("❌ Unknown option: " + params[0]);
        }
    }
}

// launch the daemon
try {
	daemon = new daemonBridge(configFile);
} catch(error) {
	console.error('❌ ERROR lauching daemon');
	if(error !== undefined) console.error(error);
	exit(1);
}
if(daemon === null) {
	console.error("❌ ERROR lauching daemon (unknown error)");
	exit(2);
}

console.log('');
console.log("Launching daemon at:", new Date().toString());
console.log('');

http.createServer(async function (req, res) {
	httpServer(req, res);
}).listen(httpServerPort);

let title = "Daemon Bridge - v0.1.0-mono-alpha";
let subTitle1 = "Started on port: " + httpServerPort;
let subTitle2 = "Network: " + daemon.getNetworkName();
let maxLength = title.length;
if (subTitle1.length > maxLength) maxLength = subTitle1.length;
if (subTitle2.length > maxLength) maxLength = subTitle2.length;
const stars = "─".repeat(maxLength + 6);
const spaces = " ".repeat(maxLength + 6);
subTitle1 = subTitle1 + " ".repeat(maxLength - subTitle1.length);
subTitle2 = subTitle2 + " ".repeat(maxLength - subTitle2.length);

console.log("┌" + stars + "┐");
console.log("│" + spaces + "│".replaceAll(' ','\u2002'));
console.log("│   " + title + "   │".replaceAll(' ','\u2002'));
console.log("│" + spaces + "│".replaceAll(' ','\u2002'));
console.log("│   " + subTitle1 + "   │".replaceAll(' ','\u2002'));
console.log("│" + spaces + "│".replaceAll(' ','\u2002'));
console.log("│   " + subTitle2 + "   │".replaceAll(' ','\u2002'));
console.log("│" + spaces + "│".replaceAll(' ','\u2002'));
console.log("└" + stars + "┘");
console.log('');

async function httpServer(req, res) {

	res.setHeader("Access-Control-Allow-Origin", "*");
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
