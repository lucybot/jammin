var Request = require('request');
var Expect = require('chai').expect;
var Petstore = require('./petstore.js');

var BASE_URL = 'http://127.0.0.1:3000/api';

var USER_1 = {username: 'user1', password: 'jabberwocky'}
var USER_2 = {username: 'user2', password: 'cabbagesandkings'}

var successResponse = function(expectedBody, done) {
  return function(err, res, body) {
    Expect(err).to.equal(null);
    Expect(res.statusCode).to.equal(200);
    Expect(body.error).to.equal(undefined);
    if (!expectedBody) {
      Expect(body.success).to.equal(true);
    } else {
      Expect(body).to.equal(expectedBody);
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
    done();
  });

  after(function(done) {
    Petstore.dropAllEntries(done);
  })

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
})
