var Request = require('request');
var Path = require('path');

var Client = module.exports = function(options) {
  this.options = options;
  this.addFunctionsFromObject(options.module, options.basePath || '/');
}

Client.prototype.addFunctionsFromObject = function(obj, path, keys) {
  var self = this;
  keys = keys || [];
  for (var key in obj) {
    var fn = obj[key];
    var newPath = Path.join(path, key);
    if (typeof fn === 'function' || fn === true) {
      var url = self.options.host + newPath;
      var container = this;
      keys.forEach(function(k) {
        container[k] = container[k] || {};
        container = container[k];
      });
      container[key] = getProxyFunction(url);
    } else if (typeof fn === 'object' && !Array.isArray(fn)) {
      self.addFunctionsFromObject(fn, newPath, keys.concat(key));
    }
  }
}

var getProxyFunction = function(url) {
  return function() {
    arguments = Array.prototype.slice.call(arguments);
    var callback = arguments.pop();
    Request.post({
      url: url,
      json: true,
      body: arguments,
    }, function(err, resp, body) {
      if (err) callback(err);
      else if (resp.statusCode === 500) callback(body.error);
      else if (resp.statusCode !== 200) callback({statusCode: resp.statusCode});
      else callback(null, body);
    });
  }
}
