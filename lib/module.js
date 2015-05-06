var Path = require('path');
var GetParameterNames = require('get-parameter-names');

var Module = module.exports = function() {
  var self = this;
  arguments = Array.prototype.slice.call(arguments);
  var basePath = arguments.shift();
  var options = arguments.shift();
  var module = options.module;
  var middleware = arguments;
  for (var key in module) {
    var fn = module[key];
    var fnName = key;
    if (typeof fn === 'function') {
      var fnPath = Path.join(basePath, key);
      var postArgs = [
        fnPath,
        getArgMiddleware(fn, options),
      ].concat(middleware).concat([
        getModuleMiddleware(module, fnName, options),
      ]);
      self.router.post.apply(self.router, postArgs);
    }
  }
}

var getArgMiddleware = function(fn, options) {
  var args = GetParameterNames(fn);
  return function(req, res, next) {
    var convertArgs = typeof req.jammin.arguments === 'object' && !Array.isArray(req.jammin.arguments);
    var bodyArgs = convertArgs ? req.jammin.arguments : {};
    if (convertArgs) req.jammin.arguments = [];
    args.forEach(function(arg, index) {
      if (typeof req.query[arg] !== 'undefined') {
        req.jammin.arguments[index] = req.query[arg];
      }
      if (typeof bodyArgs[arg] !== 'undefined') {
        req.jammin.arguments[index] = bodyArgs[arg];
      }
    });
    next();
  }
}

var getModuleMiddleware = function(module, fnName, options) {
  var fn = module[fnName];
  return function(req, res, next) {
    if (!options.async) {
      var result = fn.apply(fn, req.jammin.arguments);
      res.json(result);
    } else {
      req.jammin.arguments.push(function(err, result) {
        if (err) res.status(500).json({error: err});
        else res.json(result || {success: true});
      });
      fn.apply(module, req.jammin.arguments);
    }
  }
}

