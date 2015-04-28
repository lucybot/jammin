var FS = require('fs');
var Request = require('request');
var Expect = require('chai').expect;
var Petstore = require('./petstore-server.js');

var SWAGGER_GOLDEN_FILE = __dirname + '/golden/petstore.swagger.json';
var BASE_URL = 'http://127.0.0.1:3000/api';

var USER_1 = {username: 'user1', password: 'jabberwocky'}
var USER_2 = {username: 'user2', password: 'cabbagesandkings'}

var successResponse = function(expectedBody, done) {
  if (!done) {
    done = expectedBody;
    expectedBody = {success: true};
  }
  return function(err, res, body) {
    if (body.error) console.log(body.error);
    Expect(err).to.equal(null);
    Expect(res.statusCode).to.equal(200);
    Expect(body.error).to.equal(undefined);
    if (!expectedBody) {
      Expect(body.success).to.equal(true);
    } else {
      if (Array.isArray(expectedBody)) {
        Expect(body).to.deep.have.members(expectedBody);
        Expect(expectedBody).to.deep.have.members(body);
      } else {
        Expect(body).to.deep.equal(expectedBody);
      }
    }
    done();
  }
}

var failResponse = function(statusCode, done) {
  return function(err, res, body) {
    Expect(err).to.equal(null);
    Expect(res.statusCode).to.equal(statusCode);
    Expect(body.error).to.not.equal(null);
    done();
  }
}

describe('Petstore', function() {
  before(function(done) {
    Petstore.listen(3000);
    Petstore.dropAllEntries(done);
  });

  it('should allow new users', function(done) {
    Request.post({
      url: BASE_URL + '/user',
      body: USER_1,
      json: true
    }, successResponse(null, done));
  });

  it('should not allow duplicate user names', function(done) {
    Request.post({
      url: BASE_URL + '/user',
      body: USER_1,
      json: true
    }, failResponse(500, done));
  })

  it('should allow a second user', function(done) {
    Request.post({
      url: BASE_URL + '/user',
      body: USER_2,
      json: true
    }, successResponse(null, done));
  })

  it('should allow new pets', function(done) {
    Request.post({
      url: BASE_URL + '/pets',
      body: {id: 42, name: 'Lucy'},
      headers: USER_1,
      json: true
    }, successResponse(null, done));
  })

  it('should allow a second pet', function(done) {
    Request.post({
      url: BASE_URL + '/pets',
      body: {id: 43, name: 'Goose'},
      headers: USER_2,
      json: true
    }, successResponse(null, done));
  })

  it('should not allow modifications from wrong user', function(done) {
    Request({
      method: 'patch',
      url: BASE_URL + '/pets/42',
      headers: USER_2,
      json: true
    }, failResponse(404, done)); // TODO: should be 401
  })

  it('should allow modifications to pet', function(done) {
    Request({
      method: 'patch',
      url: BASE_URL + '/pets/42',
      headers: USER_1,
      body: {name: 'Loosey'},
      json: true
    }, successResponse(done));
  })

  it('should allow searching', function(done) {
    Request.get({
      url: BASE_URL + '/search/pets',
      qs: {q: 'oos'},
      json: true
    }, successResponse([
      {id: 42, name: "Loosey", owner: USER_1.username, animalType: "unknown"},
      {id: 43, name: "Goose", owner: USER_2.username, animalType: "unknown"}
    ], done))
  })

  it('should not allow duplicate pets', function(done) {
    Request.post({
      url: BASE_URL + '/pets',
      body: {id: 42, name: 'Goose'},
      headers: USER_1,
      json: true
    }, failResponse(500, done))
  })

  it('should not allow new pets without auth', function(done) {
    Request.post({
      url: BASE_URL + '/pets',
      body: {id: 43, name: 'Goose'},
      json: true
    }, failResponse(401, done));
  })

  it('should not allow deletes without auth', function(done) {
    Request({
      method: 'delete',
      url: BASE_URL + '/pets/42',
      json: true
    }, failResponse(401, done));
  })

  it('should not allow deletes from wrong user', function(done) {
    Request({
      method: 'delete',
      url: BASE_URL + '/pets/42',
      headers: USER_2,
      json: true
    }, failResponse(404, done)); // TODO: should return 401
  });

  it('should not reflect bad delete', function(done) {
    Request.get({
      url: BASE_URL + '/pets/42',
      json: true
    }, successResponse({id: 42, name: 'Loosey', owner: USER_1.username, animalType: "unknown"}, done));
  })

  it('should not allow deletes with wrong password', function(done) {
    Request({
      method: 'delete',
      url: BASE_URL + '/pets/42',
      headers: {
        username: USER_1.username,
        password: USER_2.password
      },
      json: true
    }, failResponse(401, done));
  })

  it('should allow deletes from owner', function(done) {
    Request({
      method: 'delete',
      url: BASE_URL + '/pets/42',
      headers: USER_1,
      json: true
    }, successResponse(null, done));
  })

  it('should allow batched adds of pets', function(done) {
    Request.post({
      url: BASE_URL + '/pets',
      headers: USER_1,
      body: [{
        id: 1,
        name: "Pet1",
        animalType: "cat",
      }, {
        id: 2,
        name: "Pet2",
        animalType: "cat",
      }, {
        id: 3,
        name: "Pet3",
        animalType: "cat",
      }],
      json: true
    }, successResponse(null, done))
  })

  it('should allow batched modification of pets', function(done) {
    Request({
      method: 'patch',
      url: BASE_URL + '/pets',
      headers: USER_1,
      qs: {
        animalType: 'cat'
      },
      body: {
        animalType: 'dog'
      },
      json: true
    }, successResponse(null, done))
  })

  it('should reflect batched modification', function(done) {
    Request.get({
      url: BASE_URL + '/pets',
      qs: {
        animalType: 'dog'
      },
      json: true
    }, successResponse([
        {id: 1, name: "Pet1", owner: USER_1.username, animalType: 'dog'},
        {id: 2, name: "Pet2", owner: USER_1.username, animalType: 'dog'},
        {id: 3, name: "Pet3", owner: USER_1.username, animalType: 'dog'},
    ], done))
  })

  it('should support pet_count', function(done) {
    Request.get({
      url: BASE_URL + '/pet_count',
      json: true
    }, successResponse({count: 4}, done));
  });

  it('should support mapItem to get pet types', function(done) {
    Request.get({
      url: BASE_URL + '/pet_types',
      json: true,
    }, successResponse(['dog', 'dog', 'dog', 'unknown'], done));
  })

  it('should allow batched deletes of pets', function(done) {
    Request({
      method: 'delete',
      url: BASE_URL + '/pets',
      headers: USER_1,
      qs: {
        animalType: "dog"
      },
      json: true
    }, successResponse(null, done))
  })

  it('should serve swagger docs', function(done) {
    Request.get({
      url: BASE_URL + '/swagger.json',
      json: true
    }, function(err, res, body) {
      Expect(err).to.equal(null);
      if (process.env.WRITE_GOLDEN) {
        console.log("Writing new golden file!");
        FS.writeFileSync(SWAGGER_GOLDEN_FILE, JSON.stringify(body, null, 2));
      } else {
        var golden = JSON.parse(FS.readFileSync(SWAGGER_GOLDEN_FILE, 'utf8'));
        Expect(body).to.deep.equal(golden);
      }
      done();
    })
  })
})
