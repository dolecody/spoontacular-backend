# Spoonacular API Backend

A Node.js Express server that acts as an API wrapper for the Spoonacular Food API with built-in caching functionality.

## Features

- 🚀 Express.js REST API
- 🗄️ In-memory caching with 1-hour expiration
- 🔍 Recipe search endpoint
- 📖 Recipe details endpoint
- 📊 Cache statistics and management
- 🔐 Secure API key management
- ⚡ Fast response times with caching

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Variables

Create a `.env` file in the project root with the following content:

```env
# Spoonacular API Configuration
# Get your API key from: https://spoonacular.com/food-api/console#Dashboard
SPOONACULAR_API_KEY=your_actual_api_key_here

# Server Configuration (optional - defaults to 3000)
# PORT=3000
```

**Important:** Replace `your_actual_api_key_here` with your actual Spoonacular API key.

### 3. Get Your Spoonacular API Key

1. Go to [Spoonacular API Console](https://spoonacular.com/food-api/console#Dashboard)
2. Sign up for a free account
3. Copy your API key
4. Paste it in your `.env` file

### 4. Run the Server

```bash
# Development
npm start

# Or directly with node
node index.js
```

The server will start on `http://localhost:3000` (or your specified PORT).

## API Endpoints

### Health Check
```
GET /
```
Returns a simple status message.

### Search Recipes
```
GET /api/searchRecipes?query=chicken
```
Search for recipes by ingredient or dish name.

**Parameters:**
- `query` (required): Search term (e.g., "chicken", "pasta", "vegetarian")

**Response:**
- Recipe results from Spoonacular API
- `fromCache`: Boolean indicating if result was served from cache
- `timestamp`: When the response was generated

### Get Recipe Details
```
GET /api/recipe/:id
```
Get detailed information about a specific recipe.

**Parameters:**
- `id` (required): Recipe ID number

### Cache Statistics
```
GET /api/cache/stats
```
View current cache statistics and keys.

### Clear Cache
```
DELETE /api/cache/clear
```
Clear all cached data (useful for development).

## Example Usage

### Basic Recipe Search
```bash
curl "http://localhost:3000/api/searchRecipes?query=chicken"
```

### Get Recipe Details
```bash
curl "http://localhost:3000/api/recipe/12345"
```

### Check Cache Stats
```bash
curl "http://localhost:3000/api/cache/stats"
```

## Caching Behavior

- Search results are cached for 1 hour
- Recipe details are cached for 1 hour
- Cache keys are automatically generated based on search terms and recipe IDs
- First request fetches from Spoonacular API
- Subsequent requests within 1 hour are served from cache
- Cache statistics available at `/api/cache/stats`

## Deployment

### Deploy to Render

1. Push your code to GitHub
2. Connect your GitHub repo to Render
3. Set the following environment variables in Render:
   - `SPOONACULAR_API_KEY`: Your actual API key
4. Deploy!

Your API will be available at: `https://your-app-name.onrender.com`

### Use in Flutter App

```dart
import 'dart:convert';
import 'package:http/http.dart' as http;

Future<Map<String, dynamic>> searchRecipes(String query) async {
  final response = await http.get(
    Uri.parse('https://your-app-name.onrender.com/api/searchRecipes?query=$query'),
  );
  
  if (response.statusCode == 200) {
    return jsonDecode(response.body);
  } else {
    throw Exception('Failed to search recipes');
  }
}
```

## Development

### Project Structure
```
spoontacular_backend/
├── index.js          # Main server file
├── package.json      # Dependencies and scripts
├── .env             # Environment variables (create this)
└── README.md        # This file
```

### Adding New Endpoints

To add new Spoonacular API endpoints:

1. Add a new route in `index.js`
2. Implement caching logic
3. Add error handling
4. Update this README

## Troubleshooting

### Common Issues

1. **"API key is required" error**: Make sure your `.env` file has the correct `SPOONACULAR_API_KEY`
2. **Module not found**: Run `npm install` to install dependencies
3. **Port already in use**: Change the PORT in your `.env` file or stop other services on port 3000

### Debug Mode

Enable detailed logging by checking the console output when running the server.

## License

ISC 