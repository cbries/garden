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

var cmd_gpio = "gpio";

var cfg = { wsaddr: "ws://localhost:23234" };

// ###################################################

var WebSocketServer = require('websocket').server;
var spawn = require('threads').spawn;

var fs = require('fs');
var util = require('util');
var log_file = fs.createWriteStream(__dirname + '/debug-checker.log', {flags : 'w'});
var log_stdout = process.stdout;

console.log = function(d) { //
  log_file.write(util.format(d) + '\n');
  log_stdout.write(util.format(d) + '\n');
};

console.logfile = function(d) { //
  log_file.write(util.format(d) + '\n');
}

var wsClient = require('websocket').client;
var sleep = require('sleep').sleep;
var usleep = require('sleep').usleep;	

var checkState = function(obj, mode, c) { 
	// mode -> 0:=valve, 1:=switch
  try
  {
	var data = obj;
	if(mode == 0)
		data = obj.valves;
	else if(mode == 1)
		data = obj.switches;

	//console.log("Valves: " + data + ", " + data.length);
	//console.log("Switches: " + data + ", " + data.length);

	var h = function(data) {
	  var name = data.name;
	  var state = data.state;
	  var lastAccess = parseInt(data.lastAccess) / 1000;
	  var interval = parseInt(data.interval * 60);

	  var d = new Date();
          var currentTime = d.getTime() / 1000;

	  if(interval != 0)
	  {
	  	console.log(" ################################################## ");	
	  	console.log("Check state of " + name + " (Interval: " + interval + ")");
	  	console.log("Last access:  " + lastAccess);
	  	console.log("Interval:     " + interval);
	  	console.log("Current Time: " + currentTime);
	  	console.log("Left:         " + currentTime - (lastAccess + interval));
	  	var v = currentTime >= (lastAccess + interval);
	  	console.log("Disable:      " + v);
	  }

	  if(state == true && currentTime >= (lastAccess + interval))
	  {
		if(mode == 0)
			c.send(JSON.stringify({valve: name, interval: 0}));
		else if(mode == 1)
			c.send(JSON.stringify({switches: name, interval: 0}));
	  }
	  else
	  {
		if(state == true && interval <= 0)
		{
			if(mode == 0)
			    c.send(JSON.stringify({valve: name, interval: 0}));
            else if(mode == 1)
				c.send(JSON.stringify({switches: name, interval: 0}));
		}
	  }
	};

	if(data != null)
        {
                for(i=0; i < data.length; ++i)
                {
                        var o = data[i];
			console.log("Check: " + o.name);
                        h(o);
                }
        }
  }
  catch(ex)
  {
	// ignore
  }
};

var checkStates = function() {

	var w = new wsClient();
		
	w.on('connect', function(connection) {
		connection.send(JSON.stringify({"cmd": "update"}));
		connection.on('message', function(json) {
             	        try {
				if(json.type === 'utf8')
				{
				  json = JSON.parse(json.utf8Data);
				  if(json.type != null && json.type !== 'undefined')
				  {
				    if(json.type == 'update')
				    {
					if(json.data.s0 != null)
                                		checkState(json.data.s0, 0, connection);
                               		if(json.data.s1 != null)
                                	        checkState(json.data.s1, 1, connection);
				   
					connection.close();
				    	
					w = null;
				    }
				  }				
				}
               	        } catch(ex) {
               	                // ignore
               	        }
               	});

		connection.on('close', function(evt) {
			checkInProgress = false;
		});
	})

	w.on('connectFailed', function(evt) {
		console.log("WebSocket failed: " + evt.toString());
	});

	w.connect(cfg.wsaddr);
};

setInterval(checkStates, 5000);

