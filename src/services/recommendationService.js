import Post from "../models/postModel.js";
import PagePost from "../models/pagePostModel.js";
import GroupPost from "../models/groupPostModel.js";
import User from "../models/userModel.js";
import natural from "natural";
import { Types } from "mongoose";

const tokenizer = new natural.WordTokenizer();
const TfIdf = natural.TfIdf;

class RecommendationService {
  // ... existing code ...
}

// Export một instance của RecommendationService
const recommendationService = new RecommendationService();
export default recommendationService; 