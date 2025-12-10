// This file contains the algorithm for matching lost and found items
// In a real app, this would be more sophisticated, possibly using machine learning

// Note: Image classification is now handled by Gemini API in GeminiAPI.js

// Calculate text similarity score between two strings
export const calculateTextSimilarity = (text1, text2) => {
  if (!text1 || !text2) return 0;
  
  // Convert to lowercase for case-insensitive comparison
  const str1 = text1.toLowerCase();
  const str2 = text2.toLowerCase();
  
  // Split into words and remove duplicates
  const words1 = [...new Set(str1.split(/\s+/).filter(word => word.length > 2))];
  const words2 = [...new Set(str2.split(/\s+/).filter(word => word.length > 2))];
  
  // Count matching words
  let matchCount = 0;
  for (const word of words1) {
    if (words2.includes(word)) {
      matchCount++;
    }
  }
  
  // Calculate Jaccard similarity
  const union = new Set([...words1, ...words2]).size;
  return union === 0 ? 0 : matchCount / union;
};

// Calculate category similarity score
export const calculateCategorySimilarity = (categories1, categories2) => {
  if (!categories1 || !categories2 || categories1.length === 0 || categories2.length === 0) {
    return 0;
  }
  
  // Count matching categories
  let matchCount = 0;
  for (const category of categories1) {
    if (categories2.includes(category)) {
      matchCount++;
    }
  }
  
  // Calculate Jaccard similarity
  const union = new Set([...categories1, ...categories2]).size;
  return matchCount / union;
};

// Calculate date proximity score (closer dates get higher scores)
export const calculateDateProximity = (date1, date2) => {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  
  // Calculate difference in days
  const diffTime = Math.abs(d2 - d1);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  // Score decreases as the time difference increases (max 30 days)
  return Math.max(0, 1 - diffDays / 30);
};

// Main matching function: combines text and category similarity
export const matchItems = (itemA, itemB) => {
  // itemA and itemB: { description, categories }
  let score = 0;

  // 1. Text similarity (0-1)
  const textScore = calculateTextSimilarity(itemA.description, itemB.description);

  // 2. Category match (0 or 1)
  let categoryScore = 0;
  if (
    itemA.categories && itemB.categories &&
    itemA.categories.length > 0 && itemB.categories.length > 0 &&
    itemA.categories[0].toLowerCase() === itemB.categories[0].toLowerCase()
  ) {
    categoryScore = 1;
  }

  // Weighted score: text (70%), category (30%)
  score = 0.7 * textScore + 0.3 * categoryScore;
  return score;
};

// Calculate overall match score between a lost item and a found item
export const calculateMatchScore = (lostItem, foundItem) => {
  // Skip if items are not of the same type or category
  if (!lostItem || !foundItem) return 0;
  
  // Calculate individual similarity scores - Updated weights to prioritize categories and date, reduce description
  const titleScore = calculateTextSimilarity(lostItem.title, foundItem.title) * 0.25;
  const descriptionScore = calculateTextSimilarity(lostItem.description, foundItem.description) * 0.05; // Reduced weight
  const categoryScore = calculateCategorySimilarity(lostItem.categories, foundItem.categories) * 0.45; // Major factor
  const dateScore = calculateDateProximity(lostItem.createdAt, foundItem.createdAt) * 0.25; // Major factor
  
  // Calculate weighted average
  const totalScore = titleScore + descriptionScore + categoryScore + dateScore;
  
  return totalScore;
};

// Find potential matches for a lost item
export const findMatchesForLostItem = (lostItem, foundItems) => {
  if (!lostItem || !foundItems || foundItems.length === 0) {
    return [];
  }
  
  const matches = foundItems.map(foundItem => ({
    lostItem,
    foundItem,
    score: calculateMatchScore(lostItem, foundItem)
  }));
  
  // Filter matches with score above threshold and sort by score (descending)
  return matches
    .filter(match => match.score > 0.4) // Only return matches with score > 0.4
    .sort((a, b) => b.score - a.score);
};

// Find potential matches for a found item
export const findMatchesForFoundItem = (foundItem, lostItems) => {
  if (!foundItem || !lostItems || lostItems.length === 0) {
    return [];
  }
  
  const matches = lostItems.map(lostItem => ({
    lostItem,
    foundItem,
    score: calculateMatchScore(lostItem, foundItem)
  }));
  
  // Filter matches with score above threshold and sort by score (descending)
  return matches
    .filter(match => match.score > 0.4) // Only return matches with score > 0.4
    .sort((a, b) => b.score - a.score);
};