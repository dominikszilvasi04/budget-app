// client/src/App.js
import React, { useState, useEffect } from 'react'; // Import hooks
import axios from 'axios'; // Import axios
import './App.css'; // Keep the default styling for now

function App() {
  // State variables
  const [categories, setCategories] = useState([]); // To store the fetched categories
  const [loading, setLoading] = useState(true);     // To indicate if data is being fetched
  const [error, setError] = useState(null);         // To store any fetching errors

  // useEffect hook to fetch data when the component mounts
  useEffect(() => {
    // Define the function to fetch categories
    const fetchCategories = async () => {
      setLoading(true); // Start loading
      setError(null);   // Reset error state
      try {
        // Make GET request to our backend endpoint
        // Make sure your backend server is running!
        const response = await axios.get('http://localhost:5001/api/categories');

        setCategories(response.data); // Update state with fetched data
      } catch (err) {
        console.error("Error fetching categories:", err);
        setError('Failed to load categories. Is the backend server running?'); // Set error message
      } finally {
        setLoading(false); // Stop loading, regardless of success or error
      }
    };

    fetchCategories(); // Call the function

    // The empty dependency array [] means this effect runs only once
    // when the component mounts (like componentDidMount)
  }, []);

  // --- Render Logic ---

  // Display loading message
  if (loading) {
    return <div className="App">Loading categories...</div>;
  }

  // Display error message
  if (error) {
    return <div className="App">Error: {error}</div>;
  }

  // Display the categories list
  return (
    <div className="App">
      <header className="App-header">
        <h1>Budget Tracker Categories</h1>
        {categories.length > 0 ? (
          <ul>
            {categories.map(category => (
              <li key={category.id}>{category.name}</li>
            ))}
          </ul>
        ) : (
          <p>No categories found.</p>
        )}
      </header>
    </div>
  );
}

export default App;