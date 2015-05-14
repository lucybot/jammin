var Path = require('path');
var GetParameterNames = require('get-parameter-names');

var ModuleBuilder = module.exports = function(router) {
  this.router = router;
}

ModuleBuilder.prototype.addRoutes = function() {
  arguments = Array.prototype.slice.call(arguments);
  var basePath = arguments.shift();
  var options = arguments.shift();
  var module = options.module;
  var middleware = arguments;
  this.addRoutesFromObject(module, basePath, middleware, options);
}

ModuleBuilder.prototype.addRoutesFromObject = function(obj, path, middleware, options) {
  var self = this;
  for (var key in obj) {
    var item = obj[key];
    var newPath = Path.join(path, key);
    if (typeof item === 'function') {
      var postArgs = [
        newPath,
        getArgMiddleware(item, options),
      ].concat(middleware).concat([
        getMiddleware(obj, key, options),
      ]);
      self.router.post.apply(self.router, postArgs);
    } else if (typeof item === 'object' && !Array.isArray(item)) {
      self.addRoutesFromObject(item, newPath, middleware, options);
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

var getMiddleware = function(obj, fnName, options) {
  var fn = obj[fnName];
  return function(req, res, next) {
    if (!options.async) {
      try {
        var result = fn.apply(fn, req.jammin.arguments);
        res.json(result);
      } catch (err) {
        res.status(500).json({error: err.toString()});
        throw err;
      }
    } else {
      req.jammin.arguments.push(function(err, result) {
        if (err) {
          console.log('JAMMIN ERR', err);
          if (err instanceof Error) return res.status(500).json({error: err.toString()})
          else return res.status(500).json({error: err});
        } else {
          res.json(result || {success: true});
        }
      });
      try {
        fn.apply(obj, req.jammin.arguments);
      } catch (err) {
        res.status(500).json({error: err.toString()});
        throw err;
      }
    }
  }
}

