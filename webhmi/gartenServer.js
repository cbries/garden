#!/usr/bin/env node
//
// Author: Christian Benjamin Ries
// Contact: www.christianbenjaminries.de
// Mail: mail@christianbenjaminries.de
// License: MIT
//

// ###################################################
//  C O N F I G U R A T I O N
// ###################################################

var valveMain = 4;
var valveTrees = 5; 
var valveReserved = 6; 
var wsListenPort = 23234;
var cmd_gpio = "./gpio";

// ###################################################

var WebSocketServer = require('websocket').server;
var http = require('http');
var exec = require('child_process').exec;

var fs = require('fs');
var util = require('util');
var log_file = fs.createWriteStream(__dirname + '/debug.log', {flags : 'w'});
var log_stdout = process.stdout;

console.log = function(d) { //
  log_file.write(util.format(d) + '\n');
  log_stdout.write(util.format(d) + '\n');
};
console.logfile = function(d) { //
  log_file.write(util.format(d) + '\n');
}

var connections = [];

var valveStates = { "valves" : [
	{"name": "main", "state": false, "lastAccess": 0, "gpiopin" : valveMain},
	{"name": "trees", "state": false, "lastAccess": 0, "gpiopin" : valveTrees},
	{"name": "reserved", "state": false, "lastAccess": 0, "gpiopin" : valveReserved},
]};

function executeCommand(cmdcall) {
	var child = exec(cmdcall, execLog);
	child.on('close', function(code) {
		console.log("Command: " + cmdcall + ", Result: " + code);
		if(code != 0)
			sendError(null, "Command failed: " + cmdcall + ", Result: " + code);	
	});
}

function resetValves() {
	valveStates["valves"].forEach(function(entry) {
		executeCommand(cmd_gpio + " mode " + entry.gpiopin + " out");
		executeCommand(cmd_gpio + " write " + entry.gpiopin + " 0");
	});
}

resetValves();

process.on('SIGTERM', function() { console.log("SIGTERM : shutting down softly..."); resetValves(); process.exit(); });
process.on('SIGINT', function() { console.log("SIGTERM : shutting down softly..."); resetValves(); process.exit(); });

var server = http.createServer(function(request, response) {
    console.log((new Date()) + ' Received request for ' + request.url);
    response.writeHead(404);
    response.end();
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

function setGpio(c, valve) {
	var gpiopin = valve.gpiopin;
	var state = valve.state;
	var name = valve.name;
		
	console.log(name + "::GPIO: " + gpiopin + " -> " + state + " (" + valve.lastAccess + ")");
	
	if(state === true)
		executeCommand(cmd_gpio + " write " + gpiopin + " 1");
	else
		executeCommand(cmd_gpio + " write " + gpiopin + " 0");
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

function updateValves(c) {
	
	var v = valveStates["valves"];
	
	for(var i=0; i < v.length; ++i)
		setGpio(c, v[i]);
}

function handlingMessage(c, json) {	
	var valveName = json.valve;
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
		var d = new Date();
		valveEntry.lastAccess = d.getTime();
		updateValves(c);
		sendData(c, "state", valveStates);
	}	
}

wsServer.on('request', function(request) {

    if (!originIsAllowed(request.origin)) {
      // Make sure we only accept requests from an allowed origin
      request.reject();
      console.log((new Date()) + ' Connection from origin ' + request.origin + ' rejected.');
      return;
    }

    console.log((new Date()) + ' Connection accepted.');
    var c = request.accept(null, request.origin);
    connections.push(c);
	
	sendData(c, "state", valveStates);
	
	c.on('message', function(msg) {
		try 
		{
			console.log("Received: " + msg.utf8Data);
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
        console.log((new Date()) + ' Peer ' + c.remoteAddress + ' disconnected.');
    });
});
