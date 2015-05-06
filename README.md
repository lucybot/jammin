## Installation
```npm install jammin```

**Note: Jammin is still in alpha. The API is not stable.**

## About
Jammin is the fastest way (that I know of) to build REST APIs in NodeJS. It consists of:
* A light-weight wrapper around [Mongoose](http://mongoosejs.com/) to expose database operations
* A module wrapper for exposing functions as API calls
* An [Express](http://expressjs.com/) router to expose HTTP methods.

Jammin is fully extensible via middleware to support things like authentication, sanitization, resource ownership, and complex queries.

## Usage

### Modules
Use API.module() to automatically pass ```req.query``` and ```req.body``` as arguments to a pre-defined set of functions.
```js
var App = require('express')();
var Jammin = require('jammin');

var API = new Jammin.API();
API.module('/files', {module: require('fs'), async: true});

App.use('/v0', API.router);
App.listen(3000);
```
```bash
> curl -X POST $HOST/v0/files/writeFile?path=hello.txt -d {"data": "Hello World!"}
> curl -X POST $HOST/v0/files/readFile?path=hello.txt
Hello World!
```

### Database Operations
Use API.define() to create Mongoose models, and expose HTTP methods that will use ```req.params``` and ```req.query``` to query the database and ```req.body``` to update it.
```js
var App = require('express')();
var Jammin = require('jammin');
var API = new Jammin.API('mongodb://<username>:<password>@<mongodb_host>');

var PetSchema = {
  name: String,
  age: Number
};

API.define('Pet', PetSchema);
API.Pet.get('/pets/:name');
API.Pet.post('/pets');

App.use('/v0', API.router);
App.listen(3000);
```

```bash
> curl -X POST $HOST/v0/pets -d '{"name": "Lucy", "age": 2}'
{"success": true}
> curl $HOST/v0/pets/Lucy
{"name": "Lucy", "age": 2}
```

## Documentation

### Modules (beta)
Jammin allows you to expose arbitrary functions as API endpoints. For example, we can give API clients access to the filesystem.
```js
API.module('/files', {module: require('fs'), async: true})
```
Jammin will expose top-level functions in the module as POST requests. Arguments can be passed in via query parameters (with the same names as the function's arguments), a JSON object in the POST body (again, using the function arguments as keys), or a JSON array in the POST body. All three of the following calls are equivalent:
```bash
> curl -X POST $HOST/files?path=foo.txt&data=hello
> curl -X POST $HOST/files -d '{"path": "foo.txt", "data": "hello"}'
> curl -X POST $HOST/files -d '["foo.txt", "hello"]'
```
See the Middleware section below for an example of how to safely expose fs

### Database Operations

**GET** ```get/getMany``` will use ```req.params``` and ```req.query``` to **find an item** or array of items in the database.
```js
API.Pet.get('/pet/:name');
API.Pet.getMany('/pets')
```
**POST** ```post/postMany``` will use ```req.body``` to **create a new item** or set of items in the database.
```js
API.Pet.post('/pets');
API.Pet.postMany('/pets');
```
**PATCH** ```patch/patchMany``` will use ```req.params``` and ```req.query``` to find an item or set of items in the database, and use ```req.body``` to **update those items**.
```js
API.Pet.patch('/pets/:name);
API.Pet.patchMany('/pets');
```
**PUT** ```put/putMany``` will use ```req.params``` and ```req.query``` to find an item or set of items in the database, and use ```req.body``` to **update those items, or create a new item if none exists**
```js
API.Pet.put('/pets/:name');
API.Pet.putMany('/pets');
```
**DELETE** ```delete/deleteMany``` will use ```req.params``` and ```req.query``` to **remove an item** from the database
```js
API.Pet.delete('/pets/:name);
API.Pet.deleteMany('/pets');
```

### Schemas and Validation
See the documentation for [Mongoose Schemas](http://mongoosejs.com/docs/guide.html) for the full set of features.
#### Require fields
```js
var PetSchema = {
  name: {type: String, required: true}
}
```
#### Hide fields
```js
var UserSchema = {
  username: String,
  password_hash: {type: String, select: false}
}
```

### Middleware
You can use middleware to intercept database calls, alter the request, perform authentication, etc.

Change ```req.jammin.query``` to alter how Jammin selects items from the database (GET, PATCH, PUT, DELETE).

Change ```req.jammin.document``` to alter the document Jammin will insert into the database (POST, PATCH, PUT).

Change ```req.jammin.method``` to alter how Jammin interacts with the database.

Change ```req.jammin.arguments``` to alter function calls made to modules.

The example below alters ```req.query``` to construct a complex Mongo query from user inputs.
```js
API.Pet.getMany('/search/pets', function(req, res, next) {
  req.jammin.query = {
    name: { "$regex": new RegExp(req.query.q) }
  };
  next();
});
```
A more complex example achieves lazy deletion:
```js
API.router.use('/pets', function(req, res, next) {
  if (req.method === 'DELETE') {
    req.jammin.method = 'PATCH';
    req.jammin.document = {deleted: true};
  } else if (req.method === 'GET') {
    req.jammin.query.deleted = {"$ne": true};
  } else if (req.method === 'POST' || req.method === 'PUT') {
    req.jammin.document.deleted = false;
  }
  next();
}
```
Or resource ownership:
```js
var setOwnership = function(req, res, next) {
  req.jammin.document.owner = req.user.username;
  next();
}
var ownersOnly = function(req, res, next) {
  req.jammin.query.owner = {"$eq": req.user.username};
  next();
}
API.Pets.get('/pets');
API.Pets.post('/pets', setOwnership);
API.Pets.patch('/pets/:id', ownersOnly);
API.Pets.delete('/pets/:id', ownersOnly);
```
You can also use middleware to alter calls to module functions. The function below 
```js
API.module('/files', {module: require('fs'), async: true}, function(req, res, next) {
  if (req.path.indexOf('Sync') !== -1) return res.status(400).send("Synchronous functions not allowed");
  // Remove path traversals
  req.jammin.arguments[0] = Path.join('/', req.jammin.arguments[0]);
  // Make sure all operations are inside __dirname/user_files
  req.jammin.arguments[0] = Path.join(__dirname, 'user_files', req.jammin.arguments[0]);
  next();
});
```

### Swagger
Serve a [Swagger specification](http://swagger.io) for your API at the specified path. You can use this to document your API via [Swagger UI](https://github.com/swagger-api/swagger-ui) or a [LucyBot portal](https://lucybot.com)
```js
API.swagger('/swagger.json');
```
Jammin will automatically fill out most of your spec, but you can provide additional information:
```
var API = new Jammin({
  databaseURL: DatabaseURL,
  swagger: {
    info: {title: 'Pet Store'},
    host: 'api.example.com',
    basePath: '/api'
  }
});
```

## Extended Usage
See the example [Petstore Server](test/petstore-server.js) for other examples.
