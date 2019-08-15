#!/usr/bin/env node
//
// Author: Christian Benjamin Ries
// Contact: www.christianbenjaminries.de
// Mail: mail@christianbenjaminries.de
// License: MIT
//

var cfg = require('./gartenServer.cfg.js').cfg;
var valveMain = cfg.valveMain;
var valveTrees = cfg.valveTrees;
var valveReserved = cfg.valveReserved;
var valveDropping = cfg.valveDropping;
var lightsFront = cfg.lightsFront;
var lightsBack = cfg.lightsBack;
var wsListenPort = cfg.wsListenPort;
var cmd_gpio = cfg.cmd_gpio;
var WebSocketServer = require('websocket').server;
var http = require('http');
var exec = require('child_process').exec;

var fs = require('fs');
var util = require('util');
var log_file = fs.createWriteStream(__dirname + '/debug.log', {flags : 'w'});
var log_stdout = process.stdout;

console.log = function(d) { //
//  log_file.write(util.format(d) + '\n');
//  log_stdout.write(util.format(d) + '\n');
};

console.logfile = function(d) { //
//  log_file.write(util.format(d) + '\n');
}

var valveStates = { "valves" : [
	{"name": "main", "state": false, "lastAccess": 0, "gpiopin" : valveMain, "interval": 0},
	{"name": "trees", "state": false, "lastAccess": 0, "gpiopin" : valveTrees, "interval": 0},
	{"name": "backyard", "state": false, "lastAccess": 0, "gpiopin" : valveReserved, "interval": 0},
	{"name": "dropping", "state": false, "lastAccess": 0, "gpiopin" : valveDropping, "interval": 0}
]};

var switchStates = { "switches" : [
	{"name": "front", "state": false, "lastAccess": 0, "gpiopin": lightsFront, "interval": 0},
	{"name": "back", "state": false, "lastAccess": 0, "gpiopin": lightsBack, "interval": 0}
]};

function sendWeatherData(c) {
	var json = JSON.parse(fs.readFileSync('./gartenServer.data.json', 'utf8'));
	sendData(c, "data", json);
	json = null;
}

function executeCommand(cmdcall) {
	var child = exec(cmdcall, execLog);
	//var child = exec("ls", execLog);
	child.on('close', function(code) {
		console.log("Command: " + cmdcall + ", Result: " + code);
		if(code != 0)
			sendError(null, "Command failed: " + cmdcall + ", Result: " + code);	
		child = null;
	});
}

function resetValves() {
	valveStates["valves"].forEach(function(entry) {
		if(entry.gpiopin >= 0) {
			executeCommand(cmd_gpio + " mode " + entry.gpiopin + " out");
			executeCommand(cmd_gpio + " write " + entry.gpiopin + " 0");
		}
	});
}

function resetSwitches() {
	switchStates["switches"].forEach(function(entry) {
		if(entry.gpiopin >= 0) {
			executeCommand(cmd_gpio + " mode " + entry.gpiopin + " out");
			executeCommand(cmd_gpio + " write " + entry.gpiopin + " 0");
		}
	});
}

resetValves();
resetSwitches();

process.on('SIGTERM', function() { console.log("SIGTERM : shutting down softly..."); resetValves(); resetSwitches(); process.exit(); });
process.on('SIGINT', function() { console.log("SIGTERM : shutting down softly..."); resetValves(); resetSwitches(); process.exit(); });

var server = http.createServer(function(request, response) {
    console.log((new Date()) + ' Received request for ' + request.url);
    //response.writeHead(404);
    //response.end();

	var raw = fs.createReadStream('index.html');
	var acceptEncoding = request.headers['accept-encoding'];
	if (!acceptEncoding) {
		acceptEncoding = '';
	}

	// Note: this is not a conformant accept-encoding parser.
	// See http://www.w3.org/Protocols/rfc2616/rfc2616-sec14.html#sec14.3
	if (acceptEncoding.match(/\bdeflate\b/)) {
		response.writeHead(200, { 'content-encoding': 'deflate' });
		raw.pipe(zlib.createDeflate()).pipe(response);
	} else if (acceptEncoding.match(/\bgzip\b/)) {
		response.writeHead(200, { 'content-encoding': 'gzip' });
		raw.pipe(zlib.createGzip()).pipe(response);
	} else {
		response.writeHead(200, {});
		raw.pipe(response);
	}
	
	response.end();
	response = null;
	raw = null;
});

function execLog(error, stdout, stderr) {
	console.logfile(' Exec::Stdout: ' + stdout);
	console.logfile(' Exec::Stderr: ' + stderr);
	if (error !== null) {
		console.log(' Exec failure: ' + error);
	}
}

function isValidValve(name) {
	var o = null;
	valveStates["valves"].forEach(function(entry){
		if(entry["name"] === name) {
			o = entry;
		}
	});
	return o;
}

function isValidSwitch(name) {
	var o = null;
        switchStates["switches"].forEach(function(entry){
                if(entry["name"] === name) {
                        o = entry;
                }
        });
        return o;
}

