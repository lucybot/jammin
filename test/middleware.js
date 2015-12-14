var expect = require('chai').expect;

var J = require('../lib/middleware.js');

describe('Middleware', function() {
  it('should allow object API', function(done) {
    var req = {jammin: {}};
    J({limit: 20})(req, {}, function() {
      expect(req.jammin.limit).to.equal(20);
      done();
    })
  })

  it('should allow function API', function(done) {
    var req = {jammin: {}};
    J.limit(20)(req, {}, function() {
      expect(req.jammin.limit).to.equal(20);
      done();
    })
  })

  it('should throw error for bad key', function() {
    var fn = function() {J({foo: 'bar'})}
    expect(fn).to.throw(Error);
  })
})
