import express from "express";
import {
  getRecommendedPosts,
  updatePostRecommendationScore,
  updateAllRecommendationScores,
  updatePostContentMetadata,
} from "../controllers/recommendationController.js";
import auth from "../middlewares/authentication.js";

const router = express.Router();

// Tất cả các routes đều yêu cầu đăng nhập
router.use(auth());

// Lấy danh sách bài viết được gợi ý
router.get("/posts", getRecommendedPosts);

// Cập nhật điểm gợi ý cho một bài viết cụ thể
router.patch("/posts/:postType/:postId/score", updatePostRecommendationScore);

// Cập nhật điểm gợi ý cho tất cả bài viết
router.patch("/posts/update-all-scores", updateAllRecommendationScores);

// Cập nhật metadata nội dung cho một bài viết
router.patch("/posts/:postType/:postId/metadata", updatePostContentMetadata);

export default router; 