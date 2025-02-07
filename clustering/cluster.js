const LifeRaft = require('@markwylde/liferaft');
const fs = require("fs");
const net = require('net');
const msg = require('axon');

/*
const LifeBoat = LifeRaft.extend({
    server: null,
    socket: null,
    address: 'tcp://localhost:4001',

    initialize: function initialize(options, fn) {
        this.server = require('net').createServer(function () {
            // Do stuff here to handle incoming connections etc.
        }.bind(this));

        //const next = require('one-time')(fn);

        //this.server.once('listening', next);
        //this.server.once('error', next);

        //this.server.on('listening', listenFunction);
        //this.server.on('error', errorFunction);

        this.server.listen(this.address);
    },

    write: function write(packet, callback) {
      if (!this.socket) this.socket = require('net').connect(this.address);
      this.socket.write(JSON.stringify(packet));
    }
});
*/

/*
var net = require('net');
var server = net.createServer(function(socket) {
    // confirm socket connection from client
    console.log((new Date())+'A client connected to server...');
    socket.on('data', function(data) {
        var json = JSON.parse(data.toString());
        console.log(json)
    });
    // send info to client
    socket.write('Echo from server: NODE.JS Server \r\n');
    socket.pipe(socket);
    socket.end();
    console.log('The client has disconnected...\n');
}).listen(10337, '192.168.100.1');
*/

// ---------------------------------------------------------------------

class MsgRaft extends LifeRaft {
    //server = null;
    //socketAddress = [];
    //clustersList = [];
    startPort = null;

    initialize(options) {
        console.log('initializing cluster server on port %s', options.port);
        this.startPort = options.port;
        const socket = msg.socket('rep'); // = this.socket

        socket.bind(options.port);
        socket.on('message', (data, callback) => {
            //this.emit('data', data, callback);
            options.onData(this, data);
        });

        socket.on('error', () => {
            console.log('failed to initialize on port: ', options.port);
        });
    }

    /*
    initialize(options) {
        //console.log('options: ',options);
        this.clustersList = options.listClusters;
        console.log('initializing cluster server on port %s', options.port);
        this.server = net.createServer(function(c) {
            console.log('-- server connected --');
            c.on('end', () => { console.log('-- server disconnected --'); });
            c.on('error', (error) => { if(error.code !== 'ECONNRESET') console.log('server error: ',error); }); // client disconnected ?
            c.on('timeout', () => { console.log("timeout!"); });
            c.on('close', (raison) => { console.log('Connection closed: ',raison); });
            c.on('data', (data) => {
                //console.log('data (createServer): ',data.toString()); // data:  {"state":2,"term":1,"address":"127.0.0.1:4102","type":"vote","leader":""}
                this.emit('data', data.toString(), null);
                // data => { console.log('ack data'); c.write(data.toString()); c.end(); });
            });

            //console.log('ack data');
            c.write('ok');
            c.end();
            //console.log('end ack data');
        }.bind(this));

        this.server.listen(options.port, () => { console.log('server online'); });

        this.server.on('message', (data, callback) => {
            console.log('message receive: ',data);
            //this.emit('data', data, callback);
        });

        this.server.on('error', () => {
            console.log('failed to initialize on port: ', options.port);
        });
    }
    */

    /*
packet: {
  state: 2,
  term: 3,
  address: '0x6606dB68735D3cbD616B3455aA0481B766aDB926',
  type: 'vote',
  leader: ''
}
writing packet to socket on port tcp://127.0.0.1:4002
    */

