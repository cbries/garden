
var cfg = require('./gartenServer.cfg.js').cfg;
var wsClient = require('websocket').client;
var dateFormat = require('dateformat');

var Twit = require('twit');
var T = new Twit({
    consumer_key:         process.env.TWITTER_CONSUMER_KEY
  , consumer_secret:      process.env.TWITTER_CONSUMER_SECRET
  , access_token:         process.env.TWITTER_ACCESS_TOKEN_KEY
  , access_token_secret:  process.env.TWITTER_ACCESS_TOKEN_SECRET
});

module.exports = {
  tweetSwitchedOff: function(info) {
	T.post('statuses/update', { 
		status: info.type + ' \'' + info.targetName + '\' switched off!' }, function(err, data, response) {
			if(err) {
				console.log("There was a problem tweeting the message.", err);
			}
	});
  },

  tweetSwitchedOn: function(info) {
	//var ti = parseInt(info.interval);
    //var hours = parseInt(ti / 3600);
    //var minutes = parseInt(ti - (hours*3600) / 60);
    //var seconds = parseInt(ti % 60);
    //var ttt = hours + ":" + minutes;
	T.post('statuses/update', {
        status: info.type + ' \'' + info.targetName + '\' switched on!' }, function(err, data, response) {
            if(err) {
                console.log("There was a problem tweeting the message.", err);
            }
    });
  },

  checkStates: function (callback, fakeMoment) {
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
                            callback(json.data.s0, 0, connection, fakeMoment);
                        if(json.data.s1 != null)
                            callback(json.data.s1, 1, connection, fakeMoment);

                        connection.close();
						connection = null;
                        w = null;
						json = null;
                    }
                  }
                }
            } catch(ex) {
                // ignore
            }
        });

        connection.on('close', function(evt) {
            checkInProgress = false;
			if(connection != null)
				connection.close();
			connection = null;
			w = null;
        });
    })
    w.on('connectFailed', function(evt) {
        console.log("WebSocket failed: " + evt.toString());
		w = null;
	});
    w.connect(cfg.wsaddr);
  },

  twoDigits: function(n) {
	if(n < 10)
		return '0' + n;
	return n;
  },

  strPad: function(str, width, padding) {
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
};

