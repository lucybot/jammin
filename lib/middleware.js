var SETTERS = ['limit', 'sort', 'skip', 'projection', 'populate', 'select'];

var J = module.exports = function(args) {
  for (var key in args) {
    if (SETTERS.indexOf(key) === -1) throw new Error("Unsupported key for Jammin: " + key)
  }
  return function(req, res, next) {
    for (var key in args) {
      req.jammin[key] = args[key];
    }
    next();
  }
};

SETTERS.forEach(function(s) {
  J[s] = function(arg) {
    return function(req, res, next) {
      req.jammin[s] = arg;
      next();
    }
  }
})

