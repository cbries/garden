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
	// when     := ($sunrise$ | $sunset$ | $tt$) + NUM_SECONDS
	// interval := NUM_SECONDS
      { "mode" : "on",  "target" : "front", "when" :      "$tt$ + 5.5*3600" /*  5:30h          */, "interval" : 3600 * 12 }
	, { "mode" : "off", "target" : "front", "when" : "$sunrise$ + (15*60)" /* sunrise + 15min */, "interval" : 3600 * 12 }
	, { "mode" : "on",  "target" : "front", "when" : "$sunset$  - (15*60)" /* sunset - 15min  */, "interval" : 3600 * 12 }
	, { "mode" : "off", "target" : "front", "when" :      "$tt$ + 22.5*3600" /* 22:30h          */, "interval" : 3600 * 12 }
	// +++ TESTS +++
	//, { "mode" : "on", "target" : "front", "when" : "$sunrise$+(3*60*60)", "interval" : 3600 * 24 * 7 }
	//, { "mode" : "off", "target" : "front", "when" : "$sunrise$+(6*60*60)", "interval" : 3600 * 24 * 7 }
];

var _m = require('moment');
var WebSocketServer = require('websocket').server;
var clc = require('cli-color');
var fs = require('fs');
var util = require('util');
var dateFormat = require('dateformat');
var log_file = fs.createWriteStream(__dirname + '/debug-scheduler.log', {flags : 'w'});
var log_stdout = process.stdout;

console.log = function(d) { //
  log_file.write(util.format(d) + '\n');
  log_stdout.write(util.format(d) + '\n');
};

console.logfile = function(d) { //
  log_file.write(util.format(d) + '\n');
}

var dates = require("./DateOfAYear-2018.json");

function getDataOf(year, month, day) {
	for(var i=0; i < dates.length; ++i) {
		var o = dates[i];
		var pattern = year.toString().substring(2) + "-" + twoDigits(month) + "-" + twoDigits(day);
		if(o.date == pattern)
			return o;
	}
	return null;
}

function getSecondsOf(str, y, m, d) 
{
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
	return _m({
		y : y,	M : m, day : d,
		h : 0, m : 0, s : 0, ms : 0}).unix();
}

function getStartSecondsOfToday() {
	return _m({
		y : _m().year(), M : _m().month(), day : _m().date(),
		h : hour, m : minute, s : 0, ms : 0});
}

var callback = function(obj, mode, c, mFake) {
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
			var stateMode = state == 'true' || state == true ? "on" : "off";

			var scheds = schedule;

			for(var i=0; i < scheds.length; ++i) {
				var sched = scheds[i];

				if(sched.target != name)
					continue;

				sched.when = sched.when.replace("$sunrise$", sunrise0);
				sched.when = sched.when.replace("$sunset$", sunset0);
				sched.when = sched.when.replace("$tt$", parseInt(getStartSecondsOf(year, month, day)));
				sched.when = eval(sched.when);
			};

			if(mFake == null || mFake == 'undefined')
				mFake = _m.unix();
			
			var schedIndex = -1;
			for(var i=0; i < scheds.length; ++i) 
			{
				if(name != scheds[i].target)
					continue;
				var s0 = _m.unix(scheds[i].when);
				var s1 = null;
				if(i >= (scheds.length - 1))
					s1 = _m({y : 2020, M : 1, day : 1});
				else
					s1 = _m.unix(scheds[i+1].when);				
				
				if(mFake.isAfter(s0) && mFake.isSameOrBefore(s1))
				{
					schedIndex = i;
					break;
				}
			}

			if(schedIndex <= -1) {
				console.log("No action to perform for '" + name + "'");
				return;
			}

			console.log(clc.blueBright.underline(name + " is " + stateMode));
            for(var i=0; i < scheds.length; ++i)
            {
                var s = scheds[i];
                if(s.target != name)
                    continue;
				var my = clc.xterm(15).bgXterm(0);
				if(schedIndex == i)
					my = clc.xterm(11).bgXterm(0);
                console.log(my("S: " + _m.unix(s.when).format() + " (" + _m.unix(s.when).format("HH:mm") + ") -> " + s.mode));
            }

			var rs = scheds[schedIndex];
		
			if(rs.target != name)
				return;
	
			//console.log("stateMode: " + stateMode + ", rs.mode: " + rs.mode);

			if(stateMode == rs.mode) {
				console.log("No action to perform, target state of '" + rs.target + "' is correct.");
				return;
			}

			console.log("Current state of '" + rs.target + "' is '" + stateMode + "'.");

			if(rs.mode == 'on')
			{
				// ignore
			}
			else
			{
				// ignore
			}

			var mm = clc.xterm(202);
			if(mode == 0)
			{
				console.log(mm(" > Toggle valve: " + rs.target + " to " + rs.mode));
				c.send(JSON.stringify({valve: rs.target, interval: parseInt(rs.interval/60)}));
			}
			else if(mode == 1)
			{
				console.log(mm(" > Toggle switch: " + rs.target + " to " + rs.mode));
				c.send(JSON.stringify({switches: rs.target, interval: parseInt(rs.interval/60)}));
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

  console.log(" ### CHECK ### ");

  var year = _m().year();
  var month = _m().month();
  var day = _m().date();
  
  var dataOfDay = getDataOf(year, month+1, day);
  if(dataOfDay == null) {
	console.log("No data for date.");
    return;
  }

  var sunrise = dataOfDay.data.sunrise;
  var sunset = dataOfDay.data.sunset;
  var moonphase = dataOfDay.data.moonphase;

  var sunrise0 = parseInt(getStartSecondsOf(year, month, day)) + parseInt(getSecondsOf(sunrise, year, month, day));
  var sunset0 = parseInt(getStartSecondsOf(year, month, day)) + parseInt(getSecondsOf(sunset, year, month, day));

  console.log("Today: " + _m({y : year, M : month, day : day}).format("DD.MM.YYYY"));

//console.log("Sunrise: " + _m.unix(sunrise0).format() + ", " + sunrise0 + ", " + _m.unix(sunrise0).unix());
//console.log("Sunset:  " + _m.unix(sunset0).format() + ", " + sunset0 + ", " + _m.unix(sunset0).unix());

//for(var hour = 0; hour < 24; ++hour) {
//	for(var minute = 0; minute < 60; minute+=30) {
		
//		var mFake = _m({
//			y : year, M : month, day : day,
//			h : 20, m : 5, s : 0, ms : 0});

        var mFake = _m({
            y : year, M : month, day : day,
            h : _m().hour(), m : _m().minutes(), s : 0, ms : 0});

		checkStates(callback, mFake);
//	}
//}


