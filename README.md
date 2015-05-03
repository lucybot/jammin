## Installation
```npm install jammin```

**Note: Jammin is still in alpha. The API is not stable.**

## About
Jammin is the fastest way (that I know of) to build REST APIs in NodeJS. It consists of a light-weight wrapper around [Mongoose](http://mongoosejs.com/) for database operations and an [Express](http://expressjs.com/) router to expose HTTP methods. It is fully extensible via middleware to support things like authentication, resource ownership, and complex queries.

## Usage

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
> curl -X POST 127.0.0.1:3000/v0/pets -d '{"name": "Lucy", "age": 2}'
{"success": true}
> curl 127.0.0.1:3000/v0/pets/Lucy
{"name": "Lucy", "age": 2}
```

### GET
Jammin will use ```req.params``` and ```req.query``` to **find an item** in the database.
```js
API.Pet.get('/pet/:name);
```
Use ```getMany``` to return an array of matching documents.
```js
API.Pet.getMany('/pet')
```

### POST
Jammin will use ```req.body``` to **create a new item** in the database.
```js
API.Pet.post('/pets');
```
Use ```postMany``` to accept an array of items to be created.
```js
API.Pet.postMany('/pets');
```

### PATCH
Jammin will use ```req.params``` and ```req.query``` to find an item in the database, and use ```req.body``` to **update that item**.
```js
API.Pet.patch('/pets/:name);
```
Use ```patchMany``` to update every matching item in the database.
```js
API.Pet.patchMany('/pets');
```

### DELETE
Jammin will use ```req.params``` and ```req.query``` to **remove an item** from the database.
```js
API.Pet.delete('/pets/:name);
```
Use deleteMany to delete every matching item in the database.
```js
API.Pet.deleteMany('/pets');
```

### Middleware
You can use middleware to intercept database calls, alter the request, perform authentication, etc.

Change ```req.jammin.query``` to alter how Jammin selects items from the database.

Change ```req.jammin.document``` to alter the document Jammin will insert into the database.

Change ```req.jammin.method``` to alter how Jammin interacts with the database.

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
