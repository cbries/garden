#!/usr/bin/env node
//
// Author: Christian Benjamin Ries
// Contact: www.christianbenjaminries.de
// Mail: mail@christianbenjaminries.de
// License: MIT
//

var WebSocketServer = require('websocket').server;
var http = require('http');
var Gpio = require('onoff').Gpio;

// ###################################################
//  C O N F I G U R A T I O N
// ###################################################

var valveMain = new Gpio(23, 'out');
var valveTrees = new Gpio(24, 'out');
var valveReserved = new Gpio(25, 'out');
var wsListenPort = 8080;

// ###################################################

var connections = [];

var server = http.createServer(function(request, response) {
    console.log((new Date()) + ' Received request for ' + request.url);
    response.writeHead(404);
    response.end();
});

var valveStates = { "valves" : [
	{"name": "main", "state": true, "lastAccess": 0, "gpiopin" : valveMain},
	{"name": "trees", "state": false, "lastAccess": 0, "gpiopin" : valveTrees},
	{"name": "reserved", "state": true, "lastAccess": 0, "gpiopin" : valveReserved},
]};

function isValidValve(name)
{
	var o = null;
	valveStates["valves"].forEach(function(entry){
		if(entry["name"] === name)
		{
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

function setGpio(valve) {
	var p0 = valve.gpiopin;
	var p1 = valve.state;
	var p2 = valve.name;
		
	console.log(p2 + "::GPIO: " + p0 + " -> " + p1 + " (" + valve.lastAccess + ")");
	
	if(p1 == true)
		p0.writeSync(0);
	else
		p0.writeSync(1);
}

function sendError(c, msg) {
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

function updateValves() {
	
	var v = valveStates["valves"];
	
	//v.forEach(function(entry){
	//	console.log("Name: " + entry.name + " -> " + entry.state);		
	//});
	
	for(var i=0; i < v.length; ++i)
		setGpio(v[i]);
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
		updateValves();
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