
var pool = require('..');

describe('pool', function(){
  describe('()', function(){
    it('should default max to 50', function(){
      pool()._max.should.eql(50);
    })
  })

  describe('max()', function(){
    it('should set max', function(){
      pool().max(20)._max.should.eql(20);
    })
  })

  describe('constructor()', function(){
    it('should set constructor', function(){
      pool().constructor(pool)._constructor.should.eql(pool);
    })
  })

  describe('add()', function(){
    it('should push an object to items', function(){
      pool().add(1).items.should.eql([1]);
    })

    it('should emit add', function(done){
      pool().on('add', done).add(1);
    })

    it('should increment added', function(){
      pool().add(1).add(1).added.should.eql(2);
    })

    it('should not add more than max', function(){
      pool().max(1).add(1).add(1).items.should.eql([1]);
    })
  })

  describe('generate()', function(){
    it('should support sync generators', function(done){
      var p = pool();
      p.generator(function(){ return 1; });
      p.generate(function(err){
        if (err) return done(err);
        p.items.should.eql([1]);
        done();
      });
    })

    it('should support async generators', function(done){
      var p = pool();
      p.generator(function(fn){ setImmediate(fn.bind(null, null, 1)) });
      p.generate(function(err){
        if (err) return done(err);
        p.items.should.eql([1]);
        done();
      })
    })

    it('should delegate generator errors', function(done){
      var p = pool();
      p.generator(function(fn){ fn(Error('err')); });
      p.generate(function(err){
        if (!err) return done(new Error('expected err'));
        err.message.should.eql('err');
        done();
      })
    })

    it('should emit errors if no callback is supplied', function(done){
      var p = pool();
      p.generator(function(fn){ fn(Error('err')); });
      p.on('error', function(err){
        if (!err) return done(new Error('expected err'));
        done();
      });
      p.generate();
    })
  })

  describe('populate()', function(){
    it('should populate `n` objects', function(){
      var p = pool();
      p.generator(function(){ return 1; });
      p.populate(10);
      p.items.length.should.eql(10);
    })

    it('should set min', function(){
      var p = pool();
      p.generator(function(){ return 1; });
      p.populate(10);
      p._min.should.eql(10);
    });

    it('should not populate more than max', function(){
      var p = pool();
      p.generator(function(){ return 1; });
      p.max(3);
      p.added = 3;
      p.populate(1);
      p.items.should.eql([]);
    })

    it('should call `fn` if supplied', function(done){
      var p = pool();
      p.generator(function(){ return 1; });
      p.populate(10, done);
    })

    it('should emit `populate` when done', function(done){
      var p = pool();
      p.generator(function(){ return 1; });
      p.on('populate', done);
      p.populate(10);
    })

    it('should support async generators', function(done){
      var p = pool();
      p.generator(function(fn){ setImmediate(fn.bind(null, null, 1)); });
      p.populate(10, done);
    })
  })

  describe('return()', function(){
    it('should return an item to items', function(){
      var p = pool();
      p.return(1);
      p.items.should.eql([1]);
    })

    it('should not push if max is reached', function(){
      var p = pool();
      p.max(1);
      p.return(1);
      p.return(1);
      p.items.should.eql([1]);
    })

    it('should destruct an item when there are more items then needed', function(done){
      var p = pool();
      p.constructor(function(){ return {}; });
      p.destructor(function(obj){ obj.destroyed = true; });
      p.max(2);
      p.populate(1);
      p.acquire(function(err, a){
        if (err) return done(err);
        p.acquire(function(err, b){
          if (err) return done(err);
          p.return(a);
          p.return(b);
          p.items.should.eql([{}]);
          b.destroyed.should.be.true;
          done();
        })
      });
    })
  })

  describe('acquire()', function(){
    var p;

    beforeEach(function(done){
      p = pool();
      p.generator(function(done){
        setImmediate(done.bind(null, null, 1));
      });
      p.max(3);
      p.populate(2, done);
    })

    it('supply an item if there are items', function(done){
      p.acquire(function(err, obj){
        if (err) return done(err);
        obj.should.eql(1);
        done();
      })
    })

    it('should generate an item if there are no items', function(done){
      p.items = [];
      p.acquire(function(err, obj){
        if (err) return done(err);
        obj.should.eql(1);
        done();
      });
    })

    it('should wait for an item to be returned', function(done){
      p.populate(10, function(err){
        if (err) return done(err);
        p.items = [];

        p.acquire(function(err, obj){
          if (err) return done(err);
          obj.should.eql('baz');
          done();
        });

        p.return('baz');
      })
    })
  })
})
