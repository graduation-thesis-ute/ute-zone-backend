import mongoose from "mongoose";
import { schemaOptions } from "../configurations/schemaConfig.js";
const groupPostSchema = new mongoose.Schema(
  {
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    imageUrls: [{
      type: String,
    }],
    status: {
      type: Number,
      enum: [1, 2, 3], // 1: pending, 2: approved, 3: rejected 
      default: 1,
    },
    isUpdated: {
      type: Number,
      enum: [0, 1],
      default: 0,
    },
    // New fields for recommendation algorithm
    engagement: {
      viewCount: { type: Number, default: 0 },
      likeCount: { type: Number, default: 0 },
      commentCount: { type: Number, default: 0 },
      averageInteractionTime: { type: Number, default: 0 },
      engagementRate: { type: Number, default: 0 },
      memberReachRate: { type: Number, default: 0 }, // views / total group members
    },
    contentMetadata: {
      tags: [{ type: String }],
      keywords: [{ type: String }],
      topic: { type: String },
      sentiment: { type: Number },
      groupCategory: { type: String },
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

const GroupPost = mongoose.model("GroupPost", groupPostSchema);

export default GroupPost; 