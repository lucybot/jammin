var Mongoose = require('mongoose');
var Express = require('express');
var BodyParser = require('body-parser');

var Definition = require('./definition.js');
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

var API = module.exports = function(options) {
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
API.prototype.module = require('./module.js');
API.Schema = Mongoose.Schema;

API.prototype.define = function(label, schema) {
  this.swaggerBuilder.addDefinition(label, schema);
  if (Object.keys(this).indexOf(label) !== -1) {
    throw new Error("Invalid label " + label + "\nLabel is restricted or already defined")
  }
  this[label] = new Definition(this, label, schema);
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

