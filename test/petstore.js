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

var UserSchema = new Jammin.Schema({
  username: {type: String, required: true, unique: true, match: /^\w+$/},
  password_hash: {type: String, required: true},
})

var PetSchema = new Jammin.Schema({
  id: {type: Number, required: true, unique: true},
  name: String,
  owner: {type: Jammin.Schema.ObjectId, ref: 'User'},
  animalType: String,
  imageURLs: [String]
})

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

// Creates a new user
API.user.post('/user', function(req, res, next) {
  req.body.password_hash = Hash.generate(req.body.password);
  next();
});

// Gets a pet by id
API.pet.get('/pets/{id}');

// Searches pets by name
API.pet.getMany('/search/pets', {
  swagger: {
    description: "Search all pets by name",
    parameters: [
      {name: 'q', in: 'query', type: 'string', description: 'Any regex'}
    ]
  }
}, function(req, res, next) {
  var userQuery = Util._extend({}, req.query);
  req.query = {
    name: { "$regex": new RegExp(userQuery.q) }
  };
  next();
})

// Creates a new pet
API.pet.post('/pets', authenticateUser, function(req, res, next) {
  req.body.owner = req.user._id;
  next();
});

// Delete's a pet.
API.pet.delete('/pets/{id}', authenticateUser, function(req, res, next) {
  req.query = {
    id: req.params.id,
    // By setting 'owner', we ensure the user can only delete his own pets.
    owner: req.user._id
  };
  next();
});

App.use('/api', API.router);

