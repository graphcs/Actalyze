/**
 * Text Processing Utility for Word Cloud
 * Handles tokenization, normalization, stop word removal, and lemmatization
 */

import natural from 'natural';
import Sentiment from 'sentiment';

// Initialize NLP tools
const tokenizer = new natural.WordTokenizer();
const sentimentAnalyzer = new Sentiment();

// Simple lemmatization rules for common political terms
const LEMMA_MAP: Record<string, string> = {
  // Plurals
  'cities': 'city',
  'countries': 'country',
  'states': 'state',
  'policies': 'policy',
  'parties': 'party',
  'votes': 'vote',
  'bills': 'bill',
  'laws': 'law',
  'taxes': 'tax',
  'americans': 'american',
  'democrats': 'democrat',
  'republicans': 'republican',
  'conservatives': 'conservative',
  'liberals': 'liberal',
  
  // Verb forms
  'voting': 'vote',
  'voted': 'vote',
  'passing': 'pass',
  'passed': 'pass',
  'charging': 'charge',
  'charged': 'charge',
  'supporting': 'support',
  'supported': 'support',
  'opposing': 'oppose',
  'opposed': 'oppose',
};

/**
 * Simple lemmatization for better word grouping
 */
export function lemmatize(word: string): string {
  // Check manual lemma map first
  if (LEMMA_MAP[word]) {
    return LEMMA_MAP[word];
  }
  
  const lowerWord = word.toLowerCase();
  
  // Don't lemmatize short words (they're usually fine as-is)
  if (lowerWord.length <= 4) {
    return word;
  }
  
  // Remove common suffixes while keeping readable words
  if (lowerWord.endsWith('ies') && lowerWord.length > 5) {
    // cities -> city, families -> family
    return lowerWord.slice(0, -3) + 'y';
  }
  
  if (lowerWord.endsWith('es') && lowerWord.length > 5 && !lowerWord.endsWith('ses')) {
    // charges -> charge (but not cases -> cas)
    return lowerWord.slice(0, -2);
  }
  
  if (lowerWord.endsWith('s') && lowerWord.length > 4 && 
      !['us', 'ss', 'is', 'as'].some(end => lowerWord.endsWith(end))) {
    // votes -> vote, laws -> law (but not us, business, this, was)
    return lowerWord.slice(0, -1);
  }
  
  if (lowerWord.endsWith('ing') && lowerWord.length > 7) {
    // voting -> vote, charging -> charge (but not amazing -> amaz, debating keeps full)
    // Keep gerunds that are commonly used as nouns/adjectives
    if (['debating', 'marketing', 'programming', 'training'].includes(lowerWord)) {
      return word;
    }
    return lowerWord.slice(0, -3);
  }
  
  if (lowerWord.endsWith('ed') && lowerWord.length > 6) {
    // voted -> vote, charged -> charge (but not red -> r)
    // Check if removing 'ed' leaves a valid word
    const base = lowerWord.slice(0, -2);
    if (base.length >= 4) {
      return base;
    }
  }
  
  // Don't lemmatize proper nouns (capitalized words) or names
  if (word[0] === word[0].toUpperCase() && word.length <= 8) {
    return word.toLowerCase(); // Keep the word, just lowercase it
  }
  
  return word;
}

// Political and common stop words to remove
const STOP_WORDS = new Set([
  // Common English stop words
  'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i',
  'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at',
  'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she',
  'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their',
  'what', 'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go',
  'me', 'when', 'make', 'can', 'like', 'time', 'no', 'just', 'him', 'know',
  'take', 'people', 'into', 'year', 'your', 'good', 'some', 'could', 'them',
  'see', 'other', 'than', 'then', 'now', 'look', 'only', 'come', 'its', 'over',
  'think', 'also', 'back', 'after', 'use', 'two', 'how', 'our', 'work', 'first',
  'well', 'way', 'even', 'new', 'want', 'because', 'any', 'these', 'give', 'day',
  'most', 'us', 'is', 'was', 'are', 'been', 'has', 'had', 'were', 'said', 'did',
  'am', 'being', 'having', 'does', 'doing',
  
  // Political filler words
  'politics', 'political', 'politician', 'politicians',
  'rt', 'via', // Twitter-specific
  
  // Common single letters and numbers
  'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm',
  'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
]);

// Minimum word length
const MIN_WORD_LENGTH = 3;

/**
 * Clean and normalize tweet text
 * Remove URLs, mentions, hashtags symbols (keep text), emojis, special chars
 */
