import mongoose from "mongoose";
import { schemaOptions } from "../configurations/schemaConfig.js";

const PostRecommendationSchema = new mongoose.Schema(
    {
        post: {
            type: mongoose.Schema.Types.ObjectId,
            refPath: 'postModel',
            required: true,
        },
        postModel: {
            type: String,
            enum: ['PagePost', 'GroupPost', 'Post'],
            required: true,
        },
        engagement: {
            viewCount: { type: Number, default: 0 },
            likeCount: { type: Number, default: 0 },
            commentCount: { type: Number, default: 0 },
            averageInteractionTime: { type: Number, default: 0 },
            engagementRate: { type: Number, default: 0 },
            followerReachRate: { type: Number, default: 0 }, // views / total followers
        },
        contentMetadata: {
            tags: [{ type: String }],
            keywords: [{ type: String }],
            topic: { type: String },
            sentiment: { type: Number },
            category: { type: String }, // pageCategory or groupCategory
        },
        recommendationScore: {
            type: Number,
            default: 0,
        },
        lastRecommendedAt: {
            type: Date,
            default: null,
        },
        recommendationHistory: [{
            userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            score: Number,
            timestamp: { type: Date, default: Date.now }
        }]
    },
    schemaOptions
);

// Create compound index for efficient querying
PostRecommendationSchema.index({ post: 1, postModel: 1 }, { unique: true });

const PostRecommendation = mongoose.model("PostRecommendation", PostRecommendationSchema);
export default PostRecommendation; 