
var cfg = require('./gartenServer.cfg.js').cfg;
var wsClient = require('websocket').client;

module.exports = {
  checkStates: function (callback) {
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
                            callback(json.data.s0, 0, connection);
                        if(json.data.s1 != null)
                            callback(json.data.s1, 1, connection);

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

