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

var cfg = { wsaddr: "ws://localhost:23234" };

// ###################################################

var WebSocketServer = require('websocket').server;
var spawn = require('threads').spawn;
var clc = require('cli-color');
var fs = require('fs');
var util = require('util');
var log_file = fs.createWriteStream(__dirname + '/debug-caller.log', {flags : 'w'});
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
var dateFormat = require('dateformat');
var args = require('optimist')
	.usage('Usage: $0 -t [name] -s [true|false] -i [num]')
	.demand(['t', 's', 'i'])
	.argv;

var target = args.t;
var targetState = args.s == "true" ? true : false;
var targetInterval = parseInt(args.i); // seconds

console.log("Target:   " + target);
console.log("State:    " + targetState);
console.log("Interval: " + targetInterval + " minutes");

var checkState = function(obj, mode, c) { 
	// mode -> 0:=valve, 1:=switch
  try
  {
	var data = obj;
	if(mode == 0)
		data = obj.valves;
	else if(mode == 1)
		data = obj.switches;

	var h = function(data) {
		var name = data.name;
		var state = data.state;

		if(name != target)
			return;

		if(state == targetState)
		{
			console.log(target + " is already " + (!targetState ? clc.red('stopped') : clc.green('running')));
		}
		else
		{
			if(mode == 0)
				c.send(JSON.stringify({valve: target, interval: targetInterval}));
			else if(mode == 1)
				c.send(JSON.stringify({switches: target, interval: targetInterval}));
		
			console.log(target + " " + (!targetState ? clc.red('stopped') : clc.green('running')));
		}		
	};

	if(data != null)
    {
		for(i=0; i < data.length; ++i)
        {
			var o = data[i];
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

checkStates();

