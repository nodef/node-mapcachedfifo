'use strict';
const $ = function MapCachedFifo(src, cap, evict) {
  this._src = src;
  this._size = -1;
  this._num = 0;
  this._cap = cap||1024;
  this._buf = 0.5*this._cap;
  this._evict = evict||0.5;
  this._map = new Map();
  this._set = new Map();
};
module.exports = $;

const _ = $.prototype;

Object.defineProperty(_, 'size', {'get': function() {
  if(this._size>=0) return Promise.resolve(this._size);
  return this.flush().then(() => this._src.size).then((ans) => this._size = ans);
}});

_.flush = function(n) {
  var a = [], i = 0, I = n||this._set.size;
  for(var [k, v] of this._set) {
    a.push(v===undefined? this._src.delete(k) : this._src.set(k, v));
    if(++i>=I) break;
  }
  this._set.clear();
  return Promise.all(a).then(() => i);
};

_.evict = function(n) {
  var i = 0, I = n||this._evict*this._map.size;
  for(var [k, v] of this._map) {
    if(this._set.has(k)) continue;
    this._num -= v===undefined? 0 : 1;
    this._map.delete(k);
    if(++i>=I) break;
  }
  return Promise.resolve(i);
};

_.set = function(k, v) {
  const x = this._map.get(k);
  this._map.set(k, v);
  this._set.set(k, v);
  const dnum = (x===undefined? 1 : 0) - (v===undefined? 1 : 0);
  this._size = this._num===this._size? this._size+dnum : -1;
  this._num += dnum;
  if(this._map.size>this._cap) this.evict();
  if(this._set.size>this._buf) this.flush();
  return Promise.resolve(v);
};

_.get = function(k) {
  if(this._map.has(k) || this._num===this._size) return Promise.resolve(this._map.get(k));
  return this._src.get(k).then((ans) => {
    this._map.set(k, ans);
    this._num += ans===undefined? 0 : 1;
    if(this._map.size>this._cap) this.evict();
    return ans;
  });
};

_.delete = function(k) {
  return this.set(k, undefined);
};

_.has = function(k) {
  this.get(k).then((ans) => ans===undefined? false : true);
};

_.clear = function() {
  this._map.clear();
  this._set.clear();
  this._size = 0;
  this._num = 0;
  return this._src.clear();
};

_.valueOf = function() {
  if(this._num===this._size) return Promise.resolve(this._map);
  this.flush().then(() => this._src.valueOf().then((ans) => {
    this._map = ans;
    this._num = ans.size;
    this._size = ans.size;
    return ans;
  }));
};

_.forEach = function(fn, thisArg) {
  return this.valueOf().then((ans) => ans.forEach(fn, thisArg));
};

_.entries = function() {
  return this.valueOf().then((ans) => ans.entries());
};

_.keys = function() {
  return this.valueOf().then((ans) => ans.keys());
};

_.values = function() {
  return this.valueOf().then((ans) => ans.values());
};
