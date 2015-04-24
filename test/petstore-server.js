var FS = require('fs');
var Hash = require('password-hash');
var App = require('express')();

module.exports.listen = function(port) {
  App.listen(port || 3000);
}

module.exports.dropAllEntries = function(callback) {
  API.pet.db.remove({}, function(err) {
    API.user.db.remove({}, function(err) {
      callback();
    })
  })
}

var DatabaseURL = JSON.parse(FS.readFileSync('./creds/mongo.json', 'utf8')).url;
var Jammin = require('../index.js')
var API = new Jammin({
  databaseURL: DatabaseURL,
  swagger: {
    info: {title: 'Pet Store'},
    host: 'api.example.com',
    basePath: '/api'
  }
});

var UserSchema = {
  username: {type: String, required: true, unique: true, match: /^\w+$/},
  password_hash: {type: String, required: true},
}

var PetSchema = {
  id: {type: Number, required: true, unique: true},
  name: String,
  owner: String,
  animalType: {type: String, default: 'unknown'}
}

var authenticateUser = function(req, res, next) {
  var query = {
    username: req.headers['username'],
  };
  API.user.db.findOne(query, function(err, user) {
    if (err) {
      res.status(500).json({error: err.toString()})
    } else if (!user) {
      res.status(401).json({error: "Unknown user:" + query.username});
    } else if (!Hash.verify(req.headers['password'], user.password_hash)) {
      res.status(401).json({error: "Invalid password for " + query.username}) 
    } else {
      req.user = user;
      next();
    }
  }) 
}

API.define('pet', PetSchema);
API.define('user', UserSchema);

// Creates a new user.
API.user.post('/user', function(req, res, next) {
  req.body.password_hash = Hash.generate(req.body.password);
  next();
});

// Gets a pet by id.
API.pet.get('/pets/{id}');

// Gets an array of pets that match the query.
API.pet.getMany('/pets');

// Searches pets by name
API.pet.getMany('/search/pets', {
  swagger: {
    description: "Search all pets by name",
    parameters: [
      {name: 'q', in: 'query', type: 'string', description: 'Any regex'}
    ]
  }
}, function(req, res, next) {
  req.query = {
    name: { "$regex": new RegExp(req.query.q) }
  };
  next();
})

// Creates one or more new pets.
API.pet.postMany('/pets', authenticateUser, function(req, res, next) {
  if (!Array.isArray(req.body)) req.body = [req.body];
  req.body.forEach(function(pet) {
    pet.owner = req.user.username;
  });
  next();
});

// Setting req.query.owner ensures that only the logged-in user's
// pets will be returned by any queries Jammin makes to the DB.
var enforceOwnership = function(req, res, next) {
  req.query.owner = req.user.username;
  next();
}

// Changes a pet.
API.pet.patch('/pets/{id}', authenticateUser, enforceOwnership);

// Changes every pet that matches the query.
API.pet.patchMany('/pets', authenticateUser, enforceOwnership);

// Deletes a pet by ID.
API.pet.delete('/pets/{id}', authenticateUser, enforceOwnership);

// Deletes every pet that matches the query.
API.pet.deleteMany('/pets', authenticateUser, enforceOwnership);

App.use('/api', API.router);
