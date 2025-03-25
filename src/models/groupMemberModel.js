import mongoose from "mongoose";
import { schemaOptions } from "../configurations/schemaConfig.js";

const GroupMemberSchema = new mongoose.Schema(
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
    role: {
      type: Number,
      required: true,
      enum: [1, 2], // 1: admin, 2: member
      default: 2,
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

const GroupMember = mongoose.model("GroupMember", GroupMemberSchema);

export default GroupMember;

