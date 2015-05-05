var Path = require('path');
var Async = require('async');
var Mongoose = require('mongoose');
var Express = require('express');
var BodyParser = require('body-parser');
var PathToRegexp = require('path-to-regexp');

var SwaggerBuilder = require('./swagger-builder.js');

var MONGO_FIELDS = ['_id', '__v'];
var SELECT = MONGO_FIELDS.map(function(f) {return '-' + f}).join(' ');
var METHODS = ['get', 'patch', 'put', 'post', 'delete'];

var removeMongoFields = function(obj) {
  if (typeof obj !== 'object') return obj;
  else if (Array.isArray(obj)) return obj.map(removeMongoFields);
  else {
    for (key in obj) {
      if (MONGO_FIELDS.indexOf(key) === -1) {
        obj[key] = removeMongoFields(obj[key]);
      } else {
        delete obj[key];
      }
    }
    return obj;
  }
}

var setJamminDefaults = function(req, res, next) {
  if (!req.jammin) {
    req.jammin = {
      query: JSON.parse(JSON.stringify(req.query)),
      document: JSON.parse(JSON.stringify(req.body)),
      arguments: JSON.parse(JSON.stringify(req.body)),
      method: req.method.toLowerCase(),
    }
  }
  for (key in req.params) {
    req.jammin.query[key] = req.params[key];
  }
  next();
}

/** API **/

var API = function(options) {
  options = options || {};
  if (typeof options === 'string') options =  {databaseURL: options};
  var self = this;
  self.router = Express.Router();
  self.router.use(BodyParser.json());
  METHODS.concat(['use']).forEach(function(method) {
    var origFunc = self.router[method];
    self.router[method] = function() {
      arguments = Array.prototype.slice.call(arguments);
      var insertLoc = 0;
      for (var i = 0; i < arguments.length; ++i) {
        if (typeof arguments[i] === 'function') {
          insertLoc = i;
          break;
        }
      }
      arguments.splice(insertLoc, 0, setJamminDefaults);
      return origFunc.apply(self.router, arguments);
    }
  })
  if (options.databaseURL) {
    self.mongoose = Mongoose.createConnection(options.databaseURL);
  }
  self.swaggerBuilder = new SwaggerBuilder(options.swagger);
}
module.exports = API;
API.Schema = Mongoose.Schema;

API.prototype.define = function(label, schema) {
  this.swaggerBuilder.addDefinition(label, schema);
  if (Object.keys(this).indexOf(label) !== -1) {
    throw new Error("Invalid label " + label + "\nLabel is restricted or already defined")
  }
  this[label] = new Definition(this, label, schema);
}

var getModuleRoute = function(fn, options) {
  return function(req, res, next) {
    if (!options.async) {
      var result = fn.apply(fn, req.jammin.arguments);
      res.json(result);
    } else {
      req.jammin.arguments.push(function(err, result) {
        if (err) res.status(500).json({error: err});
        else res.json(result || {success: true});
      });
      fn.apply(fn, req.jammin.arguments);
    }
  }
}

API.prototype.module = function() {
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
      var postArgs = [fnPath].concat(middleware).concat(getModuleRoute(fn, options));
      self.router.post.apply(self.router, postArgs);
    }
  }
}

API.prototype.swagger = function() {
  var self = this;
  arguments = Array.prototype.slice.call(arguments);
  var path = arguments[0];
  var middleware = arguments.splice(1);
  var options  = typeof middleware[0] === 'object' ? middleware.shift() : {};
  middleware.unshift(path);
  middleware.push(function(req, res, next) {
    if (req.query.pretty) {
      res.set('Content-Type', 'application/json');
      res.send(JSON.stringify(self.swaggerBuilder.swagger, null, 2));
    } else {
      res.json(self.swaggerBuilder.swagger);
    }
  })
  self.router.get.apply(self.router, middleware);
}

/** Definition **/

var Definition = function(api, label, schema) {
  this.api = api;
  this.label = label;
  this.db = api.mongoose.model(label, new Mongoose.Schema(schema));
}

Definition.prototype.queryDB = function(method, many, query, doc, callback) {
  var self = this;
  if (method === 'get') {
    var find = many ? self.db.find : self.db.findOne;
    find.apply(self.db, [query, SELECT]).exec(callback);
  } else if (method === 'post') {
    var docs = many ? doc : [doc];
    Async.parallel(docs.map(function(doc) {
      return function(callback) {
        var toAdd = new self.db(doc);
        toAdd.save(callback);
      }
    }), function(err) {
      callback(err, {success: true});
    })
  } else if (method === 'put') {
    var docs = many ? doc : [doc];
    Async.parallel(docs.map(function(doc) {
      return function(callback) {
        self.db.findOneAndUpdate(query, doc, {upsert: true}).select(SELECT).exec(callback);
      }
    }), callback);
  } else if (method === 'patch') {
    if (many) {
      self.db.update(query, doc, {multi: true}).select(SELECT).exec(function(err) {
        callback(err, {success: true});
      })
    } else {
      self.db.findOneAndUpdate(query, doc, {new: true}).select(SELECT).exec(callback);
    }
  } else if (method === 'delete') {
    var remove = many ? self.db.remove : self.db.findOneAndRemove;
    remove.apply(self.db, [query]).exec(function(err, thing) {
      callback(err, thing);
    })
  } else {
    throw new Error("Unsupported method:" + method);
  }
}

var getRouteFunction = function(method, many) {
  // Can be called with (path[, middleware...]) or (req, res, callback);
  return function() {
    var self = this;
    var sendResponse = typeof arguments[0] === 'string';
    var options = sendResponse && typeof arguments[1] === 'object' ? arguments[1] : {};
    var dbAction = function(req, res, next) {
      self.queryDB(req.jammin.method, many, req.jammin.query, req.jammin.document, function(err, thing) {
        if (err) res.status(500).json({error: err.toString()});
        else if (!thing) res.status(404).json({error: 'Not Found'})
        else if (sendResponse && method === 'get') {
          if (many) thing = thing.map(function(t) { return t.toObject({versionKey: false}) });
          else thing = thing.toObject({versionKey: false});
          if (options.mapItem) {
            if (many) thing = thing.map(options.mapItem);
            else thing = options.mapItem(thing);
          }
          removeMongoFields(thing);
          res.json(thing);
        }
        else if (sendResponse) res.json({success: true})
        else next(thing);
      })
    }
    // If we get (req, res, callback) instead of a path, just apply
    // dbAction. Otherwise delegate to the router.
    if (!sendResponse) return dbAction.apply(self, arguments);
    
    arguments = Array.prototype.slice.call(arguments);
    var expressPath = arguments[0];
    var keys = [];
    PathToRegexp(expressPath, keys);
    var swaggerPath = expressPath;
    keys.forEach(function(key) {
      swaggerPath = swaggerPath.replace(':' + key.name, '{' + key.name + '}');
    });
    var middleware = arguments.splice(1);
    if (typeof middleware[0] === 'object') middleware.shift();
    if (options.swagger) options.swagger = JSON.parse(JSON.stringify(options.swagger));
    self.api.swaggerBuilder.addRoute({
      method: method,
      path: swaggerPath,
      collection: self.label,
      many: many
    }, options.swagger);
    middleware.push(dbAction);
    middleware.unshift(expressPath);
    this.api.router[method].apply(this.api.router, middleware);
  }
}

METHODS.forEach(function(method) {
  Definition.prototype[method] = getRouteFunction(method);
  Definition.prototype[method + 'Many'] = getRouteFunction(method, true)
})
