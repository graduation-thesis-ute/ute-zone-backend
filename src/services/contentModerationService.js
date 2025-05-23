import OpenAI from 'openai';
import dotenv from 'dotenv';
import { makeErrorResponse } from './apiService.js';
import Post from '../models/postModel.js';
import Page from '../models/pageModel.js';
import Group from '../models/groupModel.js';
dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Hàm kiểm tra nội dung văn bản
const checkTextContent = async (content) => {
  try {
    const response = await openai.moderations.create({
      input: content,
    });

    const results = response.results[0];
    
    // Kiểm tra các category nhạy cảm
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
    };
  } catch (error) {
    throw new Error('Error checking content: ' + error.message);
  }
};

// Hàm kiểm tra hình ảnh (sử dụng URL của hình ảnh)
const checkImageContent = async (imageUrl) => {
  try {
    // Sử dụng API của OpenAI để phân tích hình ảnh
    const response = await openai.images.analyze({
      image: imageUrl,
      model: "gpt-4-vision-preview"
    });

    const results = response.results[0];
    
    return {
      isSafe: !results.flagged,
      categories: results.categories,
      confidence: results.category_scores,
    };
  } catch (error) {
    throw new Error('Error checking image: ' + error.message);
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
    };
  } catch (error) {
    throw new Error('Error moderating post: ' + error.message);
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