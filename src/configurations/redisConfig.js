import redis from "redis";

// Create Redis client with retry strategy and proper error handling
const client = redis.createClient({
  url: "redis://127.0.0.1:6379", // Default Redis port is 6379, not 7979
  socket: {
    reconnectStrategy: (retries) => {
      // Exponential backoff with max retries
      const delay = Math.min(retries * 50, 2000);
      return delay;
    },
    connectTimeout: 10000, // 10 seconds
  },
});

// Error handling
client.on("error", (err) => {
  console.error("Redis Client Error:", err);
});

client.on("connect", () => {
  console.log("Successfully connected to Redis");
});

client.on("reconnecting", () => {
  console.log("Reconnecting to Redis...");
});

client.on("end", () => {
  console.log("Redis connection ended");
});

// Connect to Redis
const connectRedis = async () => {
  try {
    await client.connect();
  } catch (err) {
    console.error("Failed to connect to Redis:", err);
    // Don't throw here, let the application continue without Redis
  }
};

// Initialize connection
connectRedis();

export default client;
