import OpenAI from 'openai';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import { makeErrorResponse } from './apiService.js';
import Post from '../models/postModel.js';
import Page from '../models/pageModel.js';
import Group from '../models/groupModel.js';
dotenv.config();

// Cấu hình các API key
const AI_PROVIDERS = {
  HUGGINGFACE: {
    name: 'huggingface',
    apiKey: process.env.HUGGINGFACE_API_KEY,
    enabled: process.env.HUGGINGFACE_API_KEY ? true : false,
    priority: 1 // Đặt Hugging Face làm provider ưu tiên cao nhất
  },
  OPENAI: {
    name: 'openai',
    apiKey: process.env.OPENAI_API_KEY,
    enabled: true,
    priority: 2
  },
  GOOGLE: {
    name: 'google',
    apiKey: process.env.GOOGLE_AI_API_KEY,
    enabled: process.env.GOOGLE_AI_API_KEY ? true : false,
    priority: 3
  },
  AZURE: {
    name: 'azure',
    apiKey: process.env.AZURE_AI_API_KEY,
    enabled: process.env.AZURE_AI_API_KEY ? true : false,
    priority: 4
  }
};

// Khởi tạo các client AI
const openai = new OpenAI({
  apiKey: AI_PROVIDERS.OPENAI.apiKey,
});

// Cache để lưu kết quả kiểm tra nội dung
const contentCache = new Map();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 giờ

// Các category nhạy cảm cho Hugging Face
const HUGGINGFACE_CATEGORIES = {
  TOXICITY: 'toxic',
  SEVERE_TOXICITY: 'severe_toxic',
  OBSCENE: 'obscene',
  THREAT: 'threat',
  INSULT: 'insult',
  IDENTITY_HATE: 'identity_hate',
  VIOLENCE: 'violence',
  SEXUAL: 'sexual'
};

// Ngưỡng điểm cho mỗi category
// const CATEGORY_THRESHOLDS = {
//   [HUGGINGFACE_CATEGORIES.TOXICITY]: 0.7,
//   [HUGGINGFACE_CATEGORIES.SEVERE_TOXICITY]: 0.5,
//   [HUGGINGFACE_CATEGORIES.OBSCENE]: 0.7,
//   [HUGGINGFACE_CATEGORIES.THREAT]: 0.7,
//   [HUGGINGFACE_CATEGORIES.INSULT]: 0.7,
//   [HUGGINGFACE_CATEGORIES.IDENTITY_HATE]: 0.7,
//   [HUGGINGFACE_CATEGORIES.VIOLENCE]: 0.7,
//   [HUGGINGFACE_CATEGORIES.SEXUAL]: 0.7
// };
const CATEGORY_THRESHOLDS = {
  toxic: 0.7,
  severe_toxic: 0.5,
  obscene: 0.7,
  threat: 0.7,
  insult: 0.7,
  identity_hate: 0.7,
  violence: 0.7,
  sexual: 0.7
};
// Model ID cho Hugging Face API
const HUGGINGFACE_MODEL = "unitary/toxic-bert";

