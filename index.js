import express from "express";
import dotenv from "dotenv";
import fetch from "node-fetch";
import NodeCache from "node-cache";
import cors from "cors";

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const BASE_URL = "https://api.spoonacular.com";

// Cache with 1-hour expiration (3600 seconds)
const cache = new NodeCache({ stdTTL: 3600 });

// Middleware to parse JSON requests
app.use(express.json());

// Enable CORS for all routes
app.use(cors({
  origin: true, // Allow all origins in development
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Helper function to make API calls with caching
async function fetchWithCache(cacheKey, url, cacheDuration = 3600) {
  // Check cache first
  const cached = cache.get(cacheKey);
  if (cached) {
    console.log(`Serving from cache: ${cacheKey}`);
    return {
      ...cached,
      fromCache: true,
      timestamp: new Date().toISOString()
    };
  }

  try {
    console.log(`Fetching from API: ${url}`);
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    // Store in cache
    cache.set(cacheKey, data, cacheDuration);
    console.log(`Cached: ${cacheKey}`);

    return {
      ...data,
      fromCache: false,
      timestamp: new Date().toISOString()
    };

  } catch (err) {
    throw new Error(`Failed to fetch data: ${err.message}`);
  }
}

// Root route - health check
app.get("/", (req, res) => {
  res.send("Spoonacular API wrapper is running! 🍽️");
});

// Debug endpoint to check environment variables
app.get("/api/debug", (req, res) => {
  res.json({
    hasSpoonacularKey: !!process.env.SPOONACULAR_API_KEY,
    keyLength: process.env.SPOONACULAR_API_KEY ? process.env.SPOONACULAR_API_KEY.length : 0,
    nodeEnv: process.env.NODE_ENV || 'not set'
  });
});

// RECIPE ENDPOINTS

// Search recipes endpoint with caching
app.get("/api/searchRecipes", async (req, res) => {
  const query = req.query.query;
  
  if (!query) {
    return res.status(400).json({ 
      error: "Query parameter is required",
      example: "/api/searchRecipes?query=chicken"
    });
  }

  try {
    const cacheKey = `search_${query.toLowerCase()}`;
    const url = `${BASE_URL}/recipes/complexSearch?query=${encodeURIComponent(query)}&apiKey=${process.env.SPOONACULAR_API_KEY}&number=12&addRecipeInformation=true`;
    const result = await fetchWithCache(cacheKey, url);
    res.json(result);
  } catch (err) {
    console.error("Error searching recipes:", err.message);
    res.status(500).json({ error: "Failed to search recipes", details: err.message });
  }
});

// Search recipes by nutrients
app.get("/api/searchRecipesByNutrients", async (req, res) => {
  const { minCarbs, maxCarbs, minProtein, maxProtein, minFat, maxFat, minCalories, maxCalories } = req.query;
  
  try {
    const params = new URLSearchParams({
      apiKey: process.env.SPOONACULAR_API_KEY,
      number: req.query.number || '12'
    });
    
    if (minCarbs) params.append('minCarbs', minCarbs);
    if (maxCarbs) params.append('maxCarbs', maxCarbs);
    if (minProtein) params.append('minProtein', minProtein);
    if (maxProtein) params.append('maxProtein', maxProtein);
    if (minFat) params.append('minFat', minFat);
    if (maxFat) params.append('maxFat', maxFat);
    if (minCalories) params.append('minCalories', minCalories);
    if (maxCalories) params.append('maxCalories', maxCalories);

    const cacheKey = `nutrients_${params.toString()}`;
    const url = `${BASE_URL}/recipes/findByNutrients?${params}`;
    const result = await fetchWithCache(cacheKey, url);
    res.json(result);
  } catch (err) {
    console.error("Error searching recipes by nutrients:", err.message);
    res.status(500).json({ error: "Failed to search recipes by nutrients", details: err.message });
  }
});

// Search recipes by ingredients
app.get("/api/searchRecipesByIngredients", async (req, res) => {
  const { ingredients } = req.query;
  
  if (!ingredients) {
    return res.status(400).json({ 
      error: "Ingredients parameter is required",
      example: "/api/searchRecipesByIngredients?ingredients=apples,flour,sugar"
    });
  }

  try {
    const params = new URLSearchParams({
      ingredients: ingredients,
      apiKey: process.env.SPOONACULAR_API_KEY,
      number: req.query.number || '12',
      ranking: req.query.ranking || '1',
      ignorePantry: req.query.ignorePantry || 'false'
    });

    const cacheKey = `ingredients_${ingredients.toLowerCase()}`;
    const url = `${BASE_URL}/recipes/findByIngredients?${params}`;
    const result = await fetchWithCache(cacheKey, url);
    res.json(result);
  } catch (err) {
    console.error("Error searching recipes by ingredients:", err.message);
    res.status(500).json({ error: "Failed to search recipes by ingredients", details: err.message });
  }
});

// Get recipe information by ID
app.get("/api/recipe/:id", async (req, res) => {
  const recipeId = req.params.id;
  
  if (!recipeId || isNaN(recipeId)) {
    return res.status(400).json({ error: "Valid recipe ID is required" });
  }

  try {
    const cacheKey = `recipe_${recipeId}`;
    const url = `${BASE_URL}/recipes/${recipeId}/information?apiKey=${process.env.SPOONACULAR_API_KEY}&includeNutrition=true`;
    const result = await fetchWithCache(cacheKey, url);
    res.json(result);
  } catch (err) {
    console.error("Error fetching recipe:", err.message);
    res.status(500).json({ error: "Failed to fetch recipe details", details: err.message });
  }
});

// Get recipe information bulk
app.post("/api/recipes/bulk", async (req, res) => {
  const { ids } = req.body;
  
  if (!ids || !Array.isArray(ids)) {
    return res.status(400).json({ error: "Array of recipe IDs is required in request body" });
  }

  try {
    const idsString = ids.join(',');
    const cacheKey = `bulk_${idsString}`;
    const url = `${BASE_URL}/recipes/informationBulk?ids=${idsString}&apiKey=${process.env.SPOONACULAR_API_KEY}&includeNutrition=true`;
    const result = await fetchWithCache(cacheKey, url);
    res.json(result);
  } catch (err) {
    console.error("Error fetching bulk recipes:", err.message);
    res.status(500).json({ error: "Failed to fetch bulk recipes", details: err.message });
  }
});

// Get similar recipes
app.get("/api/recipe/:id/similar", async (req, res) => {
  const recipeId = req.params.id;
  
  if (!recipeId || isNaN(recipeId)) {
    return res.status(400).json({ error: "Valid recipe ID is required" });
  }

  try {
    const cacheKey = `similar_${recipeId}`;
    const url = `${BASE_URL}/recipes/${recipeId}/similar?apiKey=${process.env.SPOONACULAR_API_KEY}&number=${req.query.number || '3'}`;
    const result = await fetchWithCache(cacheKey, url);
    res.json(result);
  } catch (err) {
    console.error("Error fetching similar recipes:", err.message);
    res.status(500).json({ error: "Failed to fetch similar recipes", details: err.message });
  }
});

// Get random recipes
app.get("/api/recipes/random", async (req, res) => {
  try {
    const params = new URLSearchParams({
      apiKey: process.env.SPOONACULAR_API_KEY,
      number: req.query.number || '3'
    });
    
    if (req.query.tags) params.append('tags', req.query.tags);
    if (req.query.include_tags) params.append('include-tags', req.query.include_tags);
    if (req.query.exclude_tags) params.append('exclude-tags', req.query.exclude_tags);

    // Random recipes shouldn't be cached as aggressively
    const cacheKey = `random_${Date.now()}_${Math.floor(Date.now() / 300000)}`; // 5 minute cache
    const url = `${BASE_URL}/recipes/random?${params}`;
    const result = await fetchWithCache(cacheKey, url, 300); // 5 minute cache
    res.json(result);
  } catch (err) {
    console.error("Error fetching random recipes:", err.message);
    res.status(500).json({ error: "Failed to fetch random recipes", details: err.message });
  }
});

// Autocomplete recipe search
app.get("/api/recipes/autocomplete", async (req, res) => {
  const { query } = req.query;
  
  if (!query) {
    return res.status(400).json({ error: "Query parameter is required" });
  }

  try {
    const cacheKey = `autocomplete_${query.toLowerCase()}`;
    const url = `${BASE_URL}/recipes/autocomplete?query=${encodeURIComponent(query)}&apiKey=${process.env.SPOONACULAR_API_KEY}&number=${req.query.number || '10'}`;
    const result = await fetchWithCache(cacheKey, url);
    res.json(result);
  } catch (err) {
    console.error("Error autocomplete recipes:", err.message);
    res.status(500).json({ error: "Failed to autocomplete recipes", details: err.message });
  }
});

// Get recipe taste by ID
app.get("/api/recipe/:id/taste", async (req, res) => {
  const recipeId = req.params.id;
  
  if (!recipeId || isNaN(recipeId)) {
    return res.status(400).json({ error: "Valid recipe ID is required" });
  }

  try {
    const cacheKey = `taste_${recipeId}`;
    const url = `${BASE_URL}/recipes/${recipeId}/tasteWidget.json?apiKey=${process.env.SPOONACULAR_API_KEY}`;
    const result = await fetchWithCache(cacheKey, url);
    res.json(result);
  } catch (err) {
    console.error("Error fetching recipe taste:", err.message);
    res.status(500).json({ error: "Failed to fetch recipe taste", details: err.message });
  }
});

// Get recipe equipment by ID
app.get("/api/recipe/:id/equipment", async (req, res) => {
  const recipeId = req.params.id;
  
  if (!recipeId || isNaN(recipeId)) {
    return res.status(400).json({ error: "Valid recipe ID is required" });
  }

  try {
    const cacheKey = `equipment_${recipeId}`;
    const url = `${BASE_URL}/recipes/${recipeId}/equipmentWidget.json?apiKey=${process.env.SPOONACULAR_API_KEY}`;
    const result = await fetchWithCache(cacheKey, url);
    res.json(result);
  } catch (err) {
    console.error("Error fetching recipe equipment:", err.message);
    res.status(500).json({ error: "Failed to fetch recipe equipment", details: err.message });
  }
});

// Get recipe price breakdown by ID
app.get("/api/recipe/:id/price", async (req, res) => {
  const recipeId = req.params.id;
  
  if (!recipeId || isNaN(recipeId)) {
    return res.status(400).json({ error: "Valid recipe ID is required" });
  }

  try {
    const cacheKey = `price_${recipeId}`;
    const url = `${BASE_URL}/recipes/${recipeId}/priceBreakdownWidget.json?apiKey=${process.env.SPOONACULAR_API_KEY}`;
    const result = await fetchWithCache(cacheKey, url);
    res.json(result);
  } catch (err) {
    console.error("Error fetching recipe price breakdown:", err.message);
    res.status(500).json({ error: "Failed to fetch recipe price breakdown", details: err.message });
  }
});

// Get recipe ingredients by ID
app.get("/api/recipe/:id/ingredients", async (req, res) => {
  const recipeId = req.params.id;
  
  if (!recipeId || isNaN(recipeId)) {
    return res.status(400).json({ error: "Valid recipe ID is required" });
  }

  try {
    const cacheKey = `ingredients_info_${recipeId}`;
    const url = `${BASE_URL}/recipes/${recipeId}/ingredientWidget.json?apiKey=${process.env.SPOONACULAR_API_KEY}`;
    const result = await fetchWithCache(cacheKey, url);
    res.json(result);
  } catch (err) {
    console.error("Error fetching recipe ingredients:", err.message);
    res.status(500).json({ error: "Failed to fetch recipe ingredients", details: err.message });
  }
});

// Get recipe nutrition by ID
app.get("/api/recipe/:id/nutrition", async (req, res) => {
  const recipeId = req.params.id;
  
  if (!recipeId || isNaN(recipeId)) {
    return res.status(400).json({ error: "Valid recipe ID is required" });
  }

  try {
    const cacheKey = `nutrition_${recipeId}`;
    const url = `${BASE_URL}/recipes/${recipeId}/nutritionWidget.json?apiKey=${process.env.SPOONACULAR_API_KEY}`;
    const result = await fetchWithCache(cacheKey, url);
    res.json(result);
  } catch (err) {
    console.error("Error fetching recipe nutrition:", err.message);
    res.status(500).json({ error: "Failed to fetch recipe nutrition", details: err.message });
  }
});

// Get analyzed recipe instructions
app.get("/api/recipe/:id/analyzedInstructions", async (req, res) => {
  const recipeId = req.params.id;
  
  if (!recipeId || isNaN(recipeId)) {
    return res.status(400).json({ error: "Valid recipe ID is required" });
  }

  try {
    const cacheKey = `analyzed_instructions_${recipeId}`;
    const url = `${BASE_URL}/recipes/${recipeId}/analyzedInstructions?apiKey=${process.env.SPOONACULAR_API_KEY}`;
    const result = await fetchWithCache(cacheKey, url);
    res.json(result);
  } catch (err) {
    console.error("Error fetching analyzed instructions:", err.message);
    res.status(500).json({ error: "Failed to fetch analyzed instructions", details: err.message });
  }
});

// Extract recipe from website
app.post("/api/recipes/extract", async (req, res) => {
  const { url: recipeUrl } = req.body;
  
  if (!recipeUrl) {
    return res.status(400).json({ error: "URL is required in request body" });
  }

  try {
    const cacheKey = `extract_${Buffer.from(recipeUrl).toString('base64')}`;
    const url = `${BASE_URL}/recipes/extract?url=${encodeURIComponent(recipeUrl)}&apiKey=${process.env.SPOONACULAR_API_KEY}`;
    const result = await fetchWithCache(cacheKey, url);
    res.json(result);
  } catch (err) {
    console.error("Error extracting recipe:", err.message);
    res.status(500).json({ error: "Failed to extract recipe", details: err.message });
  }
});

// Analyze recipe
app.post("/api/recipes/analyze", async (req, res) => {
  const { title, servings, ingredients, instructions } = req.body;
  
  if (!title || !servings || !ingredients || !instructions) {
    return res.status(400).json({ 
      error: "Title, servings, ingredients, and instructions are required" 
    });
  }

  try {
    const requestBody = new URLSearchParams({
      title,
      servings: servings.toString(),
      ingredients,
      instructions,
      apiKey: process.env.SPOONACULAR_API_KEY
    });

    const response = await fetch(`${BASE_URL}/recipes/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: requestBody
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    res.json({
      ...data,
      fromCache: false,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error("Error analyzing recipe:", err.message);
    res.status(500).json({ error: "Failed to analyze recipe", details: err.message });
  }
});

// Summarize recipe
app.get("/api/recipe/:id/summary", async (req, res) => {
  const recipeId = req.params.id;
  
  if (!recipeId || isNaN(recipeId)) {
    return res.status(400).json({ error: "Valid recipe ID is required" });
  }

  try {
    const cacheKey = `summary_${recipeId}`;
    const url = `${BASE_URL}/recipes/${recipeId}/summary?apiKey=${process.env.SPOONACULAR_API_KEY}`;
    const result = await fetchWithCache(cacheKey, url);
    res.json(result);
  } catch (err) {
    console.error("Error summarizing recipe:", err.message);
    res.status(500).json({ error: "Failed to summarize recipe", details: err.message });
  }
});

// Analyze recipe instructions
app.post("/api/recipes/analyzeInstructions", async (req, res) => {
  const { instructions } = req.body;
  
  if (!instructions) {
    return res.status(400).json({ error: "Instructions are required in request body" });
  }

  try {
    const requestBody = new URLSearchParams({
      instructions,
      apiKey: process.env.SPOONACULAR_API_KEY
    });

    const response = await fetch(`${BASE_URL}/recipes/analyzeInstructions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: requestBody
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    res.json({
      ...data,
      fromCache: false,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error("Error analyzing instructions:", err.message);
    res.status(500).json({ error: "Failed to analyze instructions", details: err.message });
  }
});

// Classify cuisine
app.post("/api/recipes/classifyCuisine", async (req, res) => {
  const { title, ingredientList } = req.body;
  
  if (!title && !ingredientList) {
    return res.status(400).json({ error: "Either title or ingredientList is required" });
  }

  try {
    const requestBody = new URLSearchParams({
      apiKey: process.env.SPOONACULAR_API_KEY
    });
    
    if (title) requestBody.append('title', title);
    if (ingredientList) requestBody.append('ingredientList', ingredientList);

    const response = await fetch(`${BASE_URL}/recipes/cuisine`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: requestBody
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    res.json({
      ...data,
      fromCache: false,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error("Error classifying cuisine:", err.message);
    res.status(500).json({ error: "Failed to classify cuisine", details: err.message });
  }
});

// Analyze recipe search query
app.get("/api/recipes/analyzeQuery", async (req, res) => {
  const { q } = req.query;
  
  if (!q) {
    return res.status(400).json({ error: "Query parameter 'q' is required" });
  }

  try {
    const cacheKey = `analyze_query_${q.toLowerCase()}`;
    const url = `${BASE_URL}/recipes/queries/analyze?q=${encodeURIComponent(q)}&apiKey=${process.env.SPOONACULAR_API_KEY}`;
    const result = await fetchWithCache(cacheKey, url);
    res.json(result);
  } catch (err) {
    console.error("Error analyzing query:", err.message);
    res.status(500).json({ error: "Failed to analyze query", details: err.message });
  }
});

// Guess nutrition by dish name
app.get("/api/recipes/guessNutrition", async (req, res) => {
  const { title } = req.query;
  
  if (!title) {
    return res.status(400).json({ error: "Title parameter is required" });
  }

  try {
    const cacheKey = `guess_nutrition_${title.toLowerCase()}`;
    const url = `${BASE_URL}/recipes/guessNutrition?title=${encodeURIComponent(title)}&apiKey=${process.env.SPOONACULAR_API_KEY}`;
    const result = await fetchWithCache(cacheKey, url);
    res.json(result);
  } catch (err) {
    console.error("Error guessing nutrition:", err.message);
    res.status(500).json({ error: "Failed to guess nutrition", details: err.message });
  }
});

// INGREDIENT ENDPOINTS

// Autocomplete ingredient search
app.get("/api/ingredients/autocomplete", async (req, res) => {
  const { query } = req.query;
  
  if (!query) {
    console.error("Autocomplete error: Query parameter is missing."); // Enhanced logging
    return res.status(400).json({ error: "Query parameter is required" });
  }

  try {
    const params = new URLSearchParams({
      query,
      number: req.query.number || '10',
      apiKey: process.env.SPOONACULAR_API_KEY
    });
    
    if (req.query.intolerances) params.append('intolerances', req.query.intolerances);

    const cacheKey = `ingredient_autocomplete_${query.toLowerCase()}`;
    const url = `${BASE_URL}/food/ingredients/autocomplete?${params}`;
    
    console.log(`Forwarding autocomplete request to: ${url}`);

    const result = await fetchWithCache(cacheKey, url);
    res.json(result);
  } catch (err) {
    console.error("Error during ingredient autocomplete:", err.message);
    res.status(500).json({ error: "Failed to autocomplete ingredients", details: err.message });
  }
});

// Search ingredients
app.get("/api/ingredients/search", async (req, res) => {
  const { query } = req.query;
  
  if (!query) {
    return res.status(400).json({ error: "Query parameter is required" });
  }

  try {
    const params = new URLSearchParams({
      query: query,
      apiKey: process.env.SPOONACULAR_API_KEY,
      number: req.query.number || '10'
    });
    
    if (req.query.intolerances) params.append('intolerances', req.query.intolerances);
    if (req.query.sort) params.append('sort', req.query.sort);
    if (req.query.sortDirection) params.append('sortDirection', req.query.sortDirection);

    const cacheKey = `ingredient_search_${query.toLowerCase()}`;
    const url = `${BASE_URL}/food/ingredients/search?${params}`;
    const result = await fetchWithCache(cacheKey, url);
    res.json(result);
  } catch (err) {
    console.error("Error searching ingredients:", err.message);
    res.status(500).json({ error: "Failed to search ingredients", details: err.message });
  }
});

// Get ingredient information
app.get("/api/ingredients/:id/information", async (req, res) => {
  const ingredientId = req.params.id;
  
  if (!ingredientId || isNaN(ingredientId)) {
    return res.status(400).json({ error: "Valid ingredient ID is required" });
  }

  try {
    const params = new URLSearchParams({
      apiKey: process.env.SPOONACULAR_API_KEY,
      amount: req.query.amount || '1',
      unit: req.query.unit || 'serving',
      locale: req.query.locale || 'en_US'
    });

    const cacheKey = `ingredient_${ingredientId}_${params.toString()}`;
    const url = `${BASE_URL}/food/ingredients/${ingredientId}/information?${params}`;
    const result = await fetchWithCache(cacheKey, url);
    res.json(result);
  } catch (err) {
    console.error("Error fetching ingredient info:", err.message);
    res.status(500).json({ error: "Failed to fetch ingredient information", details: err.message });
  }
});

// Compute ingredient amount
app.get("/api/ingredients/:id/amount", async (req, res) => {
  const ingredientId = req.params.id;
  const { nutrient, target } = req.query;
  
  if (!ingredientId || isNaN(ingredientId) || !nutrient || !target) {
    return res.status(400).json({ 
      error: "Valid ingredient ID, nutrient, and target are required" 
    });
  }

  try {
    const params = new URLSearchParams({
      nutrient,
      target,
      apiKey: process.env.SPOONACULAR_API_KEY
    });
    
    if (req.query.unit) params.append('unit', req.query.unit);

    const cacheKey = `ingredient_amount_${ingredientId}_${nutrient}_${target}`;
    const url = `${BASE_URL}/food/ingredients/${ingredientId}/amount?${params}`;
    const result = await fetchWithCache(cacheKey, url);
    res.json(result);
  } catch (err) {
    console.error("Error computing ingredient amount:", err.message);
    res.status(500).json({ error: "Failed to compute ingredient amount", details: err.message });
  }
});

// Convert amounts
app.get("/api/ingredients/convert", async (req, res) => {
  const { ingredientName, sourceAmount, sourceUnit, targetUnit } = req.query;
  
  if (!ingredientName || !sourceAmount || !sourceUnit || !targetUnit) {
    return res.status(400).json({ 
      error: "ingredientName, sourceAmount, sourceUnit, and targetUnit are required" 
    });
  }

  try {
    const params = new URLSearchParams({
      ingredientName,
      sourceAmount,
      sourceUnit,
      targetUnit,
      apiKey: process.env.SPOONACULAR_API_KEY
    });

    const cacheKey = `convert_${ingredientName}_${sourceAmount}_${sourceUnit}_${targetUnit}`;
    const url = `${BASE_URL}/recipes/convert?${params}`;
    const result = await fetchWithCache(cacheKey, url);
    res.json(result);
  } catch (err) {
    console.error("Error converting amounts:", err.message);
    res.status(500).json({ error: "Failed to convert amounts", details: err.message });
  }
});

// Parse ingredients
app.post("/api/ingredients/parse", async (req, res) => {
  const { ingredientList } = req.body;
  
  if (!ingredientList) {
    return res.status(400).json({ error: "ingredientList is required in request body" });
  }

  try {
    const requestBody = new URLSearchParams({
      ingredientList,
      servings: req.body.servings || '1',
      apiKey: process.env.SPOONACULAR_API_KEY
    });

    const response = await fetch(`${BASE_URL}/recipes/parseIngredients`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: requestBody
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    res.json({
      ...data,
      fromCache: false,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error("Error parsing ingredients:", err.message);
    res.status(500).json({ error: "Failed to parse ingredients", details: err.message });
  }
});

// Compute glycemic load
app.post("/api/ingredients/glycemicLoad", async (req, res) => {
  const { ingredientList } = req.body;
  
  if (!ingredientList) {
    return res.status(400).json({ error: "ingredientList is required in request body" });
  }

  try {
    const requestBody = new URLSearchParams({
      ingredientList,
      apiKey: process.env.SPOONACULAR_API_KEY
    });

    const response = await fetch(`${BASE_URL}/food/ingredients/glycemicLoad`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: requestBody
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    res.json({
      ...data,
      fromCache: false,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error("Error computing glycemic load:", err.message);
    res.status(500).json({ error: "Failed to compute glycemic load", details: err.message });
  }
});

// Get ingredient substitutes
app.get("/api/ingredients/substitutes", async (req, res) => {
  const { ingredientName } = req.query;
  
  if (!ingredientName) {
    return res.status(400).json({ error: "ingredientName parameter is required" });
  }

  try {
    const cacheKey = `substitutes_${ingredientName.toLowerCase()}`;
    const url = `${BASE_URL}/food/ingredients/substitutes?ingredientName=${encodeURIComponent(ingredientName)}&apiKey=${process.env.SPOONACULAR_API_KEY}`;
    const result = await fetchWithCache(cacheKey, url);
    res.json(result);
  } catch (err) {
    console.error("Error fetching substitutes:", err.message);
    res.status(500).json({ error: "Failed to fetch ingredient substitutes", details: err.message });
  }
});

// Get ingredient substitutes by ID
app.get("/api/ingredients/:id/substitutes", async (req, res) => {
  const ingredientId = req.params.id;
  
  if (!ingredientId || isNaN(ingredientId)) {
    return res.status(400).json({ error: "Valid ingredient ID is required" });
  }

  try {
    const cacheKey = `substitutes_id_${ingredientId}`;
    const url = `${BASE_URL}/food/ingredients/${ingredientId}/substitutes?apiKey=${process.env.SPOONACULAR_API_KEY}`;
    const result = await fetchWithCache(cacheKey, url);
    res.json(result);
  } catch (err) {
    console.error("Error fetching substitutes by ID:", err.message);
    res.status(500).json({ error: "Failed to fetch ingredient substitutes by ID", details: err.message });
  }
});

// Cache statistics endpoint
app.get("/api/cache/stats", (req, res) => {
  const keys = cache.keys();
  const stats = {
    totalCachedItems: keys.length,
    cachedQueries: keys.filter(key => key.startsWith('search_')).length,
    cachedRecipes: keys.filter(key => key.startsWith('recipe_')).length,
    cachedIngredients: keys.filter(key => key.startsWith('ingredient_')).length,
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