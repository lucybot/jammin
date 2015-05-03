var Request = require('request');
var Path = require('path');

var Client = module.exports = function(options) {
  for (var key in options.module) {
    var fn = options.module[key];
    var fnName = key;
    if (typeof fn === 'function') {
      var url = options.host + Path.join(options.basePath || '/', fnName);
      this[key] = getProxyFunction(key, url);
    }
  }
}

var getProxyFunction = function(fnName, url) {
  return function() {
    arguments = Array.prototype.slice.call(arguments);
    var callback = arguments.pop();
    console.log('calling:' + url);
    Request.post({
      url: url,
      json: true,
      body: arguments,
    }, function(err, resp, body) {
      if (err) callback(err);
      else if (resp.statusCode === 500) callback(body);
      else if (resp.statusCode !== 200) callback({statusCode: resp.statusCode});
      else callback(null, body);
    });
  }
}
