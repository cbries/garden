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

var cfg = { 
	wsaddr: "ws://localhost:23234",
    updateInterval: 5000
};

// ###################################################

var WebSocketServer = require('websocket').server;
var spawn = require('threads').spawn;
var clc = require('cli-color');
var fs = require('fs');
var util = require('util');
var log_file = fs.createWriteStream(__dirname + '/debug-info.log', {flags : 'w'});
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
	.usage('Usage: $0 -i [seconds]')
	.demand(['i'])
	.argv;

cfg.updateInterval = parseInt(args.i) * 1000;

console.log("Interval: " + cfg.updateInterval);

// see http://www.codexpedia.com/javascript/javascript-string-padding-function/
function strPad(str, width, padding) {
    if (typeof str === 'string' || typeof str === 'number') {
        str = str + '';
    } else {
        throw 'str has to be type string or number.';
    }
 
    if (typeof width !== 'number') {
        throw 'width has to be a number.'; 
    }
 
    if (typeof padding !== 'string') {
        throw 'padding has to be a string.';
    }
 
    if (padding.length === 0) {
        throw 'padding cannot be an empty string.';
    }
 
    while (str.length < width) {
        str = padding + str;
    }
    return str;
}

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
		var lastAccess = parseInt(parseInt(data.lastAccess) / 1000);
		var lastAccessPretty = dateFormat(data.lastAccess, "dd, mm dS, h:MM:ss TT");
		var interval = parseInt(data.interval * 60);
		var intervalDeadlinePretty = dateFormat((lastAccess + interval) * 1000, "dd, mm dS, h:MM:ss TT");

		var d = new Date();
		var currentTime = d.getTime() / 1000;
		
		console.log(strPad(name, 10, ' ') + ' -> ' + (state? clc.green("running") : clc.red("stopped")) + 
			(state ? ' [Started ' + clc.yellow(lastAccessPretty) + ', Until: ' + clc.yellow(intervalDeadlinePretty) + ']' 
				   : ' [Last access ' + lastAccessPretty + ']'
			)
		);
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
						console.log(" ----------------------------------------------------------------------------------------- ");
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

setInterval(checkStates, cfg.updateInterval);

