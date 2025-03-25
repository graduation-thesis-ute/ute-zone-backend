import mongoose from "mongoose";
import { schemaOptions } from "../configurations/schemaConfig.js";

const GroupSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    avatarUrl: {
      type: String,
      default: null,
    },
    coverUrl: {
      type: String,
      default: null,
    },
    privacy: {
      type: Number,
      required: true,
      enum: [1, 2], // 1: public, 2: private
      default: 1,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: Number,
      required: true,
      enum: [1, 2], // 1: active, 2: inactive
      default: 1,
    },
  },
  schemaOptions
);

const Group = mongoose.model("Group", GroupSchema);
export default Group;
