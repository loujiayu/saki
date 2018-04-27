class localStorage {
  constructor() {
    this.item = new Map();
  }
  setItem(key, value) {
    this.item.set(key, value);
  }
  getItem(key) {
    this.item.get(key);
  }
  removeItem(key) {
    this.item.delete(key);
  }
}

global.localStorage = new localStorage();
