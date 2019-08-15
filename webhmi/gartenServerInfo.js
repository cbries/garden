#!/usr/bin/env node
//
// Author: Christian Benjamin Ries
// Contact: www.christianbenjaminries.de
// Mail: mail@christianbenjaminries.de
// License: MIT
//

var cfg = require('./gartenServer.cfg.js').cfg;
var helper = require('./gartenServer.helper.js');
var strPad = helper.strPad;
var checkStates = helper.checkStates;

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

if(process.argv.slice(2).length <= 1)
{
	console.log("Usage: node " + process.argv[1] + " -i [seconds]");
	return;
}

var argv = require('minimist')(process.argv.slice(2));

cfg.updateIntervalInfo = argv.i * 1000;

var checkState = function(obj, mode, c) { 
	// mode -> 0:=valve, 1:=switch
  try
  {
	var data = obj;
	if(mode == 0)
		data = obj.valves;
	else if(mode == 1)
		data = obj.switches;
	else if(mode == 2)
		data = obj.autoModes;

	var h = function(data) {
		var name = data.name;
		var state = data.state;
		var lastAccess = parseInt(parseInt(data.lastAccess) / 1000);
		var lastAccessPretty = dateFormat(data.lastAccess, "dS/mm, h:MM:ss TT");
		var interval = parseInt(data.interval * 60);
		var intervalDeadlinePretty = dateFormat((lastAccess + interval) * 1000, "dS/mm, h:MM:ss TT");

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

checkStates(checkState);
setInterval(function() {checkStates(checkState);}, cfg.updateIntervalInfo);

