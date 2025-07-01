import express from "express";
import dotenv from "dotenv";
import fetch from "node-fetch";
import NodeCache from "node-cache";

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const BASE_URL = "https://api.spoonacular.com";

// Cache with 1-hour expiration (3600 seconds)
const cache = new NodeCache({ stdTTL: 3600 });

// Middleware to parse JSON requests
app.use(express.json());

// Root route - health check
app.get("/", (req, res) => {
  res.send("Spoonacular API wrapper is running! 🍽️");
});

// Search recipes endpoint with caching
app.get("/api/searchRecipes", async (req, res) => {
  const query = req.query.query;
  
  // Validate query parameter
  if (!query) {
    return res.status(400).json({ 
      error: "Query parameter is required",
      example: "/api/searchRecipes?query=chicken"
    });
  }

  // Check if result is cached
  const cacheKey = `search_${query.toLowerCase()}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    console.log(`Serving "${query}" from cache`);
    return res.json({
      ...cached,
      fromCache: true,
      timestamp: new Date().toISOString()
    });
  }

  try {
    // Fetch from Spoonacular API
    console.log(`Fetching "${query}" from Spoonacular API`);
    const response = await fetch(
      `${BASE_URL}/recipes/complexSearch?query=${encodeURIComponent(query)}&apiKey=${process.env.SPOONACULAR_API_KEY}&number=12&addRecipeInformation=true`
    );

    if (!response.ok) {
      throw new Error(`Spoonacular API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    // Store in cache
    cache.set(cacheKey, data);
    console.log(`Cached "${query}" for 1 hour`);

    // Return data with cache info
    res.json({
      ...data,
      fromCache: false,
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    console.error("Error fetching recipes:", err.message);
    res.status(500).json({ 
      error: "Failed to fetch recipes",
      details: err.message 
    });
  }
});

// Get recipe information by ID endpoint
app.get("/api/recipe/:id", async (req, res) => {
  const recipeId = req.params.id;
  
  if (!recipeId || isNaN(recipeId)) {
    return res.status(400).json({ 
      error: "Valid recipe ID is required" 
    });
  }

  // Check cache first
  const cacheKey = `recipe_${recipeId}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    console.log(`Serving recipe ${recipeId} from cache`);
    return res.json({
      ...cached,
      fromCache: true,
      timestamp: new Date().toISOString()
    });
  }

  try {
    console.log(`Fetching recipe ${recipeId} from Spoonacular API`);
    const response = await fetch(
      `${BASE_URL}/recipes/${recipeId}/information?apiKey=${process.env.SPOONACULAR_API_KEY}&includeNutrition=true`
    );

    if (!response.ok) {
      throw new Error(`Spoonacular API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    // Store in cache
    cache.set(cacheKey, data);
    console.log(`Cached recipe ${recipeId} for 1 hour`);

    res.json({
      ...data,
      fromCache: false,
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    console.error("Error fetching recipe:", err.message);
    res.status(500).json({ 
      error: "Failed to fetch recipe details",
      details: err.message 
    });
  }
});

// Cache statistics endpoint
app.get("/api/cache/stats", (req, res) => {
  const keys = cache.keys();
  const stats = {
    totalCachedItems: keys.length,
    cachedQueries: keys.filter(key => key.startsWith('search_')).length,
    cachedRecipes: keys.filter(key => key.startsWith('recipe_')).length,
    cacheKeys: keys
  };
  res.json(stats);
});

// Clear cache endpoint (useful for development)
app.delete("/api/cache/clear", (req, res) => {
  cache.flushAll();
  res.json({ message: "Cache cleared successfully" });
});

// Start the server
app.listen(PORT, () => {
  console.log(`🚀 Spoonacular API wrapper listening on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}`);
  console.log(`🔍 Search recipes: http://localhost:${PORT}/api/searchRecipes?query=chicken`);
  console.log(`📊 Cache stats: http://localhost:${PORT}/api/cache/stats`);
}); 