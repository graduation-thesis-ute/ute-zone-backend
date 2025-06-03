import mongoose from "mongoose";
import { schemaOptions } from "../configurations/schemaConfig.js";
import { deleteFileByUrl } from "../services/apiService.js";

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
    // Reference to recommendation data
    recommendation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PostRecommendation"
    }
  },
  schemaOptions
);

groupPostSchema.pre(
  "deleteOne",
  { document: true, query: false },
  async function (next) {
    try {
      // Delete associated images
      for (const imageUrl of this.imageUrls) {
        await deleteFileByUrl(imageUrl);
      }
      // Delete associated recommendation data
      if (this.recommendation) {
        await mongoose.model("PostRecommendation").deleteOne({ _id: this.recommendation });
      }
      next();
    } catch (error) {
      next(error);
    }
  }
);

const GroupPost = mongoose.model("GroupPost", groupPostSchema);
export default GroupPost; 