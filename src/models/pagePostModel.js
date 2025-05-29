import mongoose from "mongoose";
import { schemaOptions } from "../configurations/schemaConfig.js";
import { deleteFileByUrl } from "../services/apiService.js";

const PagePostSchema = new mongoose.Schema(
    {
        page:{
            type: mongoose.Schema.Types.ObjectId,
            ref: "Page",
            required: true,
        },
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        content:{
            type: String,
            required: true,
        },
        imageUrls:{
            type: [String], //list image urls
            default: [],
        },
        kind:{
            type: Number,
            enum: [1,2,3], // 1. public, 2. follower, 3.only page member
            default: 1,
        },
        status: {
            type: Number,
            enum: [1, 2, 3], // 1: pending, 2: accepted, 3: rejected
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
            followerReachRate: { type: Number, default: 0 }, // views / total followers
        },
        contentMetadata: {
            tags: [{ type: String }],
            keywords: [{ type: String }],
            topic: { type: String },
            sentiment: { type: Number },
            pageCategory: { type: String },
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
PagePostSchema.pre(
    "deleteOne",
    { document: true, query: false },
    async function (next){
        try {
            for (const imageUrl of this.imageUrls){
                await deleteFileByUrl(imageUrl);
            }
        } catch (error) {
            next(error);
        }
    }
);

const PagePost = mongoose.model("PagePost", PagePostSchema);
export default PagePost;