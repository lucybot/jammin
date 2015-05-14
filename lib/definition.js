var Async = require('async');
var Mongoose = require('mongoose');
var BodyParser = require('body-parser');
var PathToRegexp = require('path-to-regexp');

var Definition = module.exports = function(api, label, schema) {
  this.api = api;
  this.label = label;
  this.db = api.mongoose.model(label, new Mongoose.Schema(schema));
}

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
    arguments = Array.prototype.slice.call(arguments);
    var isMiddleware = typeof arguments[0] !== 'string';
    var sendResponse = !isMiddleware || arguments.length === 2;
    var options = sendResponse && typeof arguments[1] === 'object' ? arguments[1] : {};
    var dbAction = function(req, res, next) {
      var useMethod = isMiddleware ? method : req.jammin.method;
      self.queryDB(useMethod, many, req.jammin.query, req.jammin.document, function(err, thing) {
        if (err) res.status(500).json({error: err.toString()});
        else if (!thing) res.status(404).json({error: 'Not Found'})
        else if (sendResponse && useMethod === 'get') {
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
    if (isMiddleware) return dbAction.apply(self, arguments);
    
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