server.listen(wsListenPort, function() {
    console.log((new Date()) + ' Server is listening on port '+ wsListenPort);
});

wsServer = new WebSocketServer({
    httpServer: server,
    // You should not use autoAcceptConnections for production
    // applications, as it defeats all standard cross-origin protection
    // facilities built into the protocol and the browser.  You should
    // *always* verify the connection's origin and decide whether or not
    // to accept it.
    autoAcceptConnections: false
});

function originIsAllowed(origin) {
  // put logic here to detect whether the specified origin is allowed.
  return true;
}

function setGpio(c, data) {
	var gpiopin = data.gpiopin;
	var state = data.state;
	var name = data.name;
	var lastAccess = data.lastAccess;
	var interval = data.interval;
	
	if(gpiopin > -1)
	{	
		console.log(name + "::GPIO: " + gpiopin + " -> " + state + " (" + lastAccess + ", " + interval + ")");
	
		if(state === true)
			executeCommand(cmd_gpio + " write " + gpiopin + " 1");
		else
			executeCommand(cmd_gpio + " write " + gpiopin + " 0");
	}
	else
	{
		console.log(name + "::GPIO: [not valid:=" + gpiopin + "] -> call is NOT performed");
	}
}

function sendError(c, msg) {
	if(c === null)
		return;
	c.send(JSON.stringify({
		"type" : "status",
		"data" : {
			"status" : "error",
			"message" : msg
		}
	}));
}

function sendOk(c, msg) {
	c.send(JSON.stringify({
		"type" : "status",
		"data" : {
			"status" : "success",
			"message" : msg
		}
	}));
}

function sendData(c, strType, jsonData) {
	var data = JSON.stringify({
		"type" : strType,
		"data" : jsonData
	});
	c.send(data);
}

function sendUpdate(c) {
	var data = JSON.stringify({ "type": "update", "data": {s0 : valveStates, s1 : switchStates }});
	c.send(data);
}

function updateValves(c) {
	var v = valveStates["valves"];
	for(var i=0; i < v.length; ++i)
		setGpio(c, v[i]);
}

function updateSwitches(c) {
        var s = switchStates["switches"];
        for(var i=0; i < s.length; ++i)
                setGpio(c, s[i]);
}

function handlingMessage(c, json) {	

	if(json.cmd != null && json.cmd != 'undefined')
	{
		if(json.cmd == "update")
		{
			sendUpdate(c);
			return;
		}
	}

	if(json.valve != null && json.valve != 'undefined')
	{
		var valveName = json.valve;
		if(valveName === 'update')
       	{
            sendWeatherData(c);
            return;
      	}

		var interval = json.interval;
		var valveEntry = isValidValve(valveName);	
		if(valveEntry == null)
		{
			sendError(c, "Valve name is not valid: " + valveName);
		}
		else
		{
			var newState = !valveEntry.state;
			var v = valveStates["valves"];
			v.forEach(function(entry){entry.state = false;});
			valveEntry.state = newState;
			if(newState == true)
				valveEntry.interval = interval;
			else
				valveEntry.interval = 0;
			var d = new Date();
			valveEntry.lastAccess = d.getTime();
			updateValves(c);
			sendData(c, "state", valveStates);
			v = null;
		}
		valveEntry = null;
	}

	if(json.switches != null && json.switches != 'undefined')
	{
		var switchName = json.switches;
		var interval = json.interval;
		var switchEntry = isValidSwitch(switchName);
		if(switchEntry == null)
		{
			sendError(c, "Switch name is not valid: " + switchName);
		}
		else
		{
			var newSwitchState = !switchEntry.state;
			var v = switchStates["switches"];
			//v.forEach(function(entry){entry.state = false;});
			switchEntry.state = newSwitchState;
			if(newSwitchState == true)
				switchEntry.interval = interval;
			else
				switchEntry.interval = 0;
			var d = new Date();
			switchEntry.lastAccess = d.getTime();
			updateSwitches(c);
			sendData(c, "switchStates", switchStates); 
		}
		switchEntry = null;
	}
}

wsServer.on('request', function(request) {

    if (!originIsAllowed(request.origin)) {
      // Make sure we only accept requests from an allowed origin
      request.reject();
	  request = null;
      //console.log((new Date()) + ' Connection from origin ' + request.origin + ' rejected.');
      return;
    }

    //console.log((new Date()) + ' Connection accepted.');
    var c = request.accept(null, request.origin);
	
	sendData(c, "state", valveStates);
	sendData(c, "switchStates", switchStates);
	sendWeatherData(c);

	c.on('message', function(msg) {
		try 
		{
			var json = JSON.parse(msg.utf8Data);
			handlingMessage(c, json);
		} 
		catch (e) 
		{
			console.log(e);
			sendError(c, "Command failed{" + e.name + ": " + e.message + "}");
			return ;
		}		
    });
	
    c.on('close', function(reasonCode, description) {
        //console.log((new Date()) + ' Peer ' + c.remoteAddress + ' disconnected.');
		c = null;
    });
});

