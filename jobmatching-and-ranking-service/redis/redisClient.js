const Redis = require("ioredis");

const redisClient = new Redis({
  // host: "redis-server",       // container name of Redis service
  // port: 6379,
});


module.exports = redisClient;
