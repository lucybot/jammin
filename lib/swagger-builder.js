var Mongoose = require('mongoose');

var Builder = function(swagger) {
  this.schemas = {};
  this.swagger = swagger || {};
  this.swagger.swagger = '2.0';
  this.swagger.paths = {};
  this.swagger.definitions = {};
  this.swagger.info = this.swagger.info || {};
  this.swagger.info.title = this.swagger.info.title || 'My API';
  this.swagger.info.version = this.swagger.info.version || '0.0';
  this.swagger.host = this.swagger.host || '127.0.0.1';
  this.swagger.basePath = this.swagger.basePath || '/';
  this.swagger.produces = this.swagger.produces || ['application/json'];
  this.swagger.consumes = this.swagger.consumes || ['application/json'];
};
module.exports = Builder;

Builder.prototype.addDefinition = function(label, schema) {
  this.schemas[label] = schema;
  this.swagger.definitions[label] = convertSchema(schema);
}

Builder.prototype.addRoute = function(details, override) {
  var path = this.swagger.paths[details.path] = this.swagger.paths[details.path] || {};
  var route = path[details.method] = override || {};
  route.description = route.description || getRouteDescription(details);
  if (!route.parameters) {
    route.parameters = [];
    var schema = this.swagger.definitions[details.collection];
    var namedParams = route.parameters.map(function(param) {return param.name})
    var pathParams = (details.path.match(/{\w+}/) || []).map(function(param) {
      return param.substring(1, param.length - 1);
    })
    pathParams.forEach(function(name) {
      if (namedParams.indexOf(name) !== -1) return;
      namedParams.push(name);
      route.parameters.push({
        name: name,
        in: 'path',
        type: schema.properties[name].type
      })
    });
    if (details.method !== 'post') {
      for (name in schema.properties) {
        if (namedParams.indexOf(name) !== -1) continue;
        namedParams.push(name);
        route.parameters.push({
          name: name,
          in: 'query',
          type: schema.properties[name].type
        })
      }
    } else {
      var ref = {'$ref': '#/definitions/' + details.collection};
      route.parameters.push({
        name: 'body',
        in: 'body',
        schema: !details.many ? ref : {type: 'array', items: ref}
      })
    }
  }
  route.responses = route.responses || {};
  route.responses['200'] = route.responses['200'] || {
    description: getResponseDescription(details),
    schema: getResponseSchema(details),
  };
}

var getRouteDescription = function(opts) {
  var desc = '';

  if (opts.method === 'get') desc += 'Retrieves ';
  else if (opts.method === 'post') desc += 'Adds ';
  else if (opts.method === 'patch') desc += 'Updates ';
  else if (opts.method === 'delete') desc += 'Removes ';

  var collDesc = getCollectionDescription(opts);
  desc += collDesc.charAt(0).toLowerCase() + collDesc.substring(1); 

  return desc;
}

var getResponseDescription = function(opts) {
  if (opts.method === 'get' || (opts.method === 'patch' && !opts.many)) {
    return getCollectionDescription(opts);
  } else {
    return 'Success';
  }
}

var getResponseSchema = function(opts) {
  if (opts.method === 'get' || (opts.method === 'patch' && !opts.many)) {
    var ref = {'$ref': '#/definitions/' + opts.collection}
    return !opts.many ? ref : {type: 'array', items: ref};
  }
}

var getCollectionDescription = function(opts) {
  if (opts.many) return 'An array of ' + opts.collection + 's';
  else return 'A ' + opts.collection;
}

var convertSchema = function(mongoose) {
  var json = {type: 'object', properties: {}};
  for (key in mongoose) {
    json.properties[key] = convertSchemaItem(mongoose[key]);
  }
  return json;
}

var convertSchemaItem = function(mongoose) {
  if (Array.isArray(mongoose)) {
    return {type: 'array', items: convertSchemaItem(mongoose[0])};
  }
  if (typeof mongoose !== 'object') {
    mongoose = {type: mongoose};
  } else if (!mongoose.type) {
    return convertSchema(mongoose);
  }

  var json = {};
  var type = mongoose.type;
  if (type === String) {
    json.type = 'string';
  } else if (type === Number) {
    json.type = 'number';
  } else if (type === Date) {
    json.type = 'string';
    json.format = 'date';
  } else if (type === Mongoose.Schema.Types.Mixed) {
    json.type = 'object'
  } else if (type === Mongoose.Schema.Types.Buffer) {
    json.type = 'array';
    json.items = {type: 'string', format: 'byte'};
  } else if (type === Boolean) {
    json.type = 'boolean'
  } else if (type === Mongoose.Schema.Types.ObjectId) {
    json.type = 'string';
  } else if (type === Array) {
    return {type: 'array', items: convertSchemaItem(Mongoose.Schema.Types.Mixed)}
  }
  return json;
}
