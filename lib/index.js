
/**
 * Dependencies
 */

var Emitter = require('events').EventEmitter;
var debug = require('debug')('pool');
var Batch = require('batch');
var once = require('once');

/**
 * Export `Pool`
 */

module.exports = Pool;

/**
 * Initialize a new Pool with `max`.
 *
 * @param {Number} max
 * @api public
 */

function Pool(max){
  if (!(this instanceof Pool)) return new Pool(max);
  Emitter.call(this);
  this.max(max || 50);
  this.queue = [];
  this.items = [];
  this.pending = 0;
  this.added = 0;
}

/**
 * Inherit `Emitter`
 */

Pool.prototype.__proto__ = Emitter.prototype;

/**
 * Get total items, including used ones.
 *
 * @return {Number}
 * @api public
 */

Pool.prototype.length = function(){
  return this.added + this.pending;
};

/**
 * Set `max`.
 *
 * @param {Number} max
 * @return {Pool}
 * @api public
 */

Pool.prototype.max = function(max){
  debug('max %d', max);
  this._max = max;
  return this;
};

/**
 * Set `min`.
 *
 * @param {Number} min
 * @return {Pool}
 * @api public
 */

Pool.prototype.min = function(min){
  debug('min %d', min);
  this._min = min;
  return this;
};

/**
 * Set generator `fn`.
 *
 * @param {Function} fn
 * @return {Pool}
 * @api public
 */

Pool.prototype.constructor =
Pool.prototype.generator = function(fn){
  debug('generator %s', fn.name || '-');
  this._constructor = fn;
  return this;
};

/**
 * Set destructor `fn`.
 *
 * @param {Function} fn
 * @return {Pool}
 * @api public
 */

Pool.prototype.destructor = function(fn){
  debug('destructor %s', fn.name || '-');
  this._destructor = fn;
  return this;
};

/**
 * Populate `n` objects with optional `fn`
 *
 * @param {Number} n
 * @param {Function} fn
 * @return {Pool}
 * @api public
 */

Pool.prototype.populate = function(n, fn){
  var error = fn || this.emit.bind(this, 'error');
  var n = Math.min(n, this._max - this.added);
  var batch = new Batch;
  var self = this;

  this.min(n);

  while (0 < n--) {
    batch.push(function(done){
      self.generate(done);
    });
  }

  batch.end(function(err){
    if (err) return error(err);
    if (fn) fn();
    self.emit('populate');
  });

  return this;
};

/**
 * Acquire an object.
 *
 * @param {Function} fn
 * @param {Number} timeout
 * @return {Pool}
 * @api public
 */

Pool.prototype.acquire = function(fn, timeout){
  var ms = timeout || 500;
  var fn = once(fn);
  var self = this;
  var obj;
  var tid;

  if (this.items.length) {
    obj = this.items.pop();
    return setImmediate(function(){
      fn(null, obj);
      debug('acquired, total items: %d', self.items.length);
      self.emit('acquired');
    });
  }

  debug('timeout in %d', ms);
  tid = setTimeout(function(){
    clearTimeout(tid);
    var i = self.queue.indexOf(fn);
    self.queue.splice(i, 1);
    debug('timeout');
    fn();
  }, ms);

  if (this._constructor) {
    return this.generate(function(err, item){
      if (err) return fn(err);
      if (item) clearTimeout(tid);
      if (item) return self.acquire(fn);
      self.queue.push([fn, tid]);
    });
  }

  self.queue.push([fn, tid]);
  return this;
};

/**
 * Return an object.
 *
 * @param {Object} obj
 * @return {Pool}
 * @api public
 */

Pool.prototype.return = function(obj){
  if (this._max <= this.items.length) return this;
  if (this._min <= this.items.length) return this.destruct(obj);
  this.items.push(obj);
  debug('returned, total items: %d', this.items.length);
  this.dequeue();
  this.emit('return');
  return this;
};

/**
 * Add an object.
 *
 * @param {Object} obj
 * @return {Pool}
 * @api private
 */

Pool.prototype.add = function(obj){
  if (1 + this.added > this._max) return this;
  ++this.added;
  this.items.push(obj);
  debug('added, total items: %d', this.items.length);
  this.emit('add');
  return this;
};

/**
 * Construct an item `fn(err, generated)`.
 *
 * @param {Function} fn
 * @return {Pool}
 * @api private
 */

Pool.prototype.construct =
Pool.prototype.generate = function(fn){
  var error = fn || this.emit.bind(this, 'error');
  var fn = fn || function(){};
  var gen = this._constructor;
  var self = this;

  if (this._max <= this.length()) {
    debug('max of %d reached', this._max);
    if (fn) fn();
    return this;
  }

  if (0 == gen.length) {
    this.add(gen());
    if (fn) fn(null, true);
    return;
  }

  ++this.pending;
  gen(function(err, obj){
    --self.pending;
    if (err) return error(err);
    self.add(obj);
    fn(null, true);
  });

  return this;
};

/**
 * Destruct `obj` with `fn(err, obj)`.
 *
 * @param {Object} obj
 * @return {Pool}
 * @api private
 */

Pool.prototype.destruct = function(obj){
  var fn = this._destructor;
  debug('destruct obj');
  if (fn) fn(obj);
  --this.added;
  return this;
};

/**
 * Dequeue awaiting callbacks.
 *
 * @api private
 */

Pool.prototype.dequeue = function(){
  var item = this.queue.shift();
  if (!item) return;
  clearTimeout(item[1]);
  this.acquire(item[0]);
};