    write(packet, callback) {
        console.log('-- write --');
        console.log('packet:',packet);
        //console.log('-- Writing packet to address %s port %s --',this.address.split(':')[0], this.address.split(':')[1]);
        try {
            /*
            if (!this.socket) {
                this.socket = require('net').connect(this.address.split(':')[1], this.address.split(':')[0]);
                this.socket.on('error', (err) => {
                    console.error('Failed to write to %s, error: %s', this.address, err.code);
                    if (err.code === 'ECONNRESET') {
                        console.log('err.code === ECONNRESET');
                        this.emit('remove_server', this.address);
                    }
                });
            }
            //this.socket.setNoDelay(true);
            this.socket.write(JSON.stringify(packet));
            */

            /* on envoi mais l'autre ne reçoit pas
            //console.log('-- Writing packet to address %s, port %s --',this.address.split(':')[0], this.address.split(':')[1]);
            if (!this.socket) {
                this.socket = msg.socket('req');
                this.socket.bind(this.startPort);
                //this.socket.connect(parseInt(this.address.split(':')[1]), this.address.split(':')[0]);
                //this.socket.on('error', function err () { console.error('failed to write to: ', this.address); });
            }
            //debug('writing packet to socket on port %s', this.address);
            console.log('-- Writing packet to address %s --',this.address);
            this.socket.send(packet, (data) => {
                //callback(undefined, data);
                console.log('socket.send callback data: ',data);
            });
            */
           // on envoi et on reçoit !!!!
            //console.log('-- Writing packet to address %s, port %s --',this.address.split(':')[0], this.address.split(':')[1]);
            //console.log('socket:',this.socket);
            if (!this.socket) {
                this.socket = msg.socket('req'); // socket: socket: RepSocket sur d1 / ReqSocket sur d2
                //this.socket.bind(this.startPort);
                this.socket.connect(parseInt(this.address.split(':')[1]), this.address.split(':')[0]);
                this.socket.on('error', function err () { console.error('failed to write to: ', this.address); });
            }
            //debug('writing packet to socket on port %s', this.address);
            console.log('-- Writing packet to address %s --',this.address);
            this.socket.send(packet, (data) => {
                //callback(undefined, data);
                console.log('socket.send callback data: ',data);
            });
        }
        catch(error) {
            console.error("Error writing packet: ", error);
        }
    }

    /*
    findPort(address) {
        for (let i = 0; i < this.clustersList.length; i++) {
            if (this.clustersList[i].address.toLowerCase() === address.toLowerCase()) {
                return this.clustersList[i].port;
            }
        }
        return null;
    }
    */
}