// Hàm kiểm tra nội dung văn bản với Hugging Face API
const checkTextContentWithHuggingFace = async (content) => {
  try {
    if (!AI_PROVIDERS.HUGGINGFACE.apiKey) {
      throw new Error('Hugging Face API key is not configured');
    }

    const url = `https://api-inference.huggingface.co/models/${HUGGINGFACE_MODEL}`;
    
    console.log('Calling Hugging Face API...');
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AI_PROVIDERS.HUGGINGFACE.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        inputs: content,
        options: {
          wait_for_model: true,
          use_cache: false
        }
      })
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Hugging Face API key is invalid');
      } else if (response.status === 429) {
        throw new Error('Hugging Face API rate limit exceeded');
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Hugging Face API error (${response.status}): ${errorData.error || response.statusText}`);
      }
    }

    const data = await response.json();
    console.log('Hugging Face API response:', JSON.stringify(data, null, 2));

    // Flatten if response is nested array
    const results = Array.isArray(data) && Array.isArray(data[0]) ? data[0] : data;
    const flaggedCategories = [];
    const categoryScores = {};
    let isSafe = true;

    // Các nhãn cần kiểm tra
    const CHECK_LABELS = ['toxic', 'threat', 'severe_toxic', 'insult', 'obscene'];
    for (const result of results) {
      if (result && typeof result === 'object') {
        const label = (result.label || '').toLowerCase();
        const score = parseFloat(result.score) || 0;
        categoryScores[label] = score;
        if (CHECK_LABELS.includes(label) && score >= CATEGORY_THRESHOLDS[label]) {
          flaggedCategories.push(label);
          isSafe = false;
        }
      }
    }

    // Nếu có bất kỳ nhãn nào vượt ngưỡng thì flagged và không duyệt bài
    return {
      isSafe,
      flaggedCategories: [...new Set(flaggedCategories)],
      confidence: categoryScores,
      provider: 'huggingface',
      rawResponse: data
    };
  } catch (error) {
    const errorMessage = error.message.includes('Hugging Face API') 
      ? error.message 
      : `Hugging Face API error: ${error.message}`;
    
    console.error('Hugging Face API error details:', {
      message: errorMessage,
      content: content.substring(0, 100) + '...',
      timestamp: new Date().toISOString()
    });

    throw new Error(errorMessage);
  }
};

// Hàm kiểm tra nội dung văn bản với Google Perspective API
const checkTextContentWithGoogle = async (content) => {
  try {
    if (!AI_PROVIDERS.GOOGLE.apiKey) {
      throw new Error('Google API key is not configured');
    }

    // Tạm thời bỏ qua Google API vì chúng ta đang ưu tiên Hugging Face
    throw new Error('Google API temporarily disabled');
  } catch (error) {
    throw new Error(`Google API error: ${error.message}`);
  }
};

// Hàm kiểm tra nội dung văn bản với OpenAI
const checkTextContentWithOpenAI = async (content) => {
  try {
    if (!AI_PROVIDERS.OPENAI.apiKey) {
      throw new Error('OpenAI API key is not configured');
    }

    const response = await openai.moderations.create({
      input: content,
    });

    const results = response.results[0];
    
    const sensitiveCategories = [
      'hate', 'hate/threatening', 'self-harm', 'sexual', 
      'sexual/minors', 'violence', 'violence/graphic'
    ];

    const flaggedCategories = sensitiveCategories.filter(
      category => results.categories[category]
    );

    return {
      isSafe: !results.flagged,
      flaggedCategories,
      confidence: results.category_scores,
      provider: 'openai'
    };
  } catch (error) {
    if (error.response?.status === 401) {
      throw new Error('OpenAI API key is invalid');
    } else if (error.response?.status === 429) {
      throw new Error('OpenAI API quota exceeded');
    } else {
      throw new Error(`OpenAI API error: ${error.message}`);
    }
  }
};

// Hàm kiểm tra nội dung văn bản với Azure AI
const checkTextContentWithAzure = async (content) => {
  try {
    // TODO: Implement Azure AI content moderation
    // Đây là placeholder, cần implement thực tế với Azure AI API
    throw new Error('Azure AI moderation not implemented yet');
  } catch (error) {
    throw new Error(`Azure AI Error: ${error.message}`);
  }
};

// Hàm kiểm tra nội dung văn bản với nhiều provider
const checkTextContent = async (content) => {
  // Tạo cache key từ nội dung
  const cacheKey = `text:${content}`;
  
  // Kiểm tra cache
  const cachedResult = contentCache.get(cacheKey);
  if (cachedResult && (Date.now() - cachedResult.timestamp) < CACHE_TTL) {
    console.log('Using cached text moderation result');
    return cachedResult.data;
  }

  // Sắp xếp các provider theo priority và chỉ lấy những provider có API key hợp lệ
  const enabledProviders = Object.values(AI_PROVIDERS)
    .filter(provider => {
      if (!provider.enabled) return false;
      if (!provider.apiKey) {
        console.log(`${provider.name} API key is not configured`);
        return false;
      }
      return true;
    })
    .sort((a, b) => a.priority - b.priority);

  if (enabledProviders.length === 0) {
    throw new Error('No AI moderation providers are properly configured. Please check your API keys and provider settings.');
  }

  let lastError = null;
  let providerErrors = [];

  // Thử từng provider theo thứ tự ưu tiên
  for (const provider of enabledProviders) {
    try {
      console.log(`Trying ${provider.name} moderation...`);
      let result;
      switch (provider.name) {
        case 'huggingface':
          result = await checkTextContentWithHuggingFace(content);
          break;
        case 'openai':
          result = await checkTextContentWithOpenAI(content);
          break;
        case 'google':
          result = await checkTextContentWithGoogle(content);
          break;
        case 'azure':
          result = await checkTextContentWithAzure(content);
          break;
        default:
          continue;
      }

      console.log(`${provider.name} moderation successful`);
      
      // Lưu vào cache
      contentCache.set(cacheKey, {
        data: result,
        timestamp: Date.now()
      });

      return result;
    } catch (error) {
      const errorInfo = {
        provider: provider.name,
        error: error.message,
        timestamp: new Date().toISOString()
      };
      providerErrors.push(errorInfo);
      console.error(`Error with ${provider.name} moderation:`, errorInfo);
      lastError = error;
      continue; // Thử provider tiếp theo
    }
  }

  // Nếu tất cả provider đều thất bại, thử lấy từ cache cũ
  if (cachedResult) {
    console.log('Using expired cached text moderation result due to all providers failing');
    return cachedResult.data;
  }

  // Nếu không có cache và tất cả provider đều thất bại
  const errorDetails = providerErrors.map(e => `${e.provider}: ${e.error}`).join('; ');
  throw new Error(`All AI providers failed. Provider errors: ${errorDetails}`);
};

// Hàm kiểm tra hình ảnh với nhiều provider
const checkImageContent = async (imageUrl) => {
  // Tạo cache key từ URL hình ảnh
  const cacheKey = `image:${imageUrl}`;
  
  // Kiểm tra cache
  const cachedResult = contentCache.get(cacheKey);
  if (cachedResult && (Date.now() - cachedResult.timestamp) < CACHE_TTL) {
    console.log('Using cached image moderation result');
    return cachedResult.data;
  }

  // TODO: Implement image moderation with multiple providers
  // Hiện tại chỉ sử dụng OpenAI
  try {
    const response = await openai.images.analyze({
      image: imageUrl,
      model: "gpt-4-vision-preview"
    });

    const results = response.results[0];
    
    const result = {
      isSafe: !results.flagged,
      categories: results.categories,
      confidence: results.category_scores,
      provider: 'openai'
    };

    // Lưu vào cache
    contentCache.set(cacheKey, {
      data: result,
      timestamp: Date.now()
    });

    return result;
  } catch (error) {
    // Nếu có lỗi API, thử lấy từ cache cũ
    if (cachedResult) {
      console.log('Using expired cached image moderation result due to API error');
      return cachedResult.data;
    }
    throw new Error(`Error checking image: ${error.message}`);
  }
};

// Hàm kiểm tra toàn bộ bài post
const moderatePostContent = async (post) => {
  try {
    // Kiểm tra nội dung văn bản
    const textCheck = await checkTextContent(post.content);
    
    // Kiểm tra các hình ảnh nếu có
    let imageChecks = [];
    if (post.imageUrls && post.imageUrls.length > 0) {
      imageChecks = await Promise.all(
        post.imageUrls.map(url => checkImageContent(url))
      );
    }

    // Tổng hợp kết quả
    const isTextSafe = textCheck.isSafe;
    const isImagesSafe = imageChecks.every(check => check.isSafe);
    const flaggedCategories = [
      ...textCheck.flaggedCategories,
      ...imageChecks.flatMap(check => 
        Object.entries(check.categories)
          .filter(([_, value]) => value)
          .map(([key]) => key)
      )
    ];

    return {
      isSafe: isTextSafe && isImagesSafe,
      flaggedCategories: [...new Set(flaggedCategories)],
      textAnalysis: textCheck,
      imageAnalysis: imageChecks,
      provider: textCheck.provider // Thêm thông tin về provider đã sử dụng
    };
  } catch (error) {
    console.error('Error during post moderation:', error.message);
    throw error;
  }
};
const formatModerationPostData = (moderationData) => {
  return {
    isSafe: moderationData.isSafe,
    flaggedCategories: moderationData.flaggedCategories,
    textAnalysis: moderationData.textAnalysis,
    imageAnalysis: moderationData.imageAnalysis,
  };
}
const formatModerationPageData = (moderationData) => {
  return {
    isSafe: moderationData.isSafe,
    flaggedCategories: moderationData.flaggedCategories,
    textAnalysis: moderationData.textAnalysis,
    imageAnalysis: moderationData.imageAnalysis,
  };
}
const formatModerationGroupData = (moderationData) => {
  return {
    isSafe: moderationData.isSafe,
    flaggedCategories: moderationData.flaggedCategories,
    textAnalysis: moderationData.textAnalysis,
    imageAnalysis: moderationData.imageAnalysis,
  };
}
const getListModerationPosts = async (req) => {
  const {
    postId,
    isPaged,
    page = 0,
    size = isPaged === "0" ? Number.MAX_SAFE_INTEGER : 10,
  } = req.query;  
  const offset = parseInt(page, 10) * parseInt(size, 10);
  const limit = parseInt(size, 10);
  const query = {};
  if (postId) {
    query.postId = postId;
  } 
  const [totalElements, posts] = await Promise.all([
    Post.countDocuments(query),
    Post.find(query)
      .skip(offset)
      .limit(limit)
  ]); 
  const totalPages = Math.ceil(totalElements / limit);
  const formattedPosts = await Promise.all(posts.map(post => formatModerationPostData(post)));
  return {
    content: formattedPosts,
    totalPages,
    totalElements,
  };
}
const getListModerationPages = async (req) => {
  const {
    pageId,
    isPaged,
    page = 0,
    size = isPaged === "0" ? Number.MAX_SAFE_INTEGER : 10,
  } = req.query;  
  const offset = parseInt(page, 10) * parseInt(size, 10);
  const limit = parseInt(size, 10);
  const query = {};
  if (pageId) {
    query.pageId = pageId;
  } 
  const [totalElements, pages] = await Promise.all([
    Page.countDocuments(query),
    Page.find(query)
      .skip(offset)
      .limit(limit)
  ]); 
  const totalPages = Math.ceil(totalElements / limit);
  const formattedPages = await Promise.all(pages.map(page => formatModerationPageData(page)));
  return {
    content: formattedPages,
    totalPages,
    totalElements,
  };  
}
const getListModerationGroups = async (req) => {
  const {
    groupId,
    isPaged,
    page = 0,
    size = isPaged === "0" ? Number.MAX_SAFE_INTEGER : 10,
  } = req.query;  
  const offset = parseInt(page, 10) * parseInt(size, 10);
  const limit = parseInt(size, 10);
  const query = {};
  if (groupId) {  
    query.groupId = groupId;
  } 
  const [totalElements, groups] = await Promise.all([
    Group.countDocuments(query),
    Group.find(query)
      .skip(offset)
      .limit(limit)
  ]); 
  const totalPages = Math.ceil(totalElements / limit);
  const formattedGroups = await Promise.all(groups.map(group => formatModerationGroupData(group)));
  return {
    content: formattedGroups,
    totalPages,
    totalElements,
  };
}
export {
  moderatePostContent,
  checkTextContent,
  checkImageContent,
  formatModerationPostData,
  formatModerationPageData,
  formatModerationGroupData,
  getListModerationPosts,
  getListModerationPages,
  getListModerationGroups
}; 