#!/usr/bin/env node
//
// Author: Christian Benjamin Ries
// Contact: www.christianbenjaminries.de
// Mail: mail@christianbenjaminries.de
// License: MIT
//

var helper = require('./gartenServer.helper.js');
var cfg = require('./gartenServer.cfg.js').cfg;
var twoDigits = helper.twoDigits;
var checkStates = helper.checkStates;

var schedule = [
	// mode     := "on" | "off"
	// target   := "main" | "trees" | "reserved" | "front" | "back"
	// when     := ($sunrise$ | $sunset$) + NUM_SECONDS
	// interval := NUM_SECONDS
	  { "mode" : "off", "target" : "front", "when" : "$sunrise$-(30*60)", "interval" : 3600 * 24 * 7 }
	, { "mode" : "on", "target" : "front", "when" : "$sunset$+(30*60)", "interval" : 3600 * 24 * 7 }
	
	// +++ TESTS +++
	//, { "mode" : "on", "target" : "front", "when" : "$sunrise$+(3*60*60)", "interval" : 3600 * 24 * 7 }
	//, { "mode" : "off", "target" : "front", "when" : "$sunrise$+(6*60*60)", "interval" : 3600 * 24 * 7 }
];

var WebSocketServer = require('websocket').server;
var clc = require('cli-color');
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

var dates = require("./DateOfAYear-2016.json");
var day = (new Date()).getDate();
var month = (new Date()).getMonth() + 1;
var year = (new Date()).getYear();

function getDataOf(year, month, day) {
	for(var i=0; i < dates.length; ++i) {
		var o = dates[i];
		var pattern = year.toString().substring(1) + "-" + twoDigits(month) + "-" + twoDigits(day);
		if(o.date == pattern)
			return o;
	}
	return null;
}

function getSecondsOf(str, y, m, d) {
	var hasAm = str.indexOf("AM") != -1;
	var hasPm = str.indexOf("PM") != -1;
	
	if(hasAm)
		str = str.substring(0, str.indexOf("AM"));
	else if(hasPm)
		str = str.substring(0, str.indexOf("PM"));

	var parts = str.split(":");

	var hour = parseInt(parts[0]) + (hasPm ? 12 : 0);
	var minutes = parseInt(parts[1]);
	var seconds = parseInt(parts[2]);

	return (hour * 60 * 60) + (minutes * 60) + seconds;
}

function getStartSecondsOf(y, m , d) {
	var startOfDay = (new Date(y + 1900, m - 1, d)).getTime();
	return (parseInt(startOfDay) + parseInt(new Date(y + 1900, m, d).getTimezoneOffset())) / 1000;
}

function getLocalNowTimestamp() {
	var n = new Date();
	var v= n.getTime();
    return Math.round((parseInt(v)) / 1000); // + (new Date().getTimezoneOffset())) / 1000);
}

var dataOfDay = getDataOf(year, month, day);
if(dataOfDay == null)
	return;

var sunrise = dataOfDay.data.sunrise;
var sunset = dataOfDay.data.sunset;
var moonphase = dataOfDay.data.moonphase;

var sunrise0 = parseInt(getStartSecondsOf(year, month, day)) + parseInt(getSecondsOf(sunrise, year, month, day));
var sunset0 = parseInt(getStartSecondsOf(year, month, day)) + parseInt(getSecondsOf(sunset, year, month, day));

var mo = clc.xterm(202);
//console.log("It is " + clc.yellow(getLocalNowTimestamp()));
console.log("It is " + (new Date()).toLocaleString());
console.log(" Sunrise: " + mo(sunrise));
console.log(" Sunset:  " + mo(sunset));
//console.log("Data: " + sunrise0 + " until " + sunset0 + " (" + moonphase + ")");

checkStates(function(obj, mode, c) {
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
			//var lastAccess = parseInt(parseInt(data.lastAccess) / 1000);
			//var lastAccessPretty = dateFormat(data.lastAccess, "dd, mm dS, h:MM:ss TT");
			//var interval = parseInt(data.interval * 60);
			//var intervalDeadlinePretty = dateFormat((lastAccess + interval) * 1000, "dd, mm dS, h:MM:ss TT");

			for(var i=0; i < schedule.length; ++i) {
				var sched = schedule[i];

				if(sched.target != name)
					continue;

				sched.when = sched.when.replace("$sunrise$", sunrise0);
				sched.when = sched.when.replace("$sunset$", sunset0);
				sched.when = eval(sched.when);

				var v = (new Date(sched.when * 1000)).toLocaleString();
				var localTime = getLocalNowTimestamp();
				var scheduleTime = sched.when;

				console.log("switch '" + sched.target + "' " + (sched.mode == "on" ? clc.green("on") : clc.red("off")) + ", when: " + v);
				//console.log("Mode: " + sched.mode);
				//console.log("State: " + state);
				//console.log("Typeof: " + typeof(state));

				var res = false;
				var interval = 0;

				if(sched.mode == "on" && (state == false || state == "false"))
				{
					if(localTime >= scheduleTime)
					{
						res = true;
						interval = sched.interval;
					}
				}
				else if(sched.mode == "off" && (state == true || state == "true"))
				{
					if(localTime <= scheduleTime)
					{
						res = true;
						interval = 0;
					}
				}

				if(res == true || res == "true")
				{
					var mm = clc.xterm(202);
					if(mode == 0)
					{
						console.log(mm(" > Toggle vavle: " + sched.target));
						c.send(JSON.stringify({valve: sched.target, interval: interval}));
					}
					else if(mode == 1)
					{
						console.log(mm(" > Toggle switch: " + sched.target));
						c.send(JSON.stringify({switches: sched.target, interval: interval}));
					}
				}
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
});