export function cleanText(text: string): string {
  let cleaned = text;
  
  // Remove URLs
  cleaned = cleaned.replace(/https?:\/\/\S+/gi, '');
  
  // Remove mentions but keep the username text
  cleaned = cleaned.replace(/@(\w+)/g, '$1');
  
  // Remove hashtag symbol but keep the text
  cleaned = cleaned.replace(/#(\w+)/g, '$1');
  
  // Remove emojis and special unicode characters
  cleaned = cleaned.replace(/[\u{1F600}-\u{1F64F}]/gu, ''); // Emoticons
  cleaned = cleaned.replace(/[\u{1F300}-\u{1F5FF}]/gu, ''); // Symbols & Pictographs
  cleaned = cleaned.replace(/[\u{1F680}-\u{1F6FF}]/gu, ''); // Transport & Map
  cleaned = cleaned.replace(/[\u{1F1E0}-\u{1F1FF}]/gu, ''); // Flags
  cleaned = cleaned.replace(/[\u{2600}-\u{26FF}]/gu, ''); // Misc symbols
  cleaned = cleaned.replace(/[\u{2700}-\u{27BF}]/gu, ''); // Dingbats
  
  // Remove extra whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  // Convert to lowercase
  cleaned = cleaned.toLowerCase();
  
  return cleaned;
}

/**
 * Tokenize and filter words
 * Returns array of meaningful words (with gentle lemmatization)
 */
export function tokenizeAndFilter(text: string): string[] {
  // Tokenize
  const tokens = tokenizer.tokenize(text);
  
  if (!tokens) return [];
  
  // Filter and normalize with gentle lemmatization
  const filtered = tokens
    .map(token => token.toLowerCase().trim())
    .filter(token => {
      // Remove stop words
      if (STOP_WORDS.has(token)) return false;
      
      // Remove single/double letter words
      if (token.length < MIN_WORD_LENGTH) return false;
      
      // Remove pure numbers
      if (/^\d+$/.test(token)) return false;
      
      // Remove tokens with special characters only
      if (!/[a-z]/i.test(token)) return false;
      
      return true;
    })
    // Apply gentle lemmatization to group similar words
    .map(token => lemmatize(token));
  
  return filtered;
}

/**
 * Analyze sentiment of text
 * Returns score from -1 (negative) to 1 (positive)
 */
export function analyzeSentiment(text: string): number {
  const result = sentimentAnalyzer.analyze(text);
  
  // Normalize score to -1 to 1 range
  // sentiment library returns scores typically in range of -10 to 10
  const normalized = Math.max(-1, Math.min(1, result.score / 10));
  
  return normalized;
}

/**
 * Get sentiment category
 */
export function getSentimentCategory(score: number): 'positive' | 'neutral' | 'negative' {
  if (score > 0.1) return 'positive';
  if (score < -0.1) return 'negative';
  return 'neutral';
}

/**
 * Process a single tweet
 * Returns processed text with sentiment
 */
export function processTweet(
  tweetText: string,
  tweetId: string,
  timestamp: string
): {
  words: string[];
  sentiment: number;
  sentimentCategory: 'positive' | 'neutral' | 'negative';
  originalText: string;
  tweetId: string;
  timestamp: string;
} {
  const cleanedText = cleanText(tweetText);
  const words = tokenizeAndFilter(cleanedText);
  const sentiment = analyzeSentiment(tweetText); // Use original text for sentiment
  const sentimentCategory = getSentimentCategory(sentiment);
  
  return {
    words,
    sentiment,
    sentimentCategory,
    originalText: tweetText,
    tweetId,
    timestamp,
  };
}

/**
 * Calculate word frequencies from processed tweets
 */
export function calculateWordFrequencies(
  processedTweets: Array<{
    words: string[];
    sentiment: number;
    tweetId: string;
    timestamp: string;
    originalText: string;
  }>,
  minFrequency: number = 2
): Map<string, {
  count: number;
  sentiments: number[];
  tweetIds: string[];
  timestamps: string[];
}> {
  const wordMap = new Map<string, {
    count: number;
    sentiments: number[];
    tweetIds: string[];
    timestamps: string[];
  }>();
  
  for (const tweet of processedTweets) {
    const uniqueWords = new Set(tweet.words); // Count once per tweet
    
    for (const word of uniqueWords) {
      const existing = wordMap.get(word);
      
      if (existing) {
        existing.count++;
        existing.sentiments.push(tweet.sentiment);
        existing.tweetIds.push(tweet.tweetId);
        existing.timestamps.push(tweet.timestamp);
      } else {
        wordMap.set(word, {
          count: 1,
          sentiments: [tweet.sentiment],
          tweetIds: [tweet.tweetId],
          timestamps: [tweet.timestamp],
        });
      }
    }
  }
  
  // Filter by minimum frequency
  for (const [word, data] of wordMap.entries()) {
    if (data.count < minFrequency) {
      wordMap.delete(word);
    }
  }
  
  return wordMap;
}

/**
 * Calculate average sentiment for a word
 */
export function calculateAverageSentiment(sentiments: number[]): number {
  if (sentiments.length === 0) return 0;
  const sum = sentiments.reduce((acc, val) => acc + val, 0);
  return sum / sentiments.length;
}

/**
 * Find co-occurring words (words that appear together in tweets)
 */
export function findCoOccurringWords(
  targetWord: string,
  processedTweets: Array<{
    words: string[];
    tweetId: string;
  }>,
  topN: number = 10
): Array<{ word: string; count: number }> {
  const coOccurrenceMap = new Map<string, number>();
  
  for (const tweet of processedTweets) {
    if (tweet.words.includes(targetWord)) {
      // This tweet contains the target word
      const uniqueWords = new Set(tweet.words);
      
      for (const word of uniqueWords) {
        if (word !== targetWord) {
          const count = coOccurrenceMap.get(word) || 0;
          coOccurrenceMap.set(word, count + 1);
        }
      }
    }
  }
  
  // Sort by count and return top N
  return Array.from(coOccurrenceMap.entries())
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, topN);
}
