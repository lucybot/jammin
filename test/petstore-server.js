var FS = require('fs');
var Hash = require('password-hash');
var Mongoose = require('mongoose');
require('mockgoose')(Mongoose);
var App = require('express')();
App.use(require('cors')());

module.exports.listen = function(port, done) {
  console.log('listening: ' + port);
  App.listen(port || 3000);
  Mongoose.connect('mongodb://example.com/TestingDB', done);
}

var Jammin = require('../index.js'),
    J = Jammin.middleware;
var API = new Jammin.API({
  connection: Mongoose,
});

var UserSchema = Mongoose.Schema({
  username: {type: String, required: true, unique: true, match: /^\w+$/},
  password_hash: {type: String, required: true, select: false},
})

var vaccSchema = Mongoose.Schema({
  name: String,
  date: Date,
}, {_id: false})

var PetSchema = Mongoose.Schema({
  id: {type: Number, required: true, unique: true},
  name: String,
  owner: String,
  animalType: {type: String, default: 'unknown'},
  vaccinations: [vaccSchema]
})

API.addModel('Pet', Mongoose.model('Pet', PetSchema));
API.addModel('User', Mongoose.model('User', UserSchema));

var authenticateUser = function(req, res, next) {
  var query = {
    username: req.headers['username'],
  };
  API.User.model.findOne(query).select('+password_hash').exec(function(err, user) {
    if (err) {
      res.status(500).json({error: err.toString()})
    } else if (!user || !user.password_hash) {
      res.status(401).json({error: "Unknown user:" + query.username});
    } else if (!Hash.verify(req.headers['password'], user.password_hash)) {
      res.status(401).json({error: "Invalid password for " + query.username}) 
    } else {
      req.user = user;
      next();
    }
  }) 
}

// Creates a new user.
API.User.post('/users', function(req, res, next) {
  req.jammin.document.password_hash = Hash.generate(req.body.password);
  next();
});

// Gets all users
API.User.getMany('/users');

// Gets a pet by id.
API.Pet.get('/pets/:id');

// Gets an array of pets that match the query.
API.Pet.getMany('/pets');

// Searches pets by name
API.Pet.getMany('/search/pets', J.sort('+name'), function(req, res, next) {
  req.jammin.query = {
    name: { "$regex": new RegExp(req.query.q) }
  };
  next();
});

var upsert = function(req, res, next) {
  req.jammin.method = 'put';
  next();
}

API.Pet.post('/pets/:id', upsert, authenticateUser, function(req, res, next) {
  req.jammin.document.owner = req.user.username;
  req.jammin.document.id = req.params.id;
  next();
})

// Creates one or more new pets.
API.Pet.postMany('/pets', authenticateUser, function(req, res, next) {
  if (!Array.isArray(req.jammin.document)) req.jammin.document = [req.jammin.document];
  req.jammin.document.forEach(function(pet) {
    pet.owner = req.user.username;
  });
  next();
});

// Setting req.jammin.query.owner ensures that only the logged-in user's
// pets will be returned by any queries Jammin makes to the DB.
var enforceOwnership = function(req, res, next) {
  req.jammin.query.owner = req.user.username;
  next();
}

// Changes a pet.
API.Pet.patch('/pets/:id', authenticateUser, enforceOwnership);

// Changes every pet that matches the query.
API.Pet.patchMany('/pets', authenticateUser, enforceOwnership);

// Deletes a pet by ID.
API.Pet.delete('/pets/:id', authenticateUser, enforceOwnership);

// Deletes every pet that matches the query.
API.Pet.deleteMany('/pets', authenticateUser, enforceOwnership);

API.router.get('/pet_count', function(req, res) {
  API.Pet.getMany(req, res, function(pets) {
    res.json({count: pets.length})
  })
})

API.Pet.getMany('/pet_types', {mapItem: function(pet) {return pet.animalType}})

App.use('/api', API.router);
