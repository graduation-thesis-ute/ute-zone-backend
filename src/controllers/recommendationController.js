import recommendationService from "../services/recommendationService.js";
import { catchAsync } from "../utils/catchAsync.js";
import Post from "../models/postModel.js";
import PagePost from "../models/pagePostModel.js";
import GroupPost from "../models/groupPostModel.js";

// Lấy danh sách bài viết được gợi ý
export const getRecommendedPosts = catchAsync(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const userId = req.user._id;

  const posts = await recommendationService.getRecommendedPosts(
    userId,
    parseInt(page),
    parseInt(limit)
  );

  res.status(200).json({
    status: "success",
    data: posts,
  });
});

// Cập nhật điểm gợi ý cho một bài viết cụ thể
export const updatePostRecommendationScore = catchAsync(async (req, res) => {
  const { postId, postType } = req.params;
  const userId = req.user._id;

  let post;
  switch (postType) {
    case "post":
      post = await Post.findById(postId);
      break;
    case "pagePost":
      post = await PagePost.findById(postId);
      break;
    case "groupPost":
      post = await GroupPost.findById(postId);
      break;
    default:
      return res.status(400).json({
        status: "error",
        message: "Invalid post type",
      });
  }

  if (!post) {
    return res.status(404).json({
      status: "error",
      message: "Post not found",
    });
  }

  const score = await recommendationService.calculatePostScore(post, userId);
  
  // Cập nhật điểm gợi ý
  await post.updateOne({
    $set: { recommendationScore: score },
    $push: {
      recommendationHistory: {
        userId,
        score,
        timestamp: new Date(),
      },
    },
  });

  res.status(200).json({
    status: "success",
    data: {
      postId,
      score,
    },
  });
});

// Cập nhật điểm gợi ý cho tất cả bài viết
export const updateAllRecommendationScores = catchAsync(async (req, res) => {
  const userId = req.user._id;

  await recommendationService.updateAllRecommendationScores(userId);

  res.status(200).json({
    status: "success",
    message: "All recommendation scores updated successfully",
  });
});

// Cập nhật metadata nội dung cho một bài viết
export const updatePostContentMetadata = catchAsync(async (req, res) => {
  const { postId, postType } = req.params;
  const { tags, keywords, topic, sentiment } = req.body;

  let post;
  switch (postType) {
    case "post":
      post = await Post.findById(postId);
      break;
    case "pagePost":
      post = await PagePost.findById(postId);
      break;
    case "groupPost":
      post = await GroupPost.findById(postId);
      break;
    default:
      return res.status(400).json({
        status: "error",
        message: "Invalid post type",
      });
  }

  if (!post) {
    return res.status(404).json({
      status: "error",
      message: "Post not found",
    });
  }

  // Cập nhật metadata
  post.contentMetadata = {
    ...post.contentMetadata,
    tags: tags || post.contentMetadata.tags,
    keywords: keywords || post.contentMetadata.keywords,
    topic: topic || post.contentMetadata.topic,
    sentiment: sentiment || post.contentMetadata.sentiment,
  };

  await post.save();

  res.status(200).json({
    status: "success",
    data: {
      postId,
      contentMetadata: post.contentMetadata,
    },
  });
}); 