module.exports = class cluster {
    _raft = null;
    _config = null;

    constructor(configFile) {
        try {
            this._config = JSON.parse(fs.readFileSync(configFile, "utf8"));
        } catch(error) {
            console.log("❌ Error loading configuration file: "+ configFile + ", file is not a valid JSON or file not exist !");
            throw error;
        }
    }

    async startServer() {
        this._raft = new MsgRaft(this._config.address, { // 'tcp://localhost:4001'
            'address': this._config.address,
            'port': this._config.port,
            'listClusters':this._config.clusters,
            'onData':this.receiveData,
            'election min': 2000,
            'election max': 5000,
            heartbeat: 1000
        });

        this._raft.on('heartbeat timeout', function () {
            console.log('heart beat timeout, starting election');
        });

        this._raft.on('term change', function (to, from) {
            //console.log('were now running on term %s -- was %s', to, from);
        });

        this._raft.on('leader change', function (to, from) {
            console.log('we have a new leader from %s to: %s', from, to);
        });

        this._raft.on('state change', function (to, from) {
            console.log('we have a state from %s to: %s', LifeRaft.states[from], LifeRaft.states[to]);
        });

        this._raft.on('leader', function () {
            console.log('@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@');
            console.log('I am elected as leader');
            console.log('@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@');
        });

        this._raft.on('candidate', function () {
            console.log('----------------------------------');
            console.log('I am starting as candidate');
            console.log('----------------------------------');
        });

        this._raft.on('vote', function (data) {
            console.log("add vote: ", data);
        });

        this._raft.on('commit', function (command) {
            console.log("add log: ", command);
        });

        this._raft.on('data', function (data, callback) {
            console.log("data (startServer): ", data); //  {"state":2,"term":8,"address":"127.0.0.1:4102","type":"vote","leader":""}
            callback(data);
            //this.receiveData(data);
            /*
            //this.write(this.packet('voted', { granted: true }));

            //address: '127.0.0.1:4102', => join if necessery

            //nodes.length / node.address
            console.log("nodes.length: ", this.nodes.length);
            if (this.nodes.length === 0) {
                const node = this._raft.join(data.address);
                console.log('Cluster %s added',data.address);
                console.log("nodes.length(2): ", this.nodes.length);
                this.message(data.address, this.packet('voted', { granted: true }));
            }

            //console.log("nodes.address: ", this.nodes[0].address);
            //console.log("getFollowers: ", this.getFollowers());
            //raft.dispatch('voteRequestReceived', ...) // dispatch: (type: RaftEventType, message: MessageType)

            //const dataObject = JSON.parse(data);
            //console.log("message address: ", dataObject.address);
            //this._raft.message(data.address, this.packet('voted', { granted: true }));
            //raft.dispatch(action, req.body);

            //const packet = this.packet('vote')
            //this.message(this._raft.FOLLOWER, packet);

            //switch (dataObject.type) {
                //case "add": break;
            //}
            */
        });

        this._raft.on('remove_server', function (url) {
            console.log("remove server: ", url);
            this.removeServer(url);
        });

        this.addServers();
    }

    async receiveData(parent, data) {
        //console.log("parent: ", parent); // MsgRaft // parent.votes: { for: '127.0.0.1:4101', granted: 1 },
        console.log("-- data received: ", data);
        //console.log("data.type received:", data.type);
        //console.log("data.type typeof received:", typeof data.type);
        try {
            if (data.address === undefined) return;
            //console.log("nodes: ", parent.nodes); // nodes: [],
            //console.log("nodes.length: ", parent.nodes.length);
            /*
            let node = null;
            if (parent.nodes.length === 0) {
                node = parent.join(data.address);
                console.log('Cluster %s added',data.address);
                //console.log("nodes.length(2): ", parent.nodes.length);
                //parent.nodes[0].message(data.address, this.packet('voted', { granted: true }));
            }
            else {
                node = parent.nodes[0].address;
                //console.log("nodes.address: ", parent.nodes[0].address);
            }
            //console.log("node: ", node); // MsgRaft
            */

            //MsgRaft.packet
            if (data.type === "vote") {
                console.log("vote received from: ",data.address);
                parent.message(data.address, await parent.packet('voted', { granted: true }));
            }

            //console.log("getFollowers: ", this.getFollowers());
            //raft.dispatch('voteRequestReceived', ...) // dispatch: (type: RaftEventType, message: MessageType)

            //const dataObject = JSON.parse(data);
            //console.log("message address: ", dataObject.address);
            //this._raft.message(data.address, this.packet('voted', { granted: true }));
            //raft.dispatch(action, req.body);
        }
        catch(error) {
            console.error("Error writing packet: ", error);
        }
    }

    async ping(hostname, port, timeout) {
        return new Promise((resolve) => {
            const socket = net.createConnection(port, hostname);
            socket.setTimeout(timeout);
            socket.on('connect', () => {
              socket.end();
              socket.destroy();
              resolve(0);
            });
            function handleError() { socket.destroy(); resolve(-1); }
            socket.on('timeout', handleError);
            socket.on('error', handleError);
            //socket.on('error', (err) => { console.log('error handleError: ',err); });
        });
    }

	// Check if server is running
    async checkServer(url) {
        //console.log('checkServer: ',url);
		try {
            const params = url.split(':');
            if((await this.ping(params[0], params[1], 2000)) === 0) return true;
            return false;
        } catch(error) {
			console.error('checkServer error:',error);
            return false;
		}
    }

    async addServer(url) {
        //console.log("-- addServer --");
        const result = await this.checkServer(url);
        if (result) { this._raft.join(url); console.log('Cluster %s added',url); }
        else console.log('Cluster %s not started',url);
    }

    removeServer() {
        // raft.leave('127.0.0.1:8080');
    }

    addServers() {
        //console.log("-- addServers --");
		for (let i = 0; i < this._config.clusters.length; i++) {
			this.addServer(this._config.clusters[i].address);
		}
    }

    stopServer() {
        // raft.end();
    }

    addLog() {
        // raft.command({name: 'Jimi', surname: 'Hendrix'});;
    }

    send(/* command, data */) {
        // raft.dispatch('replicateData', { something: 'shared, and available', });
    }
}
